import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../core/auth/decorators/public.decorator';
import { HealthService } from './health.service';

@ApiExcludeController()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  async check() {
    const database = await this.healthService.checkDatabase();
    return { status: 'ok', ...database };
  }

  @Public()
  @Get('live')
  live() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('ready')
  async ready() {
    return this.healthService.checkReadiness();
  }

  @Public()
  @Get('smtp')
  async smtp() {
    return this.healthService.checkSmtp();
  }

  @Public()
  @Get('sms')
  async sms() {
    return this.healthService.checkSms();
  }

  @Public()
  @Get('storage')
  async storage() {
    return this.healthService.checkStorage();
  }

  @Public()
  @Get('outbox')
  async outbox() {
    return this.healthService.checkOutbox();
  }
}
