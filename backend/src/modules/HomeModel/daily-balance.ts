/**
 * Dnevni bilans energije („energy signature") — jedina metoda identifikacije
 * koja radi u uslovima koje imamo (`17` §6.1).
 *
 * Za jedan dan u ravnoteži, energija predata kući jednaka je gubicima:
 *
 *   k1·Σ_min (grijanje(t)·(F(t) − R(t)))·Δτ = k2·(R̄ − Ō)·1440 − q_int·1440
 *
 * Dijeljenjem sa k1·1440 dobija se prava linija kroz dane:
 *
 *   y = s·x − c,   y = s·(R̄ − Ō) − c
 *   y = (1/N)·Σ grijanje(t)·(F(t) − R(t)),   x = R̄ − Ō,   s = k2/k1, c = q_int/k1
 *
 * Nagib te prave JE nagib krive kuće. Zašto ne derivacije: pri kratkim
 * ciklusima nema nijednog prozora mirovanja od 45 min (mjereno u `17` §6.2), a
 * kraći prozor ne prelazi kvant senzora od 0,5 °C.
 *
 * Ovdje su samo čiste funkcije: agregacija jednog dana i fit. Baza, cron i
 * vremenska zona su u `home-model.service.ts`.
 */

/** Serija je petominutna, pa dan ima 288 uzoraka (`21`). */
export const OBSERVATIONS_PER_DAY = 288;

/**
 * Dan se odbacuje ako pokriva manje od 80 % uzoraka. Razlog nije strogost
 * nego aritmetika: `y` je prosjek po uzorku, pa dan sa 30 uzoraka nosi
 * nepoznatu težinu — ljetni prekid grijanja i kvar mreže izgledaju isto.
 */
export const MIN_DAY_COVERAGE_RATIO = 0.8;

/** Dva parametra (`s`, `c`) plus rezerva za robustnost (`17` §6.3). */
export const MIN_DAYS_FOR_FIT = 8;

/** Ispod ovog kontrasta sobne i vanjske temperature šum pojede nagib. */
export const MIN_SIGNAL_K = 5;

/**
 * Dani sa gotovo stalnim grijanjem ili gotovo nikakvim grijanjem ne nose
 * informaciju o nagibu: u `y` ulazi samo ono vrijeme kad je grijanje radilo.
 */
export const MIN_DUTY = 0.05;
export const MAX_DUTY = 0.98;

/**
 * Dan mora biti u ravnoteži: bilans pretpostavlja stacionarno stanje, pa dan u
 * kojem se soba grijala ili hladila ne opisuje ravnotežu.
 */
export const MAX_EQUILIBRIUM_DEVIATION_K = 2;

/** Granice fizički smislenog nagiba (`17` §6.4). Izvan njih se odbacuje. */
export const SLOPE_MIN = 0.2;
export const SLOPE_MAX = 1.5;

/** Otvoren prozor, gosti, sunce: odbacuje se sve iznad 3·MAD. */
export const RESIDUAL_REJECTION_FACTOR = 3;

/** Bootstrap po danima; 300 je dovoljno za 5–95 percentil. */
export const BOOTSTRAP_RESAMPLES = 300;

/**
 * Fiksni seed: procjena mora biti **reproducibilna** (`17` §11). Isti dani daju
 * isti interval pouzdanosti, uvijek.
 */
export const DEFAULT_BOOTSTRAP_SEED = 20261108;

/**
 * Ako polazna nije poznata na više od 10 % uzoraka pod grijanjem, `y` bi bio
 * izveden iz pristrasnog podskupa — dan se odbacuje.
 */
export const MIN_PAIR_COVERAGE_RATIO = 0.9;

/** Zbir jednog lokalnog dana, pripremljen iz petominutne serije. */
export interface DayAggregate {
  localDate: string;
  samples: number;
  heatingSamples: number;
  /** Uzorci pod grijanjem kod kojih su poznate i polazna i sobna. */
  heatingPairs: number;
  /** Σ (F − R) po parovima. */
  flowMinusRoomSum: number;
  roomSum: number;
  outdoorSum: number;
  outdoorSamples: number;
  /** Medijana cilja sobe tog dana; `null` ako je nema. */
  targetRoomC: number | null;
}

export type DayRejection =
  | 'INCOMPLETE'
  | 'NO_OUTDOOR'
  | 'NO_HEATING'
  | 'FLOW_MISSING'
  | 'DUTY'
  | 'WEAK_SIGNAL'
  | 'NOT_IN_BALANCE'
  | 'NO_TARGET';

export interface DayRow {
  localDate: string;
  x: number;
  y: number;
  duty: number;
  roomMeanC: number;
  outdoorMeanC: number;
}

export type DayRowResult =
  | { ok: true; row: DayRow }
  | { ok: false; localDate: string; reason: DayRejection };

/**
 * Pretvara zbir jednog dana u jedan red regresije — ili ga odbija sa razlogom.
 *
 * `y` se računa kao prosječna razlika (polazna − soba) po paru, pomnožena
 * pravim udjelom grijanja:
 *
 *   y = (Σ_pairs (F−R) / pairs) · (heating / samples)
 *
 * To je isto kao `(1/N)·Σ_heating (F−R)` kad je polazna stalna, a ispravno je
 * i kad se polazna mijenja usred dana (`18` §0.3).
 */
export function buildDayRow(day: DayAggregate): DayRowResult {
  const reject = (reason: DayRejection): DayRowResult => ({
    ok: false,
    localDate: day.localDate,
    reason,
  });

  if (day.samples < MIN_DAY_COVERAGE_RATIO * OBSERVATIONS_PER_DAY) {
    return reject('INCOMPLETE');
  }
  if (day.outdoorSamples === 0) return reject('NO_OUTDOOR');
  if (day.heatingSamples === 0) return reject('NO_HEATING');
  if (day.heatingPairs < MIN_PAIR_COVERAGE_RATIO * day.heatingSamples) {
    return reject('FLOW_MISSING');
  }
  if (day.targetRoomC == null) return reject('NO_TARGET');

  const duty = day.heatingSamples / day.samples;
  if (duty < MIN_DUTY || duty > MAX_DUTY) return reject('DUTY');

  const roomMeanC = day.roomSum / day.samples;
  const outdoorMeanC = day.outdoorSum / day.outdoorSamples;
  const x = roomMeanC - outdoorMeanC;
  if (Math.abs(x) < MIN_SIGNAL_K) return reject('WEAK_SIGNAL');
  if (Math.abs(roomMeanC - day.targetRoomC) > MAX_EQUILIBRIUM_DEVIATION_K) {
    return reject('NOT_IN_BALANCE');
  }

  const meanPairDifference = day.flowMinusRoomSum / day.heatingPairs;

  return {
    ok: true,
    row: {
      localDate: day.localDate,
      x,
      y: meanPairDifference * duty,
      duty,
      roomMeanC,
      outdoorMeanC,
    },
  };
}

export interface FitOptions {
  minDays?: number;
  bootstrapResamples?: number;
  seed?: number;
}

export interface FitSuccess {
  status: 'ok';
  /** `s = b/a`. */
  slope: number;
  ciLow: number;
  ciHigh: number;
  /** `c = q_int/k1`; pozitivan broj stepeni. */
  internalGainC: number;
  days: number;
  residualStd: number;
}

export type FitResult =
  | FitSuccess
  | { status: 'insufficient'; days: number; reason: string }
  | { status: 'rejected'; days: number; reason: string; slope: number | null };

interface OlsFit {
  slope: number;
  intercept: number;
  residualStd: number;
  residuals: number[];
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Obični najmanji kvadrati za `y = slope·x + intercept`. */
function ols(rows: readonly DayRow[]): OlsFit | null {
  const n = rows.length;
  if (n < 2) return null;

  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumXY = 0;
  for (const row of rows) {
    sumX += row.x;
    sumY += row.y;
    sumXX += row.x * row.x;
    sumXY += row.x * row.y;
  }

  const denominator = n * sumXX - sumX * sumX;
  if (Math.abs(denominator) < 1e-9) return null; // nema varijacije u x

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  const residuals = rows.map((row) => row.y - (slope * row.x + intercept));
  const sumSquares = residuals.reduce((acc, r) => acc + r * r, 0);
  const residualStd = n > 2 ? Math.sqrt(sumSquares / (n - 2)) : 0;

  return { slope, intercept, residualStd, residuals };
}

/** Deterministicki PRNG (mulberry32) — isti seed, isti interval. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return Number.NaN;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor(sorted.length * p)),
  );
  return sorted[index];
}

/**
 * Fit `y = s·x − c` sa tri koraka: najmanji kvadrati, odbacivanje outliera po
 * MAD, pa klasični interval po danima.
 *
 * Zašto se `s` izvan `[0,2; 1,5]` **odbacuje**, a ne steže: stegnuta vrijednost
 * bi izgledala kao izmjeren podatak. Odbijena procjena ostavlja model u
 * `DEGRADED`, gdje predlog miruje (`17` §11) — što je istina o tome šta znamo.
 */
export function fitDailyBalance(
  rows: readonly DayRow[],
  options: FitOptions = {},
): FitResult {
  const minDays = options.minDays ?? MIN_DAYS_FOR_FIT;
  const resamples = options.bootstrapResamples ?? BOOTSTRAP_RESAMPLES;
  const random = mulberry32(options.seed ?? DEFAULT_BOOTSTRAP_SEED);

  if (rows.length < minDays) {
    return {
      status: 'insufficient',
      days: rows.length,
      reason: 'NOT_ENOUGH_DAYS',
    };
  }

  let working = [...rows];
  let fit = ols(working);
  if (!fit) {
    return {
      status: 'rejected',
      days: working.length,
      reason: 'NO_X_VARIANCE',
      slope: null,
    };
  }

  // Robusnost: dani sa rezidualom većim od 3·MAD su otvoren prozor, gosti ili
  // sunce — ne kuća. Fit se ponavlja bez njih, ali samo ako ih ostane dovoljno.
  const absoluteResiduals = fit.residuals.map((r) => Math.abs(r));
  const mad = median(absoluteResiduals);
  if (mad > 0) {
    const kept = working.filter(
      (_, index) =>
        absoluteResiduals[index] <= RESIDUAL_REJECTION_FACTOR * mad + 1e-12,
    );
    if (kept.length >= minDays && kept.length < working.length) {
      const refit = ols(kept);
      if (refit) {
        working = kept;
        fit = refit;
      }
    }
  }

  if (fit.slope < SLOPE_MIN || fit.slope > SLOPE_MAX) {
    return {
      status: 'rejected',
      days: working.length,
      reason: 'SLOPE_OUT_OF_BOUNDS',
      slope: fit.slope,
    };
  }

  // Bootstrap po danima: interval koji odgovara na pitanje "koliko bi se ovaj
  // nagib promijenio da smo imali drugačiji uzorke dana".
  const slopes: number[] = [];
  for (let k = 0; k < resamples; k++) {
    const sample: DayRow[] = [];
    for (let i = 0; i < working.length; i++) {
      sample.push(working[Math.floor(random() * working.length)]);
    }
    const resampled = ols(sample);
    if (resampled && resampled.slope > 0.05 && resampled.slope < 3) {
      slopes.push(resampled.slope);
    }
  }
  slopes.sort((a, b) => a - b);

  const ciLow = slopes.length > 0 ? percentile(slopes, 0.05) : fit.slope;
  const ciHigh = slopes.length > 0 ? percentile(slopes, 0.95) : fit.slope;

  return {
    status: 'ok',
    slope: fit.slope,
    ciLow,
    ciHigh,
    internalGainC: -fit.intercept,
    days: working.length,
    residualStd: fit.residualStd,
  };
}
