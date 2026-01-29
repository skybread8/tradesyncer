import { Module } from "@nestjs/common";
import { AccountsService } from "./accounts.service";
import { AccountsController } from "./accounts.controller";
import { AdaptersModule } from "./adapters/adapters.module";

@Module({
  imports: [AdaptersModule],
  controllers: [AccountsController],
  providers: [AccountsService],
  exports: [AccountsService, AdaptersModule],
})
export class AccountsModule {}
