import { BadRequestException } from '@nestjs/common';
import type { Response } from 'express';

/**
 * Straničenje listi koje rastu (`33`).
 *
 * Zašto na serveru, a ne u klijentu: lista očitanja plina i preporuka raste sa
 * svakim danom rada. Prije ovoga `/gas/readings` je vraćao **sve** redove, a
 * `/recommendations` je tiho rezao na 100 — bez ijednog znaka da još 199 postoji.
 * Klijent koji ne zna da ima više ne može ni tražiti dalje, a korisnik misli da
 * je to sve što je zabilježeno.
 *
 * Ugovor ostaje niz (da ne slomi postojeće klijente), a ukupan broj ide u
 * `X-Total-Count` zaglavlje. Klijent tako zna i koliko ima ukupno i kad je došao
 * do kraja, bez promjene oblika odgovora.
 */

export interface Page {
  limit: number;
  offset: number;
}

export interface PageLimits {
  /** Koliko se vraća kad klijent ne pošalje `limit`. */
  defaultLimit: number;
  /** Gornja granica da jedan zahtjev ne može povući cijelu tabelu. */
  maxLimit: number;
}

/** `X-Total-Count` — ukupan broj redova za filter, ne broj u ovoj strani. */
export const TOTAL_COUNT_HEADER = 'X-Total-Count';

function parseInteger(
  raw: string | undefined,
  name: 'limit' | 'offset',
  fallback: number,
): number {
  if (raw == null || raw === '') return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new BadRequestException(`${name} mora biti cijeli broj ≥ 0`);
  }
  return value;
}

export function parsePage(
  raw: { limit?: string; offset?: string },
  limits: PageLimits,
): Page {
  const limit = parseInteger(raw.limit, 'limit', limits.defaultLimit);
  const offset = parseInteger(raw.offset, 'offset', 0);

  if (limit < 1 || limit > limits.maxLimit) {
    throw new BadRequestException(
      `limit mora biti cijeli broj 1..${limits.maxLimit}`,
    );
  }

  return { limit, offset };
}

/** Postavlja ukupan broj u zaglavlje; tijelo odgovora ostaje niz. */
export function setTotalCount(res: Response | undefined, total: number): void {
  if (res && typeof res.setHeader === 'function') {
    res.setHeader(TOTAL_COUNT_HEADER, String(total));
  }
}

/**
 * Skraćuje niz na jednu stranu. Koristi se kad se broj redova dobija istim
 * upitom (`count` + `findMany` u transakciji) ili kad je izvor već učitan.
 */
export function slicePage<T>(rows: readonly T[], page: Page): T[] {
  return rows.slice(page.offset, page.offset + page.limit);
}
