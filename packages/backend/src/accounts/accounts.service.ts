import { Injectable, NotFoundException, BadRequestException, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateAccountDto, UpdateAccountDto } from "./dto";
import { AdapterFactory } from "./adapters/adapter.factory";
import { TestConnectionDto } from "./adapters/test-connection.dto";

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(
    private prisma: PrismaService,
    private adapterFactory: AdapterFactory
  ) {}

  async create(userId: string, createAccountDto: CreateAccountDto) {
    this.logger.log(`📝 Creating account for user ${userId}`);
    this.logger.log(`📝 Account data:`, JSON.stringify(createAccountDto, null, 2));
    
    return this.prisma.tradingAccount.create({
      data: {
        ...createAccountDto,
        userId: userId,
      } as any, // Type assertion to handle Prisma's complex types
    });
  }

  async findAll(userId: string) {
    return this.prisma.tradingAccount.findMany({
      where: { userId },
      include: {
        masterCopiers: true,
        slaveConfigs: {
          include: {
            copier: true,
          },
        },
      },
    });
  }

  async findOne(id: string, userId?: string) {
    const account = await this.prisma.tradingAccount.findUnique({
      where: { id },
      include: {
        masterCopiers: true,
        slaveConfigs: {
          include: {
            copier: true,
          },
        },
      },
    });

    if (!account) {
      throw new NotFoundException(`Trading account with ID ${id} not found`);
    }

    if (userId && account.userId !== userId) {
      throw new BadRequestException("Unauthorized");
    }

    return account;
  }

  async update(id: string, userId: string, updateAccountDto: UpdateAccountDto) {
    this.logger.log(`📝 Updating account ${id} for user ${userId}`);
    this.logger.log(`📝 Update data:`, JSON.stringify(updateAccountDto, null, 2));
    
    await this.findOne(id, userId); // Check ownership

    return this.prisma.tradingAccount.update({
      where: { id },
      data: updateAccountDto,
    });
  }

  async remove(id: string, userId: string) {
    this.logger.log(`Attempting to delete account ${id} for user ${userId}`);
    
    const account = await this.findOne(id, userId); // Check ownership

    // Check if account is used as master in any copier
    const masterCopiers = await this.prisma.copier.findMany({
      where: { masterAccountId: id },
    });

    if (masterCopiers.length > 0) {
      this.logger.warn(`Cannot delete account ${id}: used as master in ${masterCopiers.length} copier(s)`);
      throw new BadRequestException(
        `No se puede eliminar la cuenta porque está siendo usada como cuenta maestra en ${masterCopiers.length} copier(s). Elimina primero los copiers asociados.`
      );
    }

    // Check if account is used as slave in any copier
    const slaveConfigs = await this.prisma.copierAccountConfig.findMany({
      where: { slaveAccountId: id },
      include: { copier: true },
    });

    if (slaveConfigs.length > 0) {
      this.logger.warn(`Cannot delete account ${id}: used as slave in ${slaveConfigs.length} copier(s)`);
      const copierNames = slaveConfigs.map((sc) => sc.copier.name).join(", ");
      throw new BadRequestException(
        `No se puede eliminar la cuenta porque está siendo usada como cuenta esclava en ${slaveConfigs.length} copier(s): ${copierNames}. Elimina primero la cuenta de los copiers asociados.`
      );
    }

    // Check if account has any trades
    const tradesCount = await this.prisma.trade.count({
      where: { accountId: id },
    });

    if (tradesCount > 0) {
      this.logger.log(`Account ${id} has ${tradesCount} trades, but will be deleted anyway (trades will be preserved)`);
    }

    try {
      // Disconnect the account first if connected
      if (account.isConnected) {
        this.logger.log(`Account ${id} is connected, attempting to disconnect...`);
        try {
          const adapter = this.adapterFactory.getAdapter(account.platform, account.firm);
          if (adapter.isConnected()) {
            await adapter.disconnect();
          }
        } catch (error) {
          this.logger.warn(`Failed to disconnect adapter for account ${id}, continuing with deletion:`, error);
        }
      }

      const deletedAccount = await this.prisma.tradingAccount.delete({
        where: { id },
      });

      this.logger.log(`Successfully deleted account ${id}`);
      return deletedAccount;
    } catch (error: any) {
      this.logger.error(`Failed to delete account ${id}:`, error);
      
      // Check for foreign key constraint errors
      if (error.code === "P2003") {
        throw new BadRequestException(
          "No se puede eliminar la cuenta porque tiene relaciones activas. Asegúrate de eliminar primero todos los copiers y trades asociados."
        );
      }
      
      throw new BadRequestException(
        `Error al eliminar la cuenta: ${error.message || "Error desconocido"}`
      );
    }
  }

  async connect(id: string, userId: string) {
    const account = await this.findOne(id, userId);

    // Get adapter for this platform
    const adapter = this.adapterFactory.getAdapter(account.platform, account.firm);

    try {
      // Connect using email/password or API key/secret
      await adapter.connect({
        email: account.email || undefined,
        password: account.password || undefined,
        apiKey: account.apiKey || undefined,
        apiSecret: account.apiSecret || undefined,
        accountNumber: account.accountNumber,
        config: account.additionalConfig,
      });

      // Update account status
      return this.prisma.tradingAccount.update({
        where: { id },
        data: {
          isConnected: true,
          lastSyncAt: new Date(),
          errorMessage: null,
        },
      });
    } catch (error) {
      return this.prisma.tradingAccount.update({
        where: { id },
        data: {
          isConnected: false,
          errorMessage: error.message,
        },
      });
    }
  }

  async disconnect(id: string, userId: string) {
    await this.findOne(id, userId);

    const account = await this.findOne(id, userId);
    const adapter = this.adapterFactory.getAdapter(account.platform, account.firm);

    await adapter.disconnect();

    return this.prisma.tradingAccount.update({
      where: { id },
      data: {
        isConnected: false,
      },
    });
  }

  /**
   * Test connection to trading platform without saving account
   */
  async testConnection(testConnectionDto: TestConnectionDto) {
    try {
      const adapter = this.adapterFactory.getAdapter(
        testConnectionDto.platform,
        testConnectionDto.firm
      );

      // Override API URL if provided
      if (testConnectionDto.apiUrl) {
        // This would require modifying the adapter to accept URL override
        // For now, we'll use the default URL from env
      }

      // Attempt connection with email/password or API key/secret
      await adapter.connect({
        email: testConnectionDto.email,
        password: testConnectionDto.password,
        apiKey: testConnectionDto.apiKey,
        apiSecret: testConnectionDto.apiSecret,
        accountNumber: testConnectionDto.accountNumber,
        config: testConnectionDto.apiUrl ? { apiUrls: [testConnectionDto.apiUrl] } : undefined,
      });

      // Try to fetch account info to verify connection
      const accountInfo = await adapter.getAccountInfo();

      // Disconnect after test
      await adapter.disconnect();

      return {
        success: true,
        message: "Connection successful",
        accountInfo: {
          accountId: accountInfo.accountId,
          balance: accountInfo.balance,
          equity: accountInfo.equity,
          positionsCount: accountInfo.positions.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || "Connection failed",
        error: error.toString(),
      };
    }
  }

  /**
   * Connect to platform and discover all available accounts
   * This is the new flow: Connect first, then create accounts
   */
  async connectPlatform(userId: string, connectDto: any) {
    try {
      this.logger.log(`🚀 ===== CONNECTING TO PLATFORM =====`);
      this.logger.log(`   Firm: ${connectDto.firm}`);
      this.logger.log(`   Platform: ${connectDto.platform}`);
      this.logger.log(`   User ID: ${userId}`);
      this.logger.log(`   Has Email: ${!!connectDto.email}`);
      this.logger.log(`   Has Password: ${!!connectDto.password}`);
      this.logger.log(`   Has API Key: ${!!connectDto.apiKey}`);
      this.logger.log(`   Has API Secret: ${!!connectDto.apiSecret}`);

      // Get adapter
      const adapter = this.adapterFactory.getAdapter(
        connectDto.platform,
        connectDto.firm
      );
      
      this.logger.log(`   Adapter: ${adapter.constructor.name}`);
      this.logger.log(`   Adapter Firm: ${adapter.getFirm()}`);
      this.logger.log(`   Adapter Platform: ${adapter.getPlatform()}`);

      // Create connection config
      const connectionConfig = {
        email: connectDto.email,
        password: connectDto.password,
        apiKey: connectDto.apiKey,
        apiSecret: connectDto.apiSecret,
        accountNumber: "", // Will be discovered
        config: {},
      };

      // Connect using credentials (email/password or API key/secret)
      this.logger.log(`🔌 Attempting to connect adapter...`);
      await adapter.connect(connectionConfig);
      this.logger.log(`✅ Adapter connected successfully`);

      // Get all accounts from platform
      this.logger.log(`📋 Fetching all accounts from platform...`);
      let platformAccounts;
      try {
        platformAccounts = await adapter.getAllAccounts();
        this.logger.log(`✅ Retrieved ${platformAccounts.length} account(s) from platform`);
      } catch (error: any) {
        this.logger.warn(`⚠️ getAllAccounts failed: ${error.message}`);
        this.logger.warn(`   Trying alternative method...`);
        // If getAllAccounts fails, try to get account info for a single account
        // This is a fallback for platforms that don't support getAllAccounts
        try {
          const accountInfo = await adapter.getAccountInfo();
          platformAccounts = [accountInfo];
          this.logger.log(`✅ Fallback method succeeded, got 1 account`);
        } catch (fallbackError: any) {
          this.logger.error(`❌ Fallback method also failed: ${fallbackError.message}`);
          throw new Error(`Could not retrieve accounts: ${error.message}`);
        }
      }

      // Disconnect after fetching accounts
      this.logger.log(`🔌 Disconnecting adapter...`);
      await adapter.disconnect();
      this.logger.log(`✅ Adapter disconnected`);

      // Transform platform accounts to include all necessary details
      const discoveredAccounts = platformAccounts.map((acc: any) => ({
        accountId: acc.accountId || acc.id || "",
        accountNumber: acc.accountId || acc.accountNumber || acc.id || "",
        accountSize: acc.balance || acc.accountSize || 0,
        balance: acc.balance || 0,
        equity: acc.equity || acc.balance || 0,
        firm: connectDto.firm,
        platform: connectDto.platform,
        name: acc.name || `${connectDto.firm} - ${acc.accountId || acc.id}`,
      }));

      this.logger.log(`Discovered ${discoveredAccounts.length} account(s) from ${connectDto.firm}`);

      return {
        success: true,
        message: `Connected successfully. Found ${discoveredAccounts.length} account(s)`,
        accounts: discoveredAccounts,
        credentials: {
          email: connectDto.email,
          // Don't return password or API secret for security
          hasPassword: !!connectDto.password,
          hasApiKey: !!connectDto.apiKey,
        },
      };
    } catch (error: any) {
      this.logger.error(`Failed to connect to platform:`, error);
      throw new BadRequestException(
        `Failed to connect to platform: ${error.message}`
      );
    }
  }

  /**
   * Create accounts from discovered platform accounts
   * Called after connecting to platform
   */
  async createAccountsFromPlatform(
    userId: string,
    accounts: Array<{
      accountNumber: string;
      accountSize: number;
      firm: string;
      platform: string;
      name: string;
    }>,
    credentials: {
      email?: string;
      password?: string;
      apiKey?: string;
      apiSecret?: string;
    }
  ) {
    try {
      this.logger.log(`Creating ${accounts.length} account(s) for user ${userId}`);

      const createdAccounts = [];
      const updatedAccounts = [];

      for (const accountData of accounts) {
        // Check if account already exists
        const existingAccount = await this.prisma.tradingAccount.findFirst({
          where: {
            userId,
            accountNumber: accountData.accountNumber,
            firm: accountData.firm as any,
          },
        });

        const accountPayload = {
          name: accountData.name,
          firm: accountData.firm as any,
          platform: accountData.platform as any,
          accountNumber: accountData.accountNumber,
          accountSize: accountData.accountSize,
          currentBalance: accountData.accountSize,
          email: credentials.email,
          password: credentials.password, // In production, encrypt this
          apiKey: credentials.apiKey,
          apiSecret: credentials.apiSecret, // In production, encrypt this
          lastSyncAt: new Date(),
          isConnected: true,
        };

        if (existingAccount) {
          // Update existing account
          const updated = await this.prisma.tradingAccount.update({
            where: { id: existingAccount.id },
            data: accountPayload,
          });
          updatedAccounts.push(updated);
        } else {
          // Create new account
          const created = await this.prisma.tradingAccount.create({
            data: {
              ...accountPayload,
              userId,
            },
          });
          createdAccounts.push(created);
        }
      }

      this.logger.log(`Created ${createdAccounts.length} new account(s) and updated ${updatedAccounts.length} existing account(s)`);

      return {
        success: true,
        message: `Created ${createdAccounts.length} account(s) and updated ${updatedAccounts.length} account(s)`,
        created: createdAccounts,
        updated: updatedAccounts,
      };
    } catch (error: any) {
      this.logger.error(`Failed to create accounts from platform:`, error);
      throw new BadRequestException(
        `Failed to create accounts: ${error.message}`
      );
    }
  }

  /**
   * Sync accounts from platform after login
   * This automatically discovers and adds accounts from the trading platform
   * @deprecated Use connectPlatform and createAccountsFromPlatform instead
   */
  async syncAccountsFromPlatform(
    userId: string,
    firm: string,
    platform: string,
    email: string,
    password: string
  ) {
    try {
      // Get adapter
      const adapter = this.adapterFactory.getAdapter(
        platform as any,
        firm as any
      );

      // Connect using email/password
      await adapter.connect({
        email,
        password,
        accountNumber: "", // Will be discovered
        config: {},
      });

      // Get all accounts from platform
      const platformAccounts = await adapter.getAllAccounts();

      // Disconnect
      await adapter.disconnect();

      // Create or update accounts in database
      const syncedAccounts = [];
      for (const platformAccount of platformAccounts) {
        // Check if account already exists
        const existingAccount = await this.prisma.tradingAccount.findFirst({
          where: {
            userId,
            accountNumber: platformAccount.accountId,
            firm: firm as any,
          },
        });

        if (existingAccount) {
          // Update existing account
          const updated = await this.prisma.tradingAccount.update({
            where: { id: existingAccount.id },
            data: {
              currentBalance: platformAccount.balance,
              email,
              password, // In production, encrypt this
              lastSyncAt: new Date(),
            },
          });
          syncedAccounts.push(updated);
        } else {
          // Create new account
          const created = await this.prisma.tradingAccount.create({
            data: {
              userId,
              name: `${firm} - ${platformAccount.accountId}`,
              firm: firm as any,
              platform: platform as any,
              accountNumber: platformAccount.accountId,
              accountSize: platformAccount.balance,
              currentBalance: platformAccount.balance,
              email,
              password, // In production, encrypt this
              lastSyncAt: new Date(),
            },
          });
          syncedAccounts.push(created);
        }
      }

      return {
        success: true,
        message: `Synced ${syncedAccounts.length} account(s) from ${firm}`,
        accounts: syncedAccounts,
      };
    } catch (error: any) {
      throw new BadRequestException(
        `Failed to sync accounts: ${error.message}`
      );
    }
  }
}
