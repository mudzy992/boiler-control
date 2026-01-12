import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private readonly CACHE_MIN = 10; // minuta

  constructor(private prisma: PrismaService) {}

  /**
   * Glavna metoda za dohvat danasnje temperature
   */
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

    // --- Prvi pokušaj: WeatherAPI ---
    let weather = await this.fetchWeatherAPI(city);

    // --- Provjera realnosti min/max ---
    if (weather && (weather.temp_min < -20 || weather.temp_max > 15)) {
      this.logger.warn(
        `WeatherAPI gave unrealistic temperatures for ${city}. Trying Open-Meteo fallback.`,
      );
      const fallback = await this.fetchOpenMeteo(city);
      if (fallback) weather = fallback;
    }

    if (!weather) {
      throw new Error(`Failed to fetch weather data for ${city}`);
    }

    return await this.prisma.weatherCache.create({
      data: { city, ...weather, fetchedAt: new Date() },
    });
  }

  /**
   * WeatherAPI.com
   */
  private async fetchWeatherAPI(city: string) {
    try {
      const apiKey = process.env.WEATHER_API_KEY!;
      const { data } = await axios.get(
        'https://api.weatherapi.com/v1/forecast.json',
        {
          params: { key: apiKey, q: city, days: 1, aqi: 'no', alerts: 'no' },
        },
      );

      const current = data.current;
      const today = data.forecast.forecastday[0];
      const hours = today.hour;

      const avg = (arr: any[]) =>
        arr.reduce((s, h) => s + h.temp_c, 0) / arr.length;

      const mornTemp = avg(
        hours.filter((h) => {
          const hr = new Date(h.time).getHours();
          return hr >= 6 && hr <= 9;
        }),
      );

      const dayTemp = avg(
        hours.filter((h) => {
          const hr = new Date(h.time).getHours();
          return hr >= 12 && hr <= 15;
        }),
      );

      const tempAvg = mornTemp * 0.65 + dayTemp * 0.35;

      return {
        temperature: current.temp_c,
        feelslike: current.feelslike_c,
        temp_min: today.day.mintemp_c,
        temp_max: today.day.maxtemp_c,
        temp_avg: tempAvg,
        wind_kph: current.wind_kph,
        gust_kph: current.gust_kph,
        wind_dir: current.wind_dir,
        pressure_mb: current.pressure_mb,
        humidity: current.humidity,
        cloud: current.cloud,
        uv_index: current.uv,
        precipitation_mm: today.day.totalprecip_mm,
        snow_cm: today.day.totalsnow_cm,
        condition_text: current.condition.text,
        sunrise: today.astro.sunrise,
        sunset: today.astro.sunset,
        moonrise: today.astro.moonrise,
        moonset: today.astro.moonset,
        moon_phase: today.astro.moon_phase,
        moon_illumination: today.astro.moon_illumination
          ? parseInt(today.astro.moon_illumination, 10)
          : null,
      };
    } catch (e) {
      this.logger.error(`WeatherAPI fetch failed: ${e.message}`);
      return null;
    }
  }

  /**
   * Open-Meteo.com fallback
   */
  private async fetchOpenMeteo(city: string) {
    try {
      // Pretpostavimo da imamo lokaciju preko grada
      const { data: geo } = await axios.get(
        `https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1`,
      );
      if (!geo.results?.length) return null;

      const { latitude, longitude } = geo.results[0];
      const { data } = await axios.get(
        'https://api.open-meteo.com/v1/forecast',
        {
          params: {
            latitude,
            longitude,
            hourly: 'temperature_2m',
            daily: 'temperature_2m_max,temperature_2m_min',
            timezone: 'Europe/Sarajevo',
          },
        },
      );

      const todayHourly = data.hourly.temperature_2m.slice(6, 16); // 6–15h
      const tempAvg =
        todayHourly.reduce((a, b) => a + b, 0) / todayHourly.length;

      return {
        temperature: tempAvg,
        feelslike: tempAvg,
        temp_min: data.daily.temperature_2m_min[0],
        temp_max: data.daily.temperature_2m_max[0],
        temp_avg: tempAvg,
        wind_kph: 0,
        gust_kph: 0,
        wind_dir: '',
        pressure_mb: 0,
        humidity: 0,
        cloud: 0,
        uv_index: 0,
        precipitation_mm: 0,
        snow_cm: 0,
        condition_text: 'Clear',
        sunrise: '',
        sunset: '',
        moonrise: '',
        moonset: '',
        moon_phase: '',
        moon_illumination: null,
      };
    } catch (e) {
      this.logger.error(`Open-Meteo fetch failed: ${e.message}`);
      return null;
    }
  }
}
