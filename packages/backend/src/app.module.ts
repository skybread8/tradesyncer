import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { AccountsModule } from "./accounts/accounts.module";
import { CopierModule } from "./copier/copier.module";
import { TradesModule } from "./trades/trades.module";
import { WebSocketModule } from "./websocket/websocket.module";
import { AccountingModule } from "./accounting/accounting.module";
import { PrismaModule } from "./prisma/prisma.module";
import { JwtAuthGuard } from "./auth/guards/jwt-auth.guard";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.local", ".env"],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    AccountsModule,
    CopierModule,
    TradesModule,
    WebSocketModule,
    AccountingModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
