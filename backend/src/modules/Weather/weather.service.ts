import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WeatherService {
  constructor(private prisma: PrismaService) {}

  async getTodayWeather(city: string) {
    const cached = await this.prisma.weatherCache.findFirst({
      where: { city },
      orderBy: { fetchedAt: 'desc' },
    });

    const now = new Date();
    if (cached && now.getTime() - cached.fetchedAt.getTime() < 10 * 60 * 1000) {
      return cached;
    }

    try {
      const apiKey = process.env.WEATHER_API_KEY!;
      const { data } = await axios.get(
        'https://api.weatherapi.com/v1/forecast.json',
        {
          params: {
            key: apiKey,
            q: city,
            days: 1,
            aqi: 'no',
            alerts: 'no',
          },
        },
      );

      const current = data.current;
      const today = data.forecast.forecastday[0];
      const hours = today.hour;

      const avg = (arr: any[]) =>
        arr.reduce((s, h) => s + h.temp_c, 0) / arr.length;

      const mornTemp = avg(
        hours.filter((h: any) => {
          const hr = new Date(h.time).getHours();
          return hr >= 6 && hr <= 9;
        }),
      );

      const dayTemp = avg(
        hours.filter((h: any) => {
          const hr = new Date(h.time).getHours();
          return hr >= 12 && hr <= 15;
        }),
      );

      // Energetski relevantna temperatura
      const tempAvg = mornTemp * 0.65 + dayTemp * 0.35;

      return await this.prisma.weatherCache.create({
        data: {
          city,
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
          moon_illumination: today.astro.moon_illumination,
        },
      });
    } catch (e) {
      throw new HttpException('Weather fetch failed', HttpStatus.BAD_GATEWAY);
    }
  }
}
