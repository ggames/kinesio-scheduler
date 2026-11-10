import { ConfigService } from '@nestjs/config';
import { TokenCipher } from './token-cipher';

function buildCipher(secret = 'a'.repeat(32)): TokenCipher {
  const configService = {
    get: (key: string) => {
      if (key === 'MAIL_ENCRYPTION_KEY') return secret;
      return undefined;
    },
  } as unknown as ConfigService;
  return new TokenCipher(configService);
}

describe('TokenCipher', () => {
  it('debe cifrar y descifrar un valor', () => {
    const cipher = buildCipher();
    const encrypted = cipher.encrypt('https://app.test/activate?token=abc');

    expect(encrypted).not.toContain('abc');
    expect(cipher.decrypt(encrypted)).toBe(
      'https://app.test/activate?token=abc',
    );
  });

  it('debe rechazar un payload alterado', () => {
    const cipher = buildCipher();
    const encrypted = cipher.encrypt('secreto');
    const tampered = `${encrypted.slice(0, -2)}AA`;

    expect(() => cipher.decrypt(tampered)).toThrow();
  });

  it('debe rechazar un secreto demasiado corto', () => {
    expect(() => buildCipher('short')).toThrow();
  });
});
