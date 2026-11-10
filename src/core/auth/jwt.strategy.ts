import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { UsersService } from '../../modules/users/application/users.service';
import { UserStatus } from '../../modules/users/domain/user.entity';
import { normalizeRoles, primaryRole } from './roles';
import { getJwtSecret } from './jwt.config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private authService: AuthService,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(configService),
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: any) {
    const token = req.headers.authorization?.split(' ')[1];
    if (token && (await this.authService.isTokenBlacklisted(token))) {
      throw new UnauthorizedException('Token is revoked');
    }

    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User is not active');
    }

    if (
      typeof payload.ver !== 'number' ||
      payload.ver !== (user.tokenVersion ?? 0)
    ) {
      throw new UnauthorizedException('Token is no longer valid');
    }

    return {
      userId: user.id,
      email: user.email,
      clinicId: user.clinicId ?? null,
      role: primaryRole(user),
      roles: normalizeRoles(user),
      tokenVersion: user.tokenVersion ?? 0,
    };
  }
}
