import { Controller, Get, Param, Query, UseGuards, Request } from "@nestjs/common";
import { TradesService } from "./trades.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@UseGuards(JwtAuthGuard)
@Controller("trades")
export class TradesController {
  constructor(private readonly tradesService: TradesService) {}

  @Get()
  findAll(
    @Request() req,
    @Query("copierId") copierId?: string,
    @Query("accountId") accountId?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string
  ) {
    return this.tradesService.findAll(req.user.id, { 
      copierId, 
      accountId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get("history")
  getHistory(@Request() req, @Query("limit") limit?: number) {
    return this.tradesService.getTradeHistory(req.user.id, limit ? parseInt(limit.toString()) : 100);
  }

  @Get("mappings/:copierId")
  getMappings(@Request() req, @Param("copierId") copierId: string) {
    return this.tradesService.getTradeMappings(copierId, req.user.id);
  }

  @Get(":id")
  findOne(@Request() req, @Param("id") id: string) {
    return this.tradesService.findOne(id, req.user.id);
  }
}
