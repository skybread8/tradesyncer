import { Module } from "@nestjs/common";
import { CopierService } from "./copier.service";
import { CopierController } from "./copier.controller";
import { TradeCopierEngine } from "./trade-copier.engine";
import { AccountsModule } from "../accounts/accounts.module";
import { TradesModule } from "../trades/trades.module";

@Module({
  imports: [AccountsModule, TradesModule],
  controllers: [CopierController],
  providers: [CopierService, TradeCopierEngine],
  exports: [CopierService, TradeCopierEngine],
})
export class CopierModule {}
