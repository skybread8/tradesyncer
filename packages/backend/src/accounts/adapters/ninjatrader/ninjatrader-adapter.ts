import { Injectable, Logger } from "@nestjs/common";
import { TradingFirm, Platform, TradeSide, TradeType } from "@prisma/client";
import {
  ITradingAdapter,
  ConnectionConfig,
  TradeOrder,
  TradeExecution,
  AccountInfo,
  Position,
} from "../trading-adapter.interface";
import WebSocket from "ws";
import axios, { AxiosInstance, AxiosError } from "axios";
import { ApiDiscoveryService } from "../rithmic/api-discovery.service";

/**
 * NinjaTrader Adapter
 * 
 * NinjaTrader is a trading platform used by some prop firms.
 * This adapter connects to NinjaTrader API/WebSocket.
 * 
 * Based on research:
 * - NinjaTrader has REST API and WebSocket capabilities
 * - Authentication: API Key/Secret or OAuth
 * - WebSocket for real-time updates
 * 
 * Note: NinjaTrader API documentation may require specific licensing
 */
@Injectable()
export class NinjaTraderAdapter implements ITradingAdapter {
  private readonly logger = new Logger("NinjaTraderAdapter");
  private connected = false;
  private config: ConnectionConfig | null = null;
  private firm: TradingFirm;
  private ws: WebSocket | null = null;
  private httpClient: AxiosInstance;
  private tradeCallbacks: Array<(execution: TradeExecution) => void> = [];
  private positionCallbacks: Array<(position: Position) => void> = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private authToken: string | null = null;
  protected pollingInterval: NodeJS.Timeout | null = null;

  // NinjaTrader real API URLs
  protected readonly NINJATRADER_API_BASE = process.env.NINJATRADER_API_URL || "https://brokerage.ninjatrader.com";
  protected readonly NINJATRADER_WS_URL = process.env.NINJATRADER_WS_URL || "wss://brokerage.ninjatrader.com/websocket";

  protected apiDiscovery: ApiDiscoveryService;

  constructor(firm: TradingFirm) {
    this.firm = firm;
    this.apiDiscovery = new ApiDiscoveryService();
    this.httpClient = axios.create({
      baseURL: this.NINJATRADER_API_BASE,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  getFirm(): TradingFirm {
    return this.firm;
  }

  getPlatform(): Platform {
    return Platform.NINJATRADER;
  }

  /**
   * Connect to NinjaTrader platform
   */
  async connect(config: ConnectionConfig): Promise<void> {
    try {
      this.logger.log(`Connecting to NinjaTrader for ${this.firm}...`);
      this.config = config;

      // If API discovery is enabled, try to discover endpoints
      if (process.env.ENABLE_API_DISCOVERY === "true") {
        this.logger.log("Attempting API discovery for NinjaTrader...");
        const discovery = await this.apiDiscovery.discoverApiConfig(
          config.accountNumber || "",
          config.email,
          config.password,
          config.apiKey,
          config.apiSecret,
          this.getDiscoveryUrls()
        );

        if (discovery.baseUrl) {
          this.logger.log(`Discovered API base URL: ${discovery.baseUrl}`);
          this.httpClient.defaults.baseURL = discovery.baseUrl;
        }
      }

      // Step 1: Authenticate
      const authResponse = await this.authenticate(config);
      this.authToken = authResponse.token || authResponse.accessToken || authResponse.sessionId;

      // Step 2: Connect WebSocket
      if (this.authToken) {
        await this.connectWebSocket(this.authToken);
      } else {
        this.logger.warn("No token received, skipping WebSocket connection. Will use polling instead.");
        this.startTradePolling();
      }

      this.connected = true;
      this.reconnectAttempts = 0;
      this.logger.log(`Successfully connected to NinjaTrader (${this.firm})`);
    } catch (error: any) {
      this.logger.error(`Failed to connect to NinjaTrader:`, {
        message: error.message,
        stack: error.stack,
        response: error.response?.data,
      });
      this.connected = false;
      throw new Error(`Connection failed: ${error.message}`);
    }
  }

  /**
   * Get discovery URLs for NinjaTrader
   * Real URLs for NinjaTrader Brokerage and API
   */
  protected getDiscoveryUrls(): string[] {
    return [
      // NinjaTrader Brokerage (most common)
      "https://brokerage.ninjatrader.com",
      "https://brokerage.ninjatrader.com/api",
      "https://brokerage.ninjatrader.com/v1",
      "https://brokerage.ninjatrader.com/v1/api",
      // NinjaTrader API (alternative)
      "https://api.ninjatrader.com",
      "https://api.ninjatrader.com/v1",
      "https://api.ninjatrader.com/api",
      // NinjaTrader main site API
      "https://ninjatrader.com/api",
      "https://ninjatrader.com/api/v1",
    ];
  }

  /**
   * Authenticate with NinjaTrader API
   * NinjaTrader typically uses API Key/Secret or OAuth
   * Real endpoints for NinjaTrader Brokerage
   */
  private async authenticate(config: ConnectionConfig): Promise<any> {
    const authEndpoints = [
      // OAuth endpoints (most common for NinjaTrader)
      "/oauth/token",
      "/api/oauth/token",
      "/v1/oauth/token",
      "/api/v1/oauth/token",
      // Standard auth endpoints
      "/auth/login",
      "/api/auth/login",
      "/v1/auth/login",
      "/api/v1/auth/login",
      // Alternative endpoints
      "/login",
      "/api/login",
      "/v1/login",
      "/authenticate",
      "/api/authenticate",
    ];

    // Try API Key/Secret first (most common for NinjaTrader)
    if (config.apiKey && config.apiSecret) {
      for (const endpoint of authEndpoints) {
        try {
          this.logger.log(`Trying API key auth at ${endpoint}...`);
          
          const authPayload: any = {
            grant_type: "client_credentials",
            client_id: config.apiKey,
            client_secret: config.apiSecret,
          };

          const response = await this.httpClient.post(endpoint, authPayload, {
            validateStatus: (status) => status < 500,
          });

          if (response.status === 200 || response.status === 201) {
            this.logger.log(`✅ API key authentication successful at ${endpoint}`);
            return response.data;
          }
        } catch (error: any) {
          this.logger.debug(`Error at ${endpoint}: ${error.message}`);
          continue;
        }
      }
    }

    // Try email/password as fallback
    if (config.email && config.password) {
      for (const endpoint of authEndpoints) {
        try {
          this.logger.log(`Trying email/password auth at ${endpoint}...`);
          
          const authPayload: any = {
            email: config.email,
            password: config.password,
            grant_type: "password",
          };

          const response = await this.httpClient.post(endpoint, authPayload, {
            validateStatus: (status) => status < 500,
          });

          if (response.status === 200 || response.status === 201) {
            this.logger.log(`✅ Email/password authentication successful at ${endpoint}`);
            return response.data;
          }
        } catch (error: any) {
          continue;
        }
      }
    }

    throw new Error("Authentication failed: No valid credentials provided");
  }

  /**
   * Connect to NinjaTrader WebSocket
   */
  private async connectWebSocket(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = `${this.NINJATRADER_WS_URL}?token=${token}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.on("open", () => {
          this.logger.log("WebSocket connected to NinjaTrader");
          this.subscribeToUpdates();
          resolve();
        });

        this.ws.on("message", (data: WebSocket.Data) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleWebSocketMessage(message);
          } catch (error) {
            this.logger.error("Error parsing WebSocket message:", error);
          }
        });

        this.ws.on("error", (error) => {
          this.logger.error("WebSocket error:", error);
          reject(error);
        });

        this.ws.on("close", () => {
          this.logger.warn("WebSocket closed");
          this.connected = false;
          this.attemptReconnect();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private subscribeToUpdates(): void {
    if (!this.ws || !this.config) return;

    // NinjaTrader WebSocket subscription format
    this.ws.send(JSON.stringify({
      action: "subscribe",
      accountId: this.config.accountNumber,
      channels: ["trades", "positions", "account"],
    }));
  }

  private handleWebSocketMessage(message: any): void {
    if (message.type === "trade" || message.event === "trade") {
      const execution: TradeExecution = {
        orderId: message.orderId || message.id,
        tradeId: message.tradeId || message.id,
        symbol: message.symbol,
        side: this.normalizeSide(message.side),
        quantity: message.quantity || message.size,
        price: message.price,
        executedAt: new Date(message.executedAt || message.timestamp),
        status: this.normalizeStatus(message.status),
      };
      this.tradeCallbacks.forEach((callback) => callback(execution));
    }

    if (message.type === "position" || message.event === "position") {
      const position: Position = {
        symbol: message.symbol,
        side: this.normalizeSide(message.side),
        quantity: message.quantity || message.size,
        entryPrice: message.entryPrice || message.price,
        unrealizedPnL: message.unrealizedPnL || message.pnl || 0,
      };
      this.positionCallbacks.forEach((callback) => callback(position));
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error("Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    this.logger.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectInterval = setTimeout(async () => {
      if (this.authToken) {
        try {
          await this.connectWebSocket(this.authToken);
          this.reconnectAttempts = 0;
        } catch (error) {
          this.attemptReconnect();
        }
      }
    }, delay);
  }

  private startTradePolling(intervalMs: number = 5000): void {
    if (this.pollingInterval) return;

    this.logger.log(`Starting trade polling (interval: ${intervalMs}ms)`);
    this.pollingInterval = setInterval(async () => {
      try {
        const trades = await this.fetchTrades();
        for (const trade of trades) {
          this.tradeCallbacks.forEach((callback) => callback(trade));
        }
      } catch (error) {
        this.logger.error(`Error polling trades:`, error);
      }
    }, intervalMs);
  }

  private stopTradePolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  async disconnect(): Promise<void> {
    this.logger.log(`Disconnecting from NinjaTrader...`);
    this.stopTradePolling();
    
    if (this.reconnectInterval) {
      clearTimeout(this.reconnectInterval);
      this.reconnectInterval = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.connected = false;
    this.config = null;
    this.authToken = null;
    this.unsubscribe();
  }

  isConnected(): boolean {
    return this.connected;
  }

  async placeOrder(order: TradeOrder): Promise<TradeExecution> {
    if (!this.connected) throw new Error("Not connected");
    
    try {
      // Try multiple endpoints for placing orders
      const orderEndpoints = [
        "/api/order/place",
        "/api/v1/order/place",
        "/v1/order/place",
        "/order/place",
        "/api/orders",
        "/api/v1/orders",
      ];

      const orderPayload = {
        accountId: this.config?.accountNumber,
        instrument: order.symbol,
        quantity: order.quantity,
        orderType: order.type,
        side: order.side,
        price: order.price,
        stopLoss: order.stopLoss,
        takeProfit: order.takeProfit,
      };

      for (const endpoint of orderEndpoints) {
        try {
          const response = await this.httpClient.post(endpoint, orderPayload, {
            validateStatus: (status) => status < 500,
          });

          if (response.status === 200 || response.status === 201) {
            return this.normalizeTradeExecution(response.data);
          }
        } catch (error: any) {
          continue;
        }
      }

      throw new Error("Failed to place order: All endpoints failed");
    } catch (error) {
      this.logger.error(`Failed to place order:`, error);
      throw error;
    }
  }

  async cancelOrder(orderId: string): Promise<void> {
    if (!this.connected) throw new Error("Not connected");
    
    try {
      await this.httpClient.post(`/api/order/cancel`, { orderId });
    } catch (error) {
      this.logger.error(`Failed to cancel order:`, error);
      throw error;
    }
  }

  async modifyOrder(orderId: string, updates: Partial<TradeOrder>): Promise<TradeExecution> {
    if (!this.connected) throw new Error("Not connected");
    
    try {
      const response = await this.httpClient.post(`/api/order/modify`, {
        orderId,
        ...updates,
      });
      return this.normalizeTradeExecution(response.data);
    } catch (error) {
      this.logger.error(`Failed to modify order:`, error);
      throw error;
    }
  }

  async closePosition(symbol: string, side?: TradeSide): Promise<TradeExecution> {
    if (!this.connected) throw new Error("Not connected");
    
    try {
      const response = await this.httpClient.post(`/api/position/close`, {
        accountId: this.config?.accountNumber,
        symbol,
        side,
      });
      return this.normalizeTradeExecution(response.data);
    } catch (error) {
      this.logger.error(`Failed to close position:`, error);
      throw error;
    }
  }

  async getAccountInfo(): Promise<AccountInfo> {
    if (!this.connected) throw new Error("Not connected");
    return await this.fetchAccountInfo();
  }

  async getAllAccounts(): Promise<AccountInfo[]> {
    if (!this.connected) throw new Error("Not connected");
    
    try {
      // Try multiple endpoints for fetching all accounts
      const accountEndpoints = [
        "/api/account/list",
        "/api/v1/account/list",
        "/v1/account/list",
        "/api/accounts",
        "/api/v1/accounts",
        "/v1/accounts",
        "/account/list",
        "/accounts",
      ];

      for (const endpoint of accountEndpoints) {
        try {
          const response = await this.httpClient.get(endpoint, {
            validateStatus: (status) => status < 500,
          });

          if (response.status === 200 && response.data) {
            const accounts = Array.isArray(response.data)
              ? response.data
              : response.data.accounts || response.data.data || [];

            if (accounts.length > 0) {
              return accounts.map((acc: any) => ({
                accountId: acc.id || acc.accountId || acc.accountNumber,
                balance: acc.balance || acc.accountBalance || 0,
                equity: acc.equity || acc.balance || 0,
                marginUsed: acc.marginUsed || 0,
                positions: [],
              }));
            }
          }
        } catch (error: any) {
          continue;
        }
      }

      // Fallback: return current account only
      this.logger.warn("Could not fetch all accounts, returning current account only");
      const currentAccount = await this.getAccountInfo();
      return [currentAccount];
    } catch (error) {
      this.logger.error(`Failed to fetch all accounts:`, error);
      const currentAccount = await this.getAccountInfo();
      return [currentAccount];
    }
  }

  onTradeUpdate(callback: (execution: TradeExecution) => void): () => void {
    this.tradeCallbacks.push(callback);
    return () => {
      const index = this.tradeCallbacks.indexOf(callback);
      if (index > -1) this.tradeCallbacks.splice(index, 1);
    };
  }

  onPositionUpdate(callback: (position: Position) => void): () => void {
    this.positionCallbacks.push(callback);
    return () => {
      const index = this.positionCallbacks.indexOf(callback);
      if (index > -1) this.positionCallbacks.splice(index, 1);
    };
  }

  unsubscribe(): void {
    this.tradeCallbacks = [];
    this.positionCallbacks = [];
  }

  protected async fetchTrades(): Promise<TradeExecution[]> {
    try {
      // Try multiple endpoints for fetching trades
      const tradeEndpoints = [
        "/api/trade/list",
        "/api/v1/trade/list",
        "/v1/trade/list",
        "/api/trades",
        "/api/v1/trades",
        "/v1/trades",
        "/trade/list",
        "/trades",
      ];

      for (const endpoint of tradeEndpoints) {
        try {
          const response = await this.httpClient.get(endpoint, {
            params: { accountId: this.config?.accountNumber },
            validateStatus: (status) => status < 500,
          });

          if (response.status === 200 && response.data) {
            const trades = Array.isArray(response.data)
              ? response.data
              : response.data.trades || response.data.data || [];
            return trades.map((trade: any) => this.normalizeTradeExecution(trade));
          }
        } catch (error: any) {
          continue;
        }
      }

      return [];
    } catch (error) {
      this.logger.error(`Failed to fetch trades:`, error);
      return [];
    }
  }

  protected async fetchPositions(): Promise<Position[]> {
    try {
      // Try multiple endpoints for fetching positions
      const positionEndpoints = [
        "/api/position/list",
        "/api/v1/position/list",
        "/v1/position/list",
        "/api/positions",
        "/api/v1/positions",
        "/v1/positions",
        "/position/list",
        "/positions",
      ];

      for (const endpoint of positionEndpoints) {
        try {
          const response = await this.httpClient.get(endpoint, {
            params: { accountId: this.config?.accountNumber },
            validateStatus: (status) => status < 500,
          });

          if (response.status === 200 && response.data) {
            const positions = Array.isArray(response.data)
              ? response.data
              : response.data.positions || response.data.data || [];
            return positions.map((pos: any) => ({
              symbol: pos.symbol || pos.instrument,
              side: this.normalizeSide(pos.side),
              quantity: pos.quantity || pos.size,
              entryPrice: pos.entryPrice || pos.price,
              unrealizedPnL: pos.unrealizedPnL || pos.pnl || 0,
            }));
          }
        } catch (error: any) {
          continue;
        }
      }

      return [];
    } catch (error) {
      this.logger.error(`Failed to fetch positions:`, error);
      return [];
    }
  }

  protected async fetchAccountInfo(): Promise<AccountInfo> {
    try {
      const accountNumber = this.config?.accountNumber || "";
      
      // Try multiple endpoints for fetching account info
      const accountEndpoints = [
        `/api/account/get`,
        `/api/v1/account/get`,
        `/v1/account/get`,
        `/api/account/${accountNumber}`,
        `/api/v1/account/${accountNumber}`,
        `/v1/account/${accountNumber}`,
        `/account/get`,
        `/account/${accountNumber}`,
      ];

      for (const endpoint of accountEndpoints) {
        try {
          const response = await this.httpClient.get(endpoint, {
            params: endpoint.includes(accountNumber) ? {} : { accountId: accountNumber },
            validateStatus: (status) => status < 500,
          });

          if (response.status === 200 && response.data) {
            const data = response.data;
            const positions = await this.fetchPositions();
            return {
              accountId: data.id || data.accountId || this.config?.accountNumber || "",
              balance: data.balance || data.accountBalance || 0,
              equity: data.equity || data.balance || 0,
              marginUsed: data.marginUsed || 0,
              positions,
            };
          }
        } catch (error: any) {
          continue;
        }
      }

      throw new Error("Failed to fetch account info: All endpoints failed");
    } catch (error) {
      this.logger.error(`Failed to fetch account info:`, error);
      throw error;
    }
  }

  protected normalizeTradeExecution(trade: any): TradeExecution {
    return {
      orderId: trade.orderId || trade.id,
      tradeId: trade.tradeId || trade.executionId || trade.id,
      symbol: trade.symbol || trade.instrument,
      side: this.normalizeSide(trade.side),
      quantity: trade.quantity || trade.size || trade.orderQty,
      price: trade.price || trade.fillPrice,
      executedAt: new Date(trade.executedAt || trade.timestamp || trade.time),
      status: this.normalizeStatus(trade.status),
    };
  }

  protected normalizeSide(side: string): TradeSide {
    const upper = side.toUpperCase();
    if (upper === "BUY" || upper === "LONG") return TradeSide.BUY;
    if (upper === "SELL" || upper === "SHORT") return TradeSide.SELL;
    return TradeSide.BUY;
  }

  protected normalizeStatus(status: string): "filled" | "partially_filled" | "pending" | "cancelled" | "rejected" {
    const upper = status.toUpperCase();
    if (upper === "FILLED" || upper === "EXECUTED") return "filled";
    if (upper === "PARTIAL" || upper === "PARTIALLY_FILLED") return "partially_filled";
    if (upper === "PENDING" || upper === "NEW") return "pending";
    if (upper === "CANCELLED" || upper === "CANCELED") return "cancelled";
    if (upper === "REJECTED") return "rejected";
    return "pending";
  }
}
