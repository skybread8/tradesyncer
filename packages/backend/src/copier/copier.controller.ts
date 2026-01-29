import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from "@nestjs/common";
import { CopierService } from "./copier.service";
import { CreateCopierDto, UpdateCopierDto, AddSlaveAccountDto, UpdateSlaveAccountDto } from "./dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@UseGuards(JwtAuthGuard)
@Controller("copiers")
export class CopierController {
  constructor(private readonly copierService: CopierService) {}

  @Post()
  create(@Request() req, @Body() createCopierDto: CreateCopierDto) {
    return this.copierService.create(req.user.id, createCopierDto);
  }

  @Get()
  findAll(@Request() req) {
    return this.copierService.findAll(req.user.id);
  }

  @Get(":id")
  findOne(@Request() req, @Param("id") id: string) {
    return this.copierService.findOne(id, req.user.id);
  }

  @Patch(":id")
  update(
    @Request() req,
    @Param("id") id: string,
    @Body() updateCopierDto: UpdateCopierDto
  ) {
    return this.copierService.update(id, req.user.id, updateCopierDto);
  }

  @Delete(":id")
  remove(@Request() req, @Param("id") id: string) {
    return this.copierService.remove(id, req.user.id);
  }

  @Post(":id/start")
  start(@Request() req, @Param("id") id: string) {
    return this.copierService.start(id, req.user.id);
  }

  @Post(":id/stop")
  stop(@Request() req, @Param("id") id: string) {
    return this.copierService.stop(id, req.user.id);
  }

  @Post(":id/pause")
  pause(@Request() req, @Param("id") id: string) {
    return this.copierService.pause(id, req.user.id);
  }

  @Post(":id/slaves")
  addSlaveAccount(@Request() req, @Param("id") id: string, @Body() dto: AddSlaveAccountDto) {
    return this.copierService.addSlaveAccount(id, req.user.id, dto);
  }

  @Delete(":id/slaves/:slaveAccountId")
  removeSlaveAccount(@Request() req, @Param("id") id: string, @Param("slaveAccountId") slaveAccountId: string) {
    return this.copierService.removeSlaveAccount(id, req.user.id, slaveAccountId);
  }

  @Patch(":id/slaves/:slaveAccountId")
  updateSlaveConfig(
    @Request() req,
    @Param("id") id: string,
    @Param("slaveAccountId") slaveAccountId: string,
    @Body() updates: UpdateSlaveAccountDto
  ) {
    return this.copierService.updateSlaveConfig(id, req.user.id, slaveAccountId, updates);
  }
}
