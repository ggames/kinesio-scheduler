import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { MailService } from '../core/mail/mail.service';
import { SMS_PROVIDER } from '../core/sms/sms.types';
import { Inject } from '@nestjs/common';
import type { SmsProvider } from '../core/sms/sms.types';
import { LocalStorageProvider } from '../modules/attachments/storage/local-storage.provider';
import { EmailOutbox } from '../core/mail/domain/email-outbox.entity';
import { EmailOutboxStatus } from '../core/mail/domain/email-outbox.entity';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly mailService: MailService,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
    @Inject(LocalStorageProvider)
    private readonly storageProvider: LocalStorageProvider,
    @InjectRepository(EmailOutbox)
    private readonly outboxRepository: Repository<EmailOutbox>,
  ) {}

  async checkDatabase(): Promise<{ database: 'up'; timestamp: string }> {
    try {
      await this.dataSource.query('SELECT 1');
      return { database: 'up', timestamp: new Date().toISOString() };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'down',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async checkSmtp(): Promise<{ smtp: 'up' | 'down'; timestamp: string }> {
    try {
      // MailService inyectado significa que el módulo de correo está disponible
      const enabled =
        process.env.MAIL_ENABLED !== 'false' && !!this.mailService;
      return {
        smtp: enabled ? 'up' : 'down',
        timestamp: new Date().toISOString(),
      };
    } catch {
      return { smtp: 'down', timestamp: new Date().toISOString() };
    }
  }

  async checkSms(): Promise<{ sms: 'up' | 'down'; timestamp: string }> {
    try {
      const enabled = this.smsProvider.isEnabled();
      return {
        sms: enabled ? 'up' : 'down',
        timestamp: new Date().toISOString(),
      };
    } catch {
      return { sms: 'down', timestamp: new Date().toISOString() };
    }
  }

  async checkStorage(): Promise<{ storage: 'up' | 'down'; timestamp: string }> {
    try {
      // Intenta listar o acceder al storage provider
      const storage = (this.storageProvider as any).baseDir;
      if (storage) {
        return { storage: 'up', timestamp: new Date().toISOString() };
      }
      return { storage: 'down', timestamp: new Date().toISOString() };
    } catch {
      return { storage: 'down', timestamp: new Date().toISOString() };
    }
  }

  async checkOutbox(): Promise<{
    outbox: { pending: number; failed: number };
    timestamp: string;
  }> {
    try {
      const pending = await this.outboxRepository.count({
        where: { status: EmailOutboxStatus.PENDING },
      });
      const failed = await this.outboxRepository.count({
        where: { status: EmailOutboxStatus.FAILED },
      });
      return {
        outbox: { pending, failed },
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        outbox: { pending: -1, failed: -1 },
        timestamp: new Date().toISOString(),
      };
    }
  }

  async checkReadiness(): Promise<{
    status: 'ok';
    database: 'up';
    migrations: 'up';
    smtp: 'up' | 'down';
    sms: 'up' | 'down';
    storage: 'up' | 'down';
    outbox: { pending: number; failed: number };
    timestamp: string;
  }> {
    await this.checkDatabase();

    let executedNames = new Set<string>();
    try {
      const rows: { name: string }[] = await this.dataSource.query(
        `SELECT "name" FROM "migrations"`,
      );
      executedNames = new Set(rows.map((row) => row.name));
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'up',
        migrations: 'unknown',
        timestamp: new Date().toISOString(),
      });
    }

    const loaded = this.dataSource.migrations
      .map((migration) => migration.name || migration.constructor.name)
      .filter(Boolean);
    const pending = loaded.filter((name) => !executedNames.has(name));

    if (pending.length > 0) {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'up',
        migrations: 'pending',
        pending,
        timestamp: new Date().toISOString(),
      });
    }

    const smtp = await this.checkSmtp();
    const sms = await this.checkSms();
    const storage = await this.checkStorage();
    const outbox = await this.checkOutbox();

    return {
      status: 'ok',
      database: 'up',
      migrations: 'up',
      smtp: smtp.smtp,
      sms: sms.sms,
      storage: storage.storage,
      outbox: outbox.outbox,
      timestamp: new Date().toISOString(),
    };
  }
}
