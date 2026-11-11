import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  BACKFILL_VERSION_PREFIX,
  buildDailyHistory,
  classifyOrigin,
  type DailyRecordInput,
} from '../daily-history';
import {
  DailyHistoryService,
  MAX_HISTORY_ROWS,
} from '../daily-history.service';
import { validatedLimit } from '../daily-history.controller';

/**
 * Historija dnevnih zapisa (`31`).
 *
 * Najvažnije što ovi testovi čuvaju: **rekonstruisan red ne smije izgledati kao
 * izmjeren.** Backfill je upisao 301 dan; ako klijent ne dobije porijeklo, poslije
 * niko ne može razlikovati ono što je sistem zaista izmjerio od onoga što je
 * izvedeno iz starih događaja.
 */

function row(overrides: Partial<DailyRecordInput> = {}): DailyRecordInput {
  return {
    localDate: '2026-03-10',
    proposedFlowTemp: null,
    proposedAt: null,
    cycles: null,
    medianCycleMin: null,
    dutyPercent: null,
    overshootC: null,
    undershootC: null,
    flowSetC: null,
    flowSetSource: null,
    gasM3: null,
    degreeDays: null,
    nightUndershootC: null,
    hysteresisK: null,
    heatRateCPerHour: null,
    shadowFlowC: null,
    shadowAction: null,
    modelVersion: null,
    outcomeVersion: null,
    outcomeAt: null,
    ...overrides,
  };
}

describe('classifyOrigin', () => {
  it('backfill u `modelVersion` je BACKFILL', () => {
    expect(
      classifyOrigin({
        modelVersion: `${BACKFILL_VERSION_PREFIX}events-1`,
        outcomeVersion: null,
      }),
    ).toBe('BACKFILL');
  });

  it('backfill u `outcomeVersion` je dovoljan', () => {
    expect(
      classifyOrigin({
        modelVersion: null,
        outcomeVersion: `${BACKFILL_VERSION_PREFIX}events-1`,
      }),
    ).toBe('BACKFILL');
  });

  it('red bez oznake je LIVE — nije ga napisao backfill', () => {
    expect(classifyOrigin({ modelVersion: 'w-3', outcomeVersion: 'o-2' })).toBe(
      'LIVE',
    );
    expect(classifyOrigin({ modelVersion: null, outcomeVersion: null })).toBe(
      'LIVE',
    );
  });

  it('prefiks mora biti na početku oznake, ne bilo gdje', () => {
    expect(
      classifyOrigin({
        modelVersion: 'w-not-backfill-1',
        outcomeVersion: null,
      }),
    ).toBe('LIVE');
  });
});

describe('buildDailyHistory — šta red nosi', () => {
  it('nula ciklusa je mjerenje, a ne odsustvo mjerenja', () => {
    // Dan bez grijanja je podatak: `0` ciklusa je izmjereno. `null` je ono što
    // znači „nije mjereno", i ta razlika se ne smije izgubiti u klijentu.
    const { rows } = buildDailyHistory([row({ cycles: 0 })]);
    expect(rows[0].has.cycles).toBe(true);
  });

  it('prazan red nema ni jednu grupu mjerenja', () => {
    const { rows } = buildDailyHistory([row()]);
    expect(rows[0].has).toEqual({
      cycles: false,
      gas: false,
      degreeDays: false,
      night: false,
      hysteresis: false,
      heatRate: false,
      shadow: false,
    });
  });

  it('shadow je prisutan i kad je samo akcija upisana', () => {
    const { rows } = buildDailyHistory([row({ shadowAction: 'HOLD' })]);
    expect(rows[0].has.shadow).toBe(true);
  });

  it('redovi se sortiraju po datumu, a datumi su tekst', () => {
    const { rows } = buildDailyHistory([
      row({ localDate: '2026-03-11' }),
      row({ localDate: '2025-12-31' }),
      row({ localDate: '2026-01-01' }),
    ]);
    expect(rows.map((entry) => entry.localDate)).toEqual([
      '2025-12-31',
      '2026-01-01',
      '2026-03-11',
    ]);
  });
});

describe('buildDailyHistory — sažetak', () => {
  const rows = [
    row({
      localDate: '2026-01-05',
      cycles: 4,
      gasM3: 8.2,
      modelVersion: `${BACKFILL_VERSION_PREFIX}events-1`,
    }),
    row({
      localDate: '2026-01-06',
      cycles: 0,
      degreeDays: 12.4,
      modelVersion: `${BACKFILL_VERSION_PREFIX}events-1`,
    }),
    row({ localDate: '2026-01-07', shadowFlowC: 44, shadowAction: 'LOWER' }),
  ];

  it('broji žive i rekonstruisane odvojeno', () => {
    const { summary } = buildDailyHistory(rows);
    expect(summary.days).toBe(3);
    expect(summary.backfill).toBe(2);
    expect(summary.live).toBe(1);
  });

  it('broji pokrivenost po grupi mjerenja', () => {
    const { summary } = buildDailyHistory(rows);
    expect(summary.withCycles).toBe(2); // uključujući dan sa 0 ciklusa
    expect(summary.withGas).toBe(1);
    expect(summary.withDegreeDays).toBe(1);
    expect(summary.withShadow).toBe(1);
  });

  it('granice perioda su stvarni datumi, ne podrazumijevani', () => {
    const { summary } = buildDailyHistory(rows);
    expect(summary.firstDate).toBe('2026-01-05');
    expect(summary.lastDate).toBe('2026-01-07');
  });

  it('prazna historija nema granice — `null`, ne izmišljen datum', () => {
    const { summary, rows: empty } = buildDailyHistory([]);
    expect(empty).toEqual([]);
    expect(summary.firstDate).toBeNull();
    expect(summary.lastDate).toBeNull();
    expect(summary.days).toBe(0);
  });

  it('skraćen odgovor to i kaže', () => {
    expect(buildDailyHistory(rows).truncated).toBe(false);
    expect(buildDailyHistory(rows, { truncated: true }).truncated).toBe(true);
  });
});

describe('DailyHistoryService', () => {
  function setup(
    options: {
      home?: { id: number } | null;
      rows?: unknown[];
      /** Ukupan broj u bazi; `undefined` = isti kao `rows.length`. */
      total?: number;
    } = {},
  ) {
    const findMany = jest.fn().mockResolvedValue(options.rows ?? []);
    // Servis sada traži i `count` (`36`): `take: limit + 1` kaže „ima još",
    // ali ne koliko — a bez toga tabela ne može pisati „21–40 od 302".
    const count = jest
      .fn()
      .mockResolvedValue(options.total ?? (options.rows ?? []).length);
    /*
     * `F13` (treći krug): servis sada čita i `HeatingEvent` (ciklusi za dane
     * koje obračun nije stigao) i traži zonu doma. Stub mora imati oba, inače
     * test pada na `prisma.heatingEvent.findMany is not a function` — ne zato
     * što je logika pogrešna, nego zato što je stub ostao na starom obliku.
     * CI je to pokazao (run 42920655959).
     */
    const heatingEvent = { findMany: jest.fn().mockResolvedValue([]) };
    const prisma = {
      homeProfile: {
        findFirst: jest.fn().mockResolvedValue(
          options.home === undefined
            ? {
                id: 7,
                weatherTimezone: 'Europe/Sarajevo',
                user: { timezone: null },
              }
            : options.home,
        ),
      },
      dailyRecord: { findMany, count },
      heatingEvent,
    };
    return {
      service: new DailyHistoryService(prisma as never),
      findMany,
      count,
    };
  }

  it('odbija tuđi dom', async () => {
    const { service } = setup({ home: null });
    await expect(service.forHome(1, 9, { limit: 10 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('čita jedan red više od limita, da zna je li skraćeno', async () => {
    const { service, findMany } = setup({ rows: [] });
    await service.forHome(1, 7, { limit: 25 });
    expect(findMany.mock.calls[0][0].take).toBe(26);
  });

  it('kad ima više od limita, vraća limit i označi skraćenje', async () => {
    const many = Array.from({ length: 4 }, (_, index) =>
      row({ localDate: `2026-02-0${index + 1}` }),
    );
    const { service } = setup({ rows: many });

    const result = await service.forHome(1, 7, { limit: 3 });
    expect(result.rows).toHaveLength(3);
    expect(result.truncated).toBe(true);
  });

  it('period ide u upit kao granice na `localDate`', async () => {
    const { service, findMany } = setup({ rows: [] });
    await service.forHome(1, 7, {
      from: '2026-01-01',
      to: '2026-03-01',
      limit: 10,
    });

    expect(findMany.mock.calls[0][0].where).toEqual({
      homeProfileId: 7,
      localDate: { gte: '2026-01-01', lte: '2026-03-01' },
    });
  });

  it('bez perioda ne postavlja filter datuma', async () => {
    const { service, findMany } = setup({ rows: [] });
    await service.forHome(1, 7, { limit: 10 });
    expect(findMany.mock.calls[0][0].where).toEqual({ homeProfileId: 7 });
  });
});

describe('validatedLimit', () => {
  it('zadano je 60 kad nije poslano', () => {
    expect(validatedLimit(undefined)).toBe(60);
    expect(validatedLimit('')).toBe(60);
  });

  it('prihvata cio broj u granicama', () => {
    expect(validatedLimit('1')).toBe(1);
    expect(validatedLimit(String(MAX_HISTORY_ROWS))).toBe(MAX_HISTORY_ROWS);
  });

  it.each(['0', '-1', '1.5', 'abc', String(MAX_HISTORY_ROWS + 1)])(
    'odbija %s',
    (raw) => {
      expect(() => validatedLimit(raw)).toThrow(BadRequestException);
    },
  );
});

describe('DailyHistoryService — straničenje (`36`)', () => {
  /**
   * `offset` i `total` postoje da tabela može reći „Prikazano 21–40 od 302".
   * Bez `total` bi klijent mogao samo nagađati, a bez `offset` bi „sljedeća
   * strana" ponovo čitala iste redove.
   */
  const makeRows = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      localDate: `2026-01-${String(index + 1).padStart(2, '0')}`,
      modelVersion: 'daily-1',
      outcomeVersion: null,
    }));

  function setupWithCount(rows: unknown[], total: number) {
    const findMany = jest.fn().mockResolvedValue(rows);
    const count = jest.fn().mockResolvedValue(total);
    const prisma = {
      homeProfile: {
        findFirst: jest.fn().mockResolvedValue({
          id: 7,
          weatherTimezone: 'Europe/Sarajevo',
          user: { timezone: null },
        }),
      },
      dailyRecord: { findMany, count },
      heatingEvent: { findMany: jest.fn().mockResolvedValue([]) },
    };
    return {
      service: new DailyHistoryService(prisma as never),
      findMany,
      count,
    };
  }

  it('prosljeđuje offset u upit', async () => {
    const { service, findMany } = setupWithCount(makeRows(3), 302);
    await service.forHome(1, 7, { limit: 20, offset: 40 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 40, take: 21 }),
    );
  });

  it('bez offseta ne preskače ništa', async () => {
    const { service, findMany } = setupWithCount(makeRows(2), 2);
    await service.forHome(1, 7, { limit: 20 });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0 }));
  });

  it('vraća ukupan broj i offset u odgovoru', async () => {
    const { service } = setupWithCount(makeRows(20), 302);
    const result = await service.forHome(1, 7, { limit: 20, offset: 20 });

    expect(result.total).toBe(302);
    expect(result.offset).toBe(20);
  });

  it('`truncated` je istinit dok god postoji još redova POSLIJE ove strane', async () => {
    const middle = setupWithCount(makeRows(20), 302);
    await expect(
      middle.service.forHome(1, 7, { limit: 20, offset: 20 }),
    ).resolves.toMatchObject({ truncated: true });

    const last = setupWithCount(makeRows(2), 302);
    await expect(
      last.service.forHome(1, 7, { limit: 20, offset: 300 }),
    ).resolves.toMatchObject({ truncated: false });
  });
});
