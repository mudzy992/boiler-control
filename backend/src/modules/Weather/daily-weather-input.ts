import {
  daySummaryFrom,
  nightMinimumFrom,
} from '../DailyRecord/night-forecast';
import type { WeatherDayV2, WeatherV2Response } from './weather-v2.types';

/**
 * Ono što formula dobija iz prognoze za jedan dan.
 *
 * `nightMinC` je dodatak (F1): dnevni `tempMin` je minimum **kalendarskog**
 * dana, a noć koja odlučuje o predlogu traje 22:00 → 06:00 i prelazi ponoć.
 * Zato noćni minimum ima svoje polje, a ne izvodi se iz `tempMin`.
 *
 * Kad satna prognoza ne postoji (stariji keš, `WeatherCache` fallback),
 * `nightMinC` može biti `null` — i tada polje **ne postoji**, umjesto da bude
 * jednako `tempMin`. Pozivalac koji ne može razlikovati ta dva slučaja bi
 * tiho tvrdio da je noćni minimum izmjeren iz sata, a on je samo dnevni.
 */
export interface DailyWeatherInput {
  tempMin: number;
  tempMax: number;
  /**
   * Najhladniji sat u noći 22:00 → 06:00 (zona kuće). `null` = nema satne
   * prognoze; **nije** isto što i `tempMin`.
   */
  nightMinC?: number | null;
  /** Odakle je `nightMinC`, da se gruba procjena ne čita kao satna. */
  nightMinSource?: NightMinSource;
  /** Koliko je satnih uzoraka ušlo u `nightMinC`. */
  nightHoursUsed?: number;
  /** Prosjek svih sati lokalnog dana (`null` bez satne prognoze). */
  dayMeanC?: number | null;
  /** Najviši sat lokalnog dana (`null` bez satne prognoze). */
  dayMaxC?: number | null;
  /** `Σ max(0, 15 − T_sat)` po satima lokalnog dana. */
  degreeHours?: number | null;
}

/**
 * `HOURLY` = iz satne prognoze u zoni kuće;
 * `DAILY_MIN` = nema satne prognoze, pa je upotrijebljen dnevni minimum —
 * gruba zamjena koja **podcjenjuje** noć ako je najhladniji sat dana bio
 * poslijepodne (oblačno jutro), i **precjenjuje** ako je bio u zoru.
 */
export type NightMinSource = 'HOURLY' | 'DAILY_MIN';

function localDateKey(now: Date, timeZone: string): string | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    let year = '';
    let month = '';
    let day = '';
    for (const part of parts) {
      if (part.type === 'year') year = part.value;
      else if (part.type === 'month') month = part.value;
      else if (part.type === 'day') day = part.value;
    }
    return year && month && day ? `${year}-${month}-${day}` : null;
  } catch {
    return null;
  }
}

export function weatherDayFromV2(
  response: WeatherV2Response | null,
  now: Date,
): WeatherDayV2 | null {
  if (!response || response.status !== 'ok') return null;
  const date = localDateKey(now, response.location.timezone);
  return response.daily.find((candidate) => candidate.date === date) ?? null;
}

/**
 * Pun dnevni unos: satna prognoza za noć i za dnevni prosjek, uz dnevne
 * min/max iz `daily` bloka.
 *
 * Mjesta gdje se lako pogriješi, pa su namjerno eksplicitna:
 *
 * - **noć pripada danu koji se završava u 06:00**, pa se za `nightMinC` pitanje
 *   postavlja za *taj* lokalni dan (isti ugovor kao `DailyRecord.localDate`);
 * - **dnevni min/max ostaju iz `daily` bloka** kad postoje, jer je to ono što
 *   je v2 već dao i na čemu su ostali potrošači;
 * - kad satne prognoze nema, `nightMinC` pada na `tempMin` **uz oznaku**
 *   `DAILY_MIN` — nikad tiho, i nikad kao da je izmjeren iz sata.
 */
export function dailyWeatherInputFromV2(
  response: WeatherV2Response | null,
  now: Date,
): DailyWeatherInput | null {
  const daily = weatherDayFromV2(response, now);
  if (
    !daily ||
    typeof daily.temperatureMinC !== 'number' ||
    !Number.isFinite(daily.temperatureMinC) ||
    typeof daily.temperatureMaxC !== 'number' ||
    !Number.isFinite(daily.temperatureMaxC)
  ) {
    return null;
  }

  const base: DailyWeatherInput = {
    tempMin: daily.temperatureMinC,
    tempMax: daily.temperatureMaxC,
  };

  if (!response || response.status !== 'ok' || daily.date == null) {
    return withDailyMinFallback(base);
  }

  const zone = response.location.timezone;
  const localDate = daily.date;
  // `hourly` može nedostajati i u `status: 'ok'` odgovoru (stariji keš, drugi
  // provajder). Tada nema noći iz sata — ali dan i dalje postoji.
  const hours = (response.hourly ?? []).map((hour) => ({
    at: new Date(hour.at),
    temperatureC: hour.temperatureC,
  }));

  const night = nightMinimumFrom(hours, localDate, zone);
  const day = daySummaryFrom(hours, localDate, zone);

  return {
    ...base,
    nightMinC: night ? night.nightMinC : base.tempMin,
    nightMinSource: night ? 'HOURLY' : 'DAILY_MIN',
    nightHoursUsed: night ? night.hoursUsed : 0,
    dayMeanC: day ? day.dayMeanC : null,
    dayMaxC: day ? day.dayMaxC : null,
    degreeHours: day ? day.degreeHours : null,
  };
}

/** Isti unos, ali bez satne prognoze — noćni minimum je dnevni, i to se vidi. */
function withDailyMinFallback(base: DailyWeatherInput): DailyWeatherInput {
  return {
    ...base,
    nightMinC: base.tempMin,
    nightMinSource: 'DAILY_MIN',
    nightHoursUsed: 0,
    dayMeanC: null,
    dayMaxC: null,
    degreeHours: null,
  };
}
