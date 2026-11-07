import mockReact from 'react';
import { Text as mockNativeText } from 'react-native';
import { fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import fs from 'fs';
import path from 'path';

import { AppThemeProvider } from '../../theme/AppTheme';
import { ToastProvider } from '../../components/ui/nativewind';
import { analyticsApi } from '../../services/api/analytics.api';
import { homeProfileApi, type HomeProfile } from '../../services/api/homeProfile.api';
import { apiClient } from '../../services/api/client';
import { AnalyticsScreen } from '../analytics/AnalyticsScreen';

/**
 * F3 (AN-01, AN-03, AN-04, UX-13) — ugovori koje ovaj test čuva:
 *
 *  1. Tabela „Vrijednost / Prethodno" prikazuje stvarne brojeve TEKUĆEG i
 *     PRETHODNOG perioda iz dva odvojena upita — nijedna tvrdnja o poređenju
 *     se ne ispisuje bez podataka.
 *  2. Kad prethodnog perioda nema, ćelija je „—", a ne izmišljeni procent.
 *  3. Nema fiktivnih metrika („bolji od sličnih domova", „18 % poboljšanje")
 *     ni bloka „AI Insights" — ni u UI-ju ni u izvoru ekrana.
 *  4. Graf je jedan (`TrendChart` na `react-native-svg`), širina iz `onLayout`,
 *     bez `Dimensions.get('window')` i bez `react-native-chart-kit`.
 */

jest.mock('@expo/vector-icons', () => {
  const createIcon = () => (props: { name: string }) =>
    mockReact.createElement(mockNativeText, { accessibilityLabel: `icon-${props.name}` }, props.name);
  return { Ionicons: createIcon(), MaterialCommunityIcons: createIcon() };
});

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: {} }),
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), setParams: jest.fn() }),
}));

jest.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en-US' } }),
}));

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  cacheDirectory: null,
  getInfoAsync: jest.fn(async () => ({ exists: true, isDirectory: true })),
  makeDirectoryAsync: jest.fn(async () => undefined),
  deleteAsync: jest.fn(async () => undefined),
  writeAsStringAsync: jest.fn(async () => undefined),
}));

jest.mock('../../services/api/analytics.api', () => ({
  analyticsApi: {
    getHeatingSummary: jest.fn(),
    getHeatingStats: jest.fn(),
    getLearningTrends: jest.fn(),
    exportAnalytics: jest.fn(),
    getPreviousSummary: jest.fn(),
  },
}));

jest.mock('../../services/api/homeProfile.api', () => ({
  homeProfileApi: { getActiveHomeProfile: jest.fn() },
}));

jest.mock('../../services/api/client', () => ({
  apiClient: { getGasReadings: jest.fn(), getDashboard: jest.fn() },
}));

const activeHome = { id: 7 } as HomeProfile;

const summary = {
  summary: {
    totalCycles: 4,
    totalDurationMin: 120,
    avgDurationMin: 30,
    avgIndoorTemp: 21.5,
  },
  buckets: [],
};

const previousSummary = {
  summary: {
    totalCycles: 5,
    totalDurationMin: 150,
    avgDurationMin: 30,
    avgIndoorTemp: 21.1,
  },
  buckets: [],
};

const stats = {
  buckets: [
    { label: 'pon', avgTargetTemp: 22, avgCurrentTemp: 20.5, totalDurationMin: 60, cycles: 2 },
    { label: 'uto', avgTargetTemp: 22, avgCurrentTemp: 21.5, totalDurationMin: 60, cycles: 2 },
  ],
};

const learning = { points: [] };

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(homeProfileApi.getActiveHomeProfile).mockResolvedValue(activeHome);
  jest.mocked(analyticsApi.getHeatingSummary).mockResolvedValue(summary);
  jest.mocked(analyticsApi.getHeatingStats).mockResolvedValue(stats);
  jest.mocked(analyticsApi.getLearningTrends).mockResolvedValue(learning);
  jest.mocked(analyticsApi.getPreviousSummary).mockResolvedValue(previousSummary);
  jest.mocked(apiClient.getGasReadings).mockResolvedValue([]);
  jest.mocked(apiClient.getDashboard).mockResolvedValue({ homes: [] });
});

async function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  queryClient.setQueryData(['activeHomeProfile'], activeHome);
  const result = await render(
    <QueryClientProvider client={queryClient}>
      <AppThemeProvider colorMode="dark">
        <ToastProvider>
          <AnalyticsScreen />
        </ToastProvider>
      </AppThemeProvider>
    </QueryClientProvider>,
  );
  const table = await result.findByTestId('analytics-summary-table');
  const cleanup = async () => {
    await result.unmount();
    queryClient.clear();
  };
  return { result, table, cleanup };
}

describe('F3 analitika', () => {
  it('prikazuje stvarne vrijednosti tekućeg i prethodnog perioda', async () => {
    const { table, cleanup } = await renderScreen();

    const tableScope = within(table);
    // Tekući period: 120 min = 2.0 h, 4 ciklusa, 21.5 °C.
    expect(await tableScope.findByText('2.0')).toBeTruthy();
    expect(tableScope.getByText('21.5')).toBeTruthy();
    // Prethodni period: 150 min = 2.5 h, 5 ciklusa, 21.1 °C — iz DRUGOG upita.
    expect(tableScope.getByText('2.5')).toBeTruthy();
    expect(tableScope.getByText('21.1')).toBeTruthy();

    expect(analyticsApi.getPreviousSummary).toHaveBeenCalledTimes(1);
    const previousArgs = jest.mocked(analyticsApi.getPreviousSummary).mock.calls[0][0];
    const currentArgs = jest.mocked(analyticsApi.getHeatingSummary).mock.calls[0][0];
    // Raspon prethodnog upita je pomak oba kraja unazad za trajanje perioda:
    // `to` prethodnog = `from` tekućeg (do milisekunde).
    expect(
      Math.abs(new Date(previousArgs.to).getTime() - new Date(currentArgs.from).getTime()),
    ).toBeLessThanOrEqual(1);
    expect(previousArgs.homeProfileId).toBe(7);
    expect(previousArgs.from < previousArgs.to).toBe(true);

    await cleanup();
  });

  it('prikazuje razliku u procentima kad prethodni period postoji', async () => {
    const { table, cleanup } = await renderScreen();

    // Sati grijanja: (2.0 − 2.5) / 2.5 = −20.0 % (isti odnos i za cikluse).
    await waitFor(() =>
      expect(within(table).getAllByText('-20.0%').length).toBeGreaterThan(0),
    );

    await cleanup();
  });

  it('ispisuje „—" kad prethodnog perioda nema, bez izmišljenog procenta', async () => {
    // Bez prethodnog perioda upit nema podatke — tabela ne smije izmišljati nulu.
    jest.mocked(analyticsApi.getPreviousSummary).mockRejectedValue(new Error('no previous'));

    const { result, table, cleanup } = await renderScreen();

    await waitFor(() => expect(within(table).getAllByText('—').length).toBeGreaterThan(0));
    // Nema delte računate iz nule (dijeljenje nulom) — nema procenta u tabeli.
    expect(within(table).queryByText(/%$/)).toBeNull();
    // Sekcija nosi eksplicitnu poruku da prethodnih podataka nema.
    expect(await result.findByText('analytics.noPreviousData')).toBeTruthy();

    await cleanup();
  });

  it('ne prikazuje fiktivne metrike ni blok AI Insights', async () => {
    const { result, cleanup } = await renderScreen();

    await result.findByTestId('analytics-model');
    const tree = JSON.stringify(result.toJSON());
    expect(tree).not.toMatch(/bolji od sličnih domova/i);
    expect(tree).not.toMatch(/poboljšanje/i);
    expect(tree).not.toMatch(/AI Insights/i);
    expect(tree).not.toMatch(/vsSimilarHomes/);

    const source = fs.readFileSync(
      path.join(__dirname, '..', 'analytics', 'AnalyticsScreen.tsx'),
      'utf8',
    );
    expect(source).not.toMatch(/vsSimilarHomes|betterThanSimilar|percentImprovement/);
    expect(source).not.toMatch(/AI Insights/);

    await cleanup();
  });

  it('grafik se renderuje iz stvarne širine, bez Dimensions', async () => {
    const { result, cleanup } = await renderScreen();

    const chart = await result.findByTestId('analytics-chart');
    // Širina dolazi iz `onLayout`, a ne iz `Dimensions.get('window')`.
    await fireEvent(chart, 'layout', { nativeEvent: { layout: { width: 320, height: 150 } } });

    await waitFor(() => expect(JSON.stringify(result.toJSON())).toMatch(/RNSVG|Polyline/));

    const source = fs.readFileSync(
      path.join(__dirname, '..', 'analytics', 'AnalyticsScreen.tsx'),
      'utf8',
    );
    expect(source).not.toMatch(/Dimensions\.get/);

    await cleanup();
  });

  it('analitika i analiza plina ne koriste react-native-chart-kit', async () => {
    const analyticsSource = fs.readFileSync(
      path.join(__dirname, '..', 'analytics', 'AnalyticsScreen.tsx'),
      'utf8',
    );
    const gasAnalysisSource = fs.readFileSync(
      path.join(__dirname, '..', 'gas', 'GasAnalysisScreen.tsx'),
      'utf8',
    );
    for (const source of [analyticsSource, gasAnalysisSource]) {
      expect(source).not.toMatch(/react-native-chart-kit/);
      expect(source).not.toMatch(/Dimensions\.get/);
      expect(source).toMatch(/TrendChart/);
    }

    const pkg = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', '..', '..', 'package.json'), 'utf8'),
    ) as { dependencies: Record<string, string> };
    expect(pkg.dependencies['react-native-chart-kit']).toBeUndefined();
    expect(pkg.dependencies['react-native-svg']).toBeDefined();
  });
});
