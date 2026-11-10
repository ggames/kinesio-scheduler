import * as crypto from 'crypto';

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function hmacSha256(value: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}
