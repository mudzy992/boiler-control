/**
 * Raspon polazne koji korisnik smije upisati (`F13`).
 *
 * Izdvojeno iz `BoilerService` da bi pravilo bilo **dokazivo bez baze**:
 * granica je po domu, a dom ne smije proširiti apsolutni raspon. Do sada je ovo
 * živjelo unutar servisa, pa se moglo provjeriti samo kroz `PrismaService` —
 * a upravo taj sloj je u sandboxu nedostupan, pa pravilo nije ni bilo pokriveno.
 *
 * Tri broja koja se lako pomiješaju:
 *  - **zadano** (48–55) — važi kad dom nema svoje granice;
 *  - **apsolutno** (30–55) — fizička granica (`DailyRecord/flow-bounds.ts`);
 *    dom je može samo suziti;
 *  - **motor** (46–55, `Heating/strategies/base.strategy.ts`) — clamp izlaza
 *    preporuke, nikad granica unosa.
 */

/** Zadana donja granica kad dom nema svoju. */
export const SYSTEM_MIN_CURRENT_FLOW_TEMP = 48;
/** Zadana gornja granica kad dom nema svoju. */
export const SYSTEM_MAX_CURRENT_FLOW_TEMP = 55;
/** Apsolutni raspon — dom smije suziti, nikad proširiti. */
export const ABSOLUTE_MIN_FLOW_C = 30;
export const ABSOLUTE_MAX_FLOW_C = 55;

export interface HomeFlowBounds {
  minHeatingFlowC: number | null;
  maxHeatingFlowC: number | null;
}

export interface FlowTempRange {
  min: number;
  max: number;
  source: 'HOME' | 'SYSTEM';
}

export function resolveFlowTempRange(
  home: HomeFlowBounds | null | undefined,
): FlowTempRange {
  const requestedMin = home?.minHeatingFlowC ?? SYSTEM_MIN_CURRENT_FLOW_TEMP;
  const requestedMax = home?.maxHeatingFlowC ?? SYSTEM_MAX_CURRENT_FLOW_TEMP;

  const min = Math.max(ABSOLUTE_MIN_FLOW_C, requestedMin);
  const max = Math.min(ABSOLUTE_MAX_FLOW_C, requestedMax);

  /*
   * Dom koji je sam sebi okrenut naopačke (min > max) nije razlog da se
   * korisnik zaključa: vraća se sigurni sistemski raspon i to je vidljivo kroz
   * `source`.
   */
  if (!(min <= max)) {
    return {
      min: SYSTEM_MIN_CURRENT_FLOW_TEMP,
      max: SYSTEM_MAX_CURRENT_FLOW_TEMP,
      source: 'SYSTEM',
    };
  }

  const source: 'HOME' | 'SYSTEM' =
    home?.minHeatingFlowC != null || home?.maxHeatingFlowC != null
      ? 'HOME'
      : 'SYSTEM';

  return { min, max, source };
}
