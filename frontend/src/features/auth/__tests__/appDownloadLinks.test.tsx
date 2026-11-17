import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppDownloadLinks } from '../components/AppDownloadLinks';
import { absoluteDownloadUrl } from '../lib/appDownloadUrl';
import { apiClient } from '../../../services/api';
import '../../../locales/config';

/**
 * Linkovi za preuzimanje na login ekranu.
 *
 * Tri stvari koje se ne vide iz koda, a ovdje su zaključane:
 *
 * 1. **Platforma bez izdanja ne dobija link.** Bolje bez linka nego link na
 *    404 — mrtav link na login ekranu izgleda kao da je cijeli sajt pokvaren.
 * 2. **Link je apsolutan.** Server vraća relativnu putanju; bez spajanja sa
 *    `VITE_API_URL` klik vodi na frontend host, ne na API.
 * 3. **Greška ne blokira login.** Ako `app-releases` padne, sekcija se ne
 *    prikazuje, ali ekran radi.
 */

function renderLinks() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AppDownloadLinks />
    </QueryClientProvider>,
  );
}

const release = (version: string, id: number) => ({
  version,
  buildNumber: 10000,
  sizeBytes: 12 * 1024 * 1024,
  notes: null,
  publishedAt: '2026-11-17T09:00:00.000Z',
  downloadUrl: `/api/app-releases/${id}/apk`,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('linkovi za preuzimanje', () => {
  it('ne duplira /api kada server vrati API putanju, a base već završava sa /api', () => {
    expect(
      absoluteDownloadUrl(
        '/api/app-releases/5/apk',
        'https://api.boiler-control.ba101.top/api',
      ),
    ).toBe('https://api.boiler-control.ba101.top/api/app-releases/5/apk');
  });

  it('zadržava /api na ruti kada API base nema /api sufiks', () => {
    expect(
      absoluteDownloadUrl(
        '/api/app-releases/6/apk',
        'https://api.boiler-control.ba101.top',
      ),
    ).toBe('https://api.boiler-control.ba101.top/api/app-releases/6/apk');
  });

  it('prikazuje oba linka kad su oba izdanja objavljena', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      phone: release('2.1.0', 5),
      tv: release('1.0.0', 6),
    } as never);

    renderLinks();

    await waitFor(() => {
      expect(screen.getByText('Mobile app')).toBeTruthy();
    });
    expect(screen.getByText('TV app')).toBeTruthy();
    // Verzija je vidljiva — korisnik tako zna je li link svjež.
    expect(screen.getByText(/v2\.1\.0/)).toBeTruthy();
    expect(screen.getByText(/v1\.0\.0/)).toBeTruthy();
  });

  it('TV bez objavljenog izdanja NE dobija link', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      phone: release('2.1.0', 5),
      tv: null,
    } as never);

    renderLinks();

    await waitFor(() => expect(screen.getByText('Mobile app')).toBeTruthy());
    expect(screen.queryByText('TV app')).toBeNull();
  });

  it('kad nema ničega objavljenog, sekcija se ne prikazuje uopšte', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      phone: null,
      tv: null,
    } as never);

    const { container } = renderLinks();

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(container.querySelector('[data-testid="app-download-links"]')).toBeNull();
  });

  it('greška ne prikazuje ništa — login ekran ne smije blokirati', async () => {
    vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('mreža'));

    const { container } = renderLinks();

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(container.querySelector('[data-testid="app-download-links"]')).toBeNull();
    // Nijedna poruka o grešci: sporedni sadržaj ne smije izgledati kao kvar.
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('link je apsolutan kad je VITE_API_URL postavljen', async () => {
    /*
     * Server vraća `/api/app-releases/5/apk` (relativno). Bez spajanja sa
     * bazom, `<a href>` bi pogodio frontend host i vratio HTML 404 umjesto APK.
     * `import.meta.env` se u testu ne može mijenjati poslije importa, pa se ovdje
     * provjerava ono što je moguće: da href sadrži putanju servera i da nosi
     * `download` (bez njega Android otvori bajtove kao tekst).
     */
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      phone: release('2.1.0', 5),
      tv: null,
    } as never);

    renderLinks();

    await waitFor(() => expect(screen.getByText('Mobile app')).toBeTruthy());

    const link = screen.getByText('Mobile app').closest('a');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toContain('/api/app-releases/5/apk');
    expect(link?.hasAttribute('download')).toBe(true);
  });
});
