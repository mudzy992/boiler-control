import type { CycleEvent } from './day-outcome';
import { fillCyclesFromEvents } from './event-cycles';
import type { DailyRecordInput } from './daily-history';

/**
 * Jedna strana historije, sastavljena od redova iz baze i događaja (`F13`).
 *
 * Izdvojeno iz `DailyHistoryService` jer servis traži `PrismaService`, pa se
 * ovdje ne može izvršiti nijedan test. Pravilo koje ova funkcija nosi je
 * suština popravke: **ciklusi postoje i kad serija uzoraka nije dovoljna**, a
 * razlika između ta dva izvora mora ostati vidljiva (`cyclesSource`).
 */

export interface PageCyclesResult {
  rows: DailyRecordInput[];
  /** `localDate` → da li su ciklusi popunjeni iz događaja. */
  filledFromEvents: Set<string>;
}

/**
 * Popunjava cikluse za redove jedne strane historije.
 *
 * Redoslijed prednosti je namjeran:
 *  1. red koji **već ima** `cycles` se ne dira (serija uzoraka ima prednost);
 *  2. ako ima događaja za taj dan, broj i medijana dolaze odatle;
 *  3. ako nema ni jednog, red ostaje bez ciklusa — crtica, nikad nula.
 */
export function applyPageCycles(
  rows: readonly DailyRecordInput[],
  events: readonly CycleEvent[],
  zone: string,
): PageCyclesResult {
  const filled = fillCyclesFromEvents(
    rows.map((row) => ({
      localDate: row.localDate,
      cycles: row.cycles,
      medianCycleMin: row.medianCycleMin,
    })),
    events,
    zone,
  );

  const byDate = new Map(filled.map((row) => [row.localDate, row]));
  const filledFromEvents = new Set<string>();

  const out = rows.map((row) => {
    const cycles = byDate.get(row.localDate);
    if (!cycles || cycles.source !== 'EVENTS') return row;
    if (cycles.cycles == null) return row;
    filledFromEvents.add(row.localDate);
    return {
      ...row,
      cycles: cycles.cycles,
      medianCycleMin: cycles.medianCycleMin,
    };
  });

  return { rows: out, filledFromEvents };
}
