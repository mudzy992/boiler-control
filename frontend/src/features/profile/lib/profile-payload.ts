import type { AppLocale } from '@/locales/config';

/**
 * Tijelo za `PUT /api/user` — **bijela lista**, nikad `...form`.
 *
 * Zašto: `GET /api/user` vraća i polja koja korisnik ne mijenja (`id`, `email`,
 * `role`, `plan`, `createdAt`, `updatedAt`) i izvedena polja cijene plina
 * (`gasPriceIncVat`, `gasPriceSource`, …). Stranica je u `form` unosila cijeli
 * odgovor i vraćala ga nazad, a backend ima
 * `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` — pa je
 * **svako** spremanje padalo sa „property … should not exist".
 *
 * Prva popravka je skinula samo `id` i pala na sljedećem polju (`role`). Isti
 * obrazac se ponavlja svaki put kad backend doda polje koje server vraća a ne
 * prima. Zato se ovdje ne „uklanja višak", nego se **navodi šta smije proći**:
 * novo polje u odgovoru više ne može ući u zahtjev samo zato što postoji.
 *
 * Spisak je preslikan na `backend/src/modules/User/dto/update-user.dto.ts`.
 * `locale` je namjerno izvan spiska jer se šalje uvijek (normalizovan) — vidi
 * `buildProfileUpdate`.
 */
export const EDITABLE_PROFILE_FIELDS = [
  'name',
  'username',
  'homeLocation',
  'avatarUrl',
  'timezone',
  'prefersDarkMode',
  'gasPriceExVat',
] as const;

export type EditableProfileField = (typeof EDITABLE_PROFILE_FIELDS)[number];

/** Izvor može biti cijeli odgovor servera; čitaju se samo dozvoljena polja. */
export type ProfilePayloadSource = Partial<Record<EditableProfileField, unknown>>;

function isUsable(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'number' && Number.isNaN(value)) return false;
  // Prazan string se NE šalje: `username` ima `@MinLength(3)`, pa bi `''` srušio
  // cijelo spremanje zbog polja koje korisnik nije ni dirao.
  if (typeof value === 'string' && value.trim() === '') return false;
  return true;
}

/**
 * Pravi tijelo zahtjeva: uvijek `locale`, plus dozvoljena polja koja imaju
 * upotrebljivu vrijednost.
 */
export function buildProfileUpdate(
  source: ProfilePayloadSource,
  locale: AppLocale,
): Record<string, unknown> {
  const payload: Record<string, unknown> = { locale };

  for (const field of EDITABLE_PROFILE_FIELDS) {
    const value = source[field];
    if (isUsable(value)) payload[field] = value;
  }

  return payload;
}
