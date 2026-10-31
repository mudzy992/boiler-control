import { BadRequestException } from '@nestjs/common';
import {
  ANALYTICS_EXPORT_MAX_ROWS_FLAG,
  ANALYTICS_EXPORT_V2_FLAG,
  DEFAULT_EXPORT_MAX_ROWS,
  HARD_EXPORT_MAX_ROWS,
  MAX_EXPORT_RANGE_MS,
  aggregateAnalyticsExport,
  analyticsExportMaxRows,
  analyticsExportV2Enabled,
  exportBucketKey,
  exportDayKey,
  parseExportRange,
  resolveExportTimeZone,
} from '../analytics-export';

describe('analytics-export flags (FEAT-6)', () => {
  const originalV2 = process.env[ANALYTICS_EXPORT_V2_FLAG];
  const originalMax = process.env[ANALYTICS_EXPORT_MAX_ROWS_FLAG];
  afterEach(() => {
    if (originalV2 === undefined) delete process.env[ANALYTICS_EXPORT_V2_FLAG];
    else process.env[ANALYTICS_EXPORT_V2_FLAG] = originalV2;
    if (originalMax === undefined)
      delete process.env[ANALYTICS_EXPORT_MAX_ROWS_FLAG];
    else process.env[ANALYTICS_EXPORT_MAX_ROWS_FLAG] = originalMax;
  });

  it('v2 je zadano iskljucen i prihvata samo strogo on/off', () => {
    delete process.env[ANALYTICS_EXPORT_V2_FLAG];
    expect(analyticsExportV2Enabled()).toBe(false);
    for (const raw of ['on', 'ON', ' On ']) {
      process.env[ANALYTICS_EXPORT_V2_FLAG] = raw;
      expect(analyticsExportV2Enabled()).toBe(true);
    }
    for (const raw of ['off', 'OFF', '', 'true', '1', 'yes', 'maybe']) {
      process.env[ANALYTICS_EXPORT_V2_FLAG] = raw;
      expect(analyticsExportV2Enabled()).toBe(false);
    }
  });

  it('maxRows ima default, hard cap i odbija neispravne vrijednosti', () => {
    delete process.env[ANALYTICS_EXPORT_MAX_ROWS_FLAG];
    expect(analyticsExportMaxRows()).toBe(DEFAULT_EXPORT_MAX_ROWS);
    process.env[ANALYTICS_EXPORT_MAX_ROWS_FLAG] = '25';
    expect(analyticsExportMaxRows()).toBe(25);
    process.env[ANALYTICS_EXPORT_MAX_ROWS_FLAG] = String(HARD_EXPORT_MAX_ROWS);
    expect(analyticsExportMaxRows()).toBe(HARD_EXPORT_MAX_ROWS);
    for (const raw of [
      '0',
      '-1',
      '1.5',
      'abc',
      '',
      String(HARD_EXPORT_MAX_ROWS + 1),
    ]) {
      process.env[ANALYTICS_EXPORT_MAX_ROWS_FLAG] = raw;
      expect(analyticsExportMaxRows()).toBe(DEFAULT_EXPORT_MAX_ROWS);
    }
  });
});

describe('resolveExportTimeZone', () => {
  it('zadano je UTC i vraca rijesenu IANA zonu', () => {
    expect(resolveExportTimeZone()).toBe('UTC');
    expect(resolveExportTimeZone('Europe/Sarajevo')).toBe('Europe/Sarajevo');
    expect(resolveExportTimeZone('America/New_York')).toBe('America/New_York');
  });

  it.each([
    '',
    '+02:00',
    '-0500',
    'Europe/ Nowhere',
    'UTC; DROP',
    'a'.repeat(101),
  ])('odbija neispravnu zonu %p', (zone) => {
    expect(() => resolveExportTimeZone(zone)).toThrow(BadRequestException);
  });
});

describe('parseExportRange', () => {
  it('prihvata eksplicitni Z/offset i vraca Date', () => {
    const range = parseExportRange(
      '2026-01-01T00:00:00Z',
      '2026-01-02T00:00:00+01:00',
    );
    expect(range.from.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(range.to.toISOString()).toBe('2026-01-01T23:00:00.000Z');
  });

  it.each([
    ['2026-01-01', '2026-01-02'],
    ['2026-01-01T00:00:00', '2026-01-02T00:00:00Z'],
    ['2026-02-30T00:00:00Z', '2026-03-01T00:00:00Z'],
    ['2026-01-02T00:00:00Z', '2026-01-01T00:00:00Z'],
  ])('odbija neispravan opseg %p .. %p', (from, to) => {
    expect(() => parseExportRange(from, to)).toThrow(BadRequestException);
  });

  it('odbija opseg veci od 366 dana', () => {
    const from = new Date('2024-01-01T00:00:00Z');
    const to = new Date(from.getTime() + MAX_EXPORT_RANGE_MS + 1);
    expect(() =>
      parseExportRange(from.toISOString(), to.toISOString()),
    ).toThrow(BadRequestException);
  });
});

describe('export bucket keys', () => {
  it('dan je lokalan u trazenoj zoni', () => {
    const d = new Date('2026-01-01T23:30:00Z');
    expect(exportDayKey(d, 'UTC')).toBe('2026-01-01');
    expect(exportDayKey(d, 'Europe/Sarajevo')).toBe('2026-01-02');
    expect(exportBucketKey(d, 'Europe/Sarajevo', 'day')).toBe('2026-01-02');
  });

  it('sat nosi datum i offset pa razlikuje ponovljeni DST sat', () => {
    const first = new Date('2026-10-25T00:30:00Z');
    const second = new Date('2026-10-25T01:30:00Z');
    expect(exportBucketKey(first, 'Europe/Sarajevo', 'hour')).toBe(
      '2026-10-25T02:00:00+02:00',
    );
    expect(exportBucketKey(second, 'Europe/Sarajevo', 'hour')).toBe(
      '2026-10-25T02:00:00+01:00',
    );
  });

  it('proljetni DST sat ne postoji lokalno, ali UTC kljuc ostaje jedinstven', () => {
    const before = new Date('2026-03-29T00:30:00Z');
    const after = new Date('2026-03-29T01:30:00Z');
    expect(exportBucketKey(before, 'Europe/Sarajevo', 'hour')).toBe(
      '2026-03-29T01:00:00+01:00',
    );
    expect(exportBucketKey(after, 'Europe/Sarajevo', 'hour')).toBe(
      '2026-03-29T03:00:00+02:00',
    );
  });

  it('cuva offset koji nije puni sat', () => {
    expect(
      exportBucketKey(
        new Date('2026-01-01T00:00:00Z'),
        'Asia/Kathmandu',
        'hour',
      ),
    ).toBe('2026-01-01T05:00:00+05:45');
  });
});

describe('aggregateAnalyticsExport', () => {
  it('vraca legacy oblike, zaokruzenja i otvoreni ciklus bez kraja', () => {
    const result = aggregateAnalyticsExport(
      [
        {
          timestampStart: new Date('2026-01-01T10:00:00Z'),
          timestampEnd: new Date('2026-01-01T10:30:00Z'),
          roomCurrentTemp: 20,
          roomTargetTemp: 22,
        },
        {
          timestampStart: new Date('2026-01-01T11:00:00Z'),
          timestampEnd: null,
          roomCurrentTemp: -2.5,
          roomTargetTemp: 21,
        },
      ],
      [
        { lastUpdated: new Date('2026-01-01T10:00:00Z'), confidence: 0.5 },
        { lastUpdated: new Date('2026-01-01T11:00:00Z'), confidence: 1 },
      ],
      'UTC',
      'day',
    );
    expect(result.summary.summary).toEqual({
      totalCycles: 2,
      totalDurationMin: 30,
      avgDurationMin: 15,
      avgIndoorTemp: 8.75,
    });
    expect(result.stats.buckets).toEqual([
      {
        label: '2026-01-01',
        avgTargetTemp: 21.5,
        avgCurrentTemp: 8.75,
        totalDurationMin: 30,
        cycles: 2,
      },
    ]);
    expect(result.summary.buckets).toEqual(result.stats.buckets);
    expect(result.learning.points).toEqual([
      { date: '2026-01-01', avgConfidence: 0.75, samples: 2 },
    ]);
  });

  it('prazan izvoz daje nule i prazne nizove', () => {
    const result = aggregateAnalyticsExport([], [], 'UTC', 'hour');
    expect(result.summary.summary).toEqual({
      totalCycles: 0,
      totalDurationMin: 0,
      avgDurationMin: 0,
      avgIndoorTemp: 0,
    });
    expect(result.summary.buckets).toEqual([]);
    expect(result.stats.buckets).toEqual([]);
    expect(result.learning.points).toEqual([]);
  });

  it('ne sortira DST labele leksikografski nego cuva hronoloski ulaz', () => {
    const result = aggregateAnalyticsExport(
      [
        {
          timestampStart: new Date('2026-10-25T00:30:00Z'),
          timestampEnd: null,
          roomCurrentTemp: 20,
          roomTargetTemp: 22,
        },
        {
          timestampStart: new Date('2026-10-25T01:30:00Z'),
          timestampEnd: null,
          roomCurrentTemp: 21,
          roomTargetTemp: 23,
        },
      ],
      [],
      'Europe/Sarajevo',
      'hour',
    );
    expect(result.stats.buckets.map((b) => b.label)).toEqual([
      '2026-10-25T02:00:00+02:00',
      '2026-10-25T02:00:00+01:00',
    ]);
  });
});
