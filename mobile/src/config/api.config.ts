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
  const extra = Constants.expoConfig?.extra ?? Constants.manifest?.extra ?? {};

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
