import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from "@nestjs/common";
import { AccountingService } from "./accounting.service";
import { CreateTransactionDto, UpdateTransactionDto } from "./dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { TransactionType, TransactionStatus } from "@prisma/client";

@UseGuards(JwtAuthGuard)
@Controller("accounting")
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Post("transactions")
  create(@Request() req, @Body() createTransactionDto: CreateTransactionDto) {
    return this.accountingService.create(req.user.id, createTransactionDto);
  }

  @Get("transactions")
  findAll(
    @Request() req,
    @Query("type") type?: TransactionType,
    @Query("status") status?: TransactionStatus
  ) {
    return this.accountingService.findAll(req.user.id, { type, status });
  }

  @Get("balance")
  getBalance(@Request() req) {
    return this.accountingService.getBalance(req.user.id);
  }

  @Get("stats")
  getStats(
    @Request() req,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string
  ) {
    return this.accountingService.getStats(
      req.user.id,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );
  }

  @Get("transactions/:id")
  findOne(@Request() req, @Param("id") id: string) {
    return this.accountingService.findOne(id, req.user.id);
  }

  @Patch("transactions/:id")
  update(
    @Request() req,
    @Param("id") id: string,
    @Body() updateTransactionDto: UpdateTransactionDto
  ) {
    return this.accountingService.update(id, req.user.id, updateTransactionDto);
  }

  @Delete("transactions/:id")
  remove(@Request() req, @Param("id") id: string) {
    return this.accountingService.remove(id, req.user.id);
  }
}
