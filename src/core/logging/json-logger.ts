import type { LoggerService } from '@nestjs/common';

type LogLevel = 'debug' | 'log' | 'warn' | 'error' | 'verbose';

/**
 * Minimal dependency-free JSON logger suitable for container stdout.
 * Keeps one JSON object per line so log shippers can parse it reliably.
 */
export class JsonLogger implements LoggerService {
  constructor(private readonly level: LogLevel = 'log') {}

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('info', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  private write(
    level: string,
    message: unknown,
    optionalParams: unknown[],
  ): void {
    if (this.level === 'error' && level !== 'error') return;

    const context =
      typeof optionalParams[optionalParams.length - 1] === 'string'
        ? (optionalParams[optionalParams.length - 1] as string)
        : undefined;
    const rest = context ? optionalParams.slice(0, -1) : optionalParams;

    const entry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      pid: process.pid,
      message: this.serialize(message),
    };

    if (context) entry.context = context;
    if (rest.length > 0) {
      entry.details = rest.map((value) =>
        value instanceof Error
          ? { name: value.name, message: value.message, stack: value.stack }
          : this.serialize(value),
      );
    }

    const line = JSON.stringify(entry);
    if (level === 'error') process.stderr.write(`${line}\n`);
    else process.stdout.write(`${line}\n`);
  }

  private serialize(value: unknown): unknown {
    if (value instanceof Error) {
      return { name: value.name, message: value.message, stack: value.stack };
    }
    if (typeof value === 'string') return value;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return String(value);
    }
  }
}
