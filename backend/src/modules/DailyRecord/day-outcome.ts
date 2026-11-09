import { localDateKey, localMinuteOfDay } from './proposal-schedule';
import { OBSERVATION_INTERVAL_MIN } from '../Observation/observation-bucket';
import { OBSERVATIONS_PER_DAY, MIN_DAY_COVERAGE_RATIO } from '../HomeModel/daily-balance';

/**
 * Mjerni podaci jednog dana (`17` §5.2, §9.1) — sve što se iz serije može
 * **izračunati**, a ne pretpostaviti.
 *
 * Ovo je ulaz za kontroler iz `17` §8: on odlučuje na osnovu ishoda
 * (je li soba podbacila, koliko je ciklusa, koliko je trajao tipičan ciklus),
 * a ne na osnovu toga koliko je predlog bio lijep. Bez ovoga bi kontroler
 * spuštao polaznu naslijepo.
 *
 * Sve funkcije su čiste: baza, cron i zona su u `daily-outcome.service.ts`.
 */

/** Isti prag kao za fit modela: dan sa 30 uzoraka ne nosi mjerenje. */
export { MIN_DAY_COVERAGE_RATIO };

/**
 * Tolerancija za podbačaj (`17` §14.1): `ε = 1,0 K`, isto kao `DEAD_ZONE`.
 * Ispod normalne bande, a ne ispod cilja.
 */
export const UNDERSHOOT_TOLERANCE_K = 1.0;

/** Noć je ono što predlog mora pokriti: 22:00 → 06:00 lokalno (`15` §9.1). */
export const NIGHT_START_LOCAL_HOUR = 22;
export const NIGHT_END_LOCAL_HOUR = 6;

/** Za izmjerenu histerezu treba barem dva prelaza — jedan je slučaj, ne mjera. */
export const MIN_TRANSITIONS_FOR_HYSTERESIS = 2;

export interface OutcomeSample {
  at: Date;
  roomTempC: number | null;
  targetTempC: number | null;
  isHeating: boolean;
  /** Vanjska temperatura u tom trenutku — za noćni minimum te noći. */
  outdoorTempC?: number | null;
  /** Polazna koja je stvarno bila postavljena — za dokaz „koja polazna nije bila dovoljna". */
  flowSetC?: number | null;
}

export interface DayOutcome {
  localDate: string;
  samples: number;
  heatingSamples: number;
  dutyPercent: number;
  /** Broj ciklusa grijanja (blokova `isHeating = true`) u danu. */
  cycles: number;
  /** Medijana trajanja ciklusa; `null` ako nema ni jednog sa ≥ 2 uzorka. */
  medianCycleMin: number | null;
  /** Najveći manjak ispod cilja u danu (≥ 0). */
  undershootC: number;
  /** Najveći prebačaj iznad cilja u danu (≥ 0). */
  overshootC: number;
  comfortOk: boolean;
  /** Najveći manjak u noćnom prozoru (22:00 → 06:00); `null` bez uzoraka. */
  nightUndershootC: number | null;
  /** Najhladniji izmjereni sat te noći; `null` bez vanjske temperature. */
  nightMinOutdoorC: number | null;
  /**
   * Polazna koja je te noći stvarno bila na kotlu. Uzima se **najčešća**
   * vrijednost u prozoru (izmjena u toku noći je moguća), a kod izjednačenja
   * kasnija — tako dokaz uvijek nosi polaznu koja je nosila tu noć, a ne onu
   * koja je upisana u dnevni zapis možda i dan kasnije.
   */
  nightFlowC: number | null;
  /** `median(T_off − T_on)` — stvarna banda termostata izmjerena iz serije. */
  hysteresisK: number | null;
  /** `median(cilj − T_on)` — koliko ispod cilja grijanje počinje. */
  hysteresisAsymmetryK: number | null;
}

export type OutcomeResult =
  | { ok: true; outcome: DayOutcome }
  | { ok: false; localDate: string; reason: 'INCOMPLETE' | 'NO_ROOM' };

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Pripada li uzorak noći koja se **završava** u 06:00 dana `localDate`?
 *
 * Prozor je `localDate − 1 dan 22:00` → `localDate 06:00`, dakle u cjelini
 * prije nego dan `localDate` završi. To je jedini prozor koji je sigurno
 * kompletan u trenutku kad se dan obračunava; noć koja slijedi poslije
 * 22:00 istog dana još nije gotova i ne smije se mjeriti.
 */
function inNightWindow(at: Date, localDate: string, previousDate: string, zone: string): boolean {
  const date = localDateKey(at, zone);
  const minute = localMinuteOfDay(at, zone);
  if (date === previousDate) return minute >= NIGHT_START_LOCAL_HOUR * 60;
  if (date === localDate) return minute < NIGHT_END_LOCAL_HOUR * 60;
  return false;
}

function previousLocalDate(localDate: string): string {
  const noon = new Date(`${localDate}T12:00:00Z`);
  return new Date(noon.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Najčešća polazna u noći; kod izjednačenja kasnija. */
function dominantFlow(samples: readonly OutcomeSample[]): number | null {
  const counts = new Map<number, { count: number; lastIndex: number }>();
  samples.forEach((sample, index) => {
    if (sample.flowSetC == null) return;
    const seen = counts.get(sample.flowSetC);
    counts.set(sample.flowSetC, {
      count: (seen?.count ?? 0) + 1,
      lastIndex: index,
    });
  });

  let best: { flowC: number; count: number; lastIndex: number } | null = null;
  for (const [flowC, stats] of counts) {
    if (
      best === null ||
      stats.count > best.count ||
      (stats.count === best.count && stats.lastIndex > best.lastIndex)
    ) {
      best = { flowC, ...stats };
    }
  }
  return best === null ? null : best.flowC;
}

/**
 * Izračunava mjerni zapis jednog **završenog** lokalnog dana.
 *
 * Definicije koje vrijedi imati zapisane, jer se od njih zavisi:
 *
 * - **ciklus** je neprekinuti blok uzoraka sa `isHeating = true`. Trajanje je
 *   `zadnji − prvi + 5 min` (bucket je 5 min). Ciklus koji pređe ponoć je
 *   odsječen na granici dana — to je mjerni artefakt koji se ne skriva.
 * - **podbačaj** je `max(cilj − soba)` po uzorku, nikad negativan. Cilj je
 *   uzorkov, a ne fiksan: kuća koja drži 20 °C nije „podbacila" ako je cilj 20.
 * - **noć** pripada danu koji se **završava** u 06:00 (`22:00` prethodnog dana
 *   → `06:00` ovog). To je isti prozor koji predlog mora pokriti.
 * - **histereza** se mjeri na prelazima: `T_off − T_on` i `cilj − T_on`. Sa
 *   uzorkovanjem na 5 min bias je manji od 0,2 K (`17` §9.4).
 */
export function computeDayOutcome(
  localDate: string,
  samples: readonly OutcomeSample[],
  zone: string,
): OutcomeResult {
  const daySamples = samples
    .filter((sample) => localDateKey(sample.at, zone) === localDate)
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  const withRoom = daySamples.filter(
    (sample): sample is OutcomeSample & { roomTempC: number } =>
      sample.roomTempC != null,
  );

  if (daySamples.length < MIN_DAY_COVERAGE_RATIO * OBSERVATIONS_PER_DAY) {
    return { ok: false, localDate, reason: 'INCOMPLETE' };
  }
  if (withRoom.length === 0) {
    return { ok: false, localDate, reason: 'NO_ROOM' };
  }

  const heatingSamples = withRoom.filter((sample) => sample.isHeating).length;
  const dutyPercent = (heatingSamples / withRoom.length) * 100;

  // --- ciklusi -------------------------------------------------------------
  const runs: Array<{ start: Date; end: Date; samples: number }> = [];
  let current: { start: Date; end: Date; samples: number } | null = null;
  for (const sample of daySamples) {
    if (sample.isHeating) {
      if (current) {
        current.end = sample.at;
        current.samples += 1;
      } else {
        current = { start: sample.at, end: sample.at, samples: 1 };
      }
    } else if (current) {
      runs.push(current);
      current = null;
    }
  }
  if (current) runs.push(current);

  const runMinutes = runs
    .filter((run) => run.samples >= 2)
    .map(
      (run) =>
        (run.end.getTime() - run.start.getTime()) / 60_000 +
        OBSERVATION_INTERVAL_MIN,
    );

  // --- podbačaj i prebačaj ------------------------------------------------
  let undershootC = 0;
  let overshootC = 0;

  for (const sample of withRoom) {
    if (sample.targetTempC == null) continue;
    const deficit = sample.targetTempC - sample.roomTempC;
    if (deficit > undershootC) undershootC = deficit;
    if (deficit < -overshootC) overshootC = -deficit;
  }

  // --- noć -----------------------------------------------------------------
  // Prozor je širi od dana, pa se noć ne mjeri iz `daySamples`: njen početak
  // (22:00 prethodnog dana) pripada prethodnom danu.
  const previousDate = previousLocalDate(localDate);
  const nightSamples = samples
    .filter((sample) => inNightWindow(sample.at, localDate, previousDate, zone))
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  let nightUndershootC: number | null = null;
  for (const sample of nightSamples) {
    if (sample.roomTempC == null || sample.targetTempC == null) continue;
    const deficit = Math.max(0, sample.targetTempC - sample.roomTempC);
    nightUndershootC =
      nightUndershootC == null ? deficit : Math.max(nightUndershootC, deficit);
  }

  let nightMinOutdoorC: number | null = null;
  for (const sample of nightSamples) {
    if (sample.outdoorTempC == null) continue;
    nightMinOutdoorC =
      nightMinOutdoorC == null
        ? sample.outdoorTempC
        : Math.min(nightMinOutdoorC, sample.outdoorTempC);
  }

  // --- stvarna histereza ---------------------------------------------------
  const bands: number[] = [];
  const asymmetries: number[] = [];
  for (let index = 1; index < daySamples.length; index++) {
    const previous = daySamples[index - 1];
    const sample = daySamples[index];
    if (!previous.isHeating || sample.isHeating) continue;
    if (previous.roomTempC == null || sample.roomTempC == null) continue;
    bands.push(sample.roomTempC - previous.roomTempC);
    if (previous.targetTempC != null) {
      asymmetries.push(previous.targetTempC - previous.roomTempC);
    }
  }

  return {
    ok: true,
    outcome: {
      localDate,
      samples: withRoom.length,
      heatingSamples,
      dutyPercent,
      cycles: runs.length,
      medianCycleMin: median(runMinutes),
      undershootC,
      overshootC,
      comfortOk: undershootC <= UNDERSHOOT_TOLERANCE_K,
      nightUndershootC,
      nightMinOutdoorC,
      nightFlowC: dominantFlow(nightSamples),
      hysteresisK:
        bands.length >= MIN_TRANSITIONS_FOR_HYSTERESIS ? median(bands) : null,
      hysteresisAsymmetryK:
        asymmetries.length >= MIN_TRANSITIONS_FOR_HYSTERESIS
          ? median(asymmetries)
          : null,
    },
  };
}
