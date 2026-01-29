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
import axios, { AxiosInstance } from "axios";
import { ApiDiscoveryService } from "./api-discovery.service";

/**
 * Rithmic Adapter
 * 
 * Rithmic is the common platform used by:
 * - TopStepX
 * - TakeProfitTrader
 * - Alpha Futures
 * - MyFundedFutures
 * 
 * This adapter connects to Rithmic API/WebSocket to:
 * - Listen to trades in real-time
 * - Execute trades
 * - Get account information
 * - Monitor positions
 */
@Injectable()
export class RithmicAdapter implements ITradingAdapter {
  private readonly logger = new Logger("RithmicAdapter");
  private connected = false;
  private config: ConnectionConfig | null = null;
  private firm: TradingFirm;
  private ws: WebSocket | null = null;
  protected httpClient: AxiosInstance;
  private tradeCallbacks: Array<(execution: TradeExecution) => void> = [];
  private positionCallbacks: Array<(position: Position) => void> = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;

  // Rithmic real API URLs
  protected readonly RITHMIC_API_BASE = process.env.RITHMIC_API_URL || "https://api.rithmic.com";
  protected readonly RITHMIC_WS_URL = process.env.RITHMIC_WS_URL || "wss://api.rithmic.com/ws";

  protected apiDiscovery: ApiDiscoveryService;
  
  /**
   * Override this method in subclasses to provide firm-specific API URLs for discovery
   */
  protected getDiscoveryUrls?(): string[];

  constructor(firm: TradingFirm) {
    this.firm = firm;
    this.apiDiscovery = new ApiDiscoveryService();
    this.httpClient = axios.create({
      baseURL: this.RITHMIC_API_BASE,
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
    return Platform.RITHMIC;
  }

  /**
   * Connect to Rithmic platform
   * 
   * Rithmic typically requires:
   * - Username (account number or API key)
   * - Password (API secret)
   * - Environment (demo/live)
   * 
   * If API discovery is enabled, it will try to find the correct endpoints automatically
   */
  async connect(config: ConnectionConfig): Promise<void> {
    try {
      this.logger.log(`Connecting to Rithmic for ${this.firm} account ${config.accountNumber}...`);
      this.config = config;

      // If API discovery is enabled and no base URL is set, try to discover it
      if (process.env.ENABLE_API_DISCOVERY === "true" && !this.RITHMIC_API_BASE.includes("api.")) {
        this.logger.log("Attempting API discovery...");
        
        // Get firm-specific URLs if available
        const firmSpecificUrls = (this.getDiscoveryUrls && typeof this.getDiscoveryUrls === 'function') 
          ? this.getDiscoveryUrls() 
          : [];
        const allUrls = [...firmSpecificUrls, ...(config.config?.apiUrls || [])];
        
        const discovery = await this.apiDiscovery.discoverApiConfig(
          config.accountNumber,
          config.email,
          config.password,
          config.apiKey,
          config.apiSecret,
          allUrls
        );

        if (discovery.baseUrl) {
          this.logger.log(`Discovered API base URL: ${discovery.baseUrl}`);
          // Update HTTP client base URL
          this.httpClient.defaults.baseURL = discovery.baseUrl;
        }
      }

      // Step 1: Authenticate via REST API to get session token
      const authResponse = await this.authenticate(config);
      
      // Step 2: Connect WebSocket for real-time updates (if token available)
      if (authResponse.token || authResponse.sessionId) {
        await this.connectWebSocket(authResponse.token || authResponse.sessionId);
      } else {
        this.logger.warn("No token received, skipping WebSocket connection. Will use polling instead.");
        this.startTradePolling();
      }

      this.connected = true;
      this.reconnectAttempts = 0;
      this.logger.log(`Successfully connected to Rithmic (${this.firm})`);
    } catch (error: any) {
      this.logger.error(`Failed to connect to Rithmic:`, {
        message: error.message,
        stack: error.stack,
        response: error.response?.data,
      });
      this.connected = false;
      throw new Error(`Connection failed: ${error.message}`);
    }
  }

  /**
   * Authenticate with Rithmic API
   * 
   * Supports multiple authentication methods:
   * 1. Email/Password (primary - most common)
   * 2. API Key/Secret (alternative)
   * 3. Username/Password (fallback)
   * 
   * NOTE: The actual authentication method may vary by firm.
   * This will try different methods automatically.
   */
  private async authenticate(config: ConnectionConfig): Promise<any> {
    const authEndpoints = [
      "/auth/login",
      "/api/auth/login",
      "/v1/auth/login",
      "/login",
      "/api/login",
      "/authenticate",
      "/api/authenticate",
    ];

    // Try email/password authentication first (most common)
    if (config.email && config.password) {
      for (const endpoint of authEndpoints) {
        try {
          this.logger.log(`Trying email/password auth at ${endpoint}...`);
          
          const authPayload: any = {
            email: config.email,
            password: config.password,
            accountNumber: config.accountNumber,
          };

          // Add environment if specified
          if (config.config?.environment) {
            authPayload.environment = config.config.environment;
          }

          const response = await this.httpClient.post(endpoint, authPayload, {
            validateStatus: (status) => status < 500, // Don't throw on 4xx
          });

          if (response.status === 200 || response.status === 201) {
            this.logger.log(`✅ Email/password authentication successful at ${endpoint}`);
            return response.data;
          }

          // If 401/403, try next endpoint
          if (response.status === 401 || response.status === 403) {
            this.logger.debug(`Auth failed at ${endpoint}: ${response.status}`);
            continue;
          }
        } catch (error: any) {
          // Continue to next endpoint
          this.logger.debug(`Error at ${endpoint}: ${error.message}`);
          continue;
        }
      }
    }

    // Try API Key/Secret authentication (alternative)
    if (config.apiKey && config.apiSecret) {
      for (const endpoint of authEndpoints) {
        try {
          this.logger.log(`Trying API key auth at ${endpoint}...`);
          
          const authPayload: any = {
            apiKey: config.apiKey,
            apiSecret: config.apiSecret,
            accountNumber: config.accountNumber,
          };

          if (config.config?.environment) {
            authPayload.environment = config.config.environment;
          }

          const response = await this.httpClient.post(endpoint, authPayload, {
            validateStatus: (status) => status < 500,
          });

          if (response.status === 200 || response.status === 201) {
            this.logger.log(`✅ API key authentication successful at ${endpoint}`);
            return response.data;
          }
        } catch (error: any) {
          continue;
        }
      }
    }

    // Try username/password as fallback (using accountNumber as username)
    if (config.password) {
      for (const endpoint of authEndpoints) {
        try {
          this.logger.log(`Trying username/password auth at ${endpoint}...`);
          
          const authPayload: any = {
            username: config.accountNumber,
            password: config.password,
          };

          if (config.config?.environment) {
            authPayload.environment = config.config.environment;
          }

          const response = await this.httpClient.post(endpoint, authPayload, {
            validateStatus: (status) => status < 500,
          });

          if (response.status === 200 || response.status === 201) {
            this.logger.log(`✅ Username/password authentication successful at ${endpoint}`);
            return response.data;
          }
        } catch (error: any) {
          continue;
        }
      }
    }

    // If all methods failed, throw error
    const errorMessage = "Authentication failed: No valid credentials provided or all authentication methods failed";
    this.logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  /**
   * Connect to Rithmic WebSocket for real-time updates
   */
  private async connectWebSocket(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(`${this.RITHMIC_WS_URL}?token=${token}`);

        this.ws.on("open", () => {
          this.logger.log("WebSocket connected to Rithmic");
          
          // Subscribe to account updates
          this.subscribeToAccountUpdates();
          
          // Subscribe to trade updates
          this.subscribeToTradeUpdates();
          
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

  /**
   * Subscribe to account updates (balance, equity, etc.)
   */
  private subscribeToAccountUpdates(): void {
    if (!this.ws || !this.config) return;

    this.ws.send(JSON.stringify({
      type: "subscribe",
      channel: "account",
      account: this.config.accountNumber,
    }));
  }

  /**
   * Subscribe to trade updates
   */
  private subscribeToTradeUpdates(): void {
    if (!this.ws || !this.config) return;

    this.ws.send(JSON.stringify({
      type: "subscribe",
      channel: "trades",
      account: this.config.accountNumber,
    }));
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleWebSocketMessage(message: any): void {
    switch (message.type) {
      case "trade":
      case "execution":
        this.handleTradeUpdate(message);
        break;
      case "position":
        this.handlePositionUpdate(message);
        break;
      case "account":
        // Account balance/equity updates
        break;
      case "error":
        this.logger.error("WebSocket error message:", message);
        break;
    }
  }

  /**
   * Handle trade execution updates
   */
  private handleTradeUpdate(message: any): void {
    const execution: TradeExecution = {
      orderId: message.orderId || message.id,
      tradeId: message.tradeId || message.executionId || message.id,
      symbol: message.symbol,
      side: this.normalizeSide(message.side || message.direction),
      quantity: message.quantity || message.size,
      price: message.price || message.fillPrice,
      executedAt: new Date(message.timestamp || message.executedAt || Date.now()),
      status: this.normalizeStatus(message.status),
    };

    this.tradeCallbacks.forEach((callback) => callback(execution));
  }

  /**
   * Handle position updates
   */
  private handlePositionUpdate(message: any): void {
    const position: Position = {
      symbol: message.symbol,
      side: this.normalizeSide(message.side),
      quantity: message.quantity || message.size,
      entryPrice: message.entryPrice || message.avgPrice,
      unrealizedPnL: message.unrealizedPnL || message.pnl || 0,
    };

    this.positionCallbacks.forEach((callback) => callback(position));
  }

  /**
   * Attempt to reconnect WebSocket
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error("Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Exponential backoff, max 30s

    this.logger.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms...`);

    this.reconnectInterval = setTimeout(async () => {
      if (this.config) {
        try {
          const authResponse = await this.authenticate(this.config);
          await this.connectWebSocket(authResponse.token || authResponse.sessionId);
        } catch (error) {
          this.logger.error("Reconnection failed:", error);
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
    this.logger.log(`Disconnecting from Rithmic (${this.firm})...`);
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
    this.unsubscribe();
    this.logger.log("Disconnected from Rithmic");
  }

  isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  async placeOrder(order: TradeOrder): Promise<TradeExecution> {
    if (!this.connected) {
      throw new Error("Not connected to trading platform");
    }

    try {
      this.logger.log(`Placing order: ${order.side} ${order.quantity} ${order.symbol}`);

      // Send order via REST API or WebSocket
      const response = await this.httpClient.post(
        `/accounts/${this.config?.accountNumber}/orders`,
        {
          symbol: order.symbol,
          side: order.side.toLowerCase(),
          type: order.type.toLowerCase(),
          quantity: order.quantity,
          price: order.price,
          stopLoss: order.stopLoss,
          takeProfit: order.takeProfit,
        }
      );

      // The execution will come via WebSocket, but we return the order confirmation
      return this.normalizeTradeExecution(response.data);
    } catch (error: any) {
      this.logger.error(`Failed to place order:`, error);
      throw new Error(`Order failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async cancelOrder(orderId: string): Promise<void> {
    if (!this.connected) {
      throw new Error("Not connected to trading platform");
    }

    try {
      await this.httpClient.delete(
        `/accounts/${this.config?.accountNumber}/orders/${orderId}`
      );
      this.logger.log(`Order ${orderId} cancelled`);
    } catch (error: any) {
      this.logger.error(`Failed to cancel order:`, error);
      throw error;
    }
  }

  async modifyOrder(orderId: string, updates: Partial<TradeOrder>): Promise<TradeExecution> {
    if (!this.connected) {
      throw new Error("Not connected to trading platform");
    }

    try {
      const response = await this.httpClient.patch(
        `/accounts/${this.config?.accountNumber}/orders/${orderId}`,
        updates
      );

      return this.normalizeTradeExecution(response.data);
    } catch (error: any) {
      this.logger.error(`Failed to modify order:`, error);
      throw error;
    }
  }

  async closePosition(symbol: string, side?: TradeSide): Promise<TradeExecution> {
    if (!this.connected) {
      throw new Error("Not connected to trading platform");
    }

    try {
      const response = await this.httpClient.post(
        `/accounts/${this.config?.accountNumber}/positions/${symbol}/close`,
        { side: side?.toLowerCase() }
      );

      return this.normalizeTradeExecution(response.data);
    } catch (error: any) {
      this.logger.error(`Failed to close position:`, error);
      throw error;
    }
  }

  async getAccountInfo(): Promise<AccountInfo> {
    if (!this.connected) {
      throw new Error("Not connected to trading platform");
    }

    try {
      const response = await this.httpClient.get(
        `/accounts/${this.config?.accountNumber}`
      );

      const positionsResponse = await this.httpClient.get(
        `/accounts/${this.config?.accountNumber}/positions`
      );

      return {
        accountId: response.data.accountId || this.config?.accountNumber || "",
        balance: response.data.balance || response.data.accountBalance || 0,
        equity: response.data.equity || response.data.balance || 0,
        marginUsed: response.data.marginUsed || 0,
        positions: (positionsResponse.data.positions || positionsResponse.data || []).map(
          (pos: any) => ({
            symbol: pos.symbol,
            side: this.normalizeSide(pos.side),
            quantity: pos.quantity || pos.size,
            entryPrice: pos.entryPrice || pos.avgPrice,
            unrealizedPnL: pos.unrealizedPnL || pos.pnl || 0,
          })
        ),
      };
    } catch (error: any) {
      this.logger.error(`Failed to fetch account info:`, error);
      throw error;
    }
  }

  onTradeUpdate(callback: (execution: TradeExecution) => void): () => void {
    this.tradeCallbacks.push(callback);
    return () => {
      const index = this.tradeCallbacks.indexOf(callback);
      if (index > -1) {
        this.tradeCallbacks.splice(index, 1);
      }
    };
  }

  onPositionUpdate(callback: (position: Position) => void): () => void {
    this.positionCallbacks.push(callback);
    return () => {
      const index = this.positionCallbacks.indexOf(callback);
      if (index > -1) {
        this.positionCallbacks.splice(index, 1);
      }
    };
  }

  unsubscribe(): void {
    this.tradeCallbacks = [];
    this.positionCallbacks = [];
  }

  /**
   * Get all trading accounts associated with the provided credentials.
   * This is used for automatic account discovery after login.
   */
  async getAllAccounts(): Promise<AccountInfo[]> {
    if (!this.connected) {
      throw new Error("Not connected to trading platform");
    }

    try {
      // Try common endpoints for fetching all accounts
      const accountEndpoints = [
        "/accounts",
        "/api/accounts",
        "/v1/accounts",
        "/user/accounts",
        "/api/user/accounts",
      ];

      for (const endpoint of accountEndpoints) {
        try {
          this.logger.log(`Trying to fetch all accounts from ${endpoint}...`);
          const response = await this.httpClient.get(endpoint, {
            validateStatus: (status) => status < 500,
          });

          if (response.status === 200) {
            this.logger.log(`✅ Successfully fetched accounts from ${endpoint}`);
            const accountsData = response.data.accounts || response.data.data || response.data;
            if (Array.isArray(accountsData)) {
              return accountsData.map((acc: any) => ({
                accountId: acc.accountId || acc.id || acc.accountNumber || "",
                balance: acc.balance || acc.accountBalance || 0,
                equity: acc.equity || acc.balance || 0,
                marginUsed: acc.marginUsed || 0,
                positions: [],
              }));
            }
          }
        } catch (error: any) {
          this.logger.warn(`Failed to fetch accounts from ${endpoint}: ${error.message}`);
          continue;
        }
      }

      throw new Error("Could not retrieve accounts from any known endpoint.");
    } catch (error) {
      this.logger.error(`Failed to get all accounts for ${this.firm}:`, error);
      throw error;
    }
  }

  /**
   * Fetch trades from Rithmic API
   */
  protected async fetchTrades(): Promise<TradeExecution[]> {
    if (!this.config?.accountNumber) {
      this.logger.warn("No account number configured, cannot fetch trades");
      return [];
    }

    try {
      const response = await this.httpClient.get(
        `/accounts/${this.config.accountNumber}/trades`,
        {
          params: {
            limit: 100,
          },
        }
      );

      const trades = response.data.trades || response.data || [];
      return trades.map((trade: any) => this.normalizeTradeExecution(trade));
    } catch (error) {
      this.logger.error(`Failed to fetch trades:`, error);
      return [];
    }
  }

  // Helper methods
  private normalizeSide(side: string): TradeSide {
    const upper = side.toUpperCase();
    if (upper === "BUY" || upper === "LONG" || upper === "1") return TradeSide.BUY;
    if (upper === "SELL" || upper === "SHORT" || upper === "-1") return TradeSide.SELL;
    return TradeSide.BUY;
  }

  private normalizeStatus(status: string): "filled" | "partially_filled" | "pending" | "cancelled" | "rejected" {
    const upper = status.toUpperCase();
    if (upper === "FILLED" || upper === "EXECUTED") return "filled";
    if (upper === "PARTIAL" || upper === "PARTIALLY_FILLED") return "partially_filled";
    if (upper === "PENDING" || upper === "NEW") return "pending";
    if (upper === "CANCELLED" || upper === "CANCELED") return "cancelled";
    if (upper === "REJECTED") return "rejected";
    return "pending";
  }

  private normalizeTradeExecution(data: any): TradeExecution {
    return {
      orderId: data.orderId || data.id,
      tradeId: data.tradeId || data.executionId || data.id,
      symbol: data.symbol,
      side: this.normalizeSide(data.side),
      quantity: data.quantity || data.size,
      price: data.price || data.fillPrice,
      executedAt: new Date(data.executedAt || data.timestamp || Date.now()),
      status: this.normalizeStatus(data.status),
    };
  }
}
