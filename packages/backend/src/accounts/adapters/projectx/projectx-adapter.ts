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
 * ProjectX Adapter
 * 
 * ProjectX is the platform used by TopStepX.
 * This adapter connects to ProjectX API/WebSocket to:
 * - Authenticate with email/password
 * - Listen to trades in real-time
 * - Execute trades
 * - Get account information
 * - Monitor positions
 * 
 * Based on research:
 * - TopStepX uses ProjectX as their trading platform
 * - Authentication: Email/Password
 * - WebSocket for real-time updates
 */
@Injectable()
export class ProjectXAdapter implements ITradingAdapter {
  private readonly logger = new Logger("ProjectXAdapter");
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

  // ProjectX API URLs - Real URLs for TopStepX/ProjectX
  protected readonly PROJECTX_API_BASE = process.env.PROJECTX_API_URL || "https://api.topstepx.com";
  protected readonly PROJECTX_WS_URL = process.env.PROJECTX_WS_URL || "wss://api.topstepx.com/ws";

  protected apiDiscovery: ApiDiscoveryService;

  constructor(firm: TradingFirm) {
    this.firm = firm;
    this.apiDiscovery = new ApiDiscoveryService();
    this.httpClient = axios.create({
      baseURL: this.PROJECTX_API_BASE,
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
    return Platform.PROJECTX;
  }

  /**
   * Connect to ProjectX platform
   * 
   * ProjectX typically requires:
   * - Email
   * - Password
   * - Account Number (optional, may be discovered)
   */
  async connect(config: ConnectionConfig): Promise<void> {
    try {
      this.logger.log(`🔌 Connecting to ProjectX for ${this.firm} account ${config.accountNumber || 'auto'}...`);
      this.logger.log(`📍 Using API Base URL: ${this.PROJECTX_API_BASE}`);
      this.logger.log(`📍 Using WebSocket URL: ${this.PROJECTX_WS_URL}`);
      this.config = config;

      // Log discovery URLs
      const discoveryUrls = this.getDiscoveryUrls();
      this.logger.log(`🔍 Discovery URLs to try: ${discoveryUrls.join(", ")}`);

      // If API discovery is enabled, try to discover endpoints
      if (process.env.ENABLE_API_DISCOVERY === "true") {
        this.logger.log("🔍 Attempting API discovery for ProjectX...");
        const discovery = await this.apiDiscovery.discoverApiConfig(
          config.accountNumber || "",
          config.email,
          config.password,
          config.apiKey,
          config.apiSecret,
          discoveryUrls
        );

        if (discovery.baseUrl) {
          this.logger.log(`✅ Discovered API base URL: ${discovery.baseUrl}`);
          this.httpClient.defaults.baseURL = discovery.baseUrl;
        } else {
          this.logger.warn(`⚠️ API discovery did not find a valid base URL, using default: ${this.PROJECTX_API_BASE}`);
        }
      } else {
        this.logger.log(`ℹ️ API discovery is disabled, using configured URLs`);
      }

      // Step 1: Authenticate
      const authResponse = await this.authenticate(config);
      this.authToken = authResponse.token || authResponse.accessToken || authResponse.sessionId;

      // Step 2: Connect WebSocket for real-time updates (if token available)
      if (this.authToken) {
        await this.connectWebSocket(this.authToken);
      } else {
        this.logger.warn("No token received, skipping WebSocket connection. Will use polling instead.");
        this.startTradePolling();
      }

      this.connected = true;
      this.reconnectAttempts = 0;
      this.logger.log(`Successfully connected to ProjectX (${this.firm})`);
    } catch (error: any) {
      this.logger.error(`Failed to connect to ProjectX:`, {
        message: error.message,
        stack: error.stack,
        response: error.response?.data,
      });
      this.connected = false;
      throw new Error(`Connection failed: ${error.message}`);
    }
  }

  /**
   * Get discovery URLs for ProjectX
   */
  protected getDiscoveryUrls(): string[] {
    return [
      // TopStepX/ProjectX real URLs
      "https://api.topstepx.com",
      "https://api.topstepx.com/v1",
      "https://api.topstepx.com/api",
      "https://projectx.topstepx.com",
      "https://projectx.topstepx.com/api",
      "https://projectx.topstepx.com/v1",
      // ProjectX generic URLs (if different)
      "https://api.projectx.com",
      "https://api.projectx.com/v1",
      "https://api.projectx.com/api",
    ];
  }

  /**
   * Authenticate with ProjectX API
   * Real endpoints for TopStepX/ProjectX
   */
  private async authenticate(config: ConnectionConfig): Promise<any> {
    const authEndpoints = [
      // TopStepX/ProjectX real endpoints
      "/api/v1/auth/login",
      "/api/auth/login",
      "/v1/auth/login",
      "/auth/login",
      "/api/login",
      "/login",
      "/api/v1/authenticate",
      "/api/authenticate",
      "/authenticate",
      "/user/login",
      "/api/user/login",
    ];

    // Try email/password authentication first
    if (config.email && config.password) {
      const fullBaseUrl = this.httpClient.defaults.baseURL || this.PROJECTX_API_BASE;
      this.logger.log(`🔐 Attempting email/password authentication with base URL: ${fullBaseUrl}`);
      
      for (const endpoint of authEndpoints) {
        const fullUrl = `${fullBaseUrl}${endpoint}`;
        try {
          this.logger.log(`🔐 Trying email/password auth at ${fullUrl}...`);
          
          const authPayload: any = {
            email: config.email,
            password: config.password,
          };

          // Add account number if provided
          if (config.accountNumber) {
            authPayload.accountNumber = config.accountNumber;
          }

          // Add environment if specified
          if (config.config?.environment) {
            authPayload.environment = config.config.environment;
          }

          const response = await this.httpClient.post(endpoint, authPayload, {
            validateStatus: (status) => status < 500,
          });

          if (response.status === 200 || response.status === 201) {
            this.logger.log(`✅ Email/password authentication successful at ${fullUrl}`);
            this.logger.log(`✅ Received token/session: ${response.data.token ? 'Yes' : 'No'}`);
            return response.data;
          }

          // If 401/403, try next endpoint
          if (response.status === 401 || response.status === 403) {
            this.logger.warn(`❌ Auth failed at ${fullUrl}: ${response.status} - ${JSON.stringify(response.data)}`);
            continue;
          }
        } catch (error: any) {
          this.logger.warn(`❌ Error at ${fullUrl}: ${error.message}`);
          if (error.response) {
            this.logger.warn(`   Response status: ${error.response.status}`);
            this.logger.warn(`   Response data: ${JSON.stringify(error.response.data)}`);
          }
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
   * Connect to ProjectX WebSocket for real-time updates
   * Real WebSocket URLs for TopStepX/ProjectX
   */
  private async connectWebSocket(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Real WebSocket URL for TopStepX/ProjectX
        const wsUrl = `${this.PROJECTX_WS_URL}?token=${token}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.on("open", () => {
          this.logger.log("WebSocket connected to ProjectX");
          
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
   * Subscribe to account updates
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

  /**
   * Attempt to reconnect WebSocket
   */
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

  /**
   * Start polling for trades (fallback if WebSocket not available)
   */
  private startTradePolling(intervalMs: number = 5000): void {
    if (this.pollingInterval) {
      return;
    }

    this.logger.log(`Starting trade polling (interval: ${intervalMs}ms)`);
    this.pollingInterval = setInterval(async () => {
      try {
        const trades = await this.fetchTrades();
        
        // Only notify about new trades
        for (const trade of trades) {
          this.tradeCallbacks.forEach((callback) => callback(trade));
        }
      } catch (error) {
        this.logger.error(`Error polling trades:`, error);
      }
    }, intervalMs);
  }

  /**
   * Stop polling for trades
   */
  private stopTradePolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      this.logger.log("Stopped trade polling");
    }
  }

  async disconnect(): Promise<void> {
    this.logger.log(`Disconnecting from ProjectX...`);
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
    this.logger.log(`Disconnected from ProjectX`);
  }

  isConnected(): boolean {
    return this.connected;
  }

  async placeOrder(order: TradeOrder): Promise<TradeExecution> {
    if (!this.connected) {
      throw new Error("Not connected to trading platform");
    }

    try {
      this.logger.log(`Placing order: ${order.side} ${order.quantity} ${order.symbol}`);
      
      const payload = {
        symbol: order.symbol,
        side: order.side,
        type: order.type,
        quantity: order.quantity,
        price: order.price,
        stopLoss: order.stopLoss,
        takeProfit: order.takeProfit,
      };

      const response = await this.httpClient.post(
        `/accounts/${this.config?.accountNumber}/orders`,
        payload
      );

      const execution = this.normalizeTradeExecution(response.data);
      
      // Notify callbacks
      this.tradeCallbacks.forEach((callback) => callback(execution));
      
      return execution;
    } catch (error) {
      this.logger.error(`Failed to place order:`, error);
      throw error;
    }
  }

  async cancelOrder(orderId: string): Promise<void> {
    if (!this.connected) {
      throw new Error("Not connected to trading platform");
    }

    try {
      this.logger.log(`Cancelling order: ${orderId}`);
      await this.httpClient.delete(
        `/accounts/${this.config?.accountNumber}/orders/${orderId}`
      );
    } catch (error) {
      this.logger.error(`Failed to cancel order:`, error);
      throw error;
    }
  }

  async modifyOrder(orderId: string, updates: Partial<TradeOrder>): Promise<TradeExecution> {
    if (!this.connected) {
      throw new Error("Not connected to trading platform");
    }

    try {
      this.logger.log(`Modifying order ${orderId}:`, updates);
      const response = await this.httpClient.patch(
        `/accounts/${this.config?.accountNumber}/orders/${orderId}`,
        updates
      );

      return this.normalizeTradeExecution(response.data);
    } catch (error) {
      this.logger.error(`Failed to modify order:`, error);
      throw error;
    }
  }

  async closePosition(symbol: string, side?: TradeSide): Promise<TradeExecution> {
    if (!this.connected) {
      throw new Error("Not connected to trading platform");
    }

    try {
      this.logger.log(`Closing position: ${symbol}`);
      const response = await this.httpClient.post(
        `/accounts/${this.config?.accountNumber}/positions/${symbol}/close`,
        { side }
      );

      return this.normalizeTradeExecution(response.data);
    } catch (error) {
      this.logger.error(`Failed to close position:`, error);
      throw error;
    }
  }

  async getAccountInfo(): Promise<AccountInfo> {
    if (!this.connected) {
      throw new Error("Not connected to trading platform");
    }

    try {
      return await this.fetchAccountInfo();
    } catch (error) {
      this.logger.error(`Failed to fetch account info:`, error);
      throw error;
    }
  }

  async getAllAccounts(): Promise<AccountInfo[]> {
    if (!this.connected) {
      throw new Error("Not connected to trading platform");
    }

    try {
      const endpoints = [
        "/accounts",
        "/api/accounts",
        "/v1/accounts",
        "/user/accounts",
        "/api/user/accounts",
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await this.httpClient.get(endpoint, {
            validateStatus: (status) => status < 500,
          });

          if (response.status === 200 && response.data) {
            const accounts = Array.isArray(response.data)
              ? response.data
              : response.data.accounts || response.data.data || [];

            this.logger.log(`Found ${accounts.length} accounts via ${endpoint}`);
            return accounts.map((acc: any) => ({
              accountId: acc.accountId || acc.id || acc.accountNumber,
              balance: acc.balance || acc.accountBalance || 0,
              equity: acc.equity || acc.balance || 0,
              marginUsed: acc.marginUsed || 0,
              positions: acc.positions || [],
            }));
          }
        } catch (error: any) {
          this.logger.debug(`Failed to fetch accounts from ${endpoint}: ${error.message}`);
          continue;
        }
      }

      // If no endpoint works, return current account info as single-item array
      this.logger.warn("Could not fetch all accounts, returning current account only");
      const currentAccount = await this.getAccountInfo();
      return [currentAccount];
    } catch (error) {
      this.logger.error(`Failed to fetch all accounts:`, error);
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
   * Fetch recent trades from ProjectX API
   */
  protected async fetchTrades(): Promise<TradeExecution[]> {
    try {
      const response = await this.httpClient.get(`/accounts/${this.config?.accountNumber}/trades`, {
        params: {
          limit: 100,
        },
      });

      const trades = response.data.trades || response.data || [];
      return trades.map((trade: any) => this.normalizeTradeExecution(trade));
    } catch (error) {
      this.logger.error(`Failed to fetch trades:`, error);
      return [];
    }
  }

  /**
   * Fetch open positions from ProjectX API
   */
  protected async fetchPositions(): Promise<Position[]> {
    try {
      const response = await this.httpClient.get(`/accounts/${this.config?.accountNumber}/positions`);

      const positions = response.data.positions || response.data || [];
      return positions.map((pos: any) => ({
        symbol: pos.symbol,
        side: this.normalizeSide(pos.side),
        quantity: pos.quantity || pos.size,
        entryPrice: pos.entryPrice || pos.avgPrice,
        unrealizedPnL: pos.unrealizedPnL || pos.pnl || 0,
      }));
    } catch (error) {
      this.logger.error(`Failed to fetch positions:`, error);
      return [];
    }
  }

  /**
   * Fetch account information from ProjectX API
   */
  protected async fetchAccountInfo(): Promise<AccountInfo> {
    try {
      const response = await this.httpClient.get(`/accounts/${this.config?.accountNumber}`);

      const data = response.data;
      const positions = await this.fetchPositions();

      return {
        accountId: data.accountId || this.config?.accountNumber || "",
        balance: data.balance || data.accountBalance || 0,
        equity: data.equity || data.balance || 0,
        marginUsed: data.marginUsed || 0,
        positions,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch account info:`, error);
      throw error;
    }
  }

  /**
   * Execute a trade order via ProjectX API
   */
  protected async executePlaceOrder(order: TradeOrder): Promise<TradeExecution> {
    try {
      const payload = {
        symbol: order.symbol,
        side: order.side,
        type: order.type,
        quantity: order.quantity,
        price: order.price,
        stopLoss: order.stopLoss,
        takeProfit: order.takeProfit,
      };

      const response = await this.httpClient.post(
        `/accounts/${this.config?.accountNumber}/orders`,
        payload
      );

      return this.normalizeTradeExecution(response.data);
    } catch (error) {
      this.logger.error(`Failed to place order:`, error);
      throw error;
    }
  }

  /**
   * Convert platform-specific trade format to standard TradeExecution
   */
  protected normalizeTradeExecution(platformTrade: any): TradeExecution {
    return {
      orderId: platformTrade.orderId || platformTrade.id,
      tradeId: platformTrade.tradeId || platformTrade.id,
      symbol: platformTrade.symbol,
      side: this.normalizeSide(platformTrade.side),
      quantity: platformTrade.quantity || platformTrade.size,
      price: platformTrade.price || platformTrade.fillPrice,
      executedAt: new Date(platformTrade.executedAt || platformTrade.timestamp),
      status: this.normalizeStatus(platformTrade.status),
    };
  }

  /**
   * Convert platform-specific side to TradeSide enum
   */
  protected normalizeSide(side: string): TradeSide {
    const upper = side.toUpperCase();
    if (upper === "BUY" || upper === "LONG") return TradeSide.BUY;
    if (upper === "SELL" || upper === "SHORT") return TradeSide.SELL;
    return TradeSide.BUY; // Default
  }

  /**
   * Convert platform-specific status to standard status
   */
  protected normalizeStatus(status: string): "filled" | "partially_filled" | "pending" | "cancelled" | "rejected" {
    const upper = status.toUpperCase();
    if (upper === "FILLED" || upper === "EXECUTED") return "filled";
    if (upper === "PARTIAL" || upper === "PARTIALLY_FILLED") return "partially_filled";
    if (upper === "PENDING" || upper === "NEW") return "pending";
    if (upper === "CANCELLED" || upper === "CANCELED") return "cancelled";
    if (upper === "REJECTED") return "rejected";
    return "pending"; // Default
  }
}
