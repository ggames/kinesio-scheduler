import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, IsNull, LessThan } from 'typeorm';
import * as crypto from 'crypto';
import { User, UserStatus } from '../../modules/users/domain/user.entity';
import { AuditService } from '../audit/audit.service';
import { AuditEventType } from '../audit/domain/audit-log.entity';
import { RequestContextService } from '../request-context/request-context.service';
import { sha256 } from '../utils/hash.util';
import { RefreshToken } from './domain/refresh-token.entity';

const DEFAULT_TTL_DAYS = 30;

export interface IssuedRefreshToken {
  token: string;
  entity: RefreshToken;
}

export interface RotatedRefreshToken extends IssuedRefreshToken {
  user: User;
  reuseDetected?: boolean;
}

@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly requestContext: RequestContextService,
    private readonly auditService: AuditService,
  ) {}

  async issue(userId: string): Promise<IssuedRefreshToken> {
    const context = this.requestContext.get();
    const { rawToken, entity } = this.buildToken(
      userId,
      crypto.randomUUID(),
      context?.userAgent,
      context?.ip,
    );

    const saved = await this.dataSource.getRepository(RefreshToken).save(entity);
    return { token: rawToken, entity: saved };
  }

  async rotate(rawToken: string): Promise<RotatedRefreshToken> {
    const tokenHash = sha256(rawToken);
    const context = this.requestContext.get();

    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(RefreshToken);
      const current = await repository.findOne({
        where: { tokenHash },
        lock: { mode: 'pessimistic_write' },
      });

      if (!current) {
        throw new UnauthorizedException('Refresh token inválido');
      }

      if (current.revokedAt) {
        await repository.update(
          { familyId: current.familyId },
          { revokedAt: new Date() },
        );
        this.logger.warn(
          `Reutilización de refresh token detectada para usuario ${current.userId}`,
        );
        await this.auditService.record({
          eventType: AuditEventType.REFRESH_TOKEN_REUSE,
          targetUserId: current.userId,
        });
        throw new UnauthorizedException('Refresh token inválido');
      }

      if (current.expiresAt.getTime() <= Date.now()) {
        throw new UnauthorizedException('Refresh token expirado');
      }

      const user = await manager.findOne(User, { where: { id: current.userId } });
      if (!user || user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException('Usuario no habilitado');
      }

      const { rawToken: nextRawToken, entity: nextEntity } = this.buildToken(
        user.id,
        current.familyId,
        context?.userAgent,
        context?.ip,
      );
      const next = await repository.save(nextEntity);

      current.revokedAt = new Date();
      current.replacedByTokenId = next.id;
      await repository.save(current);

      return {
        token: nextRawToken,
        entity: next,
        user,
      };
    });
  }

  async revoke(rawToken: string): Promise<void> {
    if (!rawToken) return;

    await this.dataSource
      .getRepository(RefreshToken)
      .update({ tokenHash: sha256(rawToken), revokedAt: IsNull() }, {
        revokedAt: new Date(),
      });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.dataSource
      .getRepository(RefreshToken)
      .update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupExpiredTokens(): Promise<void> {
    const result = await this.dataSource
      .getRepository(RefreshToken)
      .delete({ expiresAt: LessThan(new Date()) });
    this.logger.log(`Refresh tokens expirados eliminados: ${result.affected ?? 0}`);
  }

  private buildToken(
    userId: string,
    familyId: string,
    userAgent?: string,
    ip?: string,
  ): { rawToken: string; entity: RefreshToken } {
    const rawToken = crypto.randomBytes(48).toString('hex');
    const ttlDays = this.numberConfig('REFRESH_TOKEN_TTL_DAYS', DEFAULT_TTL_DAYS);

    const entity = new RefreshToken();
    entity.userId = userId;
    entity.tokenHash = sha256(rawToken);
    entity.familyId = familyId;
    entity.expiresAt = new Date(
      Date.now() + ttlDays * 24 * 60 * 60 * 1000,
    );
    entity.userAgent = userAgent?.slice(0, 512) ?? null;
    entity.ip = ip?.slice(0, 64) ?? null;

    return { rawToken, entity };
  }

  private numberConfig(key: string, fallback: number): number {
    const value = Number(this.configService.get<string>(key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
}
