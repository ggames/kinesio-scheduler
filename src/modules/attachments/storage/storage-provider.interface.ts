import { Readable } from 'stream';

export interface StorageProvider {
  save(key: string, buffer: Buffer, mimeType: string): Promise<{ storageKey: string; storagePath: string }>;
  getStream(key: string): Promise<Readable>;
  getBuffer(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getSignedUrl?(key: string, expiresInSeconds?: number): Promise<string>;
}
