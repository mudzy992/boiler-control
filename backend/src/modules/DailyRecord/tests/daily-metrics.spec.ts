import { NotFoundException } from '@nestjs/common';

import {
  DailyMetricsService,
  DAILY_METRIC_FIELDS,
} from '../daily-metrics.service';

/**
 * C1 (audit analitike §1.1) — kanal za dnevne mjerne kolone.
 *
 * **Zašto ovaj test postoji.** Kolone su mjerene i zapisane, a nijedan endpoint
 * ih nije čitao. Endpoint koji ih izlaže mora pogoditi tri stvari koje se lako
 * previde:
 *
 *   1. **`null` nije `0`.** Dan sa `null` `overshootC` nije „nije bilo
 *      prebačaja", nego „nije mjereno" — ista greška kao B1.
 *   2. **Pokrivenost je po koloni**, ne ukupna: `dutyPercent` može biti
 *      popunjen na 5 dana a `heatRateCPerHour` na 2.
 *   3. **Tuđi dom je 404, ne 500.**
 */

function makeService(rows: Array<Record<string, unknown>>, home = { id: 1 }) {
  const db = {
    homeProfile: {
      findFirst: () => Promise.resolve(home),
    },
    dailyRecord: {
      findMany: () => Promise.resolve(rows),
    },
  };
  return new DailyMetricsService(db as any);
}

const day = (localDate: string, extra: Record<string, unknown> = {}) => ({
  localDate,
  outcomeAt: new Date('2026-11-10T00:00:00Z'),
  ...extra,
});

describe('C1 — dnevne metrike', () => {
  it('null ostaje null (ne 0) i ne ulazi u pokrivenost', async () => {
    const service = makeService([
      day('2026-11-08', { dutyPercent: 42, overshootC: 0.5 }),
      day('2026-11-09', { dutyPercent: null, overshootC: null }),
    ]);

    const result = await service.forHome(7, 1);

    expect(result.rows).toHaveLength(2);
    // Dan sa mjerenjem: vrijednosti su tu.
    expect(result.rows[0].dutyPercent).toBe(42);
    // Dan bez mjerenja: **polje ne postoji**, ne `0`.
    expect('dutyPercent' in result.rows[1]).toBe(false);
    expect('overshootC' in result.rows[1]).toBe(false);

    expect(result.coverage.byField.dutyPercent).toBe(1);
    expect(result.coverage.byField.overshootC).toBe(1);
    expect(result.coverage.byField.hysteresisK).toBe(0);
  });

  it('pokrivenost je po koloni, ne ukupna', async () => {
    const service = makeService([
      day('2026-11-08', { dutyPercent: 40, heatRateCPerHour: 1.2 }),
      day('2026-11-09', { dutyPercent: 55 }),
      day('2026-11-10', { dutyPercent: 61 }),
      day('2026-11-11', {}),
    ]);

    const result = await service.forHome(7, 1);

    expect(result.coverage.days).toBe(4);
    expect(result.coverage.withOutcome).toBe(4);
    // 3 od 4 za duty, 1 od 4 za heatRate — dva različita odgovora.
    expect(result.coverage.byField.dutyPercent).toBe(3);
    expect(result.coverage.byField.heatRateCPerHour).toBe(1);
    // Najbolje pokrivena kolona daje 75 %.
    expect(result.coverage.bestFieldShare).toBe(75);
  });

  it('nula je mjerenje: zadržava se i broji u pokrivenost', async () => {
    const service = makeService([day('2026-11-08', { overshootC: 0 })]);

    const result = await service.forHome(7, 1);

    expect(result.rows[0].overshootC).toBe(0);
    expect(result.coverage.byField.overshootC).toBe(1);
  });

  it('prazan prozor daje 0 % pokrivenosti, ne NaN', async () => {
    const service = makeService([]);

    const result = await service.forHome(7, 1);

    expect(result.rows).toEqual([]);
    expect(result.coverage.days).toBe(0);
    expect(result.coverage.bestFieldShare).toBe(0);
    expect(Number.isNaN(result.coverage.bestFieldShare)).toBe(false);
  });

  it('tuđi dom je 404, ne 500', async () => {
    // `null`, ne `undefined`: `undefined` bi aktivirao zadatu vrijednost helpera.
    const service = makeService([], null as never);

    await expect(service.forHome(7, 1)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('izlaže sve kolone iz spiska, bez izmišljenih imena', async () => {
    const service = makeService([day('2026-11-08')]);
    const result = await service.forHome(7, 1);

    // Ključevi pokrivenosti su TAČNO spisak polja — novo polje u spisku je
    // odluka, a ne slučajnost.
    expect(Object.keys(result.coverage.byField).sort()).toEqual(
      [...DAILY_METRIC_FIELDS].sort(),
    );
  });
});
