import mockReact from 'react';
import {
  Share,
  Text as mockNativeText,
  View as mockNativeView,
} from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system/legacy';
import { ToastProvider } from '../../components/ui/nativewind';
import { AppThemeProvider } from '../../theme/AppTheme';
import { analyticsApi } from '../../services/api/analytics.api';
import { homeProfileApi, type HomeProfile } from '../../services/api/homeProfile.api';
import { apiClient } from '../../services/api/client';
import { AnalyticsScreen } from '../analytics/AnalyticsScreen';

jest.mock('@expo/vector-icons', () => {
  const createIcon = () => (props: { name: string }) =>
    mockReact.createElement(mockNativeText, { accessibilityLabel: props.name }, props.name);
  return {
    Ionicons: createIcon(),
    MaterialCommunityIcons: createIcon(),
  };
});

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: {} }),
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), setParams: jest.fn() }),
}));

jest.mock('react-native/Libraries/Modal/Modal', () => ({
  __esModule: true,
  default: ({ visible, children }: { visible: boolean; children: mockReact.ReactNode }) =>
    visible ? mockReact.createElement(mockNativeView, null, children) : null,
}));

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
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
    // F3 (UX-13): stvarni prethodni period — kartice više ne tvrde poređenje
    // koje se ne izvršava.
    getPreviousSummary: jest.fn(),
  },
}));

jest.mock('../../services/api/homeProfile.api', () => ({
  homeProfileApi: { getActiveHomeProfile: jest.fn() },
}));

jest.mock('../../services/api/client', () => ({
  apiClient: { getGasReadings: jest.fn(), getDashboard: jest.fn(), getDailyHistory: jest.fn() },
}));

type Mode = 'light' | 'dark';

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
const stats = { buckets: [] };
const learning = { points: [] };


beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.mocked(homeProfileApi.getActiveHomeProfile).mockResolvedValue(activeHome);
  jest.mocked(analyticsApi.getHeatingSummary).mockResolvedValue(summary);
  jest.mocked(analyticsApi.getHeatingStats).mockResolvedValue(stats);
  jest.mocked(analyticsApi.getLearningTrends).mockResolvedValue(learning);
  jest.mocked(analyticsApi.exportAnalytics).mockResolvedValue({
    summary,
    stats,
    learning,
    export: {
      format: 'csv',
      contentType: 'text/csv; charset=utf-8',
      filename: 'analytics.csv',
      content: 'label,value\nweek,1\n',
    },
  });
  jest.mocked(apiClient.getGasReadings).mockResolvedValue([]);
  /*
   * Kartica dnevne historije je prije bila jedina koja ne pitа server — njen
   * upit je bio `enabled: false` dok `homeProfileId` ne stigne, a `getDailyHistory`
   * nije bio mockovan, pa je završavala u grešci. Snapshot je to skrivao kao
   * skeleton (`importantForAccessibility="no-hide-descendants"`). Sad je
   * mockovan, da screenshot prikazuje stanje koje korisnik stvarno vidi.
   */
  jest.mocked(apiClient.getDailyHistory).mockResolvedValue({
    homeProfileId: 7,
    rows: [],
    summary: {
      days: 0,
      live: 0,
      backfill: 0,
      withCycles: 0,
      withGas: 0,
      withDegreeDays: 0,
      withShadow: 0,
      firstDate: null,
      lastDate: null,
    },
    truncated: false,
    total: 0,
  });
  jest.mocked(apiClient.getDashboard).mockResolvedValue({ homes: [] });
  jest.mocked(analyticsApi.getPreviousSummary).mockResolvedValue({
    summary: {
      totalCycles: 5,
      totalDurationMin: 150,
      avgDurationMin: 30,
      avgIndoorTemp: 21.1,
    },
    buckets: [],
  });
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});


async function screenTree(mode: Mode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  queryClient.setQueryData(['activeHomeProfile'], activeHome);
  queryClient.setQueryData(['analytics-summary', 7, 'week'], summary);
  queryClient.setQueryData(['analytics-stats', 7, 'week'], stats);
  queryClient.setQueryData(['analytics-learning', 7, 'week'], learning);
  queryClient.setQueryData(['gas-readings'], []);
  const result = await render(
    <QueryClientProvider client={queryClient}>
        <AppThemeProvider colorMode={mode}>
          <ToastProvider>
            <AnalyticsScreen />
          </ToastProvider>
        </AppThemeProvider>
    </QueryClientProvider>,
  );
  // F3: prosječna sobna temperatura je sada KPI pločica sa svojim testID-om
  // (vrijednost se pojavljuje i u tabeli poređenja, pa tekst nije jedinstven).
  await result.findByTestId('kpi-avg-indoor');
  await result.findByText('analytics.noTempData');
  /*
   * Snapshot se mora snimiti tek kad su **svi** upiti razriješeni.
   *
   * Snapshot je prije ovoga bio stabilan samo slučajno: `getDailyHistory` nije
   * bio mockovan i vraćao je `undefined`, pa je kartica historije završavala u
   * stanju greške — a to stanje se ne mijenja dalje. Sad kartica čita
   * `truncated`/`total` (A1), pa je vrijeme snimanja postalo vidljivo:
   * `toMatchSnapshot` je uhvatio tabelu prije nego je prethodni period stigao
   * (`periodPrevious: —` umjesto `2.5`).
   *
   * Zato se čeka red koji potiče iz `getPreviousSummary` — tada je tabela
   * konačna, bez obzira na to koliko kartica ispod nje ima.
   */
  await waitFor(() => {
    expect(result.getByText('2.5')).toBeTruthy();
  });
  // F3: bez uzoraka modela KPI pouzdanosti prikazuje stanje "nema podataka"
  // umjesto izmišljenog procenta (AN-01); sekcija modela uvijek postoji.
  await result.findByTestId('kpi-confidence');
  await result.findByTestId('analytics-model');
  await result.findByText('analytics.noGasReadings');
  return { result, queryClient };
}

describe('Analytics nativewind', () => {
  it.each(['light', 'dark'] as const)('matches the %s snapshot', async (mode) => {
    const { result, queryClient } = await screenTree(mode);
    expect(result.toJSON()).toMatchSnapshot();
    await result.unmount();
    queryClient.clear();
  });
});

it('changes the NativeWind time range and refetches analytics', async () => {
  const { result, queryClient } = await screenTree('dark');
  // F3: vremenski period je `Segmented` traka (prototip §05), ne select.
  await fireEvent.press(result.getByTestId('analytics-range-month'));

  await waitFor(() => expect(analyticsApi.getHeatingSummary).toHaveBeenCalledTimes(2));
  expect(jest.mocked(analyticsApi.getHeatingSummary).mock.calls[1][0]).toMatchObject({
    homeProfileId: 7,
    bucket: 'day',
  });
  await result.unmount();
  queryClient.clear();
});

it('writes and shares the NativeWind CSV export', async () => {
  const share = jest
    .spyOn(Share, 'share')
    .mockResolvedValue({ action: Share.sharedAction, activityType: undefined });
  const { result, queryClient } = await screenTree('light');

  await fireEvent.press(result.getByText('analytics.exportData'));

  await waitFor(() => expect(FileSystem.writeAsStringAsync).toHaveBeenCalledTimes(1));
  expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
    'file:///documents/analytics_exports/analytics.csv',
    'label,value\nweek,1\n',
    { encoding: 'utf8' },
  );
  await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
  expect(await result.findByText('analytics.exportSuccess')).toBeTruthy();
  await result.unmount();
  queryClient.clear();
});
