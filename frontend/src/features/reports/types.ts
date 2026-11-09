/**
 * Tipovi shadow izvještaja (`24` §6.5) — kopija onoga što backend vraća.
 *
 * Zašto ručno, a ne iz `api.d.ts`: `shadow-report` još nije u generisanom
 * ugovoru (`contracts/openapi.json`), pa bi tip iz ugovora bio prazan objekat i
 * greška bi se vidjela tek u runtime-u. Kad ruta uđe u ugovor, ovaj fajl se
 * briše i tipovi se vuku iz `components['schemas']`.
 *
 * Polja su **opciona tamo gdje backend može vratiti `null`** — izvještaj je
 * pošten i kad nema podataka, pa UI mora umjeti prikazati „nema", a ne nulu.
 */

export type ShadowVerdict =
  | 'NO_DATA'
  | 'NOT_ENOUGH_DAYS'
  | 'UNEXPLAINED_DIFFERENCES'
  | 'NO_DIFFERENCES'
  | 'READY';

export type ShadowDirection = 'LOWER' | 'HIGHER' | 'SAME';

export interface ShadowReasonCount {
  reason: string;
  days: number;
}

export interface ShadowComparison {
  localDate: string;
  formulaC: number;
  decisionC: number;
  deltaC: number;
  direction: ShadowDirection;
  reasons: string[];
  explained: boolean;
}

export interface ShadowReportResponse {
  days: number;
  evaluated: number;
  pending: number;
  withoutFormula: number;
  differences: number;
  lowered: number;
  raised: number;
  same: number;
  changeSharePct: number;
  byReason: ShadowReasonCount[];
  unexplained: ShadowComparison[];
  maxAbsDeltaC: number;
  meanAbsDeltaC: number;
  blockedByModel: number;
  explored: number;
  firstDate: string | null;
  lastDate: string | null;
  verdict: ShadowVerdict;
  verdictNote: string;
}

/**
 * Historija dnevnih zapisa (`31`) — `GET /api/daily-record/history`.
 *
 * `origin` je najvažnije polje: `BACKFILL` znači da je red rekonstruisan iz
 * starih događaja, a ne izmjeren u toku dana. Prikaz to mora reći, inače
 * korisnik čita rekonstrukciju kao mjerenje.
 */
export type DailyRecordOrigin = 'LIVE' | 'BACKFILL';

export interface DailyHistoryCoverage {
  cycles: boolean;
  gas: boolean;
  degreeDays: boolean;
  night: boolean;
  hysteresis: boolean;
  heatRate: boolean;
  shadow: boolean;
}

export interface DailyHistoryRow {
  localDate: string;
  proposedFlowTemp: number | null;
  proposedAt: string | null;
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
  outcomeAt: string | null;
  origin: DailyRecordOrigin;
  has: DailyHistoryCoverage;
}

export interface DailyHistoryResponse {
  homeProfileId: number;
  rows: DailyHistoryRow[];
  summary: {
    days: number;
    live: number;
    backfill: number;
    withCycles: number;
    withGas: number;
    withDegreeDays: number;
    withShadow: number;
    firstDate: string | null;
    lastDate: string | null;
  };
  truncated: boolean;
}
