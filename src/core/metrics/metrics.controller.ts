import {
  Controller,
  Get,
  Headers,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { MetricsService } from './metrics.service';

@ApiExcludeController()
@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metrics: MetricsService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Get()
  render(@Headers('authorization') authorization?: string): string {
    const token = this.configService.get<string>('METRICS_TOKEN');
    const enabled =
      this.configService.get<string>('METRICS_ENABLED') === 'true' ||
      this.configService.get<string>('NODE_ENV') !== 'production';

    if (!token && !enabled) {
      throw new NotFoundException();
    }

    if (token) {
      const provided = authorization?.replace(/^Bearer\s+/i, '');
      if (provided !== token) {
        throw new UnauthorizedException('Invalid metrics token');
      }
    }

    return this.metrics.render();
  }
}
