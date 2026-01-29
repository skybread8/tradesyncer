import { IsString, IsNumber, IsBoolean, IsOptional, IsEnum } from "class-validator";
import { RiskScalingType } from "@prisma/client";

export class AddSlaveAccountDto {
  @IsString()
  slaveAccountId: string;

  @IsEnum(RiskScalingType)
  scalingType: RiskScalingType;

  @IsOptional()
  @IsNumber()
  fixedContracts?: number;

  @IsOptional()
  @IsNumber()
  percentageScale?: number;

  @IsOptional()
  @IsNumber()
  maxContracts?: number;

  @IsOptional()
  @IsNumber()
  dailyLossLimit?: number;

  @IsOptional()
  @IsBoolean()
  autoDisable?: boolean;
}
