/**
 * Rekonstrukcija `DailyRecord`-a za dane **prije** nego što je pisca bilo
 * (`20`, `21`, `30`).
 *
 * Zašto zaseban modul, a ne poziv na `computeDayOutcome`: taj izračun traži
 * seriju uzoraka na 5 min (≈288 dnevno) i vraća `INCOMPLETE` za svaki dan bez
 * nje. U produkciji je `ThermostatObservation` imala 17 uzoraka **ukupno** —
 * dakle nijedan prošli dan se ne može obračunati tim putem. Historija koja
 * postoji je u drugim tabelama: `HeatingEvent` (ciklusi), `BoilerHistory`
 * (stvarna polazna i vanjska temperatura), `GasReading` (dnevna očitanja) i
 * `Recommendation` (šta je korisniku tada predloženo).
 *
 * Zato backfill ima **svoj** izvor i **svoju** oznaku (`BACKFILL_VERSION`).
 * To nije formalnost: `dutyPercent` iz događaja (stvarno trajanje rada) nije
 * isti broj kao `dutyPercent` iz uzoraka (udio bucket-a od 5 min), pa se ta dva
 * ne smiju miješati u istom stupcu bez traga. Ko bude fitovao model, mora moći
 * odlučiti da backfill redove isključi.
 *
 * Ništa se ne izmišlja:
 *   - `shadow*` ostaje prazno — odluka tada nije donesena, pa je upisati bilo bi
 *     tvrditi da jeste;
 *   - `params` ostaje prazno — ulazi proračuna nijesu zapisani;
 *   - `heatRateCPerHour`, `hysteresisK` i noćna polja ostaju prazna bez serije;
 *   - svako popunjeno polje ima **izvor** u `sources`, i to je jedini način da se
 *     poslije provjeri odakle broj dolazi.
 */

import { localDateKey } from './proposal-schedule';

/** Oznaka koja ide u `modelVersion` i `outcomeVersion` backfill redova. */
export const BACKFILL_VERSION = 'backfill-events-1';

/** Vanjska temperatura ispod koje se dan računa kao grijačni; baza za stepen-dan. */
export const DEGREE_DAY_BASE_C = 15;

/** Ispod ovoga broja uzoraka vanjske temperature dnevni prosjek nije mjerenje. */
export const MIN_OUTDOOR_SAMPLES_PER_DAY = 8;

/** Ciklus kraći od ovoga je jedan otkucaj, ne ciklus. */
export const MIN_CYCLE_MIN = 1;

export interface BackfillEvent {
  timestampStart: Date;
  timestampEnd: Date | null;
  roomCurrentTemp: number;
  roomTargetTemp: number;
  hvacAction?: string | null;
}

export interface BackfillBoilerRow {
  createdAt: Date;
  externalTemp: number;
  suggestedFlowTemp: number;
  actualFlowTemp: number | null;
}

export interface BackfillGasReading {
  readingDate: Date;
  consumption: number | null;
}

export interface BackfillRecommendation {
  date: Date;
  recommendedFlowTemp: number;
}

export interface BackfillInput {
  localDate: string;
  /** Zona kuće (`resolveHomeTimeZone`); bez nje se datum ne može odrediti. */
  zone: string;
  events: readonly BackfillEvent[];
  boilerRows: readonly BackfillBoilerRow[];
  gasReadings: readonly BackfillGasReading[];
  recommendation: BackfillRecommendation | null;
}

export interface BackfillRow {
  localDate: string;
  /** Šta je odakle uzeto; prazno polje znači „red ne treba ni pisati". */
  sources: string[];
  proposedFlowTemp: number | null;
  proposedAt: Date | null;
  cycles: number | null;
  medianCycleMin: number | null;
  dutyPercent: number | null;
  overshootC: number | null;
  undershootC: number | null;
  flowSetC: number | null;
  flowSetSince: Date | null;
  flowSetSource: 'USER' | 'CARRIED' | 'UNKNOWN';
  gasM3: number | null;
  degreeDays: number | null;
  /** Polja koja bi živa obrada popunila, a backfill ne može. */
  missing: string[];
  version: string;
}

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

const round = (value: number, decimals = 2): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const sameDay = (at: Date, localDate: string, zone: string): boolean =>
  localDateKey(at, zone) === localDate;

/**
 * Rekonstruiše jedan lokalni dan.
 *
 * Vraća `null` kad za dan **nema ni jednog izvora**. To je namjerno jaka brana:
 * red bez ijednog mjerenja ne bi bio „prazan dan" nego tvrdnja da je sistem
 * radio i da nije imao šta reći. Takvi dani se ne upisuju.
 */
export function reconstructDay(input: BackfillInput): BackfillRow | null {
  const { localDate, zone } = input;

  const events = input.events
    .filter((event) => sameDay(event.timestampStart, localDate, zone))
    .sort((a, b) => a.timestampStart.getTime() - b.timestampStart.getTime());
  const boilerRows = input.boilerRows
    .filter((row) => sameDay(row.createdAt, localDate, zone))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const gas = input.gasReadings.filter((row) =>
    sameDay(row.readingDate, localDate, zone),
  );
  const recommendation = input.recommendation;

  if (
    events.length === 0 &&
    boilerRows.length === 0 &&
    gas.length === 0 &&
    recommendation == null
  ) {
    return null;
  }

  const sources: string[] = [];
  const missing: string[] = [];

  // --- predlog: ono što je korisniku tada stvarno rečeno --------------------
  let proposedFlowTemp: number | null = null;
  let proposedAt: Date | null = null;
  if (recommendation) {
    proposedFlowTemp = recommendation.recommendedFlowTemp;
    proposedAt = recommendation.date;
    sources.push('RECOMMENDATION');
  } else {
    missing.push('proposedFlowTemp');
  }

  // --- ciklusi grijanja iz događaja ----------------------------------------
  let cycles: number | null = null;
  let medianCycleMin: number | null = null;
  let dutyPercent: number | null = null;
  let overshootC: number | null = null;
  let undershootC: number | null = null;

  if (events.length > 0) {
    sources.push('HEATING_EVENT');
    const durations = events
      .filter((event) => event.timestampEnd != null)
      .map(
        (event) =>
          (event.timestampEnd!.getTime() - event.timestampStart.getTime()) / 60_000,
      )
      .filter((minutes) => minutes >= MIN_CYCLE_MIN);

    // Ciklusi se broje iz **zatvorenih** događaja: otvoren događaj nema trajanje,
    // pa bi ulazio u broj a ne u zbir — i duty bi bio manji nego stvarno.
    cycles = durations.length;
    medianCycleMin = median(durations);
    dutyPercent =
      durations.length > 0
        ? round((durations.reduce((sum, m) => sum + m, 0) / 1440) * 100, 2)
        : null;

    let maxOvershoot = 0;
    let maxUndershoot = 0;
    for (const event of events) {
      const deficit = event.roomTargetTemp - event.roomCurrentTemp;
      if (deficit > maxUndershoot) maxUndershoot = deficit;
      if (deficit < -maxOvershoot) maxOvershoot = -deficit;
    }
    overshootC = round(maxOvershoot, 2);
    undershootC = round(maxUndershoot, 2);
  } else {
    missing.push('cycles', 'medianCycleMin', 'dutyPercent', 'overshootC', 'undershootC');
  }

  // --- polazna koja je stvarno bila na kotlu -------------------------------
  let flowSetC: number | null = null;
  let flowSetSince: Date | null = null;
  if (boilerRows.length > 0) {
    sources.push('BOILER_HISTORY');
    const withFlow = boilerRows.filter((row) => row.actualFlowTemp != null);
    if (withFlow.length > 0) {
      const last = withFlow[withFlow.length - 1];
      flowSetC = last.actualFlowTemp;
      // `flowSetSince` traži trenutak **promjene**, a ne zadnjeg očitanja.
      // Bez vremena promjene polje ostaje prazno: upis zadnjeg očitanja kao
      // „od tada" bila bi tvrdnja koju podaci ne nose.
      flowSetSince = null;
    }
  }
  if (flowSetC == null) missing.push('flowSetC');

  // --- plin -----------------------------------------------------------------
  // `consumption` je u bazi već dnevna potrošnja; zbraja se ako dan ima više
  // očitanja (npr. ispravka), ali se ne izmišlja razlika kad je nema.
  let gasM3: number | null = null;
  if (gas.length > 0) {
    const values = gas
      .map((row) => row.consumption)
      .filter((value): value is number => value != null && Number.isFinite(value));
    if (values.length > 0) {
      gasM3 = round(values.reduce((sum, value) => sum + value, 0), 3);
      sources.push('GAS_READING');
    }
  }
  if (gasM3 == null) missing.push('gasM3');

  // --- stepen-dan iz **mjerenih** vanjskih temperatura ---------------------
  let degreeDays: number | null = null;
  const outdoor = boilerRows
    .map((row) => row.externalTemp)
    .filter((value) => Number.isFinite(value));
  if (outdoor.length >= MIN_OUTDOOR_SAMPLES_PER_DAY) {
    const mean = outdoor.reduce((sum, value) => sum + value, 0) / outdoor.length;
    degreeDays = round(Math.max(0, DEGREE_DAY_BASE_C - mean), 2);
    sources.push('DEGREE_DAYS_FROM_DEVICE');
  } else {
    missing.push('degreeDays');
  }

  // --- ono što backfill ne može, po definiciji ------------------------------
  missing.push(
    'nightUndershootC',
    'nightMinOutdoorMeasuredC',
    'nightFlowC',
    'hysteresisK',
    'hysteresisAsymmetryK',
    'heatRateCPerHour',
    'params',
    'shadowFlowC',
    'shadowAction',
    'shadowReasons',
  );

  return {
    localDate,
    sources,
    proposedFlowTemp,
    proposedAt,
    cycles,
    medianCycleMin,
    dutyPercent,
    overshootC,
    undershootC,
    flowSetC,
    flowSetSince,
    /*
     * Izvor polazne za prošle dane nije poznat — uvijek `UNKNOWN`, i kad je
     * vrijednost nađena. `USER` bi tvrdio da je korisnik tada mijenjao polaznu,
     * `CARRIED` da je naslijeđena; podaci ne nose ni jedno ni drugo.
     */
    flowSetSource: 'UNKNOWN',
    gasM3,
    degreeDays,
    missing,
    version: BACKFILL_VERSION,
  };
}

/** Sažetak za dry-run: koliko dana bi se upisalo i koliko polja nosi. */
export interface BackfillSummary {
  days: number;
  withEvents: number;
  withGas: number;
  withDegreeDays: number;
  withProposal: number;
  totalMissing: number;
}

export function summarise(rows: readonly BackfillRow[]): BackfillSummary {
  return {
    days: rows.length,
    withEvents: rows.filter((row) => row.sources.includes('HEATING_EVENT')).length,
    withGas: rows.filter((row) => row.sources.includes('GAS_READING')).length,
    withDegreeDays: rows.filter((row) =>
      row.sources.includes('DEGREE_DAYS_FROM_DEVICE'),
    ).length,
    withProposal: rows.filter((row) => row.sources.includes('RECOMMENDATION')).length,
    totalMissing: rows.reduce((sum, row) => sum + row.missing.length, 0),
  };
}
