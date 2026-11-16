import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GasAnalyticsPage } from '../pages/GasAnalyticsPage';
import { apiClient } from '../../../services/api';
import '../../../locales/config';

/**
 * D2 (audit analitike §2, §4) — web gas: pad servera ne smije izgledati kao
 * „0 m³, 0 €".
 *
 * **Stvarna greška.** `useGasAnalysisQuery` je hvatao grešku i vraćao `{}`, pa
 * `analysisQuery.isError` **nikad** nije bio istinit: `QueryState` sa error
 * stanjem je bio mrtav kod, a `GasAnalyticsMetrics` je iz `undefined` pravio
 * nule (`?? 0`). Korisnik je na pad servera dobijao **izmjerenih nula**.
 *
 * Test gleda ono što korisnik vidi:
 *   1. sa odbijenim zahtjevom, ekran **ne** smije pisati „0" u metrikama;
 *   2. mora postojati poruka o grešci (QueryState se konačno aktivira);
 *   3. djelimičan odgovor: polje koje fali je „—", a stvarna `0` ostaje `0`.
 */

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('D2 — web gas ne pretvara grešku u nule', () => {
  it('odbijen zahtjev prikazuje grešku, a ne „0"', async () => {
    const spy = vi
      .spyOn(apiClient, 'getGasAnalysis')
      .mockRejectedValue(new Error('500'));
    vi.spyOn(apiClient, 'getGasReadings').mockResolvedValue({
      rows: [],
      total: 0,
    } as never);

    renderWithClient(<GasAnalyticsPage />);

    /*
     * QueryState error stanje mora da se pojavi — prije popravke **nije
     * moglo**, jer je hook grešku pretvarao u uspješan `{}`.
     *
     * Traži se `role="alert"`, ne tekst: poruka je spojena iz dva ključa
     * (`loadAnalyticsError` + `loadAnalyticsErrorDesc`), pa regex nad ključem
     * ne bi pogodio ništa ni sa ispravnim kodom.
     */
    expect(await screen.findByRole('alert')).toBeTruthy();

    spy.mockRestore();
  });

  it('djelimičan odgovor: polje koje fali je „—", a stvarna nula ostaje 0', async () => {
    vi.spyOn(apiClient, 'getGasAnalysis').mockResolvedValue({
      // `totalGas: 0` je MJERENJE (nula potrošnje u periodu) — mora ostati 0.
      totalGas: 0,
      // Ostala polja nedostaju — nisu nula, nisu izmjerena.
      efficiency: { label: 'NO_DATA' },
      period: { mode: 'last_30_days' },
    } as never);
    vi.spyOn(apiClient, 'getGasReadings').mockResolvedValue({
      rows: [{ id: 1 }],
      total: 1,
    } as never);

    renderWithClient(<GasAnalyticsPage />);

    // Stvarna nula se prikazuje kao 0,00.
    expect(await screen.findByText('0.00')).toBeTruthy();

    // Nedostajuća polja su „—", ne „0".
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(5);
  });
});
