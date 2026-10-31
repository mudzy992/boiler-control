import type { AxiosInstance } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * FE2-2: access token NE smije biti čitljiv iz `localStorage` kad je backend
 * uključio httpOnly refresh tok.
 *
 * Razlog je XSS: token u `localStorage` čita bilo koji ubačeni script, i to
 * traje koliko i token (24 h bez revokacije, S-004). U memoriji ga drugi JS
 * kontekst ne može dohvatiti, a sesija se nakon reloada obnavlja iz httpOnly
 * cookie-ja.
 *
 * Testovi su namjerno **bihevioralni** (čitaju stvarni `localStorage` i
 * stvarno polje), a ne grep nad izvorom: grep bi prošao i kad bi se token
 * upisivao kroz neki drugi izraz. Isti razlog kao u `apiBaseUrl.test.ts`.
 *
 * Zastavica je dio ugovora: dok je `off`, ponašanje MORA ostati doslovno
 * prijašnje (token u `localStorage`), inače uključivanje backend zastavice
 * postaje uslov da frontend radi, a rollback nije čist.
 */

type ApiClientUnderTest = {
  setToken(token: string): void;
  clearToken(): void;
  getToken(): string | null;
  detectAuthMode(): Promise<boolean>;
  downloadProtectedFile(url: string): Promise<Blob>;
  /** `private` u izvoru; TS `private` je compile-time, pa test doseže do njega. */
  cookieAuthEnabled: boolean;
  accessToken: string | null;
  client: AxiosInstance;
};

/** Svjež primjerak jer je `apiClient` singleton dijeljen između testova. */
async function loadClient(): Promise<ApiClientUnderTest> {
  vi.resetModules();
  const mod = await import('../api');
  return mod.apiClient as unknown as ApiClientUnderTest;
}

describe('FE2-2: pohrana access tokena', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  describe('zastavica OFF (zadano) — ponašanje mora biti prijašnje', () => {
    it('setToken upisuje u localStorage', async () => {
      const api = await loadClient();
      expect(api.cookieAuthEnabled).toBe(false);

      api.setToken('bearer-abc');

      expect(localStorage.getItem('token')).toBe('bearer-abc');
    });

    it('getToken čita iz localStorage', async () => {
      const api = await loadClient();
      localStorage.setItem('token', 'iz-storagea');

      expect(api.getToken()).toBe('iz-storagea');
    });
  });

  describe('zastavica ON — token samo u memoriji', () => {
    it('setToken NE dira localStorage', async () => {
      const api = await loadClient();
      api.cookieAuthEnabled = true;

      api.setToken('memorija-xyz');

      // Ovo je srž FE2-2: XSS više nema šta pročitati.
      expect(localStorage.getItem('token')).toBeNull();
      expect(api.getToken()).toBe('memorija-xyz');
    });

    it('setToken briše ZAOSTALI token iz prethodne sesije', async () => {
      const api = await loadClient();
      // Korisnik je bio prijavljen prije uključivanja zastavice.
      localStorage.setItem('token', 'stari-token');
      api.cookieAuthEnabled = true;

      api.setToken('novi-token');

      // Bez ovoga bi stari token ostao čitljiv XSS-u iako se aplikacija više
      // ne oslanja na njega.
      expect(localStorage.getItem('token')).toBeNull();
      expect(api.getToken()).toBe('novi-token');
    });

    it('getToken NE pada na localStorage čak ni kad memorija nema token', async () => {
      const api = await loadClient();
      localStorage.setItem('token', 'stari-token');
      api.cookieAuthEnabled = true;

      // Namjerno bez fallbacka: inače bi zastarjeli token iz storagea bio
      // poslan kao Authorization iako više nije izvor istine.
      expect(api.getToken()).toBeNull();
    });
  });

  describe('clearToken', () => {
    it('čisti memoriju i localStorage kad je zastavica ON', async () => {
      const api = await loadClient();
      api.cookieAuthEnabled = true;
      api.setToken('memorija');
      localStorage.setItem('token', 'storage');

      api.clearToken();

      expect(api.getToken()).toBeNull();
      expect(localStorage.getItem('token')).toBeNull();
    });

    it('čisti localStorage i kad je zastavica OFF', async () => {
      const api = await loadClient();
      localStorage.setItem('token', 'storage');

      api.clearToken();

      expect(localStorage.getItem('token')).toBeNull();
    });
  });

  describe('detectAuthMode — zastavica se čita s backend-a, ne iz env-a', () => {
    it('authRefreshEnabled=true uključuje cookie tok', async () => {
      const api = await loadClient();
      vi.spyOn(api.client, 'get').mockResolvedValue({
        data: { authRefreshEnabled: true },
      } as never);

      await expect(api.detectAuthMode()).resolves.toBe(true);
      expect(api.cookieAuthEnabled).toBe(true);
    });

    it('nedostupno polje ostavlja tok isključen (fail-safe na stari tok)', async () => {
      const api = await loadClient();
      vi.spyOn(api.client, 'get').mockResolvedValue({ data: {} } as never);

      await expect(api.detectAuthMode()).resolves.toBe(false);
      expect(api.cookieAuthEnabled).toBe(false);
    });

    it('greška mreže NE ruši klijent nego pada na stari tok', async () => {
      const api = await loadClient();
      vi.spyOn(api.client, 'get').mockRejectedValue(new Error('mreža'));

      await expect(api.detectAuthMode()).resolves.toBe(false);
      expect(api.cookieAuthEnabled).toBe(false);
    });
  });

  describe('downloadProtectedFile', () => {
    it('ide kroz axios instancu (pa nosi auth i credentials) s responseType blob', async () => {
      const api = await loadClient();
      const get = vi.spyOn(api.client, 'get').mockResolvedValue({
        data: new Blob(['pdf'], { type: 'application/pdf' }),
      } as never);

      const blob = await api.downloadProtectedFile('/gas/reading/1/invoice');

      expect(get).toHaveBeenCalledWith('/gas/reading/1/invoice', {
        responseType: 'blob',
      });
      expect(blob).toBeInstanceOf(Blob);
    });
  });
});
