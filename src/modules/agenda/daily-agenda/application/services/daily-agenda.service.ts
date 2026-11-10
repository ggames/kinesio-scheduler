import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DailyAgenda } from '../../domain/daily-agenda.entity';

@Injectable()
export class DailyAgendaService {
  constructor(
    @InjectRepository(DailyAgenda)
    private readonly repo: Repository<DailyAgenda>,
  ) {}

  async findAll(): Promise<DailyAgenda[]> {
    return this.repo.find({ relations: { professional: true, slots: true } });
  }

  async findOne(id: string): Promise<DailyAgenda> {
    const entity = await this.repo.findOne({
      where: { id },
      relations: { professional: true, slots: true },
    });
    if (!entity) throw new NotFoundException('DailyAgenda not found');
    return entity;
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
