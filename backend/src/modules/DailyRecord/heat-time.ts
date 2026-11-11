/**
 * `T_max` kao tvrdo ograničenje (`17` §8.6, §14.2).
 *
 * Dokument ostavlja obavezu prije puštanja na bojler: *„ako predlog ne može
 * dostići cilj u 120 min pri toj polaznoj, predlog se podiže"*. U simulaciji
 * `T_max` nije prekoračen, ali nije bio ni provjeravan — a neprovjereno
 * ograničenje nije ograničenje.
 *
 * Fizika je jednostavna i namjerno neto:
 *
 * ```
 * t = ΔT / heatRate
 * ```
 *
 * gdje je `heatRate` **izmjeren iz serije** (`29`), kao neto nagib uspona dok
 * grijanje radi — dakle sa gubicima koji u tom trenutku teku. Zato se ne
 * računa iz nagiba `s`: `s` opisuje odnos gubitaka i dobitaka, ne brzinu.
 *
 * Pri drugoj polaznoj brzina se preračunava linearno po pogonskoj razlici:
 *
 * ```
 * heatRate(F) ≈ heatRate_measured · (F − R) / (F_measured − R)
 * ```
 *
 * Linearnost je pretpostavka (toplina koju emiter preda raste sa razlikom
 * polazna–soba), i to je **najslabija karika** ovog proračuna. Zato se njome
 * samo **podiže** polazna, nikad ne snižava: greška u pretpostavci tada ide u
 * smjeru više topline, a ne manje.
 */

/** Prozor u kojem soba mora biti topla (`17` §14.1). */
export const T_MAX_MINUTES = 120;

/** Ispod ovoga izmjereno dogrijavanje je šum, ne mjera. */
export const MIN_HEAT_RATE_C_PER_H = 0.1;

/** Manje od ovoga se ne računa — vremena od nekoliko minuta su zaokruživanje. */
export const MIN_RISE_C = 0.1;

export interface HeatTimeInput {
  /** Koliko stepeni do cilja; ≤ 0 znači da je cilj već dostignut. */
  riseC: number;
  /** Sobna temperatura sada. */
  roomC: number;
  /** Izmjereno neto dogrijavanje, K/h. */
  heatRateCPerHour: number;
  /** Polazna pri kojoj je ono izmjereno. */
  measuredFlowC: number;
  /** Sobna temperatura pri tom mjerenju. */
  measuredRoomC: number;
}

/** Pomoćna: brzina pri kandidatu, ili `null` kad proračun ne stoji. */
function rateAt(input: HeatTimeInput, candidateFlowC: number): number | null {
  const measuredDrive = input.measuredFlowC - input.measuredRoomC;
  const drive = candidateFlowC - input.roomC;

  if (!Number.isFinite(measuredDrive) || measuredDrive <= 0) return null;
  if (!Number.isFinite(drive) || drive <= 0) return null;
  if (!Number.isFinite(input.heatRateCPerHour)) return null;
  if (input.heatRateCPerHour < MIN_HEAT_RATE_C_PER_H) return null;

  return (input.heatRateCPerHour * drive) / measuredDrive;
}

/** Koliko minuta treba do cilja pri datoj polaznoj; `null` kad se ne zna. */
export function minutesToReach(
  input: HeatTimeInput,
  candidateFlowC: number,
): number | null {
  if (!Number.isFinite(input.riseC) || input.riseC < MIN_RISE_C) return 0;

  const rate = rateAt(input, candidateFlowC);
  if (rate == null || rate <= 0) return null;

  return (input.riseC / rate) * 60;
}

/**
 * Najniža polazna koja stigne do cilja u `maxMinutes`.
 *
 * `null` znači „ne treba podizati" (cilj je već dostignut) **ili** „ne može se
 * izračunati" — u oba slučaja se ne dira ništa. Razlika je važna za pozivaoca,
 * pa onaj koji mora znati koristi `minutesToReach` direktno.
 */
export function flowForHeatTime(
  input: HeatTimeInput,
  maxMinutes: number = T_MAX_MINUTES,
): number | null {
  if (!Number.isFinite(input.riseC) || input.riseC < MIN_RISE_C) return null;
  if (!Number.isFinite(maxMinutes) || maxMinutes <= 0) return null;

  const measuredDrive = input.measuredFlowC - input.measuredRoomC;
  if (!Number.isFinite(measuredDrive) || measuredDrive <= 0) return null;
  if (!Number.isFinite(input.heatRateCPerHour)) return null;
  if (input.heatRateCPerHour < MIN_HEAT_RATE_C_PER_H) return null;

  const neededRate = input.riseC / (maxMinutes / 60);
  const requiredFlowC =
    input.roomC + (measuredDrive * neededRate) / input.heatRateCPerHour;

  if (!Number.isFinite(requiredFlowC)) return null;

  return requiredFlowC;
}
