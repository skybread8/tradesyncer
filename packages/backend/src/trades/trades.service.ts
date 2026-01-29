import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class TradesService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    userId: string, 
    filters?: { 
      copierId?: string; 
      accountId?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ) {
    // Get user's accounts
    const userAccounts = await this.prisma.tradingAccount.findMany({
      where: { userId },
      select: { id: true },
    });

    const accountIds = userAccounts.map((acc) => acc.id);

    const where: any = {
      accountId: { in: accountIds },
    };

    if (filters?.copierId) {
      where.copierId = filters.copierId;
    }

    if (filters?.accountId) {
      where.accountId = filters.accountId;
    }

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters?.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters?.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    return this.prisma.trade.findMany({
      where,
      include: {
        account: true,
        copier: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async findOne(id: string, userId: string) {
    // Verify user owns the account this trade belongs to
    const trade = await this.prisma.trade.findUnique({
      where: { id },
      include: {
        account: true,
        copier: true,
      },
    });

    if (!trade) {
      throw new NotFoundException(`Trade with ID ${id} not found`);
    }

    const userAccount = await this.prisma.tradingAccount.findFirst({
      where: {
        id: trade.accountId,
        userId,
      },
    });

    if (!userAccount) {
      throw new NotFoundException("Unauthorized");
    }

    return trade;
  }

  async getTradeHistory(userId: string, limit = 100) {
    const userAccounts = await this.prisma.tradingAccount.findMany({
      where: { userId },
      select: { id: true },
    });

    const accountIds = userAccounts.map((acc) => acc.id);

    return this.prisma.trade.findMany({
      where: {
        accountId: { in: accountIds },
      },
      include: {
        account: true,
        copier: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    });
  }

  async getTradeMappings(copierId: string, userId: string) {
    // Verify user owns the copier
    const copier = await this.prisma.copier.findFirst({
      where: {
        id: copierId,
        userId,
      },
    });

    if (!copier) {
      throw new NotFoundException("Copier not found");
    }

    return this.prisma.tradeMapping.findMany({
      where: { copierId },
      include: {
        copier: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }
}
