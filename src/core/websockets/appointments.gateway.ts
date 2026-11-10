import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { isUUID } from 'class-validator';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { UsersService } from '../../modules/users/application/users.service';
import { UserStatus } from '../../modules/users/domain/user.entity';
import { normalizeRoles } from '../auth/roles';
import { corsOrigin } from '../config/cors';

/**
 * WebSocket gateway for real-time appointment / slot capacity updates.
 * Connections must present a valid, non-revoked JWT.
 */
@WebSocketGateway({
  cors: {
    origin: corsOrigin,
    credentials: true,
  },
})
export class AppointmentsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AppointmentsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        throw new Error('Missing token');
      }

      const payload: any = await this.jwtService.verifyAsync(token);
      if (await this.authService.isTokenBlacklisted(token)) {
        throw new Error('Token is revoked');
      }

      const user = await this.usersService.findById(payload?.sub);
      if (!user || user.status !== UserStatus.ACTIVE) {
        throw new Error('User is not active');
      }

      client.data.user = {
        userId: user.id,
        email: user.email,
        role: user.role,
        roles: normalizeRoles(user),
      };
      this.logger.log(`Client connected: ${client.id} (${user.id})`);
    } catch (err) {
      this.logger.warn(`Rejected WebSocket connection ${client.id}: ${(err as Error).message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Permite que un cliente autenticado se suscriba a las actualizaciones de un slot.
   * Payload esperado: { slotId: string }
   */
  @SubscribeMessage('subscribeToSlot')
  handleSubscribeToSlot(
    @MessageBody() data: { slotId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!client.data.user) {
      client.disconnect(true);
      return;
    }

    if (!data?.slotId || !isUUID(data.slotId)) {
      client.emit('subscriptionError', { message: 'slotId inválido' });
      return;
    }

    const room = `slots/${data.slotId}`;
    client.join(room);
    client.emit('subscribed', { room });
  }

  /**
   * Emite una actualización de capacidad a todos los clientes en la room del slot.
   */
  emitCapacityUpdate(payload: {
    slotId: string;
    remainingCapacity: number;
    status: string;
  }) {
    this.server.to(`slots/${payload.slotId}`).emit('slotCapacityUpdated', payload);
  }

  private extractToken(client: Socket): string | undefined {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.length > 0) {
      return authToken.replace(/^Bearer\s+/i, '');
    }

    const header = client.handshake.headers?.authorization;
    if (typeof header === 'string') {
      return header.replace(/^Bearer\s+/i, '');
    }

    return undefined;
  }
}
