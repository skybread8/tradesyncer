import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTransactionDto, UpdateTransactionDto } from "./dto";
import { TransactionType, TransactionStatus } from "@prisma/client";

@Injectable()
export class AccountingService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createTransactionDto: CreateTransactionDto) {
    // Si es una compra de cuenta, verificar que la cuenta existe
    if (
      createTransactionDto.type === "ACCOUNT_PURCHASE" &&
      createTransactionDto.tradingAccountId
    ) {
      const account = await this.prisma.tradingAccount.findFirst({
        where: {
          id: createTransactionDto.tradingAccountId,
          userId,
        },
      });

      if (!account) {
        throw new NotFoundException("Trading account not found");
      }
    }

    // Si amount es negativo, hacerlo positivo para compras (se mostrará como negativo en balance)
    const amount = createTransactionDto.type === "ACCOUNT_PURCHASE" 
      ? Math.abs(createTransactionDto.amount) * -1 
      : createTransactionDto.amount;

    return this.prisma.transaction.create({
      data: {
        ...createTransactionDto,
        amount,
        userId,
        status: createTransactionDto.status || "COMPLETED",
      },
      include: {
        tradingAccount: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async findAll(userId: string, filters?: { type?: TransactionType; status?: TransactionStatus }) {
    return this.prisma.transaction.findMany({
      where: {
        userId,
        ...(filters?.type && { type: filters.type }),
        ...(filters?.status && { status: filters.status }),
      },
      include: {
        tradingAccount: true,
      },
      orderBy: {
        transactionDate: "desc",
      },
    });
  }

  async findOne(id: string, userId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        tradingAccount: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    if (transaction.userId !== userId) {
      throw new BadRequestException("Unauthorized");
    }

    return transaction;
  }

  async update(id: string, userId: string, updateTransactionDto: UpdateTransactionDto) {
    await this.findOne(id, userId);

    return this.prisma.transaction.update({
      where: { id },
      data: updateTransactionDto,
      include: {
        tradingAccount: true,
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.transaction.delete({
      where: { id },
    });
  }

  /**
   * Calcular balance total del usuario
   */
  async getBalance(userId: string) {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        status: "COMPLETED",
      },
      select: {
        amount: true,
        type: true,
      },
    });

    const total = transactions.reduce((sum, t) => sum + t.amount, 0);

    // Desglose por tipo
    const purchases = transactions
      .filter((t) => t.type === "ACCOUNT_PURCHASE")
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const examFees = transactions
      .filter((t) => t.type === "EXAM_FEE")
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const withdrawals = transactions
      .filter((t) => t.type === "WITHDRAWAL")
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const deposits = transactions
      .filter((t) => t.type === "DEPOSIT")
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Calcular total de gastos (compras + exámenes)
    const totalExpenses = purchases + examFees;

    // Calcular profit neto (retiros - gastos totales)
    const netProfit = withdrawals - totalExpenses;

    // Calcular ROI (Return on Investment) = (Profit / Total Invertido) * 100
    const roi = totalExpenses > 0 ? (netProfit / totalExpenses) * 100 : 0;

    return {
      total,
      totalSpent: purchases,
      totalExamFees: examFees,
      totalExpenses, // Gastos totales (compras + exámenes)
      totalWithdrawn: withdrawals,
      totalDeposited: deposits,
      netProfit, // Profit neto (retiros - gastos)
      roi, // ROI en porcentaje
      transactionsCount: transactions.length,
      purchasesCount: transactions.filter((t) => t.type === "ACCOUNT_PURCHASE").length,
      examFeesCount: transactions.filter((t) => t.type === "EXAM_FEE").length,
      withdrawalsCount: transactions.filter((t) => t.type === "WITHDRAWAL").length,
    };
  }

  /**
   * Obtener estadísticas de contabilidad
   */
  async getStats(userId: string, startDate?: Date, endDate?: Date) {
    const where: any = {
      userId,
      status: "COMPLETED",
    };

    if (startDate || endDate) {
      where.transactionDate = {};
      if (startDate) where.transactionDate.gte = startDate;
      if (endDate) where.transactionDate.lte = endDate;
    }

    const transactions = await this.prisma.transaction.findMany({
      where,
      select: {
        amount: true,
        type: true,
        transactionDate: true,
      },
    });

    const total = transactions.reduce((sum, t) => sum + t.amount, 0);
    
    const purchases = transactions
      .filter((t) => t.type === "ACCOUNT_PURCHASE")
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const examFees = transactions
      .filter((t) => t.type === "EXAM_FEE")
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const withdrawals = transactions
      .filter((t) => t.type === "WITHDRAWAL")
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const deposits = transactions
      .filter((t) => t.type === "DEPOSIT")
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const refunds = transactions
      .filter((t) => t.type === "REFUND")
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Calcular total de gastos (compras + exámenes)
    const totalExpenses = purchases + examFees;

    // Calcular profit neto (retiros - gastos totales)
    const netProfit = withdrawals - totalExpenses;

    // Calcular ROI (Return on Investment) = (Profit / Total Invertido) * 100
    const roi = totalExpenses > 0 ? (netProfit / totalExpenses) * 100 : 0;

    // Calcular promedios
    const purchasesCount = transactions.filter((t) => t.type === "ACCOUNT_PURCHASE").length;
    const examFeesCount = transactions.filter((t) => t.type === "EXAM_FEE").length;
    const withdrawalsCount = transactions.filter((t) => t.type === "WITHDRAWAL").length;

    const avgPurchasePrice = purchasesCount > 0 ? purchases / purchasesCount : 0;
    const avgExamFee = examFeesCount > 0 ? examFees / examFeesCount : 0;
    const avgWithdrawal = withdrawalsCount > 0 ? withdrawals / withdrawalsCount : 0;

    return {
      total,
      purchases,
      examFees,
      totalExpenses, // Gastos totales (compras + exámenes)
      withdrawals,
      deposits,
      refunds,
      netProfit, // Profit neto (retiros - gastos)
      roi, // ROI en porcentaje
      count: transactions.length,
      purchasesCount,
      examFeesCount,
      withdrawalsCount,
      depositsCount: transactions.filter((t) => t.type === "DEPOSIT").length,
      refundsCount: transactions.filter((t) => t.type === "REFUND").length,
      // Promedios
      avgPurchasePrice,
      avgExamFee,
      avgWithdrawal,
      // Costo total por cuenta (compra + exámenes asociados)
      // Nota: Esto requeriría una relación más compleja, por ahora es aproximado
      avgTotalCostPerAccount: purchasesCount > 0 ? totalExpenses / purchasesCount : 0,
    };
  }
}
