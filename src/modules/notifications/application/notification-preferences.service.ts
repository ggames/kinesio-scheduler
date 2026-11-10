import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationPreference } from '../domain/notification-preference.entity';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

@Injectable()
export class NotificationPreferencesService {
  constructor(
    @InjectRepository(NotificationPreference)
    private readonly repo: Repository<NotificationPreference>,
  ) {}

  async getOrCreate(userId: string): Promise<NotificationPreference> {
    const existing = await this.repo.findOne({ where: { userId } });
    if (existing) return existing;
    const entity = this.repo.create({ userId });
    return this.repo.save(entity);
  }

  async update(
    userId: string,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreference> {
    const entity = await this.getOrCreate(userId);
    Object.assign(entity, dto);
    return this.repo.save(entity);
  }
}
