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
 * Tradovate Adapter
 * 
 * Tradovate is a trading platform used by some prop firms.
 * This adapter connects to Tradovate API/WebSocket.
 * 
 * Based on research:
 * - Tradovate has a REST API and WebSocket API
 * - Authentication: Email/Password or API Key
 * - WebSocket for real-time updates
 * 
 * API Documentation: https://api.tradovate.com/
 */
@Injectable()
export class TradovateAdapter implements ITradingAdapter {
  private readonly logger = new Logger("TradovateAdapter");
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
  private pollingInterval: NodeJS.Timeout | null = null;
  private authToken: string | null = null;

  // Tradovate API URLs
  protected readonly TRADOVATE_API_BASE = process.env.TRADOVATE_API_URL || "https://api.tradovate.com";
  protected readonly TRADOVATE_WS_URL = process.env.TRADOVATE_WS_URL || "wss://api.tradovate.com/v1/websocket";

  protected apiDiscovery: ApiDiscoveryService;

  constructor(firm: TradingFirm) {
    this.firm = firm;
    this.apiDiscovery = new ApiDiscoveryService();
    this.httpClient = axios.create({
      baseURL: this.TRADOVATE_API_BASE,
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
    return Platform.TRADOVATE;
  }

  /**
   * Connect to Tradovate platform
   */
  async connect(config: ConnectionConfig): Promise<void> {
    try {
      this.logger.log(`Connecting to Tradovate for ${this.firm}...`);
      this.config = config;

      // If API discovery is enabled, try to discover endpoints
      if (process.env.ENABLE_API_DISCOVERY === "true") {
        this.logger.log("Attempting API discovery for Tradovate...");
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
      this.logger.log(`Successfully connected to Tradovate (${this.firm})`);
    } catch (error: any) {
      this.logger.error(`Failed to connect to Tradovate:`, {
        message: error.message,
        stack: error.stack,
        response: error.response?.data,
      });
      this.connected = false;
      throw new Error(`Connection failed: ${error.message}`);
    }
  }

  /**
   * Get discovery URLs for Tradovate
   */
  protected getDiscoveryUrls(): string[] {
    return [
      "https://api.tradovate.com",
      "https://api.tradovate.com/v1",
      "https://demo.tradovate.com/api",
      "https://live.tradovate.com/api",
    ];
  }

  /**
   * Authenticate with Tradovate API
   * Tradovate typically uses: POST /v1/account/authenticate
   */
  private async authenticate(config: ConnectionConfig): Promise<any> {
    const authEndpoints = [
      "/v1/account/authenticate",
      "/api/v1/account/authenticate",
      "/account/authenticate",
      "/auth/login",
      "/api/auth/login",
      "/login",
    ];

    // Tradovate accepts username/name OR email for authentication
    // The "name" field can be either email or username
    const usernameOrEmail = config.email || config.accountNumber || (config.config?.username as string);
    
    if (usernameOrEmail && config.password) {
      for (const endpoint of authEndpoints) {
        try {
          this.logger.log(`Trying username/email authentication at ${endpoint}...`);
          this.logger.log(`Using identifier: ${usernameOrEmail} (${config.email ? 'email' : config.accountNumber ? 'accountNumber' : 'username'})`);
          
          const authPayload: any = {
            name: usernameOrEmail, // Tradovate uses "name" field which can be email OR username
            password: config.password,
          };

          // Add account number if provided (separate from name)
          if (config.accountNumber && config.accountNumber !== usernameOrEmail) {
            authPayload.accountId = config.accountNumber;
          }

          const response = await this.httpClient.post(endpoint, authPayload, {
            validateStatus: (status) => status < 500,
          });

          if (response.status === 200 || response.status === 201) {
            this.logger.log(`✅ Username/email authentication successful at ${endpoint}`);
            return response.data;
          }
        } catch (error: any) {
          this.logger.debug(`Error at ${endpoint}: ${error.message}`);
          continue;
        }
      }
    }

    throw new Error("Authentication failed: No valid credentials provided");
  }

  /**
   * Connect to Tradovate WebSocket
   */
  private async connectWebSocket(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = `${this.TRADOVATE_WS_URL}?token=${token}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.on("open", () => {
          this.logger.log("WebSocket connected to Tradovate");
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

    // Tradovate WebSocket subscription format
    this.ws.send(JSON.stringify({
      m: 0, // Message type: subscribe
      i: 1, // Request ID
      n: "subscribe",
      o: JSON.stringify({
        accountId: this.config.accountNumber,
        channels: ["trades", "positions", "account"],
      }),
    }));
  }

  private handleWebSocketMessage(message: any): void {
    // Handle Tradovate WebSocket message format
    if (message.data) {
      const data = typeof message.data === "string" ? JSON.parse(message.data) : message.data;
      
      if (data.trade || data.execution) {
        const trade = data.trade || data.execution;
        const execution: TradeExecution = {
          orderId: trade.orderId || trade.id,
          tradeId: trade.tradeId || trade.id,
          symbol: trade.symbol,
          side: this.normalizeSide(trade.side),
          quantity: trade.quantity || trade.size,
          price: trade.price,
          executedAt: new Date(trade.executedAt || trade.timestamp),
          status: this.normalizeStatus(trade.status),
        };
        this.tradeCallbacks.forEach((callback) => callback(execution));
      }

      if (data.position) {
        const pos = data.position;
        const position: Position = {
          symbol: pos.symbol,
          side: this.normalizeSide(pos.side),
          quantity: pos.quantity || pos.size,
          entryPrice: pos.entryPrice || pos.price,
          unrealizedPnL: pos.unrealizedPnL || pos.pnl || 0,
        };
        this.positionCallbacks.forEach((callback) => callback(position));
      }
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
    this.logger.log(`Disconnecting from Tradovate...`);
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
      const response = await this.httpClient.post(
        `/v1/order/placeOrder`,
        {
          accountId: this.config?.accountNumber,
          symbol: order.symbol,
          orderQty: order.quantity,
          orderType: order.type,
          side: order.side,
          price: order.price,
          stopPrice: order.stopLoss,
        }
      );
      return this.normalizeTradeExecution(response.data);
    } catch (error) {
      this.logger.error(`Failed to place order:`, error);
      throw error;
    }
  }

  async cancelOrder(orderId: string): Promise<void> {
    if (!this.connected) throw new Error("Not connected");
    
    try {
      await this.httpClient.post(`/v1/order/cancelOrder`, { orderId });
    } catch (error) {
      this.logger.error(`Failed to cancel order:`, error);
      throw error;
    }
  }

  async modifyOrder(orderId: string, updates: Partial<TradeOrder>): Promise<TradeExecution> {
    if (!this.connected) throw new Error("Not connected");
    
    try {
      const response = await this.httpClient.post(`/v1/order/modifyOrder`, {
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
      const response = await this.httpClient.post(`/v1/position/flatten`, {
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
      const response = await this.httpClient.get("/v1/account/listAccounts");
      const accounts = response.data || [];
      return accounts.map((acc: any) => ({
        accountId: acc.id || acc.accountId,
        balance: acc.balance || 0,
        equity: acc.equity || acc.balance || 0,
        marginUsed: acc.marginUsed || 0,
        positions: [],
      }));
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
      const response = await this.httpClient.get(`/v1/execution/find`, {
        params: { accountId: this.config?.accountNumber },
      });
      const trades = response.data || [];
      return trades.map((trade: any) => this.normalizeTradeExecution(trade));
    } catch (error) {
      this.logger.error(`Failed to fetch trades:`, error);
      return [];
    }
  }

  protected async fetchPositions(): Promise<Position[]> {
    try {
      const response = await this.httpClient.get(`/v1/position/find`, {
        params: { accountId: this.config?.accountNumber },
      });
      const positions = response.data || [];
      return positions.map((pos: any) => ({
        symbol: pos.symbol,
        side: this.normalizeSide(pos.side),
        quantity: pos.quantity || pos.size,
        entryPrice: pos.entryPrice || pos.price,
        unrealizedPnL: pos.unrealizedPnL || pos.pnl || 0,
      }));
    } catch (error) {
      this.logger.error(`Failed to fetch positions:`, error);
      return [];
    }
  }

  protected async fetchAccountInfo(): Promise<AccountInfo> {
    try {
      const response = await this.httpClient.get(`/v1/account/item`, {
        params: { id: this.config?.accountNumber },
      });
      const data = response.data;
      const positions = await this.fetchPositions();
      return {
        accountId: data.id || this.config?.accountNumber || "",
        balance: data.balance || 0,
        equity: data.equity || data.balance || 0,
        marginUsed: data.marginUsed || 0,
        positions,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch account info:`, error);
      throw error;
    }
  }

  protected normalizeTradeExecution(trade: any): TradeExecution {
    return {
      orderId: trade.orderId || trade.id,
      tradeId: trade.tradeId || trade.executionId || trade.id,
      symbol: trade.symbol,
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
