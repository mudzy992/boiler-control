import mockReact from 'react';
import { Text as mockNativeText } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import fs from 'fs';
import path from 'path';

import { AppThemeProvider } from '../../theme/AppTheme';
import { ToastProvider } from '../../components/ui/nativewind';
import { DashboardScreen } from '../dashboard/DashboardScreen';
import { HeatingScreen } from '../heating/HeatingScreen';

/**
 * F2 (prototip §02–§04) — ugovori koje ovaj test čuva:
 *
 *  1. Početna ima JEDAN hero (polazna voda) i TRI KPI pločice — ne osam kartica.
 *  2. Dubinu nosi ivica, ne sjena: nijedan F2 ekran ne koristi `shadow`.
 *  3. Grijanje je red po uređaju: „21.5 → 23.0" u jednom redu, ne četiri broja.
 *  4. Akcija „dodaj očitanje" je u zaglavlju, a ne FAB preko sadržaja.
 *  5. Nijedan novi ekran ne uvodi lokalnu formulu za zdravlje (MO2-12 ostaje).
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

jest.mock('../../hooks/useAppState', () => ({ useAppState: () => 'active' }));

jest.mock('../../api/dashboard.api', () => ({ getDashboard: jest.fn() }));

const mockSetCurrentTemp = jest.fn();
jest.mock('../../services/api/client', () => ({
  apiClient: {
    getDashboardHealth: jest.fn(),
    getDashboard: jest.fn(),
    getHeatingEvents: jest.fn(),
    setBoilerCurrentTemp: (...args: unknown[]) => mockSetCurrentTemp(...args),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { apiClient } = require('../../services/api/client');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDashboard } = require('../../api/dashboard.api');

const DASHBOARD_FIXTURE = {
  capabilities: { hasProfile: true, hasThermostat: true, hasLearning: true },
  system: {
    boiler: {
      externalTemp: 4.5,
      suggestedFlowTemp: 51,
      actualFlowTemp: 50,
      heatingStart: new Date(Date.now() - 65 * 60000).toISOString(),
      heatingEnd: null,
    },
    recommendation: { date: '2026-11-02T08:00:00.000Z', recommendedFlowTemp: 51, confidenceScore: 0.7 },
    weather: {
      temp: 8.5,
      feelsLike: 6.5,
      condition: 'Cloudy',
      humidity: 70,
      windSpeed: 12,
      windDirection: 'NW',
      pressure: 1012,
      uvIndex: 1,
      sunrise: '2026-11-02T06:30:00.000Z',
      sunset: '2026-11-02T16:30:00.000Z',
    },
  },
  homes: [
    {
      profile: { id: 7, floorArea: 100, ceilingHeight: 2.7, insulationType: 'EPS', windowType: 'DOUBLE', heatingType: 'RADIATORS' },
      thermostats: [
        {
          id: 10,
          alias: 'Living Room',
          vendor: 'Tuya',
          deviceId: 'tuya-1',
          mode: 'PROGRAM',
          lastSeen: new Date().toISOString(),
          roomCurrentTemp: 21.5,
          roomTargetTemp: 23,
          isHeatingNow: true,
          program: [],
        },
        {
          id: 11,
          alias: 'Kitchen',
          vendor: 'Tuya',
          deviceId: 'tuya-2',
          mode: 'MANUAL',
          lastSeen: new Date().toISOString(),
          roomCurrentTemp: 20,
          roomTargetTemp: 20,
          isHeatingNow: false,
          program: [],
        },
      ],
      learningIntervals: [],
      recentHeatingEvents: [],
    },
  ],
};

const renderWithProviders = async (element: React.ReactElement, mode: 'light' | 'dark' = 'dark') => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } },
  });
  const result = await render(
    <QueryClientProvider client={queryClient}>
      <AppThemeProvider colorMode={mode}>
        <ToastProvider>{element}</ToastProvider>
      </AppThemeProvider>
    </QueryClientProvider>,
  );
  return { result, queryClient };
};

beforeEach(() => {
  jest.clearAllMocks();
  getDashboard.mockResolvedValue(DASHBOARD_FIXTURE);
  apiClient.getDashboard.mockResolvedValue(DASHBOARD_FIXTURE);
  apiClient.getHeatingEvents.mockResolvedValue([]);
  apiClient.getDashboardHealth.mockResolvedValue({
    score: 85,
    learningConfidence: 72,
    components: [],
    warnings: [],
    computedAt: new Date().toISOString(),
  });
  mockSetCurrentTemp.mockResolvedValue({ currentFlowTemp: 52.4 });
});

const read = (relative: string) => fs.readFileSync(path.join(__dirname, '..', '..', relative), 'utf8');

describe('Početna — instrument panel', () => {
  it('shows one hero readout and exactly three KPI tiles', async () => {
    const { result, queryClient } = await renderWithProviders(<DashboardScreen />);

    expect(await result.findByTestId('dashboard-hero')).toBeTruthy();
    expect(result.getByTestId('dashboard-flow-actual')).toBeTruthy();
    // F8 (HOME-06): treća KPI pločica više nije „Vani" (vanjska temperatura je
    // sada u kartici vremena) nego trenutna temperatura termostata.
    expect(result.getByTestId('kpi-thermostat')).toBeTruthy();
    expect(result.getByTestId('kpi-health')).toBeTruthy();
    expect(result.getByTestId('kpi-thermostats')).toBeTruthy();
    expect(result.queryByTestId('kpi-fourth')).toBeNull();

    await result.unmount();
    queryClient.clear();
  });

  it('renders thermostats as rows with value → target in one readout', async () => {
    const { result, queryClient } = await renderWithProviders(<DashboardScreen />);

    expect(await result.findByTestId('thermostat-panel')).toBeTruthy();
    // F8 (HOME-06): ime termostata sada postoji i u KPI pločici („Termostat
    // sada"), pa se traži u redu termostata, a ne bilo gdje na ekranu.
    expect(result.getAllByText('Living Room').length).toBeGreaterThan(0);
    // Jedan a11y čvor nosi cijelu relaciju, umjesto tri odvojena broja.
    expect(result.getByLabelText('Living Room: 21.5 → 23.0 °C')).toBeTruthy();

    await result.unmount();
    queryClient.clear();
  });

  it('opens the set-temperature sheet from the hero action', async () => {
    const { result, queryClient } = await renderWithProviders(<DashboardScreen />);
    await result.findByTestId('dashboard-hero');

    await fireEvent.press(result.getByTestId('open-set-temp'));
    expect(await result.findByPlaceholderText('46 - 55')).toBeTruthy();

    await result.unmount();
    queryClient.clear();
  });
});

describe('Grijanje — red po uređaju', () => {
  it('renders one row per device with a single combined readout', async () => {
    const { result, queryClient } = await renderWithProviders(<HeatingScreen />);

    expect(await result.findByTestId('heating-devices')).toBeTruthy();
    expect(result.getByTestId('thermostat-readout-10')).toBeTruthy();
    expect(result.getByTestId('thermostat-readout-11')).toBeTruthy();

    await result.unmount();
    queryClient.clear();
  });
});

describe('F2 source contracts', () => {
  const f2Screens = [
    'screens/dashboard/DashboardScreen.tsx',
    'screens/heating/HeatingScreen.tsx',
    'screens/settings/SettingsScreen.tsx',
    'components/gas/GasReadingCard.tsx',
    'components/WeatherRow.tsx',
  ];

  it.each(f2Screens)('%s carries depth with borders, not shadows', (file) => {
    // Komentari smiju pominjati `shadow` (objašnjavaju šta je uklonjeno), ali
    // nijedan F2 ekran ne smije imati stvarni prop.
    const source = read(file).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    expect(source).not.toMatch(/shadow=\{?\d/);
  });

  it('gas readings action lives in the header, not in a floating button', () => {
    const source = read('screens/gas/GasReadingsScreen.tsx');
    expect(source).not.toMatch(/Floating Action Button/);
    expect(source).toContain("icon: 'add'");
    expect(source).toContain("label: t('gas.addReading')");
    // MO2-13 ugovor mora ostati: virtualizovana lista sa stabilnim ključem.
    expect(source).toContain('<FlatList');
    expect(source).toContain('keyExtractor={(item) => String(item.id)}');
    expect(source).toContain('renderItem={renderReadingItem}');
  });

  it('the dashboard still reads health from the backend (MO2-12)', () => {
    const source = read('screens/dashboard/DashboardScreen.tsx');
    expect(source).toContain('getDashboardHealth');
    expect(source).not.toContain('calculateSystemHealthMetrics');
  });
});
