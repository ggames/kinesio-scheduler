import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * Encrypts short-lived secrets (activation URLs) while they sit in the email
 * outbox. This keeps the database from storing raw activation tokens even when
 * an email delivery is delayed or retried.
 */
@Injectable()
export class TokenCipher {
  private readonly key: Buffer;

  constructor(configService: ConfigService) {
    const secret =
      configService.get<string>('MAIL_ENCRYPTION_KEY') ||
      configService.get<string>('JWT_SECRET');

    if (!secret || secret.length < 32) {
      throw new Error(
        'MAIL_ENCRYPTION_KEY o JWT_SECRET debe tener al menos 32 caracteres',
      );
    }

    this.key = crypto.createHash('sha256').update(secret).digest();
  }

  encrypt(value: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return [
      iv.toString('base64'),
      tag.toString('base64'),
      encrypted.toString('base64'),
    ].join('.');
  }

  decrypt(value: string): string {
    const [ivEncoded, tagEncoded, encryptedEncoded] = value.split('.');
    if (!ivEncoded || !tagEncoded || !encryptedEncoded) {
      throw new Error('Invalid encrypted payload');
    }

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      this.key,
      Buffer.from(ivEncoded, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tagEncoded, 'base64'));

    return Buffer.concat([
      decipher.update(Buffer.from(encryptedEncoded, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }
}
