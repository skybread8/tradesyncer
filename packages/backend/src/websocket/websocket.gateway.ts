import {
  WebSocketGateway as WSGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";

@WSGateway({
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  },
  namespace: "/ws",
})
export class WebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebSocketGateway.name);
  private connectedClients: Map<string, Socket> = new Map();

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService
  ) {}

  async handleConnection(client: Socket) {
    try {
      // Extract token from handshake auth
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.split(" ")[1];

      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        client.disconnect();
        return;
      }

      // Verify JWT token
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>("JWT_SECRET") || "your-secret-key-change-in-production",
      });

      // Store user info on socket
      (client as any).userId = payload.sub;

      this.connectedClients.set(client.id, client);
      this.logger.log(`Client ${client.id} (user: ${payload.sub}) connected`);

      // Emit connection success
      client.emit("connected", { userId: payload.sub });
    } catch (error) {
      this.logger.error(`Connection error for client ${client.id}:`, error);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.connectedClients.delete(client.id);
    this.logger.log(`Client ${client.id} disconnected`);
  }

  /**
   * Emit trade update to specific user
   */
  emitTradeUpdate(userId: string, data: any) {
    this.connectedClients.forEach((client) => {
      if ((client as any).userId === userId) {
        client.emit("trade:update", data);
      }
    });
  }

  /**
   * Emit copier status update
   */
  emitCopierUpdate(userId: string, copierId: string, data: any) {
    this.connectedClients.forEach((client) => {
      if ((client as any).userId === userId) {
        client.emit("copier:update", { copierId, ...data });
      }
    });
  }

  /**
   * Subscribe to copier updates
   */
  @SubscribeMessage("copier:subscribe")
  handleSubscribeCopier(@MessageBody() data: { copierId: string }, @ConnectedSocket() client: Socket) {
    const userId = (client as any).userId;
    if (!userId) {
      return { error: "Unauthorized" };
    }

    // Join room for this copier
    client.join(`copier:${data.copierId}`);
    this.logger.log(`User ${userId} subscribed to copier ${data.copierId}`);

    return { success: true, copierId: data.copierId };
  }

  /**
   * Unsubscribe from copier updates
   */
  @SubscribeMessage("copier:unsubscribe")
  handleUnsubscribeCopier(@MessageBody() data: { copierId: string }, @ConnectedSocket() client: Socket) {
    client.leave(`copier:${data.copierId}`);
    return { success: true };
  }

  /**
   * Broadcast to all clients in a copier room
   */
  broadcastToCopier(copierId: string, event: string, data: any) {
    this.server.to(`copier:${copierId}`).emit(event, data);
  }
}
