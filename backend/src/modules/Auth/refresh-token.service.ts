import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * SEC-4 — rotirani refresh token.
 *
 * Sigurnosni ugovor:
 *  - u bazi se čuva ISKLJUČIVO SHA-256 hash vrijednosti (`tokenHash`), nikad sam
 *    token, pa curenje baze ne daje upotrebljive tokene;
 *  - svaka rotacija opoziva stari token i izdaje novi;
 *  - ponovno korištenje VEĆ opozvanog tokena tretira se kao krađa i opoziva sve
 *    sesije tog korisnika (reuse detection, RFC 6819 §5.2.2.3);
 *  - istekli i nepostojeći token se odbijaju.
 *
 * Cijeli mehanizam je iza zastavice `AUTH_COOKIE_REFRESH_ENABLED` (zadano `off`)
 * na pozivajućoj strani — ovaj servis sam po sebi ne mijenja postojeće ponašanje
 * jer ga bez zastavice nitko ne poziva.
 */

/** Zadani životni vijek refresh tokena: 30 dana. */
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}

export interface RotatedRefreshToken extends IssuedRefreshToken {
  userId: number;
}

export interface TokenMeta {
  userAgent?: string;
  ipAddress?: string;
}

@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** SHA-256 hex (64 znaka). Token se nikad ne pohranjuje u ovom obliku. */
  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** Izdaje novi token i pohranjuje njegov hash. */
  async issue(
    userId: number,
    meta?: TokenMeta,
    ttlMs: number = REFRESH_TOKEN_TTL_MS,
  ): Promise<IssuedRefreshToken> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + ttlMs);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hash(token),
        expiresAt,
        userAgent: meta?.userAgent ?? null,
        ipAddress: meta?.ipAddress ?? null,
      },
    });

    return { token, expiresAt };
  }

  /**
   * Opoziva stari token i izdaje novi. Baca `UnauthorizedException` ako token
   * ne postoji, ako je istekao ili ako je već opozvan (krađa).
   */
  async rotate(
    token: string,
    meta?: TokenMeta,
    ttlMs: number = REFRESH_TOKEN_TTL_MS,
  ): Promise<RotatedRefreshToken> {
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(token) },
    });

    if (!row) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (row.revokedAt) {
      // Reuse detection: netko drži token koji je već rotiran. To je ili
      // krađa ili jako zastarjeli klijent — u oba slučaja najsigurnije je
      // opozvati sve sesije tog korisnika.
      this.logger.warn(
        `Refresh token reuse detected for user ${row.userId}; revoking all of their sessions`,
      );
      await this.revokeAllForUser(row.userId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (row.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    await this.prisma.refreshToken.update({
      where: { id: row.id },
      data: { revokedAt: new Date() },
    });

    const issued = await this.issue(row.userId, meta, ttlMs);
    return { userId: row.userId, ...issued };
  }

  /** Opoziva jedan token. Vraća `false` ako token ne postoji; ne baca. */
  async revoke(token: string): Promise<boolean> {
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(token) },
    });
    if (!row) return false;
    if (row.revokedAt) return true;

    await this.prisma.refreshToken.update({
      where: { id: row.id },
      data: { revokedAt: new Date() },
    });
    return true;
  }

  /** Opoziva sve aktivne sesije korisnika i vraća koliko ih je opozvano. */
  async revokeAllForUser(userId: number): Promise<number> {
    const result = await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }
}
