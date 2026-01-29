import { IsString, IsNumber, IsOptional, IsEnum, IsObject } from "class-validator";
import { TradingFirm, Platform } from "@prisma/client";

export class CreateAccountDto {
  @IsString()
  name: string;

  @IsEnum(TradingFirm)
  firm: TradingFirm;

  @IsOptional()
  @IsEnum(Platform)
  platform?: Platform;

  @IsString()
  accountNumber: string;

  @IsNumber()
  accountSize: number;

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
  @IsObject()
  additionalConfig?: any;
}
