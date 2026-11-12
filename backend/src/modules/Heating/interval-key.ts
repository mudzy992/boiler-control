import { localParts } from '../Dashboard/analytics-export';

/**
 * Ključ intervala učenja — **jedno mjesto, jedna zona** (plan
 * `PLAN-formula-v2.md`, F5.2).
 *
 * Do ove izmjene isti ključ se računao na **četiri** mjesta i u **tri** formata:
 *
 * | mjesto | format | sat |
 * |---|---|---|
 * | `Boiler.getIntervalKey()` | `weekday_afternoon` | serverski `new Date()` |
 * | `HeatingRecommendation.getIntervalKey()` | `weekday_afternoon` | serverski |
 * | `HeatingAnomalyChecker.getIntervalKey(ts)` | `weekday_afternoon` | serverski |
 * | `intervalKeyForLocalDate(localDate)` | `weekday_morning` | lokalni dan, ali **uvijek jutro** |
 *
 * Posljedica nije bila teorijska: baseline (run `43172257325`) pokazuje da
 * `HeatingIntervalLearning` već ima **dva** formata — `weekday_afternoon` iz
 * koda i `weekday_1_afternoon` iz starijeg zapisa (dan u sedmici kao **broj
 * 0–6**). Ista kuća tako ima učenje razdvojeno po formatu, a `samples` se
 * broje odvojeno.
 *
 * Zato ovaj modul:
 *
 *  1. računa sat u **zoni kuće/korisnika**, ne u zoni servera (`19` §7). Server u
 *     UTC-u bi za kuću u BiH pomjerio granicu `morning`/`afternoon` za 1–2 h, a
 *     greška je tiha: ključ izgleda ispravno, samo pripada pogrešnom dijelu dana;
 *  2. ima **jednu** funkciju za oba ulaza (trenutak i lokalni dan), da se ne
 *     mogu razići;
 *  3. **čita** i starije formate, da promjena formata ne baci postojeću
 *     historiju. Novi zapisi uvijek idu u kanonski format.
 */

/** Dio dana. Granice su iste kao u starom kodu — mijenja se zona, ne podjela. */
export type DayPart =
  'night' | 'morning' | 'late_morning' | 'afternoon' | 'evening';

/** Tip dana. Subota i nedjelja su `weekend`, kao i do sada. */
export type DayType = 'weekday' | 'weekend';

/**
 * Podjela dana. Nije izmišljena ovdje: preuzeta je iz tri identične kopije koje
 * su postojale u servisima, da se ponašanje **ne mijenja** — mijenja se samo
 * odakle dolazi sat.
 */
export function dayPart(hour: number): DayPart {
  if (hour >= 6 && hour < 9) return 'morning';
  if (hour >= 9 && hour < 12) return 'late_morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

/** `Date.getDay()` vrijednost: 0 = nedjelja. */
export function dayType(weekday: number): DayType {
  return weekday === 0 || weekday === 6 ? 'weekend' : 'weekday';
}

/**
 * Kanonski format. Mijenja se **samo uz verzionisanje** — v. `INTERVAL_KEY_VERSION`
 * i `readIntervalKey`.
 */
export function canonicalIntervalKey(
  dayTypeValue: DayType,
  part: DayPart,
): string {
  return `${dayTypeValue}_${part}`;
}

/**
 * Verzija formata, zapisana uz ključ da se poslije može znati koji je zapis u
 * kom formatu. Danas je 2: `1` je bio `<brojDana>_<dio>` (npr. `1_afternoon`),
 * `2` je `<tipDana>_<dio>`.
 */
export const INTERVAL_KEY_VERSION = 2;

export interface IntervalKeyInput {
  /**
   * Trenutak za koji se traži ključ. `null` znači „nema trenutka" — tada se
   * koristi `localDate`.
   */
  at?: Date | null;
  /**
   * Lokalni dan kuće (`YYYY-MM-DD`). Koristi se kad nema trenutka — npr. dnevni
   * zapis koji se piše jednom dnevno i zna samo dan.
   */
  localDate?: string | null;
  /**
   * IANA zona kuće. **Obavezna** namjerno: pozivalac mora odlučiti, jer zadana
   * vrijednost „UTC" je upravo greška koju ovaj modul uklanja.
   */
  timeZone: string;
  /**
   * Sat koji se koristi kad je poznat samo dan (`localDate`). Zadano 6
   * (`PROPOSAL_LOCAL_HOUR`) jer dnevni zapis nastaje ujutro — to je jedino
   * vrijeme koje zapis zaista poznaje.
   */
  hourForLocalDate?: number;
}

/**
 * Ključ za trenutak ili za lokalni dan, uvijek u zadatoj zoni.
 *
 * Vraća `null` kad nema ni trenutka ni dana — bolje ništa nego ključ iz
 * serverskog sata, koji bi tiho upisao učenje u pogrešan interval.
 */
export function intervalKey(input: IntervalKeyInput): string | null {
  const { at, localDate, timeZone } = input;

  if (at) {
    /*
     * `localParts` **baca** na neispravno ime zone (`Intl` odbija zonu). Ovaj
     * modul ne smije bacati: zove se iz cron poslova nad redovima iz baze, pa bi
     * jedan loš red oborio obradu svih ostalih. Zato `null` — pozivalac tada
     * preskače učenje i to prijavi, umjesto da tiho upiše u pogrešan interval.
     */
    let hour: number;
    try {
      hour = Number(localParts(at, timeZone).hour);
    } catch {
      return null;
    }
    // `localParts` daje zidno vrijeme; dan u sedmici se dobija iz istog
    // trenutka u istoj zoni, da sat i dan ne mogu doći iz različitih dana.
    const weekday = weekdayInZone(at, timeZone);
    if (!Number.isFinite(hour) || weekday == null) return null;
    return canonicalIntervalKey(dayType(weekday), dayPart(hour));
  }

  if (localDate) {
    const weekday = weekdayOfLocalDate(localDate);
    if (weekday == null) return null;
    const hour = input.hourForLocalDate ?? 6;
    return canonicalIntervalKey(dayType(weekday), dayPart(hour));
  }

  return null;
}

/**
 * Dan u sedmici (0–6) za trenutak u zadatoj zoni.
 *
 * Namjerno preko `Intl`, ne preko `Date.getDay()`: `getDay()` čita **serversku**
 * zonu, pa bi za trenutak u 23:30 UTC dan u BiH bio sljedeći, a ključ bi dobio
 * pogrešan tip dana.
 */
export function weekdayInZone(at: Date, timeZone: string): number | null {
  try {
    const name = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
    }).format(at);
    const index = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(
      name,
    );
    return index === -1 ? null : index;
  } catch {
    return null;
  }
}

/**
 * Dan u sedmici za `YYYY-MM-DD`.
 *
 * Računa se u **UTC** polu, a ne lokalno: `new Date('2026-11-12')` je ponoć UTC,
 * pa je dan u sedmici isti u svakoj zoni. Namjerno se ne prolazi kroz
 * `new Date(y, m, d)` (lokalno), jer bi tada server u UTC-u i server u
 * `Europe/Sarajevo` za isti tekst dali različit dan.
 */
export function weekdayOfLocalDate(localDate: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!match) return null;
  const [, year, month, day] = match;
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);

  /*
   * Raspon se provjerava **prije** `Date.UTC`, a ne kroz `isNaN`: `Date.UTC`
   * tiho prelije vrijednost u sljedeći mjesec/godinu, pa `2026-13-45` ne daje
   * `Invalid Date` nego `2027-02-14`. Test je to uhvatio — bez ove provjere bi
   * neispravan datum dobio ključ umjesto `null`.
   */
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;

  const date = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(date.getTime())) return null;
  // I provjera da se dan nije prelio (npr. 31. februar → 3. mart).
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;

  return date.getUTCDay();
}

/**
 * Čitanje ključa iz baze, sa podrškom za starije formate.
 *
 * Vraća **kanonski** ekvivalent za sve poznate formate, pa pozivalac ne mora
 * znati historiju formata:
 *
 *  - `weekday_afternoon`   → `weekday_afternoon` (v2)
 *  - `1_afternoon`         → `weekday_afternoon` (v1: dan kao broj, 1 = ponedjeljak)
 *  - `0_night`             → `weekend_night`    (v1: 0 = nedjelja)
 *  - `weekend_evening`     → `weekend_evening`  (v2)
 *
 * Nepoznat format se vraća **nepromijenjen** — tada se ne izmišlja tumačenje, ali
 * `isCanonicalIntervalKey()` kaže da nije kanonski, pa pozivalac može odlučiti.
 */
export function readIntervalKey(raw: string): string {
  if (isCanonicalIntervalKey(raw)) return raw;

  const legacy =
    /^([0-6])_(night|morning|late_morning|afternoon|evening)$/.exec(raw);
  if (legacy) {
    const weekday = Number(legacy[1]);
    return canonicalIntervalKey(dayType(weekday), legacy[2] as DayPart);
  }
  return raw;
}

/**
 * Zona za uređaj: zona kuće, pa zona korisnika, pa zadana.
 *
 * Isti lanac kao `resolveHomeTimeZone` (`DailyRecord/proposal-schedule.ts`), ali
 * bez bacanja izuzetka — ovdje nedostatak zone ne smije oboriti učenje, samo ga
 * preskočiti. Namjerno se **ne** vraća `null`: pozivalac uvijek dobije zonu, a
 * `null` bi značio „nema ključa" i tiho preskakanje učenja bez traga u logu.
 *
 * Zašto nije `UTC`: kuća u BiH bi u UTC-u dobila `night` sat vremena duže zimi i
 * dva sata ljeti, pa bi učenje za `evening` završavalo u `night`.
 */
export const FALLBACK_TIME_ZONE = 'Europe/Sarajevo';

export function zoneForDevice(device: {
  homeProfile?: {
    weatherTimezone?: string | null;
    user?: { timezone?: string | null } | null;
  } | null;
}): string {
  const home = device.homeProfile;
  for (const candidate of [home?.weatherTimezone, home?.user?.timezone]) {
    if (typeof candidate !== 'string' || candidate.trim().length === 0)
      continue;
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: candidate.trim(),
      }).resolvedOptions().timeZone;
    } catch {
      // Neispravno ime zone se preskače, ne baca — cron ne smije pasti zbog
      // jednog lošeg reda u bazi. Isto pravilo kao u `resolveHomeTimeZone`.
    }
  }
  return FALLBACK_TIME_ZONE;
}

/** Ključ za uređaj i trenutak, u zoni kuće. */
export function intervalKeyForDevice(
  device: {
    homeProfile?: {
      weatherTimezone?: string | null;
      user?: { timezone?: string | null } | null;
    } | null;
  },
  at: Date,
): string | null {
  return intervalKey({ at, timeZone: zoneForDevice(device) });
}

/** Je li ključ u kanonskom (v2) formatu. */
export function isCanonicalIntervalKey(raw: string): boolean {
  return /^(weekday|weekend)_(night|morning|late_morning|afternoon|evening)$/.test(
    raw,
  );
}

/**
 * Svi ključevi koje treba probati pri čitanju učenja za jedan kanonski ključ.
 *
 * Zašto: `HeatingIntervalLearning` ima jedinstveni indeks
 * `(homeProfileId, intervalKey)`, pa se stari i novi format **ne spajaju sami**.
 * Dok se historija ne migrira, čitanje mora naći i stariji red; inače bi prva
 * izmjena formata izgledala kao „učenje je izgubljeno".
 */
export function intervalKeyCandidates(canonical: string): string[] {
  if (!isCanonicalIntervalKey(canonical)) return [canonical];

  const [type, part] = canonical.split('_') as [DayType, DayPart];
  const out = [canonical];

  // v1: dan kao broj. Za `weekday` to su 1–5, za `weekend` 0 i 6.
  const weekdays = type === 'weekend' ? [0, 6] : [1, 2, 3, 4, 5];
  for (const weekday of weekdays) out.push(`${weekday}_${part}`);

  return out;
}
