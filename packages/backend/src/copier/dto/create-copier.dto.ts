import { IsString, IsNumber, IsBoolean, IsOptional, IsEnum } from "class-validator";
import { CopierStatus } from "@prisma/client";

export class CreateCopierDto {
  @IsString()
  name: string;

  @IsString()
  masterAccountId: string;

  @IsOptional()
  @IsBoolean()
  copyEntries?: boolean;

  @IsOptional()
  @IsBoolean()
  copyExits?: boolean;

  @IsOptional()
  @IsBoolean()
  copyModifications?: boolean;

  @IsOptional()
  @IsNumber()
  latencyToleranceMs?: number;
}
