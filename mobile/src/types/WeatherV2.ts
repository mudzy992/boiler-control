export interface WeatherLocationCandidate {
  provider: 'open-meteo';
  providerId: string;
  label: string;
  name: string;
  admin1: string | null;
  country: string | null;
  countryCode: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface ConfirmedWeatherLocation extends WeatherLocationCandidate {
  confirmedAt: string;
}

export interface WeatherLocationCandidatesResponse {
  query: string;
  candidates: WeatherLocationCandidate[];
}

export interface ConfirmWeatherLocationResponse {
  status: 'location_confirmed';
  location: ConfirmedWeatherLocation;
}

export interface WeatherCurrentV2 {
  temperatureC: number | null;
  apparentTemperatureC: number | null;
  humidityPercent: number | null;
  windKph: number | null;
  gustKph: number | null;
  windDirectionDegrees: number | null;
  pressureHpa: number | null;
  cloudPercent: number | null;
  conditionCode: number | null;
  conditionKey: string;
  conditionI18nKey: string;
  isDay: boolean | null;
}

export interface WeatherHourV2 {
  at: string;
  temperatureC: number | null;
  apparentTemperatureC: number | null;
  humidityPercent: number | null;
  precipitationProbabilityPercent: number | null;
  precipitationMm: number | null;
  windKph: number | null;
  gustKph: number | null;
  windDirectionDegrees: number | null;
  conditionCode: number | null;
  conditionKey: string;
  conditionI18nKey: string;
  isDay: boolean | null;
}

export interface WeatherDayV2 {
  date: string | null;
  temperatureMinC: number | null;
  temperatureMaxC: number | null;
  precipitationMm: number | null;
  precipitationProbabilityPercent: number | null;
  uvIndex: number | null;
  sunrise: string | null;
  sunset: string | null;
  conditionCode: number | null;
  conditionKey: string;
  conditionI18nKey: string;
}

export interface WeatherV2Success {
  version: 2;
  status: 'ok';
  source: 'open-meteo';
  location: ConfirmedWeatherLocation;
  observedAt: string | null;
  current: WeatherCurrentV2 | null;
  hourly: WeatherHourV2[];
  daily: WeatherDayV2[];
  fetchedAt: string;
  ageSeconds: number;
  freshness: 'fresh' | 'stale';
  currentHidden: boolean;
}

export interface WeatherV2LocationRequired {
  version: 2;
  status: 'location_confirmation_required';
}

export type WeatherV2Response = WeatherV2Success | WeatherV2LocationRequired;
