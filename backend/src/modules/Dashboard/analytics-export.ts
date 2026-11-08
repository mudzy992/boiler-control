import { BadRequestException, Logger } from '@nestjs/common';

export const ANALYTICS_EXPORT_V2_FLAG = 'ANALYTICS_EXPORT_V2_ENABLED';
export const ANALYTICS_EXPORT_MAX_ROWS_FLAG = 'ANALYTICS_EXPORT_MAX_ROWS';
export const DEFAULT_EXPORT_MAX_ROWS = 10_000;
export const HARD_EXPORT_MAX_ROWS = 50_000;
export const MAX_EXPORT_RANGE_MS = 366 * 24 * 60 * 60 * 1000;

const logger = new Logger('AnalyticsExport');

/** Strogo on/off; neispravna vrijednost ne uključuje novu funkciju. */
export function analyticsExportV2Enabled(): boolean {
  const raw = process.env[ANALYTICS_EXPORT_V2_FLAG];
  if (raw === undefined) return false;
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'on') return true;
  if (normalized === 'off') return false;
  logger.warn(
    `${ANALYTICS_EXPORT_V2_FLAG} ima neispravnu vrijednost ${JSON.stringify(raw)}; koristim off.`,
  );
  return false;
}

export function analyticsExportMaxRows(): number {
  const raw = process.env[ANALYTICS_EXPORT_MAX_ROWS_FLAG];
  if (raw === undefined) return DEFAULT_EXPORT_MAX_ROWS;
  const value = Number(raw);
  if (
    /^\d+$/.test(raw.trim()) &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= HARD_EXPORT_MAX_ROWS
  ) {
    return value;
  }
  logger.warn(
    `${ANALYTICS_EXPORT_MAX_ROWS_FLAG} mora biti cijeli broj 1..${HARD_EXPORT_MAX_ROWS}; koristim ${DEFAULT_EXPORT_MAX_ROWS}.`,
  );
  return DEFAULT_EXPORT_MAX_ROWS;
}

/** IANA zona, ne proizvoljan tekst niti numerički UTC offset. */
export function resolveExportTimeZone(input?: string): string {
  const zone = input ?? 'UTC';
  // IANA ime (ukljucujuci Etc/GMT+2), ali ne numericki offset poput +02:00.
  if (/^[+-]/.test(zone) || !/^[A-Za-z0-9_+\-/]{1,100}$/.test(zone)) {
    throw new BadRequestException('timeZone mora biti IANA vremenska zona');
  }
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
    }).resolvedOptions().timeZone;
  } catch {
    throw new BadRequestException('Nepoznata IANA vremenska zona');
  }
}

/** V2 opseg mora nositi eksplicitan offset/Z; nema server-local parsiranja. */
export function parseExportRange(
  from: string,
  to: string,
): { from: Date; to: Date } {
  const offsetIso =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
  if (!offsetIso.test(from) || !offsetIso.test(to)) {
    throw new BadRequestException(
      'from i to moraju biti ISO datumi s eksplicitnim Z ili UTC offsetom',
    );
  }
  const start = new Date(from);
  const end = new Date(to);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    throw new BadRequestException('Neispravan datumski opseg');
  }
  if (start.getTime() > end.getTime()) {
    throw new BadRequestException('from ne smije biti nakon to');
  }
  if (end.getTime() - start.getTime() > MAX_EXPORT_RANGE_MS) {
    throw new BadRequestException('Maksimalni opseg izvoza je 366 dana');
  }
  return { from: start, to: end };
}

type LocalParts = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  offsetMinutes: number;
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

/**
 * Zidno vrijeme u IANA zoni + pomak. Izvezeno jer ga koristi i dnevni zapis
 * (`DailyRecord`): granica dana i prag 06:00 moraju se računati ISTOM
 * funkcijom kao izvoz, inače dva mjesta u aplikaciji mogu pripisati isti
 * trenutak različitom danu.
 */
export function localParts(date: Date, zone: string): LocalParts {
  let formatter = formatterCache.get(zone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    formatterCache.set(zone, formatter);
  }
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  const year = parts.year;
  const month = parts.month;
  const day = parts.day;
  const hour = parts.hour;
  const minute = parts.minute;
  // Ukljucuje minute/sekunde: IANA zone mogu imati offset koji nije puni sat
  // (npr. Asia/Kathmandu +05:45). Sam sat bi izgubio tih 45 minuta.
  const wallClock = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(parts.minute),
    Number(parts.second),
  );
  const utcClock = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
  );
  return {
    year,
    month,
    day,
    hour,
    minute,
    offsetMinutes: Math.round((wallClock - utcClock) / 60_000),
  };
}

function offsetLabel(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const absolute = Math.abs(minutes);
  return `${sign}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`;
}

export function exportDayKey(date: Date, zone: string): string {
  const p = localParts(date, zone);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Ponovljeni DST sat ostaje dva reda jer labela nosi i offset. */
export function exportBucketKey(
  date: Date,
  zone: string,
  bucket: 'hour' | 'day',
): string {
  const p = localParts(date, zone);
  const day = `${p.year}-${p.month}-${p.day}`;
  return bucket === 'day'
    ? day
    : `${day}T${p.hour}:00:00${offsetLabel(p.offsetMinutes)}`;
}

export type ExportHeatingEvent = {
  timestampStart: Date;
  timestampEnd: Date | null;
  roomCurrentTemp: number;
  roomTargetTemp: number;
};

export type ExportLearningRow = {
  lastUpdated: Date;
  confidence: number;
};

export function aggregateAnalyticsExport(
  events: readonly ExportHeatingEvent[],
  learning: readonly ExportLearningRow[],
  zone: string,
  bucket: 'hour' | 'day',
) {
  const buckets = new Map<
    string,
    { target: number; current: number; duration: number; cycles: number }
  >();
  let totalDuration = 0;
  let totalCurrent = 0;
  for (const event of events) {
    // ULaz je hronološki; ne sortirati DST labele leksikografski.
    const key = exportBucketKey(event.timestampStart, zone, bucket);
    const row = buckets.get(key) ?? {
      target: 0,
      current: 0,
      duration: 0,
      cycles: 0,
    };
    row.target += event.roomTargetTemp;
    row.current += event.roomCurrentTemp;
    row.cycles += 1;
    totalCurrent += event.roomCurrentTemp;
    if (event.timestampEnd) {
      const duration =
        (event.timestampEnd.getTime() - event.timestampStart.getTime()) /
        60_000;
      row.duration += duration;
      totalDuration += duration;
    }
    buckets.set(key, row);
  }
  const rows = Array.from(buckets.entries()).map(([label, row]) => ({
    label,
    avgTargetTemp: Number((row.target / row.cycles).toFixed(2)),
    avgCurrentTemp: Number((row.current / row.cycles).toFixed(2)),
    totalDurationMin: Math.round(row.duration),
    cycles: row.cycles,
  }));
  const points = new Map<string, { total: number; samples: number }>();
  for (const row of learning) {
    const date = exportDayKey(row.lastUpdated, zone);
    const point = points.get(date) ?? { total: 0, samples: 0 };
    point.total += row.confidence;
    point.samples += 1;
    points.set(date, point);
  }
  return {
    summary: {
      summary: {
        totalCycles: events.length,
        totalDurationMin: Math.round(totalDuration),
        avgDurationMin: events.length
          ? Number((totalDuration / events.length).toFixed(2))
          : 0,
        avgIndoorTemp: events.length
          ? Number((totalCurrent / events.length).toFixed(2))
          : 0,
      },
      buckets: rows,
    },
    stats: { buckets: rows },
    learning: {
      points: Array.from(points.entries()).map(([date, point]) => ({
        date,
        avgConfidence: Number((point.total / point.samples).toFixed(2)),
        samples: point.samples,
      })),
    },
  };
}
