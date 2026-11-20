/**
 * API klijent TV aplikacije.
 *
 * **TV radi samo GET.** To nije konvencija koju treba pamtiti — to je
 * **interceptor koji odbija sve ostalo**, ispod. Razlika je bitna: konvencija
 * nestane prvi put kad neko doda `api.post(...)` u žurbi; interceptor padne u
 * testu i u runtime-u prije nego zahtjev napusti TV.
 *
 * Zašto je pravilo tako strogo: TV visi na zidu u dnevnoj sobi, često upaljen
 * danima, sa sesijom koja ne ističe pred korisnikom. Aplikacija bez ikakve
 * mogućnosti da mijenja stanje kotla znači da greška u TV kodu **ne može**
 * ostaviti kotao u pogrešnom režimu. Prijava je jedini izuzetak i ide preko
 * odobrenja na telefonu (v. `pairing.ts`), ne kroz ovaj klijent.
 */
import axios, { type AxiosInstance } from 'axios';

export const TV_READ_ONLY_METHODS = ['get', 'head', 'options'] as const;

/** Greška koju TV nikad ne smije vidjeti u produkciji — ali mora u testu. */
export class TvWriteBlockedError extends Error {
  constructor(method: string, url: string) {
    super(
      `TV aplikacija ne smije mijenjati stanje: ${method.toUpperCase()} ${url} ` +
        `je blokiran. Dozvoljeni su samo GET/HEAD/OPTIONS.`,
    );
    this.name = 'TvWriteBlockedError';
  }
}

export interface TvClientOptions {
  baseUrl: string;
  /** Token iz uparivanja; `null` dok TV nije uparen. */
  getToken: () => string | null;
  onUnauthorized?: () => void;
}

export function createTvClient(options: TvClientOptions): AxiosInstance {
  const instance = axios.create({
    baseURL: options.baseUrl,
    timeout: 15_000,
  });

  /**
   * Prva linija: blokiraj upis **prije** nego zahtjev ode.
   *
   * Provjerava i `config.method`, ali i to što metoda nije zadana — axios tada
   * podrazumijeva GET, pa je to dozvoljeno.
   */
  instance.interceptors.request.use((config) => {
    const method = (config.method ?? 'get').toLowerCase();
    if (
      !TV_READ_ONLY_METHODS.includes(
        method as (typeof TV_READ_ONLY_METHODS)[number],
      )
    ) {
      return Promise.reject(new TvWriteBlockedError(method, config.url ?? ''));
    }

    const token = options.getToken();
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }
    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      // 401 znači da je sesija opozvana (npr. TV je odjavljen sa telefona).
      if (error?.response?.status === 401) {
        options.onUnauthorized?.();
      }
      return Promise.reject(error);
    },
  );

  /**
   * Druga linija: `put`/`post`/`patch`/`delete` padaju bučno.
   *
   * Interceptor hvata svaki zahtjev, ali ne objašnjava pozivaocu **zašto** je
   * pao. Ovo daje grešku s imenom metode odmah na mjestu poziva.
   *
   * `configurable: true` je namjerno: `createTvClient` se u aplikaciji poziva
   * pri promjeni baze URL-a, i drugo pozivanje je padalo sa „Cannot redefine
   * property" — greška u našem kodu, ne u zaštiti.
   */
  for (const verb of ['put', 'post', 'patch', 'delete'] as const) {
    Object.defineProperty(instance, verb, {
      value: () => {
        throw new TvWriteBlockedError(verb, '(nepoznat)');
      },
      enumerable: false,
      writable: false,
      configurable: true,
    });
  }

  return instance;
}

/** Rute koje TV trenutno koristi; sve su relativne prema API_BASE_URL (`.../api`). */
export const TV_ENDPOINTS = {
  // Backend rute su `GET /api/dashboard` i `GET /api/gas/analysis`.
  dashboard: '/dashboard',
  gasAnalysis: '/gas/analysis',
  pairingSession: '/tv-pairing/sessions',
  // Najnovije TV izdanje — samo za obavijest, TV ne instalira sam.
  releaseLatest: '/app-releases/latest',
} as const;

/**
 * **Jedini upis koji TV smije poslati** — zahtjev za kod za uparivanje.
 *
 * **Zašto odvojeno od `createTvClient`, a ne izuzetak u interceptoru.** Izuzetak
 * bi značio „POST prolazi ako je URL tačno ovaj", pa bi svaka nova ruta sa
 * istim prefiksom automatski dobila pravo upisa. Ovako je dozvola **jedna
 * funkcija** koju poziva samo ekran za uparivanje, i to samo dok TV nema
 * sesiju.
 *
 */
export async function requestPairingCode(
  baseUrl: string,
  payload: { deviceLabel?: string },
): Promise<{ code: string; expiresAt: string }> {
  const response = await axios.post<unknown>(
    `${baseUrl}${TV_ENDPOINTS.pairingSession}`,
    payload,
    { timeout: 15_000 },
  );
  const value = response.data;
  if (!isRecord(value) || typeof value.code !== 'string' || typeof value.expiresAt !== 'string') {
    throw new Error('API je vratio neispravan odgovor za pairing kod.');
  }
  if (!value.code.trim() || !Number.isFinite(Date.parse(value.expiresAt))) {
    throw new Error('API je vratio neispravan odgovor za pairing kod.');
  }
  return { code: value.code, expiresAt: value.expiresAt };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
