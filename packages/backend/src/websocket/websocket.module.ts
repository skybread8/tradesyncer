import { Module } from "@nestjs/common";
import { WebSocketGateway } from "./websocket.gateway";
import { CopierModule } from "../copier/copier.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [CopierModule, AuthModule],
  providers: [WebSocketGateway],
  exports: [WebSocketGateway],
})
export class WebSocketModule {}
