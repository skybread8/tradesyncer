import { Injectable } from "@nestjs/common";
import { TradingFirm, Platform, TradeSide, TradeType } from "@prisma/client";
import {
  ITradingAdapter,
  ConnectionConfig,
  TradeOrder,
  TradeExecution,
  AccountInfo,
  Position,
} from "./trading-adapter.interface";

/**
 * Mock adapter for TopStepX
 * In production, this would connect to TopStepX API via Rithmic or their native API
 */
@Injectable()
export class TopStepXAdapter implements ITradingAdapter {
  private connected = false;
  private config: ConnectionConfig | null = null;
  private tradeCallbacks: Array<(execution: TradeExecution) => void> = [];
  private positionCallbacks: Array<(position: Position) => void> = [];
  private accountBalance = 50000; // Mock balance

  getFirm(): TradingFirm {
    return TradingFirm.TOPSTEPX;
  }

  getPlatform(): Platform {
    return Platform.RITHMIC;
  }

  async connect(config: ConnectionConfig): Promise<void> {
    // In production: authenticate with TopStepX API
    // For now, we'll simulate connection
    console.log(`[TopStepXAdapter] Connecting to account ${config.accountNumber}...`);

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Validate credentials (mock)
    if (!config.apiKey || !config.apiSecret) {
      throw new Error("Invalid credentials");
    }

    this.config = config;
    this.connected = true;
    console.log(`[TopStepXAdapter] Connected successfully`);
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.config = null;
    this.unsubscribe();
    console.log(`[TopStepXAdapter] Disconnected`);
  }

  isConnected(): boolean {
    return this.connected;
  }

  async placeOrder(order: TradeOrder): Promise<TradeExecution> {
    if (!this.connected) {
      throw new Error("Not connected to trading platform");
    }

    console.log(`[TopStepXAdapter] Placing order:`, order);

    // Simulate order execution delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Mock execution
    const execution: TradeExecution = {
      orderId: `TOPSTEPX_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tradeId: `TRADE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      symbol: order.symbol,
      side: order.side,
      quantity: order.quantity,
      price: order.price || this.getMockPrice(order.symbol),
      executedAt: new Date(),
      status: "filled",
    };

    // Notify callbacks
    this.tradeCallbacks.forEach((callback) => callback(execution));

    return execution;
  }

  async cancelOrder(orderId: string): Promise<void> {
    if (!this.connected) {
      throw new Error("Not connected to trading platform");
    }

    console.log(`[TopStepXAdapter] Cancelling order: ${orderId}`);
    // Mock cancellation
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  async modifyOrder(orderId: string, updates: Partial<TradeOrder>): Promise<TradeExecution> {
    if (!this.connected) {
      throw new Error("Not connected to trading platform");
    }

    console.log(`[TopStepXAdapter] Modifying order ${orderId}:`, updates);

    // Mock modification
    await new Promise((resolve) => setTimeout(resolve, 100));

    const execution: TradeExecution = {
      orderId,
      tradeId: `MODIFIED_${Date.now()}`,
      symbol: updates.symbol || "ES",
      side: updates.side || TradeSide.BUY,
      quantity: updates.quantity || 1,
      price: updates.price || this.getMockPrice(updates.symbol || "ES"),
      executedAt: new Date(),
      status: "filled",
    };

    return execution;
  }

  async closePosition(symbol: string, side?: TradeSide): Promise<TradeExecution> {
    if (!this.connected) {
      throw new Error("Not connected to trading platform");
    }

    console.log(`[TopStepXAdapter] Closing position: ${symbol}`);

    await new Promise((resolve) => setTimeout(resolve, 100));

    const execution: TradeExecution = {
      orderId: `CLOSE_${Date.now()}`,
      tradeId: `CLOSE_TRADE_${Date.now()}`,
      symbol,
      side: side || TradeSide.SELL,
      quantity: 1,
      price: this.getMockPrice(symbol),
      executedAt: new Date(),
      status: "filled",
    };

    return execution;
  }

  async getAccountInfo(): Promise<AccountInfo> {
    if (!this.connected) {
      throw new Error("Not connected to trading platform");
    }

    // Mock account info
    return {
      accountId: this.config?.accountNumber || "MOCK_ACCOUNT",
      balance: this.accountBalance,
      equity: this.accountBalance,
      marginUsed: 0,
      positions: [],
    };
  }

  async getAllAccounts(): Promise<AccountInfo[]> {
    // Mock implementation - return current account
    return [await this.getAccountInfo()];
  }

  onTradeUpdate(callback: (execution: TradeExecution) => void): () => void {
    this.tradeCallbacks.push(callback);
    // Return unsubscribe function
    return () => {
      const index = this.tradeCallbacks.indexOf(callback);
      if (index > -1) {
        this.tradeCallbacks.splice(index, 1);
      }
    };
  }

  onPositionUpdate(callback: (position: Position) => void): () => void {
    this.positionCallbacks.push(callback);
    // Return unsubscribe function
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

  // Helper method for mock pricing
  private getMockPrice(symbol: string): number {
    // Mock prices for common futures
    const prices: Record<string, number> = {
      ES: 5000.0,
      NQ: 17000.0,
      YM: 39000.0,
      CL: 75.0,
      GC: 2000.0,
    };

    return prices[symbol] || 1000.0;
  }
}
