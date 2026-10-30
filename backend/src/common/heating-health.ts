/**
 * FE2-14 (FE-010): health score i pravila upozorenja — JEDAN IZVOR.
 *
 * Odluka vlasnika (2026-10-30): logika ide u backend endpoint, klijenti je ne
 * računaju. Prije toga web je računao `max(0, 100 - anomalije×15)`, a mobile
 * potpuno drugu, ponderisanu formulu, pa su za isti ulaz davali različit broj.
 *
 * Usvojena je **ponderisana formula** (ona koju je mobile već koristio) jer
 * sadrži više signala; web verzija s jednim faktorom bila bi regresija.
 *
 * ⚠️ Ponderi i pragovi NIJESU stručno potvrđeni. Preuzeti su 1:1 iz postojećeg
 * mobilnog koda (`mobile/src/screens/dashboard/DashboardScreen.tsx:165-215`) i
 * web upozorenja (`DashboardPage.tsx`). Ovo ih centralizuje i čini vidljivima,
 * ali ih ne legitimiše — za stvarno utvrđivanje treba inženjer grijanja.
 *
 * Funkcije su namjerno ČISTE (bez Prisma/DI) da se mogu testirati bez baze.
 */

/** Ponderi pojedinih signala u health scoreu. */
export const HEALTH_WEIGHTS = {
  learningConfidence: 35,
  flowDelta: 25,
  thermostatFreshness: 25,
  anomalyRate: 15,
} as const;

export type HealthComponentKey = keyof typeof HEALTH_WEIGHTS;

/** Score kad nema nijednog signala (nema profila/termostata/podataka). */
export const HEALTH_NO_DATA_SCORE = 50;

/** Koliko bodova score gubi po °C odstupanja stvarne od preporučene temperature. */
export const FLOW_DELTA_PENALTY_PER_C = 12.5;

/** Termostat se smatra svježim ako je viđen unutar ovoliko minuta. */
export const THERMOSTAT_FRESH_MINUTES = 10;

/** Ciklus kraći od ovoga je „kratak" (min). */
export const SHORT_CYCLE_MINUTES = 20;

/** Koliko kratkih ciklusa pokreće upozorenje. */
export const SHORT_CYCLE_COUNT_THRESHOLD = 3;

/** Ciklus duži od ovoga je „dug" (min). */
export const LONG_CYCLE_MINUTES = 90;

/** Prosječno zaostajanje za ciljem (°C) iznad kojeg se upozorava. */
export const TARGET_SHORTFALL_WARN_C = 1.5;

/**
 * Prosječno pregašenje cilja (°C) iznad kojeg se upozorava.
 *
 * Dodano po odluci vlasnika (2026-10-30): prije je postojala samo detekcija
 * zaostajanja, i to pogrešno označena kao „overshoot".
 */
export const TARGET_OVERSHOOT_WARN_C = 1.5;

/** Koliko najnovijih događaja ulazi u uzorak za health/upozorenja. */
export const HEALTH_EVENT_SAMPLE = 20;

export interface HealthComponent {
  key: HealthComponentKey;
  /** 0–100 */
  score: number;
  weight: number;
}

export type HealthWarningType =
  | 'shortCycles'
  | 'longCycles'
  | 'targetShortfall'
  | 'targetOvershoot'
  | 'anomalies';

export type HealthWarningLevel = 'info' | 'warning' | 'error';

export interface HealthWarning {
  type: HealthWarningType;
  level: HealthWarningLevel;
  /**
   * Zadani (bosanski) tekst, kao što ga je web već prikazivao. Klijenti koji
   * žele lokalizaciju mogu koristiti `type` kao ključ.
   */
  message: string;
}

/**
 * Ograničava vrijednost na [0, 100].
 *
 * `NaN` vraća 0 jer `Math.max(0, Math.min(100, NaN))` daje `NaN`, što bi se
 * propagiralo kroz cijeli score. Ali **samo** NaN: `±Infinity` se pravilno
 * clampa na granicu (100 odnosno 0), jer „iznad granice" i „nevalidno" nisu
 * ista stvar. Prva verzija je koristila `!Number.isFinite` i time vratila 0 za
 * +Infinity — test `heating-health.spec.ts` je to uhvatio.
 */
export function clampScore(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

/**
 * Ponderisani prosjek. Vraća `HEALTH_NO_DATA_SCORE` kad nema nijedne
 * komponente — isto ponašanje kao postojeći mobilni kod.
 */
export function computeWeightedHealthScore(
  components: readonly HealthComponent[],
): number {
  if (components.length === 0) return HEALTH_NO_DATA_SCORE;

  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  if (totalWeight <= 0) return HEALTH_NO_DATA_SCORE;

  const weighted = components.reduce((sum, c) => sum + c.score * c.weight, 0);
  return Math.round(clampScore(weighted / totalWeight));
}

/** Minimalni oblik događaja koji pravila upozorenja trebaju. */
export interface HealthEventInput {
  durationMinutes: number;
  targetTemp: number;
  currentTemp: number;
  isAnomaly: boolean;
}

/**
 * Pravila upozorenja.
 *
 * `shortfall` i `overshoot` su DVA odvojena pravila s istom logikom ali
 * suprotnim predznakom:
 *   shortfall = avg(target - current) > 0  → prostorija ZAOSTAJE za ciljem
 *   overshoot = avg(current - target) > 0  → prostorija PRELAZI cilj
 *
 * Prije FE2-14 postojala je samo prva, i bila je označena kao „overshoot", što
 * je korisniku govorilo suprotno od izmjerenog.
 */
export function buildHealthWarnings(
  events: readonly HealthEventInput[],
): HealthWarning[] {
  const warnings: HealthWarning[] = [];
  if (events.length === 0) return warnings;

  const shortCycles = events.filter(
    (e) => e.durationMinutes < SHORT_CYCLE_MINUTES,
  );
  if (shortCycles.length >= SHORT_CYCLE_COUNT_THRESHOLD) {
    warnings.push({
      type: 'shortCycles',
      level: 'warning',
      message: `Detektovano ${shortCycles.length} kratkih ciklusa grijanja (< ${SHORT_CYCLE_MINUTES} min)`,
    });
  }

  const shortfallAvg =
    events.reduce((sum, e) => sum + (e.targetTemp - e.currentTemp), 0) /
    events.length;
  if (shortfallAvg > TARGET_SHORTFALL_WARN_C) {
    warnings.push({
      type: 'targetShortfall',
      level: 'warning',
      message: `Ciljna temperatura se ne dostiže - prosječno zaostajanje: ${shortfallAvg.toFixed(1)}°C`,
    });
  }

  const overshootAvg =
    events.reduce((sum, e) => sum + (e.currentTemp - e.targetTemp), 0) /
    events.length;
  if (overshootAvg > TARGET_OVERSHOOT_WARN_C) {
    warnings.push({
      type: 'targetOvershoot',
      level: 'warning',
      message: `Moguće pregašenje cilja - prosječno iznad: ${overshootAvg.toFixed(1)}°C`,
    });
  }

  const longCycles = events.filter(
    (e) => e.durationMinutes > LONG_CYCLE_MINUTES,
  );
  if (longCycles.length > 0) {
    warnings.push({
      type: 'longCycles',
      level: 'info',
      message: `Detektovano ${longCycles.length} dugih ciklusa grijanja (> ${LONG_CYCLE_MINUTES} min)`,
    });
  }

  const anomalyCount = events.filter((e) => e.isAnomaly).length;
  if (anomalyCount > 0) {
    warnings.push({
      type: 'anomalies',
      level: 'error',
      message: `${anomalyCount} anomalija(e) u odabranom periodu`,
    });
  }

  return warnings;
}

/**
 * Score za svježinu termostata: udio uređaja viđenih unutar
 * `THERMOSTAT_FRESH_MINUTES`, kao postotak.
 */
export function computeThermostatFreshnessScore(
  lastSeenValues: readonly (Date | string | null | undefined)[],
  nowMs: number = Date.now(),
): number {
  if (lastSeenValues.length === 0) return 0;

  const fresh = lastSeenValues.filter((value) => {
    if (!value) return false;
    const time =
      value instanceof Date ? value.getTime() : new Date(value).getTime();
    if (Number.isNaN(time)) return false;
    return (nowMs - time) / 60000 <= THERMOSTAT_FRESH_MINUTES;
  }).length;

  return clampScore((fresh / lastSeenValues.length) * 100);
}
