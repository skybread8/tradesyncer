import { TradingFirm, Platform, TradeSide, TradeType } from "@prisma/client";

export interface ConnectionConfig {
  // Email/Password authentication (primary method)
  email?: string;
  password?: string;
  
  // API Key/Secret authentication (alternative method)
  apiKey?: string;
  apiSecret?: string;
  
  // Account identifier
  accountNumber: string;
  
  // Additional platform-specific configuration
  config?: any;
}

export interface TradeOrder {
  symbol: string;
  side: TradeSide;
  type: TradeType;
  quantity: number;
  price?: number; // For LIMIT/STOP orders
  stopLoss?: number;
  takeProfit?: number;
}

export interface TradeExecution {
  orderId: string;
  tradeId: string;
  symbol: string;
  side: TradeSide;
  quantity: number;
  price: number;
  executedAt: Date;
  status: "filled" | "partially_filled" | "pending" | "cancelled" | "rejected";
}

export interface Position {
  symbol: string;
  side: TradeSide;
  quantity: number;
  entryPrice: number;
  unrealizedPnL: number;
}

export interface AccountInfo {
  accountId: string;
  balance: number;
  equity: number;
  marginUsed: number;
  positions: Position[];
}

/**
 * Trading Adapter Interface
 * All platform adapters must implement this interface
 */
export interface ITradingAdapter {
  /**
   * Get the firm this adapter supports
   */
  getFirm(): TradingFirm;

  /**
   * Get the platform this adapter supports
   */
  getPlatform(): Platform;

  /**
   * Connect to the trading platform
   */
  connect(config: ConnectionConfig): Promise<void>;

  /**
   * Disconnect from the trading platform
   */
  disconnect(): Promise<void>;

  /**
   * Check if adapter is connected
   */
  isConnected(): boolean;

  /**
   * Place an order
   */
  placeOrder(order: TradeOrder): Promise<TradeExecution>;

  /**
   * Cancel an order
   */
  cancelOrder(orderId: string): Promise<void>;

  /**
   * Modify an order (SL/TP, price, etc.)
   */
  modifyOrder(orderId: string, updates: Partial<TradeOrder>): Promise<TradeExecution>;

  /**
   * Close a position
   */
  closePosition(symbol: string, side?: TradeSide): Promise<TradeExecution>;

  /**
   * Get account information
   */
  getAccountInfo(): Promise<AccountInfo>;

  /**
   * Get all accounts associated with the authenticated user
   * This is used to automatically discover and add accounts after login
   */
  getAllAccounts(): Promise<AccountInfo[]>;

  /**
   * Subscribe to trade updates
   * Returns an unsubscribe function
   */
  onTradeUpdate(callback: (execution: TradeExecution) => void): () => void;

  /**
   * Subscribe to position updates
   * Returns an unsubscribe function
   */
  onPositionUpdate(callback: (position: Position) => void): () => void;

  /**
   * Unsubscribe from updates
   */
  unsubscribe(): void;
}
