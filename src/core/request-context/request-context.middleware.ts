import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { RequestContextService } from './request-context.service';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly requestContext: RequestContextService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers['x-request-id'];
    const requestId =
      typeof incoming === 'string' && incoming.length <= 128
        ? incoming
        : randomUUID();

    res.setHeader('X-Request-Id', requestId);

    this.requestContext.run(
      {
        requestId,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
      next,
    );
  }
}
