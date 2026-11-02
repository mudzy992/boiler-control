import mockReact from 'react';
import { Text as mockNativeText, View as mockNativeView } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { NativeBaseProvider } from 'native-base';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../components/ui/nativewind';
import { AppThemeProvider } from '../../theme/AppTheme';
import { theme } from '../../theme/theme';
import { getDashboard } from '../../api/dashboard.api';
import { apiClient } from '../../services/api/client';
import type { DashboardResponse } from '../../types/Dashboard';
import { DashboardScreen } from '../dashboard/DashboardScreen';

jest.mock('@expo/vector-icons', () => {
  const createIcon = () => (props: { name: string }) =>
    mockReact.createElement(mockNativeText, { accessibilityLabel: props.name }, props.name);
  return {
    Ionicons: createIcon(),
    MaterialCommunityIcons: createIcon(),
  };
});

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

jest.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en-US' },
  }),
}));

jest.mock('../../components/BottomSheetModal', () => ({
  BottomSheetModal: ({ isOpen, children }: { isOpen: boolean; children: mockReact.ReactNode }) =>
    isOpen ? mockReact.createElement(mockNativeView, null, children) : null,
}));

jest.mock('../../api/dashboard.api', () => ({
  getDashboard: jest.fn(),
}));

jest.mock('../../services/api/client', () => ({
  apiClient: {
    getDashboardHealth: jest.fn(),
    setBoilerCurrentTemp: jest.fn(),
  },
}));

type Mode = 'light' | 'dark';
type Implementation = 'legacy' | 'nativewind';

const at = (hour: number, minute = 0) => new Date(2026, 10, 2, hour, minute).toISOString();
const dashboard: DashboardResponse = {
  capabilities: { hasProfile: true, hasThermostat: true, hasLearning: true },
  system: {
    boiler: {
      externalTemp: 4.5,
      suggestedFlowTemp: 51,
      actualFlowTemp: 50,
      heatingStart: null,
      heatingEnd: null,
    },
    recommendation: {
      date: at(8),
      recommendedFlowTemp: 51,
      confidenceScore: 0.72,
      breakdown: {
        version: 1,
        mode: 'FULL',
        intervalKey: 'weekday_morning',
        baseCurveTemp: 51,
        weightedExternalTemp: 4.5,
        appliedOffsets: { home: 0.25, interval: -0.5, events: 0.25 },
        finalTemp: 51,
        confidence: 0.72,
        samples: 8,
        expectedHeatTimeMin: 28,
      },
    },
    weather: {
      temp: 8.5,
      feelsLike: 6.5,
      condition: 'Cloudy',
      humidity: 70,
      windSpeed: 12,
      windDirection: 'NW',
      pressure: 1012,
      uvIndex: 1,
      sunrise: at(6, 30),
      sunset: at(16, 30),
    },
  },
  homes: [
    {
      profile: {
        id: 7,
        floorArea: 100,
        ceilingHeight: 2.7,
        insulationType: 'MINERAL_WOOL',
        windowType: 'DOUBLE',
        heatingType: 'RADIATORS',
      },
      thermostats: [
        {
          id: 10,
          alias: 'Living Room',
          vendor: 'Tuya',
          deviceId: 'tuya-1',
          mode: 'PROGRAM',
          lastSeen: at(11),
          currentTemp: 21.5,
          targetTemp: 22,
          isHeatingNow: false,
          program: [],
        },
      ],
      learningIntervals: [],
      recentHeatingEvents: [
        {
          deviceId: 10,
          startedAt: at(9),
          endedAt: at(10),
          targetTemp: 22,
          currentTemp: 21.5,
          hvacAction: 'HEATING_OFF',
          isAnomaly: false,
        },
      ],
    },
  ],
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 10, 2, 12, 0));
  jest.clearAllMocks();
  jest.mocked(getDashboard).mockResolvedValue(dashboard);
  jest.mocked(apiClient.getDashboardHealth).mockResolvedValue({
    score: 85,
    learningConfidence: 72,
    components: [],
    warnings: [{ type: 'shortCycles', level: 'warning', message: 'Short cycle warning' }],
    computedAt: at(11, 55),
  });
  jest.mocked(apiClient.setBoilerCurrentTemp).mockResolvedValue({ currentFlowTemp: 52.4 });
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
            <DashboardScreen />
          </ToastProvider>
        </AppThemeProvider>
      </NativeBaseProvider>
    </QueryClientProvider>,
  );
  await result.findByText('Living Room');
  await result.findByTestId('recommendation-breakdown');
  await result.findByText('Short cycle warning');
  return { result, queryClient };
}

describe.each(['legacy', 'nativewind'] as const)('Dashboard %s', (implementation) => {
  it.each(['light', 'dark'] as const)('matches the %s snapshot', async (mode) => {
    const { result, queryClient } = await screenTree(mode, implementation);
    expect(result.toJSON()).toMatchSnapshot();
    await result.unmount();
    queryClient.clear();
  });
});

it('submits a valid NativeWind current temperature and refreshes dashboard data', async () => {
  const { result, queryClient } = await screenTree('dark', 'nativewind');

  await fireEvent.press(result.getByText('boiler.setCurrentTemp'));
  const input = await result.findByPlaceholderText('48 - 55');
  await fireEvent.changeText(input, '52.4');
  await fireEvent.press(result.getByText('boiler.saveCurrentTemp'));

  await waitFor(() => expect(apiClient.setBoilerCurrentTemp).toHaveBeenCalledWith(52.4));
  expect(await result.findByText('boiler.currentTempUpdated')).toBeTruthy();
  await waitFor(() => expect(getDashboard).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(apiClient.getDashboardHealth).toHaveBeenCalledTimes(2));
  await result.unmount();
  queryClient.clear();
});
