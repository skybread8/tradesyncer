import { PartialType } from "@nestjs/mapped-types";
import { IsOptional, IsString, IsEnum } from "class-validator";
import { CreateUserDto } from "./create-user.dto";
import { UserRole } from "@prisma/client";

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
