import { Injectable } from '@nestjs/common';
import axios from 'axios';
import crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { TuyaHttpAdapter } from './tuya-http.adapter';

/**
 * P2b integration note:
 * Replaced direct `axios` token fetch with calls wrapped by `TuyaHttpAdapter`.
 * This preserves existing behavior while adding circuit-breaker, timeout
 * and retry-with-jitter protection. We deliberately do not change routes
 * or DTOs — this is an internal resiliency enhancement only.
 */

@Injectable()
export class TuyaAuthService {
  private readonly baseUrl = process.env.TUYA_BASE_URL!;
  private readonly clientId = process.env.TUYA_CLIENT_ID!;
  private readonly clientSecret = process.env.TUYA_CLIENT_SECRET!;

  constructor(
    private prisma: PrismaService,
    private tuyaAdapter: TuyaHttpAdapter,
  ) {}

  /**
   * Dohvati globalni access token
   */
  async getAccessToken(): Promise<string> {
    const existing = await this.prisma.tuyaToken.findFirst();

    if (existing && existing.expiresAt > new Date()) {
      return existing.accessToken;
    }

    const now = Date.now();
    const path = '/v1.0/token?grant_type=1';
    const timestamp = now.toString();

    const sign = this.sign('GET', path, timestamp);

    // Use the Tuya adapter's circuit breaker + timeout protection.
    // We still use axios for the actual HTTP call but execute it through
    // the adapter's `executeWithCircuitBreaker` to gain retries/timeouts.
    const res = await this.tuyaAdapter.executeWithCircuitBreaker(async () =>
      axios.get(`${this.baseUrl}${path}`, {
        headers: {
          client_id: this.clientId,
          sign,
          t: timestamp,
          sign_method: 'HMAC-SHA256',
        },
      }),
    );

    if (!res.data?.result?.access_token) {
      throw new Error('Tuya token fetch failed');
    }

    const expiresAt = new Date(
      now + res.data.result.expire_time * 1000 - 60_000, // buffer 1 min
    );

    await this.prisma.tuyaToken.upsert({
      where: { id: existing?.id ?? 1 },
      update: {
        accessToken: res.data.result.access_token,
        expiresAt,
      },
      create: {
        accessToken: res.data.result.access_token,
        expiresAt,
      },
    });

    return res.data.result.access_token;
  }

  private sign(method: 'GET', path: string, t: string) {
    const contentHash = crypto.createHash('sha256').update('').digest('hex');
    const stringToSign =
      this.clientId + t + method + '\n' + contentHash + '\n\n' + path;

    return crypto
      .createHmac('sha256', this.clientSecret)
      .update(stringToSign)
      .digest('hex')
      .toUpperCase();
  }
}
