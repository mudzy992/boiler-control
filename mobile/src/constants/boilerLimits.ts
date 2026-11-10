/**
 * Raspon u koji korisnik smije upisati polaznu vodu.
 *
 * Do F13 je ovdje stajala tvrda granica 48–55, uz komentar da „API ne izlaže
 * granice". To je bilo tačno do tada i skupo: motor je predlagao npr. 46 (i to
 * je fizički izvodljivo), a ekran je odbijao unos ispod 48. Korisnik je vidio
 * preporuku koju aplikacija ne da primijeniti.
 *
 * Granica je **po domu** (`HomeProfile.minHeatingFlowC/maxHeatingFlowC`), pa
 * klijent ne smije nositi svoju kopiju brojeva: ista aplikacija na dva doma
 * mora vidjeti dva raspona. Zato je izvor `GET /api/boiler/flow-range`, a
 * konstante ispod ostaju samo kao **rezerva** dok odgovor ne stigne ili ako
 * padne mreža — nikad kao istina.
 */
export const MIN_CURRENT_FLOW_TEMP = 48;
export const MAX_CURRENT_FLOW_TEMP = 55;

/** Apsolutne granice koje server primjenjuje bez obzira na dom (30–55). */
export const ABSOLUTE_MIN_FLOW_TEMP = 30;
export const ABSOLUTE_MAX_FLOW_TEMP = 55;

export type FlowRangeSource = 'HOME' | 'SYSTEM';

export interface FlowRange {
  min: number;
  max: number;
  /** `HOME` = dom ima svoje granice; `SYSTEM` = važi zadani raspon. */
  source: FlowRangeSource;
}

export const DEFAULT_FLOW_RANGE: FlowRange = {
  min: MIN_CURRENT_FLOW_TEMP,
  max: MAX_CURRENT_FLOW_TEMP,
  source: 'SYSTEM',
};

/**
 * Pretvara odgovor `GET /api/boiler/flow-range` u raspon koji se smije
 * koristiti za validaciju unosa.
 *
 * Nepoznat ili neispravan odgovor se **ne** prihvata djelimično: ako granice
 * nisu brojevi unutar apsolutnog raspona, ili je `min > max`, vraća se zadani
 * raspon. Djelimično prihvatanje bi dalo ekran koji pušta 30 °C na jednom
 * polju, a odbija ga na drugom.
 */
export function resolveFlowRange(raw: unknown): FlowRange {
  const candidate = raw as Partial<FlowRange> | null | undefined;
  const min = candidate?.min;
  const max = candidate?.max;

  const valid =
    typeof min === 'number' &&
    typeof max === 'number' &&
    Number.isFinite(min) &&
    Number.isFinite(max) &&
    min >= ABSOLUTE_MIN_FLOW_TEMP &&
    max <= ABSOLUTE_MAX_FLOW_TEMP &&
    min <= max;

  if (!valid) return DEFAULT_FLOW_RANGE;

  return {
    min,
    max,
    source: candidate?.source === 'HOME' ? 'HOME' : 'SYSTEM',
  };
}

export function isWithinCurrentFlowTempRange(
  value: number,
  range: FlowRange = DEFAULT_FLOW_RANGE
): boolean {
  return Number.isFinite(value) && value >= range.min && value <= range.max;
}
