import { Logger } from '@nestjs/common';

/**
 * SEC-4 — sloj za httpOnly refresh cookie.
 *
 * Namjerno BEZ `cookie-parser` zavisnosti: Express već ima `res.cookie()` za
 * postavljanje, a za čitanje je dovoljno parsirati jedan `Cookie` header. Time
 * se izbjegava nova zavisnost i promjena `package-lock.json`, što je u ovom
 * okruženju dodatni rizik (CI radi `npm ci`).
 *
 * Cijeli mehanizam je iza zastavice `AUTH_COOKIE_REFRESH_ENABLED`, zadano `off`,
 * pa postojeći Bearer tok radi nepromijenjeno dok je vlasnik ne uključi.
 */

export const AUTH_COOKIE_FLAG = 'AUTH_COOKIE_REFRESH_ENABLED';
export const REFRESH_COOKIE_NAME = 'refresh_token';

const logger = new Logger('AuthCookie');

/**
 * Čita zastavicu pri svakom pozivu. Prihvata `on` (case-insensitive, trim);
 * za bilo šta drugo koristi zadano `off`. Nije `Boolean(raw)` jer bi
 * `Boolean('off')` bilo `true`.
 */
export function authCookieEnabled(): boolean {
  const raw = (process.env[AUTH_COOKIE_FLAG] ?? '').trim().toLowerCase();
  if (raw === '' || raw === 'off') return false;
  if (raw === 'on') return true;
  logger.warn(
    `[${AUTH_COOKIE_FLAG}] nepoznata vrijednost; koristi se zadano off`,
  );
  return false;
}

type SameSite = 'strict' | 'lax' | 'none';

/**
 * `SameSite` iz env-a. Zadano `lax`. Za cross-site deploy (frontend na drugom
 * originu od API-ja) treba `none`, a to prema specifikaciji zahtijeva i
 * `Secure` — zato se `none` bez `secure` odbija i pada na `lax`.
 */
export function cookieSameSite(): SameSite {
  const raw = (process.env.AUTH_COOKIE_SAME_SITE ?? '').trim().toLowerCase();
  if (raw === 'strict' || raw === 'lax' || raw === 'none') return raw;
  if (raw !== '') {
    logger.warn(
      `[AUTH_COOKIE_SAME_SITE] nepoznata vrijednost; koristi se zadano lax`,
    );
  }
  return 'lax';
}

/** `Secure` flag cookie-ja; zadano `true` jer se produkcija servira preko HTTPS-a. */
export function cookieSecure(): boolean {
  const raw = (process.env.AUTH_COOKIE_SECURE ?? '').trim().toLowerCase();
  if (raw === 'false' || raw === 'off' || raw === '0') return false;
  return true;
}

/**
 * Parsira `Cookie` header i vraća vrijednost traženog imena.
 * Namjerno ne baca: neispravan par se preskače.
 */
export function readCookie(
  header: string | undefined,
  name: string,
): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    if (key !== name) continue;
    const value = part.slice(idx + 1).trim();
    // Vrijednosti mogu biti u dvostrukim navodnicima prema RFC 6265.
    return value.startsWith('"') && value.endsWith('"') && value.length >= 2
      ? value.slice(1, -1)
      : value;
  }
  return undefined;
}

export interface CookieTarget {
  cookie(name: string, value: string, options: Record<string, unknown>): void;
  clearCookie(name: string, options: Record<string, unknown>): void;
}

function baseOptions(): Record<string, unknown> {
  const sameSite = cookieSameSite();
  const secure = cookieSecure();
  const options: Record<string, unknown> = {
    httpOnly: true,
    path: '/',
    // `none` bez `Secure` browser odbija, pa se tada koristi `lax`.
    sameSite: sameSite === 'none' && !secure ? 'lax' : sameSite,
    secure: sameSite === 'none' ? true : secure,
  };
  const domain = (process.env.AUTH_COOKIE_DOMAIN ?? '').trim();
  if (domain) options.domain = domain;
  return options;
}

/** Postavlja refresh cookie. `maxAge` u milisekundama. */
export function setRefreshCookie(
  res: CookieTarget,
  token: string,
  maxAgeMs: number,
): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...baseOptions(),
    maxAge: maxAgeMs,
  });
}

/** Uklanja refresh cookie. Mora imati ISTE opcije kao pri postavljanju. */
export function clearRefreshCookie(res: CookieTarget): void {
  res.clearCookie(REFRESH_COOKIE_NAME, baseOptions());
}
