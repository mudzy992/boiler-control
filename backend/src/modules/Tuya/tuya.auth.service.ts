import { Injectable } from '@nestjs/common';
import axios from 'axios';
import crypto from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class TuyaAuthService {
  private readonly baseUrl = process.env.TUYA_BASE_URL!;
  private readonly clientId = process.env.TUYA_CLIENT_ID!;
  private readonly clientSecret = process.env.TUYA_CLIENT_SECRET!;

  constructor(private prisma: PrismaService) {}

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

    const res = await axios.get(`${this.baseUrl}${path}`, {
      headers: {
        client_id: this.clientId,
        sign,
        t: timestamp,
        sign_method: 'HMAC-SHA256',
      },
    });

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
