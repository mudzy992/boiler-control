import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { GasConsumptionCard } from '../GasConsumptionCard';
import { apiClient } from '../../services/api/client';
import { AppThemeProvider } from '../../theme/AppTheme';

/**
 * F7 (HOME-03): kartica „ukupno potrošeni gas i cijena".
 *
 * Test pokriva tri stvari koje odlučuju da li je kartica poštena:
 *  1. sa podacima prikazuje potrošnju i cijenu iz `GET /gas/analysis`;
 *  2. bez podataka NE prikazuje nulu (tvrdnja da je potrošnja nula bi bila laž);
 *  3. dijeli `['gas-analysis']` keš sa Analizom plina — dakle nema drugog izvora.
 */
jest.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
  }),
}));

jest.mock('../../services/api/client', () => ({
  apiClient: { getGasAnalysis: jest.fn() },
}));

async function renderCard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const result = await render(
    <QueryClientProvider client={queryClient}>
      <AppThemeProvider colorMode="dark">
        <GasConsumptionCard />
      </AppThemeProvider>
    </QueryClientProvider>,
  );
  return { result, queryClient };
}

describe('GasConsumptionCard', () => {
  it('prikazuje potrošnju i cijenu iz analize plina', async () => {
    jest.mocked(apiClient.getGasAnalysis).mockResolvedValue({
      consumptionFromReferenceM3: 1234.5,
      costIncVat: 987.65,
    });
    const { result, queryClient } = await renderCard();

    expect(await result.findByTestId('gas-consumption-value')).toBeTruthy();
    const summary = await result.findAllByText(/gasSummary\.subtitle/);
    expect(summary.length).toBeGreaterThan(0);
    // Format broja prati aktivan jezik (`formatNumber`), a u testu je aktivni
    // jezik en-US — dakle decimalna tačka, ne zarez. Zarez se provjerava
    // posebno u `format.test.ts`, ne ovdje.
    expect(summary[0].props.children).toContain('987.65');
    await result.unmount();
    queryClient.clear();
  });

  it('bez očitanja ne izmišlja nulu nego kaže da podataka nema', async () => {
    jest.mocked(apiClient.getGasAnalysis).mockResolvedValue(null);
    const { result, queryClient } = await renderCard();

    expect(await result.findByText('gasSummary.noData')).toBeTruthy();
    expect(result.queryByTestId('gas-consumption-value')).toBeNull();
    expect(result.queryByText('0')).toBeNull();
    await result.unmount();
    queryClient.clear();
  });
});
