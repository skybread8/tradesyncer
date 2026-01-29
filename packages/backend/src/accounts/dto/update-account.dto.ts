import { PartialType } from "@nestjs/mapped-types";
import { IsOptional, IsString, IsNumber, IsBoolean, IsEnum, IsObject } from "class-validator";
import { CreateAccountDto } from "./create-account.dto";
import { TradingFirm, Platform } from "@prisma/client";

export class UpdateAccountDto extends PartialType(CreateAccountDto) {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(TradingFirm)
  firm?: TradingFirm;

  @IsOptional()
  @IsEnum(Platform)
  platform?: Platform;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsNumber()
  accountSize?: number;

  @IsOptional()
  @IsNumber()
  currentBalance?: number;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  apiSecret?: string;

  @IsOptional()
  @IsNumber()
  maxDrawdown?: number;

  @IsOptional()
  @IsNumber()
  dailyLossLimit?: number;

  @IsOptional()
  @IsBoolean()
  isConnected?: boolean;

  @IsOptional()
  @IsObject()
  additionalConfig?: any;
}
