import { IsString, IsOptional, IsEnum } from "class-validator";
import { TradingFirm, Platform } from "@prisma/client";

export class TestConnectionDto {
  @IsEnum(TradingFirm)
  firm: TradingFirm;

  @IsEnum(Platform)
  platform: Platform;

  @IsString()
  accountNumber: string;

  // Email/Password authentication (primary)
  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  password?: string;

  // API Key/Secret authentication (alternative)
  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  apiSecret?: string;

  @IsOptional()
  @IsString()
  apiUrl?: string; // Override default API URL for testing
}
