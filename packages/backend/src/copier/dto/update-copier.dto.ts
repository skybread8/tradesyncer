import { PartialType } from "@nestjs/mapped-types";
import { IsOptional, IsString, IsBoolean, IsNumber, IsEnum } from "class-validator";
import { CreateCopierDto } from "./create-copier.dto";
import { CopierStatus } from "@prisma/client";

export class UpdateCopierDto extends PartialType(CreateCopierDto) {
  @IsOptional()
  @IsString()
  name?: string;

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
