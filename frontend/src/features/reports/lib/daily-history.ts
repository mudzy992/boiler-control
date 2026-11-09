import type {
  DailyHistoryCoverage,
  DailyHistoryResponse,
  DailyHistoryRow,
  DailyRecordOrigin,
} from '../types';

/**
 * Prikaz historije dnevnih zapisa (`31`).
 *
 * Backfill je upisao 301 dan koji su izvedeni iz `HeatingEvent`, `GasReading`,
 * `BoilerHistory` i starih `Recommendation` redova — dakle **rekonstruisani**, a ne
 * izmjereni u toku dana. Ako tabela to ne kaže, čita se kao mjerenje, i to je
 * jedina stvarna opasnost ovog ekrana.
 *
 * Zato je porijeklo prvo polje reda, a pokrivenost (šta red stvarno nosi) drugo.
 */

export type CoverageKey = keyof DailyHistoryCoverage;

export const COVERAGE_ORDER: CoverageKey[] = [
  'cycles',
  'gas',
  'degreeDays',
  'night',
  'hysteresis',
  'heatRate',
  'shadow',
];

/** Grupe koje red stvarno nosi, u stalnom redu — da tabela ne skače. */
export function coveredGroups(row: DailyHistoryRow): CoverageKey[] {
  return COVERAGE_ORDER.filter((key) => row.has[key]);
}

/**
 * Grupe koje nedostaju. Prazan niz znači da red nosi sve — i to je jedini
 * slučaj u kojem se ne prikazuje upozorenje.
 */
export function missingGroups(row: DailyHistoryRow): CoverageKey[] {
  return COVERAGE_ORDER.filter((key) => !row.has[key]);
}

/** Naslov izvora; tekst dolazi iz i18n, ovdje je samo ključ. */
export function originLabelKey(origin: DailyRecordOrigin): string {
  return origin === 'BACKFILL'
    ? 'reports.historyOriginBackfill'
    : 'reports.historyOriginLive';
}

/**
 * Da li je odgovor prazan. Ne koristi se `!report` jer prazan izvještaj **je**
 * odgovor: „nema zapisa za taj period" nije isto što i „upit nije prošao".
 */
export function isHistoryEmpty(report?: DailyHistoryResponse | null): boolean {
  return !report || report.rows.length === 0;
}

/**
 * Rečenica sažetka: koliko dana, koliko rekonstruisano, koji period.
 *
 * Vraća brojeve, ne tekst — tekst se sklapa u komponenti, jer se množine i
 * padeži ne mogu ispravno složiti bez i18n-a.
 */
export function historyHeadline(report?: DailyHistoryResponse | null): {
  days: number;
  backfill: number;
  live: number;
  firstDate: string | null;
  lastDate: string | null;
  truncated: boolean;
} {
  return {
    days: report?.summary.days ?? 0,
    backfill: report?.summary.backfill ?? 0,
    live: report?.summary.live ?? 0,
    firstDate: report?.summary.firstDate ?? null,
    lastDate: report?.summary.lastDate ?? null,
    truncated: report?.truncated ?? false,
  };
}

/** Broj za prikaz: `null` ostaje `null`, da ga komponenta pretvori u „—". */
export function valueOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
