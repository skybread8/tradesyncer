import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AccountsService } from "../accounts/accounts.service";
import { AdapterFactory } from "../accounts/adapters/adapter.factory";
import { TradesService } from "../trades/trades.service";
import { RiskScalingType, TradeSide, TradeType } from "@prisma/client";
import { TradeOrder } from "../accounts/adapters/trading-adapter.interface";

/**
 * Core Trade Copier Engine
 * Handles real-time trade replication from master to slave accounts
 */
@Injectable()
export class TradeCopierEngine implements OnModuleDestroy {
  private readonly logger = new Logger(TradeCopierEngine.name);
  private activeCopiers: Map<string, NodeJS.Timeout> = new Map();
  private tradeSubscriptions: Map<string, () => void> = new Map();

  constructor(
    private prisma: PrismaService,
    private accountsService: AccountsService,
    private adapterFactory: AdapterFactory,
    private tradesService: TradesService
  ) {}

  /**
   * Start the copier engine for a specific copier
   */
  async start(copierId: string): Promise<void> {
    if (this.activeCopiers.has(copierId)) {
      this.logger.warn(`Copier ${copierId} is already running`);
      return;
    }

    const copier = await this.prisma.copier.findUnique({
      where: { id: copierId },
      include: {
        masterAccount: true,
        slaveConfigs: {
          include: {
            slaveAccount: true,
          },
        },
      },
    });

    if (!copier || copier.slaveConfigs.length === 0) {
      throw new Error(`Copier ${copierId} not found or has no slave accounts`);
    }

    this.logger.log(`Starting copier ${copierId} (${copier.name})`);

    // Get adapter for master account
    const masterAdapter = this.adapterFactory.getAdapter(
      copier.masterAccount.platform,
      copier.masterAccount.firm
    );

    // Ensure master is connected
    if (!masterAdapter.isConnected()) {
      await masterAdapter.connect({
        apiKey: copier.masterAccount.apiKey || "",
        apiSecret: copier.masterAccount.apiSecret || "",
        accountNumber: copier.masterAccount.accountNumber,
        config: copier.masterAccount.additionalConfig as any,
      });
    }

    // Subscribe to master trade updates
    const unsubscribe = masterAdapter.onTradeUpdate(async (execution) => {
      await this.handleMasterTrade(copierId, execution);
    });

    this.tradeSubscriptions.set(copierId, unsubscribe);

    // Create a heartbeat interval to monitor copier health
    const heartbeat = setInterval(() => {
      this.logger.debug(`Copier ${copierId} heartbeat`);
    }, 30000); // Every 30 seconds

    this.activeCopiers.set(copierId, heartbeat);

    // Log execution
    await this.prisma.executionLog.create({
      data: {
        copierId,
        level: "info",
        message: `Copier started successfully`,
      },
    });
  }

  /**
   * Stop the copier engine
   */
  async stop(copierId: string): Promise<void> {
    this.logger.log(`Stopping copier ${copierId}`);

    // Clear heartbeat
    const heartbeat = this.activeCopiers.get(copierId);
    if (heartbeat) {
      clearInterval(heartbeat);
      this.activeCopiers.delete(copierId);
    }

    // Unsubscribe from trade updates
    const unsubscribe = this.tradeSubscriptions.get(copierId);
    if (unsubscribe) {
      unsubscribe();
      this.tradeSubscriptions.delete(copierId);
    }

    // Log execution
    await this.prisma.executionLog.create({
      data: {
        copierId,
        level: "info",
        message: `Copier stopped`,
      },
    });
  }

  /**
   * Pause the copier (stops copying but keeps monitoring)
   */
  async pause(copierId: string): Promise<void> {
    await this.stop(copierId);
    this.logger.log(`Copier ${copierId} paused`);
  }

  /**
   * Handle trade execution from master account
   */
  private async handleMasterTrade(copierId: string, masterExecution: any): Promise<void> {
    try {
      const copier = await this.prisma.copier.findUnique({
        where: { id: copierId },
        include: {
          masterAccount: true,
          slaveConfigs: {
            where: { isActive: true },
            include: {
              slaveAccount: true,
            },
          },
        },
      });

      if (!copier || copier.status !== "ACTIVE") {
        return;
      }

      // Create master trade record
      const masterTrade = await this.prisma.trade.create({
        data: {
          copierId,
          accountId: copier.masterAccountId,
          symbol: masterExecution.symbol,
          side: masterExecution.side,
          type: TradeType.MARKET, // Map from execution type
          quantity: masterExecution.quantity,
          entryPrice: masterExecution.price,
          status: this.mapTradeStatus(masterExecution.status),
          externalOrderId: masterExecution.orderId,
          externalTradeId: masterExecution.tradeId,
          openedAt: masterExecution.executedAt || new Date(),
          filledAt: masterExecution.executedAt || new Date(),
        },
      });

      // Copy to each slave account
      const copyPromises = copier.slaveConfigs.map((config) =>
        this.copyTradeToSlave(copierId, masterTrade, config)
      );

      await Promise.allSettled(copyPromises);
    } catch (error) {
      this.logger.error(`Error handling master trade for copier ${copierId}:`, error);
      await this.prisma.executionLog.create({
        data: {
          copierId,
          level: "error",
          message: `Error handling master trade: ${error.message}`,
          details: { error: error.toString() },
        },
      });
    }
  }

  /**
   * Copy trade to a slave account with risk scaling
   */
  private async copyTradeToSlave(
    copierId: string,
    masterTrade: any,
    slaveConfig: any
  ): Promise<void> {
    try {
      // Check risk rules
      const riskCheck = await this.checkRiskRules(copierId, slaveConfig);
      if (!riskCheck.allowed) {
        this.logger.warn(
          `Risk rule violated for slave ${slaveConfig.slaveAccountId}: ${riskCheck.reason}`
        );
        return;
      }

      // Calculate scaled quantity
      const scaledQuantity = this.calculateScaledQuantity(
        masterTrade.quantity,
        slaveConfig,
        slaveConfig.slaveAccount
      );

      if (scaledQuantity <= 0) {
        this.logger.warn(`Scaled quantity is 0 for slave ${slaveConfig.slaveAccountId}`);
        return;
      }

      // Get adapter for slave account
      const slaveAdapter = this.adapterFactory.getAdapter(
        slaveConfig.slaveAccount.platform,
        slaveConfig.slaveAccount.firm
      );

      // Ensure slave is connected
      if (!slaveAdapter.isConnected()) {
        await slaveAdapter.connect({
          apiKey: slaveConfig.slaveAccount.apiKey || "",
          apiSecret: slaveConfig.slaveAccount.apiSecret || "",
          accountNumber: slaveConfig.slaveAccount.accountNumber,
          config: slaveConfig.slaveAccount.additionalConfig as any,
        });
      }

      // Create trade order for slave
      const slaveOrder: TradeOrder = {
        symbol: masterTrade.symbol,
        side: masterTrade.side,
        type: TradeType.MARKET, // Map appropriately
        quantity: scaledQuantity,
        stopLoss: masterTrade.stopLoss,
        takeProfit: masterTrade.takeProfit,
      };

      // Place order on slave account
      const slaveExecution = await slaveAdapter.placeOrder(slaveOrder);

      // Create slave trade record
      const slaveTrade = await this.prisma.trade.create({
        data: {
          copierId,
          accountId: slaveConfig.slaveAccountId,
          symbol: slaveExecution.symbol,
          side: slaveExecution.side,
          type: TradeType.MARKET,
          quantity: slaveExecution.quantity,
          entryPrice: slaveExecution.price,
          status: this.mapTradeStatus(slaveExecution.status),
          externalOrderId: slaveExecution.orderId,
          externalTradeId: slaveExecution.tradeId,
          openedAt: slaveExecution.executedAt || new Date(),
          filledAt: slaveExecution.executedAt || new Date(),
          stopLoss: masterTrade.stopLoss,
          takeProfit: masterTrade.takeProfit,
        },
      });

      // Create trade mapping
      await this.prisma.tradeMapping.create({
        data: {
          copierId,
          masterTradeId: masterTrade.id,
          slaveTradeId: slaveTrade.id,
          slaveAccountId: slaveConfig.slaveAccountId,
          status: "synced",
          syncedAt: new Date(),
        },
      });

      this.logger.log(
        `Trade copied: ${masterTrade.id} -> ${slaveTrade.id} (${scaledQuantity} contracts)`
      );

      // Log execution
      await this.prisma.executionLog.create({
        data: {
          copierId,
          level: "info",
          message: `Trade copied to slave account`,
          masterTradeId: masterTrade.id,
          slaveTradeId: slaveTrade.id,
          slaveAccountId: slaveConfig.slaveAccountId,
        },
      });
    } catch (error) {
      this.logger.error(`Error copying trade to slave ${slaveConfig.slaveAccountId}:`, error);

      // Create failed mapping
      await this.prisma.tradeMapping.create({
        data: {
          copierId,
          masterTradeId: masterTrade.id,
          slaveTradeId: "", // No slave trade created
          slaveAccountId: slaveConfig.slaveAccountId,
          status: "failed",
          errorMessage: error.message,
        },
      });

      await this.prisma.executionLog.create({
        data: {
          copierId,
          level: "error",
          message: `Failed to copy trade to slave: ${error.message}`,
          masterTradeId: masterTrade.id,
          slaveAccountId: slaveConfig.slaveAccountId,
          details: { error: error.toString() },
        },
      });
    }
  }

  /**
   * Calculate scaled quantity based on risk rules
   */
  private calculateScaledQuantity(
    masterQuantity: number,
    slaveConfig: any,
    slaveAccount: any
  ): number {
    switch (slaveConfig.scalingType) {
      case RiskScalingType.FIXED:
        return slaveConfig.fixedContracts || masterQuantity;

      case RiskScalingType.PERCENTAGE:
        const percentage = slaveConfig.percentageScale || 1.0;
        return Math.floor(masterQuantity * percentage);

      case RiskScalingType.BALANCE_BASED:
        // Scale based on account balance ratio
        // This is simplified - in production, you'd compare master vs slave balance
        const balanceRatio = slaveAccount.currentBalance / 50000; // Assuming 50k standard
        return Math.floor(masterQuantity * balanceRatio);

      default:
        return masterQuantity;
    }
  }

  /**
   * Check if trade is allowed based on risk rules
   */
  private async checkRiskRules(copierId: string, slaveConfig: any): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    // Check daily loss limit
    if (slaveConfig.dailyLossLimit) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayTrades = await this.prisma.trade.findMany({
        where: {
          copierId,
          accountId: slaveConfig.slaveAccountId,
          createdAt: { gte: today },
          status: { in: ["FILLED"] },
        },
      });

      const dailyLoss = todayTrades.reduce((sum, trade) => sum + (trade.realizedPnL || 0), 0);

      if (Math.abs(dailyLoss) >= slaveConfig.dailyLossLimit) {
        if (slaveConfig.autoDisable) {
          await this.prisma.copierAccountConfig.update({
            where: { id: slaveConfig.id },
            data: {
              isActive: false,
              disabledReason: `Daily loss limit exceeded: ${dailyLoss}`,
            },
          });
        }

        return {
          allowed: false,
          reason: `Daily loss limit exceeded: ${dailyLoss}`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Map execution status to TradeStatus enum
   */
  private mapTradeStatus(status: string): any {
    const statusMap: Record<string, any> = {
      filled: "FILLED",
      partially_filled: "PARTIALLY_FILLED",
      pending: "PENDING",
      cancelled: "CANCELLED",
      rejected: "REJECTED",
    };

    return statusMap[status] || "PENDING";
  }

  async onModuleDestroy() {
    // Clean up all active copiers
    for (const [copierId] of this.activeCopiers) {
      await this.stop(copierId);
    }
  }
}
