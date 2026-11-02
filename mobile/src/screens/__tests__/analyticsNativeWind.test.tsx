import mockReact from 'react';
import {
  BackHandler,
  Share,
  Text as mockNativeText,
  View as mockNativeView,
} from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { NativeBaseProvider } from 'native-base';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system/legacy';
import { ToastProvider } from '../../components/ui/nativewind';
import { AppThemeProvider } from '../../theme/AppTheme';
import { theme } from '../../theme/theme';
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

jest.mock('react-native/Libraries/Modal/Modal', () => ({
  __esModule: true,
  default: ({ visible, children }: { visible: boolean; children: mockReact.ReactNode }) =>
    visible ? mockReact.createElement(mockNativeView, null, children) : null,
}));

jest.mock('@react-native-aria/overlays', () => ({
  ...jest.requireActual('@react-native-aria/overlays'),
  // NativeBase keeps the closed Select overlay mounted on iOS. It is not
  // visible UI; NativeWind option interaction is covered through RN Modal.
  OverlayContainer: () => null,
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
  },
}));

jest.mock('../../services/api/homeProfile.api', () => ({
  homeProfileApi: { getActiveHomeProfile: jest.fn() },
}));

jest.mock('../../services/api/client', () => ({
  apiClient: { getGasReadings: jest.fn() },
}));

type Mode = 'light' | 'dark';
type Implementation = 'legacy' | 'nativewind';

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

beforeAll(() => {
  // Legacy-only parity with RootNavigator; removed with the before snapshots.
  (BackHandler as any).addEventListener = jest.fn(() => ({ remove: jest.fn() }));
  (BackHandler as any).removeEventListener = jest.fn();
});

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
});

afterEach(() => {
  delete process.env.EXPO_PUBLIC_NATIVEWIND_SCREENS;
  jest.clearAllTimers();
  jest.useRealTimers();
});


async function screenTree(mode: Mode, implementation: Implementation) {
  process.env.EXPO_PUBLIC_NATIVEWIND_SCREENS =
    implementation === 'nativewind' ? 'all' : 'none';
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
  const testTheme = {
    ...theme,
    config: { ...theme.config, initialColorMode: mode },
  };
  const result = await render(
    <QueryClientProvider client={queryClient}>
      <NativeBaseProvider
        theme={testTheme}
        initialWindowMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, right: 0, bottom: 0, left: 0 },
        }}
      >
        <AppThemeProvider colorMode={mode}>
          <ToastProvider>
            <AnalyticsScreen />
          </ToastProvider>
        </AppThemeProvider>
      </NativeBaseProvider>
    </QueryClientProvider>,
  );
  await result.findByText('21.5');
  await result.findByText('analytics.noTrendData');
  await result.findByText('0 analytics.samples');
  await result.findByText('analytics.noGasReadings');
  return { result, queryClient };
}

describe.each(['legacy', 'nativewind'] as const)('Analytics %s', (implementation) => {
  it.each(['light', 'dark'] as const)('matches the %s snapshot', async (mode) => {
    const { result, queryClient } = await screenTree(mode, implementation);
    expect(result.toJSON()).toMatchSnapshot();
    await result.unmount();
    queryClient.clear();
  });
});

it('changes the NativeWind time range and refetches analytics', async () => {
  const { result, queryClient } = await screenTree('dark', 'nativewind');
  await fireEvent.press(result.getByRole('combobox'));
  await fireEvent.press(result.getByText('analytics.thisMonth'));

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
  const { result, queryClient } = await screenTree('light', 'nativewind');

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
