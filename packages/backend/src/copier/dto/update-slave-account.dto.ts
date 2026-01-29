import { PartialType } from "@nestjs/mapped-types";
import { AddSlaveAccountDto } from "./add-slave-account.dto";

export class UpdateSlaveAccountDto extends PartialType(AddSlaveAccountDto) {}
