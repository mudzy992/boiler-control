import type { AxiosInstance } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * FE2-7 (FE-009): `api.ts` ne smije imati dev fallback na localhost.
 *
 * Prije ove izmjene linija je bila:
 *   `const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3020/api'`
 * a `frontend/Dockerfile` ima `ARG VITE_API_URL` **bez defaulta**. Build bez tog
 * arga nije padao — samo bi u `dist/` ugradio localhost, pa bi deployovana
 * aplikacija zvala korisnikov vlastiti stroj.
 *
 * Ovo je namjerno **bihevioralni** test (čita stvarni axios `baseURL`), a ne
 * grep nad izvorom: grep bi prošao i kad bi se fallback vratio kroz drugi izraz
 * (npr. pomoćna funkcija ili druga konstanta), dok ovakav test pada na stvarnom
 * ponašanju. Grep-provjera nad izvorom postoji dodatno u
 * `scripts/audit/frontend_deploy_config_repro.cjs`.
 *
 * Build-time guard (`requireApiBaseUrl()` u `vite.config.ts`) je odvojen i puca
 * samo na `command === 'build'` — ne smije srušiti ovaj suite.
 */

type ClientWithAxios = { client: AxiosInstance };

/**
 * Učitava svjež primjerak `api.ts` jer se `API_BASE_URL` računa pri učitavanju
 * modula — bez `resetModules` svi testovi bi dijelili istu vrijednost.
 */
async function loadFreshAxios(): Promise<AxiosInstance> {
  vi.resetModules();
  const mod = await import('../api');
  // `client` je `private` u `ApiClient`. TS `private` je samo compile-time, pa
  // test namjerno NE dodaje javni getter u produkcijski API samo zbog ovoga.
  return (mod.apiClient as unknown as ClientWithAxios).client;
}

const PROD_BASE = 'https://api.boiler-control.ba101.top/api';

describe('FE2-7: API base URL bez dev fallbacka', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('bez VITE_API_URL baseURL NIJE localhost (bila bi tiha produkcijska greška)', async () => {
    vi.stubEnv('VITE_API_URL', '');
    const baseURL = (await loadFreshAxios()).defaults.baseURL ?? '';
    // Srž regresije: stari fallback je ovdje davao http://localhost:3020/api.
    expect(baseURL).not.toMatch(/localhost:\d+/);
    expect(baseURL).toBe('');
  });

  it('kada VITE_API_URL STVARNO nedostaje (undefined), baseURL NIJE localhost', async () => {
    // Ovo je zaseban slučaj od praznog stringa i bio je prva verzija ovog testa
    // promašila: `'' ?? 'x'` vraća `''`, pa `??`-fallback ostane neotkriven.
    // U produkcijskom buildu bez arga vrijednost je upravo `undefined`, pa
    // `undefined ?? 'http://localhost:3020/api'` TIHO daje localhost.
    vi.stubEnv('VITE_API_URL', undefined);
    const baseURL = (await loadFreshAxios()).defaults.baseURL ?? '';
    expect(baseURL).not.toMatch(/localhost:\d+/);
    expect(baseURL).toBe('');
  });

  it('bez VITE_API_URL ne gradi se URL s "undefined" prefiksom', async () => {
    vi.stubEnv('VITE_API_URL', '');
    const client = await loadFreshAxios();
    // `api.ts` gradi URL-ove za download kao `${API_BASE_URL}/gas/reading/...`.
    // S `undefined` bi nastao "undefined/gas/..." — tihi raskid.
    const url = client.getUri({ url: '/gas/reading/1/invoice' });
    expect(url).not.toContain('undefined');
    expect(url.startsWith('/gas/reading/1/invoice')).toBe(true);
  });

  it('s VITE_API_URL baseURL je tačno proslijeđena vrijednost', async () => {
    vi.stubEnv('VITE_API_URL', PROD_BASE);
    expect((await loadFreshAxios()).defaults.baseURL).toBe(PROD_BASE);
  });

  it('vodeći i trailing razmak se režu (build arg iz compose-a)', async () => {
    vi.stubEnv('VITE_API_URL', `  ${PROD_BASE}  `);
    expect((await loadFreshAxios()).defaults.baseURL).toBe(PROD_BASE);
  });
});
