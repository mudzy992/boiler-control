import Constants from 'expo-constants';

/**
 * Centralized API Configuration
 * Single source of truth for backend URL across the entire application.
 */

/**
 * Get the backend API base URL.
 *
 * MO2-1: postoji JEDAN izvor konfiguracije i NEMA hardkodovanog fallback hosta.
 *
 * Prijašnja verzija je u `__DEV__` grani vraćala
 * `https://boiler.ba101.top/backend/api` — stvarni, produkcijski sličan host.
 * Posljedica: svaki developer i svaki lokalni build je bez najave slao saobraćaj
 * (uključujući prijave) na tuđi server, a tri različita izvora u repu
 * (`eas.json`, `.env.example`, `docs/API_CONFIG.md`) su se međusobno protivila.
 *
 * Sada nedostajuća konfiguracija pada glasno i u dev i u produkciji. Vrijednost
 * dolazi iz `eas.json` env-a ili iz `app.config.js` → `extra`, koji je i u dev
 * buildu prisutan, pa normalan razvoj radi bez `.env`.
 */
const getApiBaseUrl = (): string => {
  // `Constants.manifest` je tipiziran kao `EmbeddedManifest` iz `expo-manifests`
  // i sadrži samo `{ id, commitTime, assets }` — formalno NEMA `extra`. Ranije
  // je ovdje stajao `Constants.manifest?.extra` bez sužavanja tipa, što je
  // prolazilo samo zato što je starija verzija `expo-manifests` bila blaža;
  // instalacija `expo-updates` (MO2-2) povukla je 1.0.11 i to razotkrila
  // (TS2339). Runtime fallback se zadržava za starije manifeste, ali se tip
  // sada eksplicitno sužava umjesto da se izvor tiho izgubi.
  const manifestExtra = (
    Constants.manifest as { extra?: { EXPO_PUBLIC_API_URL?: string } } | null
  )?.extra;

  const extra: { EXPO_PUBLIC_API_URL?: string } =
    Constants.expoConfig?.extra ?? manifestExtra ?? {};

  // Postavljeno preko EAS build env varijabli (eas.json) ili lokalnog .env
  const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? extra.EXPO_PUBLIC_API_URL;

  if (apiUrl) {
    return apiUrl;
  }

  throw new Error(
    'API_URL not configured. Set EXPO_PUBLIC_API_URL in eas.json, .env, ' +
      'or app.config.js extra.',
  );
};

export const API_CONFIG = {
  BASE_URL: getApiBaseUrl(),
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 2,
} as const;
