import { localParts } from '../Dashboard/analytics-export';
import { intervalKey } from '../Heating/interval-key';

/**
 * Pravila "kada dnevni zapis nastaje" — čiste funkcije, bez baze i bez sata.
 *
 * Zašto odvojeno: granica dana i prag 06:00 su jedina dva mjesta gdje se
 * vremenska zona može pogriješiti, a greška je tiha (predlog za pogrešan dan
 * izgleda ispravno). Zato su izdvojeni i pokriveni testom, umjesto da žive
 * unutar cron metode.
 */

/** Predlog vrijedi za cijeli lokalni dan, pa nastaje na početku dana. */
export const PROPOSAL_LOCAL_HOUR = 6;

/**
 * Poslije ovog sata predlog se više ne piše — bilježi se `MISSED_WINDOW`.
 *
 * Pravilo nije fizička konstanta nego posljedica namjene: predlog upravlja
 * cijelim danom, pa se prihvata samo dok je veći dio dana još pred nama.
 * Podne je ta granica. Bez nje bi predlog u 23:40 bio istinit zapis o danu
 * koji je već prošao, a korisniku bi stigla obavijest koja ne služi ničemu.
 */
export const PROPOSAL_CUTOFF_LOCAL_HOUR = 12;

/**
 * Zadnja zona u lancu. Nije "procjena" nego dokumentovan fallback: bez ijedne
 * poznate zone ne smijemo pisati dan po UTC-u, jer bi za korisnika u BiH
 * ljeti dan počinjao u 02:00. Vrijednost je navedena u `19` i mijenja se na
 * jednom mjestu.
 */
export const DEFAULT_HOME_TIME_ZONE = 'Europe/Sarajevo';

export type TimeZoneSource = 'HOME' | 'USER' | 'DEFAULT';

export interface ResolvedTimeZone {
  zone: string;
  source: TimeZoneSource;
}

/**
 * Vraća kanonski naziv zone ili `null`.
 *
 * Numerički offset (`+02:00`) se odbija namjerno iako ga `Intl` prihvata:
 * offset nema ljetno/zimsko vrijeme, pa bi kuća u Sarajevu sa `+02:00` zimi
 * računala sat kao ljeti — predlog bi nastajao u 07:00 lokalno, i to samo pola
 * godine. Isto pravilo već koristi izvoz (`resolveExportTimeZone`).
 */
function normalizeTimeZone(zone: string): string | null {
  if (/^[+-]/.test(zone) || !/^[A-Za-z0-9_+\-/]{1,100}$/.test(zone)) {
    return null;
  }
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
    }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

/**
 * Redom: zona kuće (postavlja je weather v2), pa zona korisnika, pa fallback.
 * Zona kuće je prva jer bojler stoji u kući, a ne tamo gdje je telefon.
 * Neispravno ime zone se preskače uz prijavu izvora, ne baca izuzetak —
 * cron ne smije pasti zbog jednog lošeg reda u bazi.
 */
export function resolveHomeTimeZone(input: {
  homeTimeZone?: string | null;
  userTimeZone?: string | null;
}): ResolvedTimeZone {
  const candidates: Array<[string | null | undefined, TimeZoneSource]> = [
    [input.homeTimeZone, 'HOME'],
    [input.userTimeZone, 'USER'],
  ];

  for (const [zone, source] of candidates) {
    if (typeof zone === 'string' && zone.trim().length > 0) {
      const normalized = normalizeTimeZone(zone.trim());
      if (normalized) return { zone: normalized, source };
    }
  }

  return { zone: DEFAULT_HOME_TIME_ZONE, source: 'DEFAULT' };
}

/** `YYYY-MM-DD` u zadatoj zoni. */
export function localDateKey(now: Date, zone: string): string {
  const p = localParts(now, zone);
  return `${p.year}-${p.month}-${p.day}`;
}

/**
 * Ključ intervala učenja za lokalni dan.
 *
 * Danas postoji samo jutarnji predlog (`morning`), pa je jedina razlika radni
 * dan / vikend — i računa se iz LOKALNOG datuma. Ranije se računala iz
 * `new Date().getDay()`, dakle iz zone servera: u UTC kontejneru bi ponedjeljak
 * u 00:30 po lokalnom vremenu bio nedjelja, i predlog bi uzeo pogrešan
 * interval.
 */
export function intervalKeyForLocalDate(localDate: string): string {
  /*
   * F5.2: ključ dolazi iz `Heating/interval-key.ts`. Ostaje ovdje kao tanak
   * omotač jer ga zove `daily-record.writer` i testira `proposal-schedule`;
   * pravilo (format, podjela dana, računanje dana u sedmici) je na jednom mjestu.
   *
   * Sat je 6 (`PROPOSAL_LOCAL_HOUR`) jer dnevni zapis nastaje ujutro — to je
   * jedino vrijeme koje zapis zaista poznaje. Prije je to bilo upisano kao
   * `_morning` u samom formatu, pa je isti pojam imao dva imena: `morning` iz
   * servisa i „uvijek morning" iz zapisa.
   */
  return intervalKey({ localDate, timeZone: DEFAULT_HOME_TIME_ZONE }) ?? '';
}

/** Minute od lokalne ponoći (0–1439). */
export function localMinuteOfDay(now: Date, zone: string): number {
  const p = localParts(now, zone);
  return Number(p.hour) * 60 + Number(p.minute);
}

/** Je li lokalni dan već počeo u smislu predloga (≥ 06:00)? */
export function isProposalDue(now: Date, zone: string): boolean {
  return localMinuteOfDay(now, zone) >= PROPOSAL_LOCAL_HOUR * 60;
}

/**
 * Je li još unutar prozora u kojem predlog ima smisla (06:00–12:00)?
 * Izvan prozora zapis nastaje sa `skipReason`, ali bez predloga.
 */
export function isWithinProposalWindow(now: Date, zone: string): boolean {
  const minute = localMinuteOfDay(now, zone);
  return (
    minute >= PROPOSAL_LOCAL_HOUR * 60 &&
    minute < PROPOSAL_CUTOFF_LOCAL_HOUR * 60
  );
}

/**
 * Granica grijne sezone za `SeasonMode.AUTO`.
 *
 * 15 °C je uobičajena "grijna granica" (dnevna srednja temperatura ispod koje
 * se grijanje smatra potrebnim). Nije zakon i nije fizička konstanta — zato je
 * imenovana i na jednom mjestu, da se može promijeniti bez traženja po kodu.
 */
export const AUTO_SEASON_LIMIT_C = 15;

/**
 * `WINTER` grije uvijek, `SUMMER` nikad — to ne traži prognozu. `AUTO` je
 * jedini režim koji se odlučuje po vremenu, pa je i jedini koji zove ovu
 * funkciju; prognoza tada mora postojati (bez nje se dan bilježi kao
 * `NO_WEATHER`, a ne kao "ljeto").
 */
export function isAutoOutOfSeason(weather: {
  tempMin: number;
  tempMax: number;
}): boolean {
  const mean = (weather.tempMin + weather.tempMax) / 2;
  return mean >= AUTO_SEASON_LIMIT_C;
}
