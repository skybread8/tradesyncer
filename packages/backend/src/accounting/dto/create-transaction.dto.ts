import { IsString, IsNumber, IsOptional, IsEnum, IsDateString } from "class-validator";
import { TransactionType, TransactionStatus, TradingFirm } from "@prisma/client";

export class CreateTransactionDto {
  @IsEnum(TransactionType)
  type: TransactionType;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  tradingAccountId?: string;

  @IsOptional()
  @IsEnum(TradingFirm)
  firm?: TradingFirm;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  externalId?: string;

  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @IsOptional()
  @IsDateString()
  transactionDate?: string;
}
