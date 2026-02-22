import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { fetchWeatherApi } from 'openmeteo';
import { WeatherHttpAdapter } from './weather-http.adapter';

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

    // If cache exists but is stale, delete it. If no cache, continue.
    if (cached) {
      await this.prisma.weatherCache.delete({
        where: { id: cached.id },
      });
    }

    const weather = await this.fetchOpenMeteo(city);

    if (!weather) {
      throw new Error(`Failed to fetch Open-Meteo data for ${city}`);
    }

    return this.prisma.weatherCache.create({
      data: {
        city,
        ...weather,
        fetchedAt: new Date(),
      },
    });
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
          fetchWeatherApi('https://api.open-meteo.com/v1/forecast', {
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
      const utcOffset = response.utcOffsetSeconds();

      const current = response.current();
      const hourly = response.hourly();
      const daily = response.daily();

      if (!current || !hourly || !daily) {
        this.logger.error('Open-Meteo response missing required blocks');
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
      const times = Array.from(
        {
          length:
            (Number(hourly.timeEnd()) - Number(hourly.time())) /
            hourly.interval(),
        },
        (_, i) =>
          new Date(
            (Number(hourly.time()) + i * hourly.interval() + utcOffset) * 1000,
          ),
      );

      const temps = hVar(0);

      const avgTemps = times
        .map((t, i) => ({ hour: t.getHours(), temp: temps[i] }))
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
        feelslike:
          hVar(1)[
            times.findIndex((t) => t.getHours() === new Date().getHours())
          ] ??
          current.variables(0)?.value() ??
          0,

        temp_min: dVar(1)[0] ?? 0,
        temp_max: dVar(0)[0] ?? 0,
        temp_avg,

        wind_kph: hVar(5).at(-1) ?? 0,
        gust_kph: hVar(6).at(-1) ?? 0,
        wind_dir: `${hVar(7).at(-1) ?? 0}°`,

        pressure_mb: hVar(3).at(-1) ?? 0,
        humidity: current.variables(1)?.value() ?? 0,
        cloud: hVar(2).at(-1) ?? 0,

        uv_index: Math.max(...toArray(hVar(8)), 0),
        precipitation_mm: toArray(hVar(9)).reduce((a, b) => a + b, 0),
        snow_cm: toArray(hVar(10)).reduce((a, b) => a + b, 0),

        condition_text: `WMO_${current.variables(2)?.value() ?? 0}`,

        sunrise: new Date(
          (Number(daily.variables(2)?.valuesInt64(0) ?? 0) + utcOffset) * 1000,
        ).toISOString(),

        sunset: new Date(
          (Number(daily.variables(3)?.valuesInt64(0) ?? 0) + utcOffset) * 1000,
        ).toISOString(),

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
