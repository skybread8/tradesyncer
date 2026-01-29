import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from "@nestjs/common";
import { AccountsService } from "./accounts.service";
import { CreateAccountDto, UpdateAccountDto } from "./dto";
import { ConnectPlatformDto } from "./dto/connect-platform.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { TestConnectionDto } from "./adapters/test-connection.dto";

@UseGuards(JwtAuthGuard)
@Controller("accounts")
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  create(@Request() req, @Body() createAccountDto: CreateAccountDto) {
    console.log("[AccountsController] create called with:", JSON.stringify(createAccountDto, null, 2));
    return this.accountsService.create(req.user.id, createAccountDto);
  }

  @Get()
  findAll(@Request() req) {
    return this.accountsService.findAll(req.user.id);
  }

  @Get(":id")
  findOne(@Request() req, @Param("id") id: string) {
    return this.accountsService.findOne(id, req.user.id);
  }

  @Patch(":id")
  update(
    @Request() req,
    @Param("id") id: string,
    @Body() updateAccountDto: UpdateAccountDto
  ) {
    console.log("[AccountsController] update called:", {
      id,
      userId: req.user.id,
      updateData: updateAccountDto,
    });
    return this.accountsService.update(id, req.user.id, updateAccountDto);
  }

  @Post("test-connection")
  async testConnection(@Body() testConnectionDto: TestConnectionDto) {
    return this.accountsService.testConnection(testConnectionDto);
  }

  /**
   * Connect to platform and discover accounts
   * New flow: Connect first, then create accounts
   * IMPORTANT: This route must be BEFORE @Post(":id/connect") to avoid route conflicts
   */
  @Post("platforms/connect")
  async connectPlatform(@Request() req, @Body() connectDto: ConnectPlatformDto) {
    console.log("[AccountsController] connectPlatform called with:", {
      firm: connectDto.firm,
      platform: connectDto.platform,
      hasEmail: !!connectDto.email,
      hasPassword: !!connectDto.password,
      hasApiKey: !!connectDto.apiKey,
      hasApiSecret: !!connectDto.apiSecret,
    });
    return this.accountsService.connectPlatform(req.user.id, connectDto);
  }

  /**
   * Create accounts from discovered platform accounts
   * Called after connecting to platform
   * IMPORTANT: This route must be BEFORE @Post(":id/connect") to avoid route conflicts
   */
  @Post("platforms/create-accounts")
  async createAccountsFromPlatform(
    @Request() req,
    @Body() body: {
      accounts: Array<{
        accountNumber: string;
        accountSize: number;
        firm: string;
        platform: string;
        name: string;
      }>;
      credentials: {
        email?: string;
        password?: string;
        apiKey?: string;
        apiSecret?: string;
      };
    }
  ) {
    return this.accountsService.createAccountsFromPlatform(
      req.user.id,
      body.accounts,
      body.credentials
    );
  }

  @Delete(":id")
  remove(@Request() req, @Param("id") id: string) {
    return this.accountsService.remove(id, req.user.id);
  }

  @Post(":id/connect")
  connect(@Request() req, @Param("id") id: string) {
    return this.accountsService.connect(id, req.user.id);
  }

  @Post(":id/disconnect")
  disconnect(@Request() req, @Param("id") id: string) {
    return this.accountsService.disconnect(id, req.user.id);
  }

  @Post("sync-from-platform")
  async syncFromPlatform(
    @Request() req,
    @Body() body: { firm: string; platform: string; email: string; password: string }
  ) {
    return this.accountsService.syncAccountsFromPlatform(
      req.user.id,
      body.firm,
      body.platform,
      body.email,
      body.password
    );
  }
}
