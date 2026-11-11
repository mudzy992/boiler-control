import { localParts } from '../Dashboard/analytics-export';
import { localDateKey } from './proposal-schedule';
import { NIGHT_END_LOCAL_HOUR, NIGHT_START_LOCAL_HOUR } from './day-outcome';

/**
 * Noćni minimum iz **satne prognoze** — ono što predlog treba da pokrije.
 *
 * Zašto sat, a ne dnevni `temperature_2m_min`: dnevni minimum pokriva
 * kalendarski dan, a noć koja odlučuje o predlogu traje **22:00 → 06:00** i
 * prelazi ponoć. Dnevni minimum od 22:00 do 24:00 pripada *današnjem* danu, a
 * od 00:00 do 06:00 *sutrašnjem* — tako ih dnevni podatak nikad ne spoji. Zato
 * se `nightMinC` računa iz sati, u zoni kuće, po istom prozoru koji mjeri i
 * `computeDayOutcome` (jedna definicija noći, na dva mjesta iste vrijednosti —
 * `NIGHT_START_LOCAL_HOUR`/`NIGHT_END_LOCAL_HOUR`).
 *
 * Tri pravila:
 *
 * 1. **Samo sati koji pripadaju prozoru.** Kraj prozora je *isključen* (06:00),
 *    isto kao u mjerenju; sat koji počinje u 06:00 nije noć.
 * 2. **Bez ijednog sata nema broja.** Vraća se `null`, nikad `0` — nula je
 *    izmjeren podatak, a ovdje se ništa nije izmjerilo. Isto pravilo kao u
 *    `daily-weather-input.ts` za dnevni min.
 * 3. **Pokrivenost se vraća uz broj.** Prognoza ima 72 sata i počinje od
 *    sljedećeg punog sata, pa noć dvije noći unaprijed može biti djelimično
 *    pokrivena. `hoursUsed` to kaže umjesto da se pravi da je noć cijela.
 */

/** Kalendarski prethodni dan (`YYYY-MM-DD`) — bez `Date` i bez zone. */
export function previousLocalDate(localDate: string): string {
  const noon = new Date(`${localDate}T12:00:00Z`);
  return new Date(noon.getTime() - 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

/** Koliko sati ima puna noć (22:00 → 06:00). */
export const NIGHT_HOURS = 24 - NIGHT_START_LOCAL_HOUR + NIGHT_END_LOCAL_HOUR;

/** Jedan sat prognoze, već sveden na ono što ovaj proračun traži. */
export interface NightHourSample {
  /** Trenutak početka sata. */
  at: Date;
  /** Vanjska temperatura; `null` kad je prognoza nema. */
  temperatureC: number | null;
}

export interface NightMinimum {
  /** Najhladniji predviđeni sat u noći koja se završava tog dana u 06:00. */
  nightMinC: number;
  /** Koliko je satnih uzoraka ušlo (od `NIGHT_HOURS`). */
  hoursUsed: number;
  /** Prvi sat ušao u prozor — za provjeru da prozor nije pomjeren. */
  firstHourAt: Date;
  /** Zadnji sat ušao u prozor. */
  lastHourAt: Date;
}

/**
 * Je li sat dio noći koja se završava u 06:00 `localDate`-a?
 *
 * Isti oblik kao `isNightSample` u `day-outcome.ts`, samo nad satom umjesto
 * uzorka: sat pripada noći ako je **prethodnog** dana u 22:00 ili kasnije,
 * ili **tog** dana prije 06:00.
 */
export function isNightHourOf(
  at: Date,
  localDate: string,
  zone: string,
): boolean {
  const date = localDateKey(at, zone);
  const hour = Number(localParts(at, zone).hour);
  if (date === previousLocalDate(localDate)) {
    return hour >= NIGHT_START_LOCAL_HOUR;
  }
  if (date === localDate) {
    return hour < NIGHT_END_LOCAL_HOUR;
  }
  return false;
}

/**
 * Noćni minimum za dan koji se završava u 06:00 `localDate`-a.
 *
 * `null` kad u prozoru nema ijednog sata sa temperaturom. Djelimična
 * pokrivenost **nije** razlog za `null` — vraća se najhladniji raspoloživi sat,
 * a `hoursUsed` kaže koliko ih je bilo. Odluku o tome je li pokrivenost dovoljna
 * donosi pozivalac, jer je to pitanje politike, ne proračuna.
 */
export function nightMinimumFrom(
  hours: readonly NightHourSample[],
  localDate: string,
  zone: string,
): NightMinimum | null {
  let best: NightMinimum | null = null;

  for (const hour of hours) {
    const value = hour.temperatureC;
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    if (!isNightHourOf(hour.at, localDate, zone)) continue;

    if (best == null) {
      best = {
        nightMinC: value,
        hoursUsed: 1,
        firstHourAt: hour.at,
        lastHourAt: hour.at,
      };
      continue;
    }

    best.hoursUsed += 1;
    if (value < best.nightMinC) best.nightMinC = value;
    if (hour.at < best.firstHourAt) best.firstHourAt = hour.at;
    if (hour.at > best.lastHourAt) best.lastHourAt = hour.at;
  }

  return best;
}

/**
 * Dnevni prosjek i stepen-dan iz iste satne prognoze.
 *
 * `dayMeanC` je prosjek **svih** satnih temperatura tog lokalnog dana (00–24),
 * `degreeHours` je `Σ max(0, 15 − T_sat)`. Oba su `null` kad nema ijednog sata,
 * i oba se računaju iz istih sati — da se ne bi desilo da prosjek i stepen-dan
 * opisuju različite dane.
 */
export const DEGREE_DAY_BASE_C = 15;

export interface DayWeatherSummary {
  dayMeanC: number;
  dayMaxC: number;
  degreeHours: number;
  hoursUsed: number;
}

export function daySummaryFrom(
  hours: readonly NightHourSample[],
  localDate: string,
  zone: string,
): DayWeatherSummary | null {
  let sum = 0;
  let max = Number.NEGATIVE_INFINITY;
  let degreeHours = 0;
  let used = 0;

  for (const hour of hours) {
    const value = hour.temperatureC;
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    if (localDateKey(hour.at, zone) !== localDate) continue;

    used += 1;
    sum += value;
    if (value > max) max = value;
    degreeHours += Math.max(0, DEGREE_DAY_BASE_C - value);
  }

  if (used === 0) return null;

  return {
    dayMeanC: sum / used,
    dayMaxC: max,
    degreeHours,
    hoursUsed: used,
  };
}
