import { Logger } from '@nestjs/common';

/**
 * Ključevi vremenskih bucket-a za dashboard (FEAT-8 / B-020).
 *
 * POSTOJEĆE (v1) PONAŠANJE, koje je zakovano jer ga isporučeni klijenti već
 * crtaju:
 *   - `hour` → `HH:00` BEZ datuma. To je ispravno kao "profil sata u danu"
 *     (`mobile/src/screens/analytics/AnalyticsScreen.tsx:56` šalje `hour` samo
 *     uz jednodnevni opseg), ali SPAJA isti sat različitih dana kada API dobije
 *     višednevni opseg.
 *   - `day`  → summary koristi SERVER-LOCAL datum, stats koristi UTC. Zato isti
 *     upit može grupisati drugačije oko ponoći na dva endpointa.
 *   - `hour` u server-local zoni spaja i DST ponovljeni sat (izmjereno za
 *     Europe/Sarajevo 2026-10-25: 00:30Z i 01:30Z oba daju `getHours() === 2`).
 *
 * v2 (iza zastavice, ZADANO ISKLJUČENO) daje hronološke, determinističke
 * ključeve: `hour` → `YYYY-MM-DDTHH:00Z`, `day` → `YYYY-MM-DD` (UTC), jednako
 * na oba endpointa. Zadano je isključeno jer mijenja labele koje instalirane
 * mobile/web verzije iscrtavaju; uključuje se tek nakon pregleda potrošača.
 */

const FLAG = 'DASHBOARD_BUCKET_V2_ENABLED';

const logger = new Logger('DashboardBucket');

/**
 * Čita zastavicu pri svakom pozivu. Prihvata `on`/`off` (case-insensitive,
 * trim); za bilo šta drugo loguje i koristi zadano `off`. Nije `Boolean(raw)`
 * jer bi tada `"off"` bio `true` — ista zamka kao B-015.
 */
export function isBucketV2Enabled(): boolean {
  const raw = process.env[FLAG];
  if (raw === undefined) return false;

  const normalized = raw.trim().toLowerCase();
  if (normalized === 'on') return true;
  if (normalized === 'off') return false;

  logger.warn(
    `${FLAG} ima neispravnu vrijednost ${JSON.stringify(raw)} — koristim zadano "off".`,
  );
  return false;
}

/** v1: `HH:00` u server-local zoni. Bez datuma — vidi napomenu gore. */
export function legacyHourKey(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:00`;
}

/** v1 summary: server-local `YYYY-MM-DD`. */
export function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(date.getDate()).padStart(2, '0')}`;
}

/** v1 stats: UTC `YYYY-MM-DD`. */
export function utcDayKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

/** v2: `YYYY-MM-DDTHH:00Z` — razlikuje i DST ponovljeni sat. */
export function v2HourKey(date: Date): string {
  return `${date.toISOString().slice(0, 13)}:00Z`;
}

/**
 * Jedinstvena tačka za izračun labele.
 *
 * `legacyDayMode` čuva postojeću razliku između endpointa dok je zastavica
 * isključena: summary je `'server-local'`, stats je `'utc'`. Kada je v2
 * uključen, oba koriste UTC i razlika nestaje.
 */
export function bucketKey(
  date: Date,
  bucketType: 'hour' | 'day',
  legacyDayMode: 'server-local' | 'utc',
): string {
  if (isBucketV2Enabled()) {
    return bucketType === 'hour' ? v2HourKey(date) : utcDayKey(date);
  }

  if (bucketType === 'hour') return legacyHourKey(date);
  return legacyDayMode === 'utc' ? utcDayKey(date) : localDayKey(date);
}
