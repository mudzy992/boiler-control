/**
 * `u_day` — dnevni član za sunce, goste i kuhanje (`17` §13 korak 7, `19` §6.2).
 *
 * Model kuće (`y = s·x − c`) opisuje **prosječan** dan. Stvarni dan nosi i
 * dobitke koji nisu u modelu: sunce kroz prozor, gosti, kuhanje, pegla. Njihova
 * posljedica je mjerljiva: kuća se tog dana grijala **manje** nego što jednačina
 * predviđa za istu vanjsku temperaturu.
 *
 * Zato se `u_day` ne izmišlja ni ne pita korisnika, nego se **čita iz ostatka**:
 *
 *   predviđeno = s·x − c            (c = internalGainC, upisano u model)
 *   ostatak    = y − predviđeno     (y je stvarno predato grijanje)
 *   dobitak    = −ostatak           (više dobitaka ⇒ manje predato ⇒ ostatak < 0)
 *
 * Znak je namjerno eksplicitan: **pozitivan `u_day` znači više dobitaka**, pa
 * polazna treba da bude **niža**. Kad se znak okrene, greška je tiha i ide u
 * opasnu stranu (kuća se hladi, a aplikacija spušta).
 *
 * Tri pravila drže ovo poštenim:
 *
 * 1. **Najviše ±2 K** (`17` §1: dnevni dobitak je ±1–2 °C ekvivalenta). Veći
 *    ostatak nije sunce nego otvoren prozor ili neispravan uzorak — i ne smije
 *    se pretvoriti u savjet.
 * 2. **Medijana zadnjih 7 dana**, ne prosjek: jedan rođendan ne pomjera odluku.
 * 3. **Bez 4 dana nema broja.** Manje je šum, a `null` znači „ne mijenjaj" —
 *    što je tačno ono što se zna.
 */

/** Najveći dnevni dobitak koji se priznaje, u °C ekvivalenta polazne. */
export const DAY_GAIN_CAP_C = 2;

/** Prozor za procjenu: zadnjih 7 upotrebljivih dana. */
export const DAY_GAIN_WINDOW_DAYS = 7;

/** Bez ovoliko dana `u_day` ne postoji (medijana 3 dana je još šum). */
export const DAY_GAIN_MIN_DAYS = 4;

/** Ispod ovoga se dobitak ne priznaje kao različit od nule. */
export const DAY_GAIN_EQUAL_TOLERANCE_C = 0.05;

export interface DayGainPoint {
  localDate: string;
  /** Pozitivno = tog dana je bilo **više** dobitaka od prosjeka. */
  gainC: number;
}

export interface DayGainEstimate {
  /** Medijana zadnjih dana, ograničena na ±`DAY_GAIN_CAP_C`, 1 decimala. */
  uDayC: number;
  /** Koliko dana je ušlo u medijanu. */
  days: number;
  /** Rasipanje (max − min) u prozoru — koliko jedna odluka zavisi od jednog dana. */
  spreadC: number;
  /** Da li je sirovi ostatak bio veći od granice (tj. da li je cap djelovao). */
  capped: boolean;
}

function rounded(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Dnevni dobici iz redova koji su ušli u fit.
 *
 * `internalGainC` je `c` (pozitivan broj stepeni), a model je `y = s·x − c`.
 * Računa se nad **svim** redovima, uključujući one koje je fit izbacio kao
 * otvoren prozor: upravo ti dani nose najveći dobitak, a cap ih drži u granici.
 */
export function dayGains(
  rows: readonly { localDate: string; x: number; y: number }[],
  model: { slopeS: number; internalGainC: number },
): DayGainPoint[] {
  return rows.map((row) => {
    const predicted = model.slopeS * row.x - model.internalGainC;
    return {
      localDate: row.localDate,
      gainC: rounded(predicted - row.y, 2),
    };
  });
}

/**
 * Procjena `u_day` iz dnevnih dobitaka. Vraća `null` kad nema dovoljno dana —
 * nikad nulu, jer bi nula bila tvrdnja „prosječan dan", a to nije izmjereno.
 */
export function estimateDayGain(
  points: readonly DayGainPoint[],
  options: { windowDays?: number; minDays?: number } = {},
): DayGainEstimate | null {
  const windowDays = options.windowDays ?? DAY_GAIN_WINDOW_DAYS;
  const minDays = options.minDays ?? DAY_GAIN_MIN_DAYS;

  const usable = [...points]
    .filter((point) => Number.isFinite(point.gainC))
    .sort((a, b) => a.localDate.localeCompare(b.localDate))
    .slice(-windowDays);

  if (usable.length < minDays) return null;

  const values = usable.map((point) => point.gainC);
  const raw = median(values);
  const capped = raw > DAY_GAIN_CAP_C || raw < -DAY_GAIN_CAP_C;
  const uDayC = rounded(
    Math.min(DAY_GAIN_CAP_C, Math.max(-DAY_GAIN_CAP_C, raw)),
  );

  return {
    uDayC: Math.abs(uDayC) < DAY_GAIN_EQUAL_TOLERANCE_C ? 0 : uDayC,
    days: usable.length,
    spreadC: rounded(Math.max(...values) - Math.min(...values)),
    capped,
  };
}

/**
 * Primjena na ravnotežnu polaznu: **dobitak spušta**.
 *
 * `F_eq = cilj + s·(cilj − T_vanja)` je polazna za prosječan dan. Dan sa više
 * dobitaka traži manje, pa se oduzima. `null` (nema procjene) ne mijenja ništa:
 * nepoznat dobitak nije isto što i nulti.
 */
export function applyDayGain(
  flowC: number,
  uDayC: number | null | undefined,
): number {
  if (uDayC == null || !Number.isFinite(uDayC)) return flowC;
  return flowC - uDayC;
}
