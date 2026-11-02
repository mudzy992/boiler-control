import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { fetchOpenMeteoFlatbuffers } from './openmeteo-flatbuffers';
import { WeatherHttpAdapter } from './weather-http.adapter';

const MISSING_UNIX_TIMESTAMP = 9223372036854775807n;

function unixTimestampIso(value: bigint | null | undefined): string | null {
  if (
    value === null ||
    value === undefined ||
    value === MISSING_UNIX_TIMESTAMP
  ) {
    return null;
  }
  const seconds = Number(value);
  if (!Number.isSafeInteger(seconds) || seconds <= 0) return null;
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * P2b change: wrap external HTTP calls (geocoding + forecast) with
 * `WeatherHttpAdapter.executeWithCircuitBreaker` so requests gain timeout,
 * retries, and circuit-breaker protection. This is an internal resiliency
 * change and does not alter any controller routes or DTOs.
 */

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private readonly CACHE_MIN = 10;
  private readonly STALE_FALLBACK_MIN = 60;

  constructor(
    private prisma: PrismaService,
    private weatherAdapter: WeatherHttpAdapter,
  ) {}

  async getTodayWeather(city: string) {
    const now = new Date();

    const cached = await this.prisma.weatherCache.findFirst({
      where: { city },
      orderBy: { fetchedAt: 'desc' },
    });

    if (
      cached &&
      now.getTime() - cached.fetchedAt.getTime() < this.CACHE_MIN * 60 * 1000
    ) {
      return cached;
    }

    const weather = await this.fetchOpenMeteo(city);

    if (!weather) {
      const cacheAgeMs = cached
        ? now.getTime() - cached.fetchedAt.getTime()
        : Number.POSITIVE_INFINITY;
      if (cached && cacheAgeMs <= this.STALE_FALLBACK_MIN * 60 * 1000) {
        this.logger.warn(
          `Open-Meteo refresh failed; using cached weather for ${city}`,
        );
        return cached;
      }
      throw new Error(`Failed to fetch Open-Meteo data for ${city}`);
    }

    const data = {
      city,
      ...weather,
      fetchedAt: new Date(),
    };
    if (cached) {
      return this.prisma.weatherCache.update({
        where: { id: cached.id },
        data,
      });
    }
    return this.prisma.weatherCache.create({ data });
  }

  /**
   * Open-Meteo fetch + mapping
   */
  private async fetchOpenMeteo(city: string) {
    try {
      /* =======================
         1) Geocoding
      ======================= */
      // Use adapter to wrap the geocoding request for timeouts / CB.
      const geoRes: any = await this.weatherAdapter.executeWithCircuitBreaker(
        async () =>
          fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
              city,
            )}&count=1`,
          ).then((r) => r.json()),
      );

      if (!geoRes?.results?.length) {
        this.logger.warn(`Open-Meteo geocoding failed for ${city}`);
        return null;
      }

      const { latitude, longitude } = geoRes.results[0];

      /* =======================
         2) Forecast API
      ======================= */
      // Wrap the forecast call with the adapter's circuit breaker and timeout
      // protection. We call the original helper (`fetchWeatherApi`) but ensure
      // the execution is subject to adapter-level policies.
      const responses = await this.weatherAdapter.executeWithCircuitBreaker(
        () =>
          fetchOpenMeteoFlatbuffers('https://api.open-meteo.com/v1/forecast', {
            latitude,
            longitude,
            timezone: 'Europe/Sarajevo',
            forecast_days: 1,

            current: [
              'temperature_2m',
              'relative_humidity_2m',
              'weather_code',
              'is_day',
            ],

            hourly: [
              'temperature_2m',
              'apparent_temperature',
              'cloud_cover',
              'pressure_msl',
              'relative_humidity_2m',
              'wind_speed_10m',
              'wind_gusts_10m',
              'wind_direction_10m',
              'uv_index',
              'rain',
              'snowfall',
            ],

            daily: [
              'temperature_2m_max',
              'temperature_2m_min',
              'sunrise',
              'sunset',
            ],
          }),
      );

      const response = responses[0];
      if (!response) {
        this.logger.error('Open-Meteo response is empty');
        return null;
      }
      const utcOffset = response.utcOffsetSeconds();

      const current = response.current();
      const hourly = response.hourly();
      const daily = response.daily();

      if (!current || !hourly || !daily) {
        this.logger.error(
          `Open-Meteo response missing required blocks: current=${Boolean(
            current,
          )}, hourly=${Boolean(hourly)}, daily=${Boolean(daily)}`,
        );
        return null;
      }

      /* =======================
         Helpers
      ======================= */
      const hVar = (idx: number) => hourly.variables(idx)?.valuesArray() ?? [];

      const dVar = (idx: number) => daily.variables(idx)?.valuesArray() ?? [];

      const toArray = (v: readonly number[] | Float32Array) =>
        Array.from(v ?? []);

      /* =======================
         3) Hourly time array
      ======================= */
      const hourlyStart = Number(hourly.time());
      const interval = hourly.interval();
      const hourlyTimes = Array.from(
        {
          length: (Number(hourly.timeEnd()) - hourlyStart) / interval,
        },
        (_, i) => hourlyStart + i * interval,
      );
      const currentIndex = Math.floor(
        (Number(current.time()) - hourlyStart) / interval,
      );
      const hasCurrentSample =
        Number.isInteger(currentIndex) &&
        currentIndex >= 0 &&
        currentIndex < hourlyTimes.length;
      const hCurrent = (idx: number) =>
        hasCurrentSample ? hVar(idx)[currentIndex] : undefined;

      const temps = hVar(0);

      const avgTemps = hourlyTimes
        .map((time, i) => ({
          hour: new Date((time + utcOffset) * 1000).getUTCHours(),
          temp: temps[i],
        }))
        .filter((x) => x.temp !== undefined)
        .filter((x) => x.hour >= 6 && x.hour <= 15)
        .map((x) => x.temp);

      const temp_avg =
        avgTemps.length > 0
          ? avgTemps.reduce((a, b) => a + b, 0) / avgTemps.length
          : (current.variables(0)?.value() ?? 0);

      /* =======================
         4) Mapping → DB
      ======================= */
      return {
        temperature: current.variables(0)?.value() ?? 0,
        feelslike: hCurrent(1) ?? current.variables(0)?.value() ?? 0,

        temp_min: dVar(1)[0] ?? 0,
        temp_max: dVar(0)[0] ?? 0,
        temp_avg,

        wind_kph: hCurrent(5) ?? 0,
        gust_kph: hCurrent(6) ?? 0,
        wind_dir: `${hCurrent(7) ?? 0}°`,

        pressure_mb: hCurrent(3) ?? 0,
        humidity: current.variables(1)?.value() ?? 0,
        cloud: hCurrent(2) ?? 0,

        uv_index: Math.max(...toArray(hVar(8)), 0),
        precipitation_mm: toArray(hVar(9)).reduce((a, b) => a + b, 0),
        snow_cm: toArray(hVar(10)).reduce((a, b) => a + b, 0),

        condition_text: `WMO_${current.variables(2)?.value() ?? 0}`,

        sunrise: unixTimestampIso(daily.variables(2)?.valuesInt64(0)),
        sunset: unixTimestampIso(daily.variables(3)?.valuesInt64(0)),

        moonrise: '',
        moonset: '',
        moon_phase: '',
        moon_illumination: null,
      };
    } catch (e) {
      this.logger.error(`Open-Meteo failed: ${e.message}`);
      return null;
    }
  }
}
