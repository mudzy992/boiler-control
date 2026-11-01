import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';

/**
 * SEC-6 — dedicated scraper credential for /metrics*.
 *
 * This is deliberately not a user JWT: monitoring must not depend on a human
 * account, password rotation or refresh-token lifecycle. The guard fails closed
 * when the secret is absent/weak, and never logs the supplied credential.
 */
export const METRICS_AUTH_TOKEN_ENV = 'METRICS_AUTH_TOKEN';
export const METRICS_AUTH_MIN_LENGTH = 32;

function configuredToken(): string | null {
  const raw = process.env[METRICS_AUTH_TOKEN_ENV];
  if (typeof raw !== 'string') return null;
  const token = raw.trim();
  if (token.length < METRICS_AUTH_MIN_LENGTH || /\s/.test(token)) return null;
  return token;
}

function constantTimeEqual(a: string, b: string): boolean {
  // Hash first so timingSafeEqual gets equal-length buffers and the comparison
  // does not reveal the configured token length through an early return.
  const left = createHash('sha256').update(a, 'utf8').digest();
  const right = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(left, right);
}

@Injectable()
export class MetricsAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    response.setHeader('Cache-Control', 'no-store');

    const expected = configuredToken();
    if (!expected) {
      throw new ServiceUnavailableException(
        'Metrics authentication is not configured',
      );
    }

    const header = request.headers.authorization;
    const match =
      typeof header === 'string' ? /^Bearer\s+(\S+)$/i.exec(header) : null;
    if (!match || !constantTimeEqual(match[1], expected)) {
      response.setHeader('WWW-Authenticate', 'Bearer');
      throw new UnauthorizedException('Invalid metrics credentials');
    }

    return true;
  }
}
