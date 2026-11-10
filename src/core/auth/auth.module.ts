import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtStrategy } from './jwt.strategy';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { UsersModule } from '../../modules/users/users.module';
import { MailModule } from '../mail/mail.module';
import { AuditModule } from '../audit/audit.module';
import { TokenBlacklist } from '../../modules/users/domain/token-blacklist.entity';
import { LoginAttempt } from './domain/login-attempt.entity';
import { RefreshToken } from './domain/refresh-token.entity';
import { PasswordResetToken } from './domain/password-reset-token.entity';
import { LoginAttemptService } from './login-attempt.service';
import { RefreshTokenService } from './refresh-token.service';
import { getJwtSecret } from './jwt.config';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    MailModule,
    AuditModule,
    TypeOrmModule.forFeature([
      TokenBlacklist,
      LoginAttempt,
      RefreshToken,
      PasswordResetToken,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: getJwtSecret(configService),
        signOptions: {
          expiresIn: (configService.get<string>('JWT_ACCESS_TTL') || '15m') as any,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LoginAttemptService,
    RefreshTokenService,
    JwtStrategy,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
