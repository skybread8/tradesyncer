import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCopierDto, UpdateCopierDto, AddSlaveAccountDto } from "./dto";
import { TradeCopierEngine } from "./trade-copier.engine";
import { CopierStatus } from "@prisma/client";

@Injectable()
export class CopierService {
  constructor(
    private prisma: PrismaService,
    private tradeCopierEngine: TradeCopierEngine
  ) {}

  async create(userId: string, createCopierDto: CreateCopierDto) {
    // Verify master account exists and belongs to user
    const masterAccount = await this.prisma.tradingAccount.findFirst({
      where: {
        id: createCopierDto.masterAccountId,
        userId,
      },
    });

    if (!masterAccount) {
      throw new NotFoundException("Master account not found");
    }

    const copier = await this.prisma.copier.create({
      data: {
        ...createCopierDto,
        userId,
        status: CopierStatus.STOPPED,
      },
      include: {
        masterAccount: true,
        slaveConfigs: {
          include: {
            slaveAccount: true,
          },
        },
      },
    });

    return copier;
  }

  async findAll(userId: string) {
    return this.prisma.copier.findMany({
      where: { userId },
      include: {
        masterAccount: true,
        slaveConfigs: {
          include: {
            slaveAccount: true,
          },
        },
      },
    });
  }

  async findOne(id: string, userId?: string) {
    const copier = await this.prisma.copier.findUnique({
      where: { id },
      include: {
        masterAccount: true,
        slaveConfigs: {
          include: {
            slaveAccount: true,
          },
        },
      },
    });

    if (!copier) {
      throw new NotFoundException(`Copier with ID ${id} not found`);
    }

    if (userId && copier.userId !== userId) {
      throw new BadRequestException("Unauthorized");
    }

    return copier;
  }

  async update(id: string, userId: string, updateCopierDto: UpdateCopierDto) {
    await this.findOne(id, userId);

    return this.prisma.copier.update({
      where: { id },
      data: updateCopierDto,
      include: {
        masterAccount: true,
        slaveConfigs: {
          include: {
            slaveAccount: true,
          },
        },
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);

    // Stop copier if running
    await this.stop(id, userId);

    return this.prisma.copier.delete({
      where: { id },
    });
  }

  async start(id: string, userId: string) {
    const copier = await this.findOne(id, userId);

    if (copier.status === CopierStatus.ACTIVE) {
      throw new BadRequestException("Copier is already active");
    }

    // Verify master account is connected
    if (!copier.masterAccount.isConnected) {
      throw new BadRequestException("Master account is not connected");
    }

    // Start the copier engine
    await this.tradeCopierEngine.start(copier.id);

    // Update status
    return this.prisma.copier.update({
      where: { id },
      data: { status: CopierStatus.ACTIVE },
    });
  }

  async stop(id: string, userId: string) {
    await this.findOne(id, userId);

    // Stop the copier engine
    await this.tradeCopierEngine.stop(id);

    // Update status
    return this.prisma.copier.update({
      where: { id },
      data: { status: CopierStatus.STOPPED },
    });
  }

  async pause(id: string, userId: string) {
    await this.findOne(id, userId);

    await this.tradeCopierEngine.pause(id);

    return this.prisma.copier.update({
      where: { id },
      data: { status: CopierStatus.PAUSED },
    });
  }

  async addSlaveAccount(id: string, userId: string, dto: AddSlaveAccountDto) {
    const copier = await this.findOne(id, userId);

    // Verify slave account exists and belongs to user
    const slaveAccount = await this.prisma.tradingAccount.findFirst({
      where: {
        id: dto.slaveAccountId,
        userId,
      },
    });

    if (!slaveAccount) {
      throw new NotFoundException("Slave account not found");
    }

    // Check if already added
    const existing = await this.prisma.copierAccountConfig.findUnique({
      where: {
        copierId_slaveAccountId: {
          copierId: id,
          slaveAccountId: dto.slaveAccountId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException("Slave account already added to this copier");
    }

    return this.prisma.copierAccountConfig.create({
      data: {
        copierId: id,
        slaveAccountId: dto.slaveAccountId,
        scalingType: dto.scalingType,
        fixedContracts: dto.fixedContracts,
        percentageScale: dto.percentageScale,
        maxContracts: dto.maxContracts,
        dailyLossLimit: dto.dailyLossLimit,
        autoDisable: dto.autoDisable ?? true,
      },
      include: {
        slaveAccount: true,
      },
    });
  }

  async removeSlaveAccount(id: string, userId: string, slaveAccountId: string) {
    await this.findOne(id, userId);

    return this.prisma.copierAccountConfig.delete({
      where: {
        copierId_slaveAccountId: {
          copierId: id,
          slaveAccountId,
        },
      },
    });
  }

  async updateSlaveConfig(
    id: string,
    userId: string,
    slaveAccountId: string,
    updates: Partial<AddSlaveAccountDto>
  ) {
    await this.findOne(id, userId);

    return this.prisma.copierAccountConfig.update({
      where: {
        copierId_slaveAccountId: {
          copierId: id,
          slaveAccountId,
        },
      },
      data: updates,
      include: {
        slaveAccount: true,
      },
    });
  }
}
