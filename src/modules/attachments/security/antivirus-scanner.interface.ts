export interface AntivirusScanResult {
  isClean: boolean;
  threat?: string;
}

export interface AntivirusScanner {
  scan(buffer: Buffer, fileName: string): Promise<AntivirusScanResult>;
}

export class NoopAntivirusScanner implements AntivirusScanner {
  async scan(_buffer: Buffer, _fileName: string): Promise<AntivirusScanResult> {
    return { isClean: true };
  }
}
