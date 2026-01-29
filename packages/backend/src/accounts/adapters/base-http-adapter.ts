import { Injectable, Logger } from "@nestjs/common";
import axios, { AxiosInstance, AxiosError } from "axios";
import {
  ITradingAdapter,
  ConnectionConfig,
  TradeOrder,
  TradeExecution,
  AccountInfo,
  Position,
} from "./trading-adapter.interface";
import { TradingFirm, Platform, TradeSide, TradeType } from "@prisma/client";

/**
 * Base HTTP Adapter
 * Provides common functionality for HTTP-based trading platform adapters
 */
@Injectable()
export abstract class BaseHttpAdapter implements ITradingAdapter {
  protected readonly logger: Logger;
  protected httpClient: AxiosInstance;
  protected connected = false;
  protected config: ConnectionConfig | null = null;
  protected tradeCallbacks: Array<(execution: TradeExecution) => void> = [];
  protected positionCallbacks: Array<(position: Position) => void> = [];
  protected pollingInterval: NodeJS.Timeout | null = null;
  protected lastTradeId: string | null = null;

  constructor(
    protected readonly baseUrl: string,
    protected readonly firm: TradingFirm,
    protected readonly platform: Platform
  ) {
    this.logger = new Logger(`${firm}Adapter`);
    this.httpClient = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Add request interceptor for authentication
    this.httpClient.interceptors.request.use(
      (config) => {
        this.addAuthHeaders(config);
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.httpClient.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        this.handleHttpError(error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Abstract methods that must be implemented by subclasses
   */
  abstract getFirm(): TradingFirm;
  abstract getPlatform(): Platform;
  abstract addAuthHeaders(config: any): void;
  abstract handleHttpError(error: AxiosError): void;
  abstract fetchTrades(): Promise<TradeExecution[]>;
  abstract fetchPositions(): Promise<Position[]>;
  abstract fetchAccountInfo(): Promise<AccountInfo>;
  abstract executePlaceOrder(order: TradeOrder): Promise<TradeExecution>;

  /**
   * Connect to the trading platform
   */
  async connect(config: ConnectionConfig): Promise<void> {
    try {
      this.logger.log(`Connecting to ${this.firm} account ${config.accountNumber}...`);

      this.config = config;
      
      // Test connection by fetching account info
      await this.fetchAccountInfo();

      this.connected = true;
      this.logger.log(`Successfully connected to ${this.firm}`);

      // Start polling for trades if WebSocket is not available
      this.startTradePolling();
    } catch (error) {
      this.logger.error(`Failed to connect to ${this.firm}:`, error);
      this.connected = false;
      throw new Error(`Connection failed: ${error.message}`);
    }
  }

  /**
   * Disconnect from the trading platform
   */
  async disconnect(): Promise<void> {
    this.logger.log(`Disconnecting from ${this.firm}...`);
    this.stopTradePolling();
    this.connected = false;
    this.config = null;
    this.unsubscribe();
    this.logger.log(`Disconnected from ${this.firm}`);
  }

  /**
   * Check if adapter is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Place an order
   */
  async placeOrder(order: TradeOrder): Promise<TradeExecution> {
    if (!this.connected) {
      throw new Error("Not connected to trading platform");
    }

    try {
      this.logger.log(`Placing order: ${order.side} ${order.quantity} ${order.symbol}`);
      const execution = await this.executePlaceOrder(order);
      
      // Notify callbacks
      this.tradeCallbacks.forEach((callback) => callback(execution));
      
      return execution;
    } catch (error) {
      this.logger.error(`Failed to place order:`, error);
      throw error;
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string): Promise<void> {
    if (!this.connected) {
      throw new Error("Not connected to trading platform");
    }

    try {
      this.logger.log(`Cancelling order: ${orderId}`);
      // Implementation depends on platform API
      // This is a placeholder - override in subclass
      throw new Error("cancelOrder not implemented");
    } catch (error) {
      this.logger.error(`Failed to cancel order:`, error);
      throw error;
    }
  }

  /**
   * Modify an order
   */
  async modifyOrder(orderId: string, updates: Partial<TradeOrder>): Promise<TradeExecution> {
    if (!this.connected) {
      throw new Error("Not connected to trading platform");
    }

    try {
      this.logger.log(`Modifying order ${orderId}:`, updates);
      // Implementation depends on platform API
      // This is a placeholder - override in subclass
      throw new Error("modifyOrder not implemented");
    } catch (error) {
      this.logger.error(`Failed to modify order:`, error);
      throw error;
    }
  }

  /**
   * Close a position
   */
  async closePosition(symbol: string, side?: TradeSide): Promise<TradeExecution> {
    if (!this.connected) {
      throw new Error("Not connected to trading platform");
    }

    try {
      this.logger.log(`Closing position: ${symbol}`);
      // Implementation depends on platform API
      // This is a placeholder - override in subclass
      throw new Error("closePosition not implemented");
    } catch (error) {
      this.logger.error(`Failed to close position:`, error);
      throw error;
    }
  }

  /**
   * Get account information
   */
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

  /**
   * Get all accounts - must be implemented by subclasses
   */
  abstract getAllAccounts(): Promise<AccountInfo[]>;

  /**
   * Subscribe to trade updates
   */
  onTradeUpdate(callback: (execution: TradeExecution) => void): () => void {
    this.tradeCallbacks.push(callback);
    return () => {
      const index = this.tradeCallbacks.indexOf(callback);
      if (index > -1) {
        this.tradeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to position updates
   */
  onPositionUpdate(callback: (position: Position) => void): () => void {
    this.positionCallbacks.push(callback);
    return () => {
      const index = this.positionCallbacks.indexOf(callback);
      if (index > -1) {
        this.positionCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Unsubscribe from all updates
   */
  unsubscribe(): void {
    this.tradeCallbacks = [];
    this.positionCallbacks = [];
  }

  /**
   * Start polling for trades (fallback if WebSocket not available)
   */
  protected startTradePolling(intervalMs: number = 5000): void {
    if (this.pollingInterval) {
      return; // Already polling
    }

    this.logger.log(`Starting trade polling (interval: ${intervalMs}ms)`);
    this.pollingInterval = setInterval(async () => {
      try {
        const trades = await this.fetchTrades();
        
        // Only notify about new trades
        for (const trade of trades) {
          if (!this.lastTradeId || trade.tradeId !== this.lastTradeId) {
            this.tradeCallbacks.forEach((callback) => callback(trade));
            this.lastTradeId = trade.tradeId;
          }
        }
      } catch (error) {
        this.logger.error(`Error polling trades:`, error);
      }
    }, intervalMs);
  }

  /**
   * Stop polling for trades
   */
  protected stopTradePolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      this.logger.log("Stopped trade polling");
    }
  }

  /**
   * Convert platform-specific trade format to standard TradeExecution
   */
  protected normalizeTradeExecution(platformTrade: any): TradeExecution {
    // This should be overridden in subclasses to match platform format
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
