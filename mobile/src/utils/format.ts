/**
 * Formatiranje brojeva i datuma za prikaz — jedno mjesto, jedan jezik.
 *
 * Zašto (F6, GAS-02): `toFixed(2)` proizvodi tačku kao decimalni znak i nema
 * razdvajač hiljada, pa je u aplikaciji koja je prevedena na bosanski broj
 * brojila izgledao kao `12345.60` umjesto `12.345,60`. Isto tako su datumi bili
 * miješani: `dayjs(...).format('DD.MM.YYYY')` na nekim mjestima, a
 * `toLocaleDateString('en-US', …)` na drugim — pa je bosanski korisnik u istom
 * ekranu vidio i bosanski i engleski datum.
 *
 * Pravilo: ekrani ne zovu `toFixed` ni `toLocaleDateString` direktno. Broj se
 * formatira po jeziku iz i18n-a, datum po istom jeziku i uvijek kroz `Intl`
 * (Hermes ga ima za `en-US` i `bs-BS` jer je `Intl.PluralRules` već polifilovan;
 * `Intl.NumberFormat`/`DateTimeFormat` su dio iste ICU baze).
 */

import i18n from '../locales/config';

/** Jezik za `Intl.*` — `bs-BS` u i18n-u odgovara `bs-BA` u CLDR-u. */
export function intlLocale(): string {
  return i18n.language === 'bs-BS' ? 'bs-BA' : 'en-US';
}

/**
 * Broj sa fiksnim brojem decimala i razdvajačem hiljada.
 * `formatNumber(12345.6, 2)` → `12.345,60` (bs) / `12,345.60` (en).
 */
export function formatNumber(value: number, fractionDigits = 2): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(intlLocale(), {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/** Broj bez decimala (npr. brojač zapisa). */
export function formatInteger(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(intlLocale(), { maximumFractionDigits: 0 }).format(value);
}

/** Datum kao `07.11.2026.` (bs) / `11/07/2026` (en) — po jeziku, ne hardkodirano. */
export function formatDate(value: string | number | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(intlLocale(), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Kratki datum `DD.MM.` — isti u oba jezika, ali kroz istu funkciju. */
export function formatShortDate(value: string | number | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(intlLocale(), { day: '2-digit', month: '2-digit' }).format(date);
}

/** Vrijeme `HH:mm`, 24-časovno, bez AM/PM (bosanski i evropski engleski). */
export function formatTime(value: string | number | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(intlLocale(), {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/** Raspon datuma jednim stringom, sa en-dashom (ne hyphen-minusom). */
export function formatDateRange(
  start: string | number | Date | null | undefined,
  end: string | number | Date | null | undefined,
): string {
  return `${formatDate(start)} – ${formatDate(end)}`;
}
