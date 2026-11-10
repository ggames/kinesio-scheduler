import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, existsSync } from 'fs';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { Readable } from 'stream';
import { StorageProvider } from './storage-provider.interface';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly baseDir: string;

  constructor(private readonly configService: ConfigService) {
    this.baseDir =
      this.configService.get<string>('UPLOAD_DIR') ||
      join(process.cwd(), 'uploads');
  }

  async save(
    key: string,
    buffer: Buffer,
    _mimeType: string,
  ): Promise<{ storageKey: string; storagePath: string }> {
    const fullPath = join(this.baseDir, key);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, buffer);
    return { storageKey: key, storagePath: fullPath };
  }

  async getStream(key: string): Promise<Readable> {
    const fullPath = join(this.baseDir, key);
    if (!existsSync(fullPath)) {
      throw new NotFoundException(`Archivo no encontrado: ${key}`);
    }
    return createReadStream(fullPath);
  }

  async getBuffer(key: string): Promise<Buffer> {
    const fullPath = join(this.baseDir, key);
    try {
      return await readFile(fullPath);
    } catch {
      throw new NotFoundException(`Archivo no encontrado: ${key}`);
    }
  }

  async delete(key: string): Promise<void> {
    const fullPath = join(this.baseDir, key);
    if (existsSync(fullPath)) {
      await unlink(fullPath);
    }
  }

  async getSignedUrl(key: string, _expiresInSeconds = 3600): Promise<string> {
    const appUrl = (
      this.configService.get<string>('APP_URL') || 'http://localhost:3000'
    ).replace(/\/+$/, '');
    return `${appUrl}/attachments/file/${encodeURIComponent(key)}`;
  }
}
