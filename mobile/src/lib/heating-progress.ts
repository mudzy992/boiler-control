/**
 * Progres grijanja — logika bez UI-a (`36`).
 *
 * Ideja (vlasnik, 2026-11-08): dok grijanje traje, traka pokazuje **koliko je
 * ciklus odmakao** u odnosu na proračunato vrijeme dogrijavanja i na idealnih
 * 120 minuta:
 *
 *   0 ──────── predviđeno ──────── 120 ──────▶ preko 120
 *        zelena        žuta         crvena
 *
 * Zašto odvojeno od komponente: pragovi i medijana se moraju moći testirati bez
 * renderovanja. Greška u pragu nije kozmetika — crvena traka znači „ciklus
 * probija", a to korisnik čita kao upozorenje.
 *
 * Postojeće trake (`GaugeBar`) mjerile su nešto drugo i to je bilo zbunjujuće:
 * polazna voda u rasponu 46–55 °C i sobna temperatura na fiksnoj skali 0–30 °C.
 * Nijedna nije bila „napredak grijanja", a obje su izgledale kao napredak.
 */

/** Idealno trajanje jednog ciklusa dogrijavanja, po dogovoru sa vlasnikom. */
export const IDEAL_HEAT_MINUTES = 120;

export type HeatingZone = 'within' | 'over' | 'beyond' | 'unknown';

export interface HeatingProgressModel {
  /** Koliko ciklus traje sada; `null` kad nema početka (nije aktivno). */
  elapsedMin: number | null;
  /** Proračunato vrijeme dogrijavanja; `null` kad motor još nema podatke. */
  predictedMin: number | null;
  /** Idealno trajanje (120 min). */
  idealMin: number;
  /** Desni kraj skale — nikad manji od idealnog, raste ako ciklus probije. */
  scaleMax: number;
  /** Napunjenost trake 0–1 (elapsed / scaleMax). */
  elapsedRatio: number;
  /** Položaj markera „predviđeno" 0–1; `null` kad nema procjene. */
  predictedRatio: number | null;
  /** Položaj granice idealnog 0–1. */
  idealRatio: number;
  zone: HeatingZone;
}

/** Minute od `iso` do `now`; negativno se reže na 0 (sat uređaja i servera se razilaze). */
export function minutesSince(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null;
  const start = new Date(iso).getTime();
  if (!Number.isFinite(start)) return null;
  return Math.max(0, (now - start) / 60000);
}

/**
 * Medijana trajanja **završenih** ciklusa.
 *
 * Koristi se kao rezerva kad motor još nema `expectedHeatTimeMin`: bolje je
 * pokazati stvarno izmjereno trajanje iz aplikacije nego izmišljenu procjenu.
 * Medijana, a ne prosjek — jedan ciklus od 9 sati (zaboravljen prozor) pomjerio
 * bi prosjek, a medijanu ne.
 */
export function medianCycleMinutes(
  events: readonly {
    startedAt?: string | null;
    endedAt?: string | null;
    timestampStart?: string | null;
    timestampEnd?: string | null;
  }[],
): number | null {
  const durations = events
    .map((event) => {
      const start = event.startedAt ?? event.timestampStart ?? null;
      const end = event.endedAt ?? event.timestampEnd ?? null;
      if (!start || !end) return null;
      const minutes = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
      return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
    })
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);

  if (durations.length === 0) return null;
  const middle = Math.floor(durations.length / 2);
  return durations.length % 2 === 0
    ? (durations[middle - 1] + durations[middle]) / 2
    : durations[middle];
}

/** U kojoj je zoni ciklus u datom trenutku. */
export function heatingZone(
  elapsedMin: number | null,
  predictedMin: number | null,
  idealMin: number = IDEAL_HEAT_MINUTES,
): HeatingZone {
  if (elapsedMin === null) return 'unknown';
  if (elapsedMin > idealMin) return 'beyond';
  if (predictedMin === null || predictedMin <= 0) return 'unknown';
  return elapsedMin > predictedMin ? 'over' : 'within';
}

/** Cijeli model trake iz početka ciklusa, procjene i trenutnog vremena. */
export function heatingProgress(options: {
  startedAt: string | null | undefined;
  now: number;
  predictedMin?: number | null;
  idealMin?: number;
}): HeatingProgressModel {
  const idealMin = options.idealMin ?? IDEAL_HEAT_MINUTES;
  const predictedMin =
    options.predictedMin != null && options.predictedMin > 0 ? options.predictedMin : null;
  const elapsedMin = minutesSince(options.startedAt, options.now);

  // Skala mora primiti i probijanje: kad ciklus traje 150 min, crvena zona
  // mora biti vidljiva, a ne da se traka „napuni" i stane.
  const scaleMax = Math.max(idealMin, elapsedMin ?? 0, predictedMin ?? 0);
  const ratio = (minutes: number) => (scaleMax > 0 ? Math.min(1, minutes / scaleMax) : 0);

  return {
    elapsedMin,
    predictedMin,
    idealMin,
    scaleMax,
    elapsedRatio: elapsedMin === null ? 0 : ratio(elapsedMin),
    predictedRatio: predictedMin === null ? null : ratio(predictedMin),
    idealRatio: ratio(idealMin),
    zone: heatingZone(elapsedMin, predictedMin, idealMin),
  };
}
