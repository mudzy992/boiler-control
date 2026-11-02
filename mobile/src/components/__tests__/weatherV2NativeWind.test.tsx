import mockReact from 'react';
import { Text as mockNativeText } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppThemeProvider } from '../../theme/AppTheme';
import { weatherApi } from '../../services/api/weather.api';
import type { WeatherLocationCandidate, WeatherV2Success } from '../../types/WeatherV2';
import { WeatherV2Card } from '../weather/WeatherV2Card';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: (props: { name: string }) =>
    mockReact.createElement(mockNativeText, { accessibilityLabel: props.name }, props.name),
}));

jest.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { value?: string; location?: string }) => {
      if (options?.location) return `${key}:${options.location}`;
      if (options?.value !== undefined) return `${key}:${options.value}`;
      return key;
    },
    i18n: { language: 'en-US' },
  }),
}));

jest.mock('../../services/api/weather.api', () => ({
  weatherApi: {
    getCurrent: jest.fn(),
    getLocationCandidates: jest.fn(),
    confirmLocation: jest.fn(),
  },
  weatherV2Keys: {
    current: (homeProfileId: number) => ['weather-v2', homeProfileId],
  },
}));

const candidateA: WeatherLocationCandidate = {
  provider: 'open-meteo',
  providerId: 'a',
  label: 'Springfield, Illinois, United States',
  name: 'Springfield',
  admin1: 'Illinois',
  country: 'United States',
  countryCode: 'US',
  latitude: 39.78,
  longitude: -89.65,
  timezone: 'America/Chicago',
};
const candidateB: WeatherLocationCandidate = {
  ...candidateA,
  providerId: 'b',
  label: 'Springfield, Massachusetts, United States',
  admin1: 'Massachusetts',
  latitude: 42.1,
  longitude: -72.59,
  timezone: 'America/New_York',
};

const location = { ...candidateB, confirmedAt: '2026-01-01T00:00:00.000Z' };
const condition = {
  conditionCode: 0,
  conditionKey: 'clear',
  conditionI18nKey: 'weather.condition.clear',
};
const forecast: WeatherV2Success = {
  version: 2,
  status: 'ok',
  source: 'open-meteo',
  location,
  observedAt: '2026-11-02T11:00:00.000Z',
  current: {
    temperatureC: 0,
    apparentTemperatureC: 0,
    humidityPercent: 0,
    windKph: 0,
    gustKph: null,
    windDirectionDegrees: 180,
    pressureHpa: 1013,
    cloudPercent: 0,
    isDay: true,
    ...condition,
  },
  hourly: Array.from({ length: 72 }, (_, index) => ({
    at: new Date(Date.parse('2026-11-02T12:00:00.000Z') + index * 3600000).toISOString(),
    temperatureC: 0,
    apparentTemperatureC: 0,
    humidityPercent: 0,
    precipitationProbabilityPercent: 0,
    precipitationMm: 0,
    windKph: 0,
    gustKph: null,
    windDirectionDegrees: 180,
    isDay: true,
    ...condition,
  })),
  daily: Array.from({ length: 7 }, (_, index) => ({
    date: new Date(Date.parse('2026-11-02T12:00:00.000Z') + index * 86400000)
      .toISOString()
      .slice(0, 10),
    temperatureMinC: 0,
    temperatureMaxC: 10,
    precipitationMm: 0,
    precipitationProbabilityPercent: 0,
    uvIndex: 0,
    sunrise: null,
    sunset: null,
    ...condition,
  })),
  fetchedAt: '2026-11-02T11:55:00.000Z',
  ageSeconds: 300,
  freshness: 'fresh',
  currentHidden: false,
};

let queryClient: QueryClient | undefined;

async function renderCard() {
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  return await render(
    <QueryClientProvider client={queryClient}>
      <AppThemeProvider>
        <WeatherV2Card homeProfileId={7} />
      </AppThemeProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(weatherApi.getCurrent).mockResolvedValue(forecast);
  jest.mocked(weatherApi.getLocationCandidates).mockResolvedValue({
    query: 'Springfield',
    candidates: [candidateA, candidateB],
  });
  jest.mocked(weatherApi.confirmLocation).mockResolvedValue({
    status: 'location_confirmed',
    location,
  });
});

afterEach(() => {
  queryClient?.clear();
  queryClient = undefined;
  jest.clearAllMocks();
});

describe('MO2-17 WeatherV2Card', () => {
  it('renders zero, all 72 hours/7 days and an absolute visible fetchedAt', async () => {
    const screen = await renderCard();

    await waitFor(() => expect(screen.queryAllByTestId(/^weather-v2-hour-/)).toHaveLength(72));
    expect(screen.queryAllByTestId(/^weather-v2-day-/)).toHaveLength(7);
    expect(screen.getByText('0')).toBeTruthy();
    expect(screen.getByText('0%')).toBeTruthy();

    const fetchedAt = screen.getByTestId('weather-v2-fetched-at');
    expect(String(fetchedAt.props.children)).toContain('weather.fetchedAt:');
    expect(String(fetchedAt.props.children)).toContain('2026');
    expect(String(fetchedAt.props.children)).toContain('EST');
  });

  it('keeps hourly/daily last-good data and fetchedAt when current is hidden', async () => {
    jest.mocked(weatherApi.getCurrent).mockResolvedValue({
      ...forecast,
      fetchedAt: '2026-11-02T10:00:00.000Z',
      ageSeconds: 7200,
      freshness: 'stale',
      currentHidden: true,
    });
    const screen = await renderCard();

    await waitFor(() => expect(screen.getByText('weather.currentHidden')).toBeTruthy());
    expect(screen.getByText('weather.staleData')).toBeTruthy();
    expect(screen.queryByText('0')).toBeNull();
    expect(screen.queryAllByTestId(/^weather-v2-hour-/)).toHaveLength(72);
    expect(screen.queryAllByTestId(/^weather-v2-day-/)).toHaveLength(7);
    expect(screen.getByTestId('weather-v2-fetched-at')).toBeTruthy();
  });

  it('requires a search and confirms only the explicitly selected candidate', async () => {
    jest.mocked(weatherApi.getCurrent).mockResolvedValue({
      version: 2,
      status: 'location_confirmation_required',
    });
    const screen = await renderCard();

    await waitFor(() => expect(screen.getByLabelText('weather.chooseLocation')).toBeTruthy());
    await fireEvent.press(screen.getByLabelText('weather.chooseLocation'));
    expect(weatherApi.getLocationCandidates).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('weather.locationQuery'), 'Springfield');
    await fireEvent.press(screen.getByLabelText('weather.searchLocation'));

    await waitFor(() => expect(screen.getByText(candidateB.label)).toBeTruthy());
    expect(weatherApi.getLocationCandidates).toHaveBeenCalledWith(7, 'Springfield');
    expect(weatherApi.confirmLocation).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByLabelText(`weather.confirmCandidate:${candidateB.label}`));
    await waitFor(() =>
      expect(weatherApi.confirmLocation).toHaveBeenCalledWith(7, 'Springfield', 'b'),
    );
    expect(weatherApi.confirmLocation).toHaveBeenCalledTimes(1);
  });
});
