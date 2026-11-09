/**
 * Historija dnevnih zapisa za klijente (`31`, `32`).
 *
 * Zašto postoji: backfill je upisao 301 dan u `DailyRecord`, ali do sada **nijedan
 * ekran** nije mogao da ih vidi — jedini endpoint nad tabelom je bio shadow
 * izvještaj, a on čita samo `shadow*` kolone, koje su u backfill redu prazne po
 * definiciji. Podaci su postojali i bili nevidljivi.
 *
 * Pravilo koje ovaj modul nosi: red iz backfilla **ne smije izgledati kao red iz
 * živog rada.** Zato svaki red nosi `origin`, a sažetak broji koliko je čega.
 * Ako se to izgubi, poslije niko ne može reći koji je broj izmjeren a koji
 * rekonstruisan — a cijeli smisao backfilla je bio da se to zna.
 */

/** Oznaka u `modelVersion`/`outcomeVersion` za redove koje je napisao backfill. */
export const BACKFILL_VERSION_PREFIX = 'backfill-';

export type DailyRecordOrigin = 'LIVE' | 'BACKFILL';

/** Red kakav dolazi iz baze (samo kolone koje izvještaj koristi). */
export interface DailyRecordInput {
  localDate: string;
  proposedFlowTemp: number | null;
  proposedAt: Date | null;
  cycles: number | null;
  medianCycleMin: number | null;
  dutyPercent: number | null;
  overshootC: number | null;
  undershootC: number | null;
  flowSetC: number | null;
  flowSetSource: string | null;
  gasM3: number | null;
  degreeDays: number | null;
  nightUndershootC: number | null;
  hysteresisK: number | null;
  heatRateCPerHour: number | null;
  shadowFlowC: number | null;
  shadowAction: string | null;
  modelVersion: string | null;
  outcomeVersion: string | null;
  outcomeAt: Date | null;
}

/** Red za klijenta: iste vrijednosti + ono što klijent ne treba da izvodi sam. */
export interface DailyHistoryRow extends DailyRecordInput {
  origin: DailyRecordOrigin;
  /** Koje grupe mjerenja red stvarno nosi. `false` = nije mjereno, nije nula. */
  has: {
    cycles: boolean;
    gas: boolean;
    degreeDays: boolean;
    night: boolean;
    hysteresis: boolean;
    heatRate: boolean;
    shadow: boolean;
  };
}

export interface DailyHistorySummary {
  days: number;
  live: number;
  backfill: number;
  withCycles: number;
  withGas: number;
  withDegreeDays: number;
  withShadow: number;
  /** `null` kad nema ni jednog reda — praznina, ne „od 1970". */
  firstDate: string | null;
  lastDate: string | null;
}

export interface DailyHistory {
  rows: DailyHistoryRow[];
  summary: DailyHistorySummary;
  /** `true` kad je period skraćen na `limit` — da se ne tvrdi da je to sve. */
  truncated: boolean;
}

/**
 * Živi red ima bar jednu verziju koja **nije** backfill oznaka. Red bez ijedne
 * verzije (stariji od uvođenja kolona) tretiramo kao `LIVE`: nije ga napisao
 * backfill, pa mu ne pripisujemo tuđi status.
 */
export function classifyOrigin(row: {
  modelVersion: string | null;
  outcomeVersion: string | null;
}): DailyRecordOrigin {
  const versions = [row.modelVersion, row.outcomeVersion].filter(
    (version): version is string => typeof version === 'string',
  );
  const backfill = versions.some((version) =>
    version.startsWith(BACKFILL_VERSION_PREFIX),
  );
  return backfill ? 'BACKFILL' : 'LIVE';
}

function withFlags(row: DailyRecordInput): DailyHistoryRow {
  return {
    ...row,
    origin: classifyOrigin(row),
    has: {
      // Ciklus `0` je mjerenje (dan bez grijanja); `null` je odsustvo mjerenja.
      // Zato se provjerava `!= null`, a ne istinitost — `0` je istinito netačan
      // signal za „nema podataka".
      cycles: row.cycles != null,
      gas: row.gasM3 != null,
      degreeDays: row.degreeDays != null,
      night: row.nightUndershootC != null,
      hysteresis: row.hysteresisK != null,
      heatRate: row.heatRateCPerHour != null,
      shadow: row.shadowFlowC != null || row.shadowAction != null,
    },
  };
}

/** Redovi se sortiraju po datumu, jer `localDate` je `YYYY-MM-DD` tekst. */
export function buildDailyHistory(
  input: readonly DailyRecordInput[],
  options: { truncated?: boolean } = {},
): DailyHistory {
  const rows = [...input]
    .sort((a, b) => a.localDate.localeCompare(b.localDate))
    .map(withFlags);

  const summary: DailyHistorySummary = {
    days: rows.length,
    live: rows.filter((row) => row.origin === 'LIVE').length,
    backfill: rows.filter((row) => row.origin === 'BACKFILL').length,
    withCycles: rows.filter((row) => row.has.cycles).length,
    withGas: rows.filter((row) => row.has.gas).length,
    withDegreeDays: rows.filter((row) => row.has.degreeDays).length,
    withShadow: rows.filter((row) => row.has.shadow).length,
    firstDate: rows[0]?.localDate ?? null,
    lastDate: rows[rows.length - 1]?.localDate ?? null,
  };

  return { rows, summary, truncated: options.truncated ?? false };
}
