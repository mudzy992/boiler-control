import { Injectable } from '@nestjs/common';
import { fetchOpenMeteoFlatbuffers } from './openmeteo-flatbuffers';
import { WeatherHttpAdapter } from './weather-http.adapter';
import { mapWmoWeatherCode } from './wmo';
import {
  WEATHER_V2_PROVIDER,
  type ConfirmedWeatherLocation,
  type WeatherCurrentV2,
  type WeatherDayV2,
  type WeatherForecastPayloadV2,
  type WeatherHourV2,
  type WeatherLocationCandidate,
} from './weather-v2.types';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const PROVIDER_TIMEOUT_MS = 9000;
const MAX_BLOCK_SAMPLES = 31 * 24;

interface SdkVariable {
  value(): number;
  valuesArray(): ArrayLike<number> | null;
  valuesInt64(index: number): bigint | null;
}

interface SdkBlock {
  time(): bigint;
  timeEnd(): bigint;
  interval(): number;
  variables(index: number): SdkVariable | null | undefined;
}

interface SdkResponse {
  utcOffsetSeconds(): number;
  current(): SdkBlock | null;
  hourly(): SdkBlock | null;
  daily(): SdkBlock | null;
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function epochIso(value: unknown): string | null {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function localDate(epoch: unknown, utcOffsetSeconds: number): string | null {
  const seconds = Number(epoch);
  if (!Number.isFinite(seconds)) return null;
  const date = new Date((seconds + utcOffsetSeconds) * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function booleanValue(value: unknown): boolean | null {
  if (value === 1) return true;
  if (value === 0) return false;
  return null;
}

function validCoordinate(value: unknown, minimum: number, maximum: number) {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
  );
}

export function isValidIanaTimezone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 100) {
    return false;
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}

@Injectable()
export class OpenMeteoV2Provider {
  constructor(private readonly weatherAdapter: WeatherHttpAdapter) {}

  private async abortable<T>(
    request: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
    try {
      return await request(controller.signal);
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error('weather provider timeout');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async geocode(query: string): Promise<WeatherLocationCandidate[]> {
    const normalized = query.trim();
    if (normalized.length < 2 || normalized.length > 100) return [];

    const result = await this.weatherAdapter.executeWithCircuitBreaker(() =>
      this.abortable(async (signal) => {
        const url = `${GEOCODING_URL}?name=${encodeURIComponent(
          normalized,
        )}&count=5&language=en&format=json`;
        const response = await fetch(url, { signal });
        if (!response.ok) {
          throw new Error(`geocoding HTTP ${response.status}`);
        }
        return response.json();
      }),
    );

    if (
      typeof result !== 'object' ||
      result === null ||
      !('results' in result) ||
      !Array.isArray(result.results)
    ) {
      return [];
    }
    return result.results
      .flatMap((item: any) => {
        if (
          item?.id === undefined ||
          !validCoordinate(item.latitude, -90, 90) ||
          !validCoordinate(item.longitude, -180, 180) ||
          !isValidIanaTimezone(item.timezone) ||
          typeof item.name !== 'string' ||
          item.name.length === 0
        ) {
          return [];
        }
        const providerId = String(item.id);
        if (!providerId) return [];
        const admin1 = typeof item.admin1 === 'string' ? item.admin1 : null;
        const country = typeof item.country === 'string' ? item.country : null;
        const label = [item.name, admin1, country]
          .filter((part): part is string => Boolean(part))
          .join(', ');
        return [
          {
            provider: WEATHER_V2_PROVIDER,
            providerId,
            label,
            name: item.name,
            admin1,
            country,
            countryCode:
              typeof item.country_code === 'string' ? item.country_code : null,
            latitude: item.latitude,
            longitude: item.longitude,
            timezone: item.timezone,
          },
        ];
      })
      .slice(0, 5);
  }

  async fetchForecast(
    location: ConfirmedWeatherLocation,
  ): Promise<WeatherForecastPayloadV2> {
    const responses = await this.weatherAdapter.executeWithCircuitBreaker(() =>
      this.abortable((signal) =>
        fetchOpenMeteoFlatbuffers(
          FORECAST_URL,
          {
            latitude: location.latitude,
            longitude: location.longitude,
            timezone: location.timezone,
            forecast_days: 7,
            current: [
              'temperature_2m',
              'relative_humidity_2m',
              'apparent_temperature',
              'weather_code',
              'is_day',
              'wind_speed_10m',
              'wind_gusts_10m',
              'wind_direction_10m',
              'pressure_msl',
              'cloud_cover',
            ],
            hourly: [
              'temperature_2m',
              'apparent_temperature',
              'relative_humidity_2m',
              'precipitation_probability',
              'precipitation',
              'weather_code',
              'wind_speed_10m',
              'wind_gusts_10m',
              'wind_direction_10m',
              'is_day',
            ],
            daily: [
              'temperature_2m_max',
              'temperature_2m_min',
              'precipitation_sum',
              'precipitation_probability_max',
              'weather_code',
              'sunrise',
              'sunset',
              'uv_index_max',
            ],
          },
          { signal },
        ),
      ),
    );

    const response = responses[0] as unknown as SdkResponse | undefined;
    const hourly = response?.hourly();
    const daily = response?.daily();
    if (!response || !hourly || !daily) {
      throw new Error('Open-Meteo response is missing forecast blocks');
    }

    const current = response.current();
    const observedSeconds = current ? Number(current.time()) : 0;
    const hourlyTimes = this.blockTimes(hourly);
    const nextHour = observedSeconds
      ? hourlyTimes.findIndex((time) => time >= observedSeconds)
      : 0;
    const firstHour = nextHour < 0 ? hourlyTimes.length : nextHour;
    const selectedHours = hourlyTimes.slice(firstHour, firstHour + 72);
    const dailyTimes = this.blockTimes(daily).slice(0, 7);
    const utcOffset = response.utcOffsetSeconds();

    return {
      observedAt: current ? epochIso(current.time()) : null,
      current: current ? this.mapCurrent(current) : null,
      hourly: selectedHours.map((time, offset) =>
        this.mapHour(hourly, firstHour + offset, time),
      ),
      daily: dailyTimes.map((time, index) =>
        this.mapDay(daily, index, time, utcOffset),
      ),
    };
  }

  private blockTimes(block: SdkBlock): number[] {
    const start = Number(block.time());
    const interval = block.interval();
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(interval) ||
      interval <= 0
    ) {
      return [];
    }
    const length = Math.max(
      0,
      Math.min(
        MAX_BLOCK_SAMPLES,
        Math.floor((Number(block.timeEnd()) - start) / interval),
      ),
    );
    return Array.from({ length }, (_, index) => start + index * interval);
  }

  private numberValue(block: SdkBlock, variable: number) {
    return finite(block.variables(variable)?.value());
  }

  private arrayValue(block: SdkBlock, variable: number, index: number) {
    const values = block.variables(variable)?.valuesArray();
    if (!values || index < 0 || index >= values.length) return null;
    return finite(values[index]);
  }

  private mapCurrent(block: SdkBlock): WeatherCurrentV2 {
    const condition = mapWmoWeatherCode(this.numberValue(block, 3));
    return {
      temperatureC: this.numberValue(block, 0),
      apparentTemperatureC: this.numberValue(block, 2),
      humidityPercent: this.numberValue(block, 1),
      windKph: this.numberValue(block, 5),
      gustKph: this.numberValue(block, 6),
      windDirectionDegrees: this.numberValue(block, 7),
      pressureHpa: this.numberValue(block, 8),
      cloudPercent: this.numberValue(block, 9),
      ...condition,
      isDay: booleanValue(this.numberValue(block, 4)),
    };
  }

  private mapHour(block: SdkBlock, index: number, time: number): WeatherHourV2 {
    const condition = mapWmoWeatherCode(this.arrayValue(block, 5, index));
    return {
      at: epochIso(time) ?? new Date(time * 1000).toISOString(),
      temperatureC: this.arrayValue(block, 0, index),
      apparentTemperatureC: this.arrayValue(block, 1, index),
      humidityPercent: this.arrayValue(block, 2, index),
      precipitationProbabilityPercent: this.arrayValue(block, 3, index),
      precipitationMm: this.arrayValue(block, 4, index),
      windKph: this.arrayValue(block, 6, index),
      gustKph: this.arrayValue(block, 7, index),
      windDirectionDegrees: this.arrayValue(block, 8, index),
      ...condition,
      isDay: booleanValue(this.arrayValue(block, 9, index)),
    };
  }

  private mapDay(
    block: SdkBlock,
    index: number,
    time: number,
    utcOffset: number,
  ): WeatherDayV2 {
    const condition = mapWmoWeatherCode(this.arrayValue(block, 4, index));
    const sunrise = block.variables(5)?.valuesInt64(index);
    const sunset = block.variables(6)?.valuesInt64(index);
    return {
      date: localDate(time, utcOffset),
      temperatureMaxC: this.arrayValue(block, 0, index),
      temperatureMinC: this.arrayValue(block, 1, index),
      precipitationMm: this.arrayValue(block, 2, index),
      precipitationProbabilityPercent: this.arrayValue(block, 3, index),
      sunrise: epochIso(sunrise),
      sunset: epochIso(sunset),
      uvIndex: this.arrayValue(block, 7, index),
      ...condition,
    };
  }
}
