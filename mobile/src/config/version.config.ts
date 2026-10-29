import axios from 'axios';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { API_CONFIG } from './api.config';

/**
 * MO2-2: version gate.
 *
 * Cilj: spriječiti da instalirana verzija aplikacije radi protiv API ugovora
 * koji više ne razumije (preduslov za API-1/API-2/SEC-4/FEAT-7).
 *
 * NAJVAŽNIJE PRAVILO — **fail-open**: korisnik se blokira ISKLJUČIVO kad
 * backend nedvosmisleno kaže da je verzija premala. Svaki drugi ishod
 * (mreža pada, timeout, neočekivan oblik odgovora, nepoznata lokalna verzija)
 * znači "pusti aplikaciju da radi". Razlog: gate koji fail-uje na "zatvoreno"
 * pretvorio bi svaki backend kvar u potpuno neupotrebljivu aplikaciju, a to je
 * gori ishod od privremeno zastarjele verzije.
 */

/** Odgovor `GET /api/app/config`. Polja se smiju samo dodavati. */
export interface AppConfigResponse {
  minSupportedVersion: string;
  latestVersion: string;
  versionGateEnabled: boolean;
}

export interface VersionGateResult {
  /** `true` = prikaži "update required" i blokiraj navigaciju. */
  mustUpdate: boolean;
  /** Verzija koju backend traži; `null` ako odgovor nije stigao/valjan. */
  minSupportedVersion: string | null;
  /** Verzija koja je stvarno instalirana. */
  currentVersion: string;
  /** `true` samo ako je backend stvarno potvrdio stanje (nije fail-open). */
  verifiedByBackend: boolean;
}

/**
 * Gate endpoint je namjerno kratak: ne smije osjetno odgoditi start, a pad
 * mreže mora brzo rezultirati fail-open ponašanjem.
 */
const GATE_TIMEOUT_MS = 8000;

/** Strogi `MAJOR.MINOR.PATCH` — backend garantuje ovaj format. */
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

/**
 * Jedini izvor istine o verziji aplikacije (MO2-2: ranije su postojala tri —
 * `package.json` 2.0.0, `app.json` 1.0.0 i hardkodovano "2.0.0" u
 * `SettingsScreen.tsx`).
 *
 * Prednost ima `nativeApplicationVersion` jer je to verzija upisana u sam
 * instalirani build (EAS je postavlja), pa je to ono što korisnik stvarno ima.
 * `Constants.expoConfig.version` je fallback za okruženja bez nativnog builda.
 */
export function getAppVersion(): string {
  const native = Application.nativeApplicationVersion;
  if (typeof native === 'string' && native.trim() !== '') {
    return native.trim();
  }

  const fromConfig = Constants.expoConfig?.version;
  if (typeof fromConfig === 'string' && fromConfig.trim() !== '') {
    return fromConfig.trim();
  }

  // Nepoznata verzija se NE smije tretirati kao "prestara" — pozivalac
  // fail-open-uje na nju.
  return '0.0.0';
}

/**
 * Poredi dvije stroge semver verzije.
 *
 * Vraća negativno ako je `a < b`, 0 ako su jednake, pozitivno ako je `a > b`.
 * Namjerno bez `semver` paketa: taj paket postoji u `node_modules` ali NIJE
 * deklariran u `package.json` (fantomska zavisnost), a format je strogo
 * `MAJOR.MINOR.PATCH` pa je poređenje trivijalno i testabilno.
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10));
  const pb = b.split('.').map((n) => Number.parseInt(n, 10));

  for (let i = 0; i < 3; i += 1) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

function isStrictSemver(value: unknown): value is string {
  return typeof value === 'string' && SEMVER_PATTERN.test(value);
}

function openGate(currentVersion: string, reason: string): VersionGateResult {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.warn(`[version-gate] fail-open: ${reason}`);
  }
  return {
    mustUpdate: false,
    minSupportedVersion: null,
    currentVersion,
    verifiedByBackend: false,
  };
}

/**
 * Pita backend smije li ova verzija raditi.
 *
 * Nikad ne baca — sve greške se pretvaraju u fail-open rezultat.
 */
export async function checkVersionGate(): Promise<VersionGateResult> {
  const currentVersion = getAppVersion();

  // Nepoznata lokalna verzija: ne možemo dokazati da je prestara.
  if (!isStrictSemver(currentVersion)) {
    return openGate(currentVersion, 'nepoznata lokalna verzija');
  }

  let response: AppConfigResponse;
  try {
    // Namjerno NE preko dijeljenog apiClient-a: gate mora raditi i prije
    // auth-a i ne smije biti spregnut s 401 handlingom koji čisti token.
    const res = await axios.get<AppConfigResponse>('/app/config', {
      baseURL: API_CONFIG.BASE_URL,
      timeout: GATE_TIMEOUT_MS,
    });
    response = res.data;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return openGate(currentVersion, `backend nedostupan (${message})`);
  }

  if (!response || typeof response !== 'object') {
    return openGate(currentVersion, 'odgovor nije objekt');
  }

  if (response.versionGateEnabled === false) {
    // Backend je eksplicitno ugasio gate (kill switch).
    return {
      mustUpdate: false,
      minSupportedVersion: null,
      currentVersion,
      verifiedByBackend: true,
    };
  }

  if (!isStrictSemver(response.minSupportedVersion)) {
    return openGate(currentVersion, 'minSupportedVersion nije valjan semver');
  }

  const min = response.minSupportedVersion;
  return {
    mustUpdate: compareVersions(currentVersion, min) < 0,
    minSupportedVersion: min,
    currentVersion,
    verifiedByBackend: true,
  };
}
