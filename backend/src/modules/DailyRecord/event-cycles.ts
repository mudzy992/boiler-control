import { cyclesFromEvents, type CycleEvent } from './day-outcome';
import { localDateKey } from './proposal-schedule';

/**
 * Ciklusi za historiju — iz događaja, za dane koje obračun nije stigao.
 *
 * Zašto ovdje, a ne u `DailyOutcomeService`: taj servis gleda samo
 * `OUTCOME_LOOKBACK_DAYS` (7) dana unazad. Korisnik gleda 20 dana (i više), pa
 * je za starije dane tabela i dalje prikazivala „—" za Cikluse, iako
 * `HeatingEvent` redovi postoje od prve verzije aplikacije. Popravka u piscu je
 * zato bila nedovoljna: mjerilo se **koliko dugo servis gleda**, ne odakle
 * čita.
 *
 * Događaji su ovdje **rezerva**, ne zamjena. Ako red već ima `cycles`, taj broj
 * se ne dira — došao je iz serije uzoraka, koja mjeri i rad i cikluse, pa je
 * konzistentniji sa ostalim mjernim kolonama istog reda. Događaji popunjavaju
 * samo ono što bi inače ostalo crtica.
 *
 * Pravilo razreza dana je isto kao u obračunu (`cyclesFromEvents`): ciklus koji
 * prelazi ponoć pripada danu u kojem je **počeo**.
 */

export interface EventCyclesRow {
  localDate: string;
  cycles: number | null;
  medianCycleMin: number | null;
}

export interface EventCyclesResult extends EventCyclesRow {
  /** `EVENTS` = popunjeno odavde; `RECORDED` = red je već imao cikluse. */
  source: 'EVENTS' | 'RECORDED';
}

/**
 * Popunjava `cycles`/`medianCycleMin` iz događaja za redove koji ih nemaju.
 *
 * `events` mora biti **uzak** skup (samo dani iz zahtjeva) — prozor od 60 dana
 * sa svim kućama bi bio nekoliko hiljada redova u svakom zahtjevu za tabelu.
 */
export function fillCyclesFromEvents(
  rows: readonly EventCyclesRow[],
  events: readonly CycleEvent[],
  zone: string,
): EventCyclesResult[] {
  if (events.length === 0) {
    return rows.map((row) => ({
      ...row,
      source: row.cycles != null ? 'RECORDED' : 'EVENTS',
    }));
  }

  // Jedan prolaz kroz događaje, grupisano po lokalnom datumu: inače bi se za
  // svaki dan ponovo prolazilo kroz cijeli niz (20 dana × N događaja).
  const byDate = new Map<string, CycleEvent[]>();
  for (const event of events) {
    const key = localDateKey(event.startedAt, zone);
    const bucket = byDate.get(key);
    if (bucket) bucket.push(event);
    else byDate.set(key, [event]);
  }

  return rows.map((row) => {
    if (row.cycles != null) return { ...row, source: 'RECORDED' as const };
    const forDay = byDate.get(row.localDate) ?? [];
    if (forDay.length === 0) return { ...row, source: 'EVENTS' as const };
    const { cycles, medianCycleMin } = cyclesFromEvents(
      row.localDate,
      forDay,
      zone,
    );
    if (cycles === 0) return { ...row, source: 'EVENTS' as const };
    return {
      ...row,
      cycles,
      // Medijana ostaje `null` ako nijedan ciklus nije završen — broj ciklusa
      // je tada mjerenje, a trajanje nije.
      medianCycleMin: row.medianCycleMin ?? medianCycleMin,
      source: 'EVENTS' as const,
    };
  });
}
