import mockReact from 'react';
import { Text as mockNativeText } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../components/ui/nativewind';
import { AppThemeProvider } from '../../theme/AppTheme';
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
          roomCurrentTemp: 21.5,
          roomTargetTemp: 22,
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
          roomTargetTemp: 22,
          roomCurrentTemp: 21.5,
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
  const result = await render(
    <QueryClientProvider client={queryClient}>
        <AppThemeProvider colorMode={mode}>
          <ToastProvider>
            <DashboardScreen />
          </ToastProvider>
        </AppThemeProvider>
    </QueryClientProvider>,
  );
  // F8 (HOME-06): ime primarnog termostata sada postoji i u KPI pločici, pa se
  // ekran čeka po stabilnom `testID`-u liste, ne po tekstu koji se ponavlja.
  await result.findByTestId('thermostat-panel');
  // F8 (HOME-07): „Mode: FULL · interval: weekday_morning" je sada u redu
  // termostata, a ne u zasebnom bloku na dnu ekrana. Isti podatak, drugo mjesto.
  await result.findByTestId('thermostat-panel');
  // Testovi u ovom fajlu mockaju `t` na `t(key) => key`, pa se provjerava
  // sastav reda (koji ključevi i koja vrijednost), a ne prevedeni tekst.
  // `36`: nekada je isti red stajao dvaput — uz termostat i na dnu ekrana
  // (u `RecommendationBreakdown`). Korisnik ga je zaokružio kao suvišan, pa
  // sada smije postojati tačno jednom: na kartici termostata.
  expect(
    result.getAllByText(
      /recommendation\.mode: FULL · recommendation\.interval: weekday_morning/,
    ).length,
  ).toBe(1);

  await result.findByTestId('recommendation-breakdown');
  await result.findByText('Short cycle warning');
  return { result, queryClient };
}

describe('Dashboard nativewind', () => {
  it.each(['light', 'dark'] as const)('matches the %s snapshot', async (mode) => {
    const { result, queryClient } = await screenTree(mode);
    expect(result.toJSON()).toMatchSnapshot();
    await result.unmount();
    queryClient.clear();
  });
});

it('submits a valid NativeWind current temperature and refreshes dashboard data', async () => {
  const { result, queryClient } = await screenTree('dark');

  // F2: sheet ostaje montiran (UX-14), pa se naslov „Postavi polaznu" pojavljuje
  // i prije otvaranja — dugme se zato traži po testID-u, ne po tekstu.
  await fireEvent.press(result.getByTestId('open-set-temp'));
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

/**
 * F6 (DASH-01): redoslijed blokova na Početnoj.
 *
 * Zahtjev: **trenutno vrijeme mora biti ispod statusa kotla**. Test ne gleda
 * snimku nego stvarni redoslijed djece u renderovanom stablu, pa ne može
 * proći slučajno — traži se da `dashboard-hero` prethodi `weather-row`.
 */
it('renders current weather immediately below boiler status', async () => {
  const { result, queryClient } = await screenTree('dark');
  const body = result.getByTestId('dashboard-body');

  const order: string[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const element = node as { props?: Record<string, unknown>; children?: unknown[] };
    const testID = element.props?.testID;
    if (typeof testID === 'string' && ['dashboard-hero', 'weather-row'].includes(testID)) {
      order.push(testID);
    }
    for (const child of element.children ?? []) walk(child);
  };
  walk(body);

  expect(order[0]).toBe('dashboard-hero');
  expect(order[1]).toBe('weather-row');

  await result.unmount();
  queryClient.clear();
});
