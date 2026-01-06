import { PrismaService } from '../../prisma/prisma.service';
export declare class WeatherService {
    private prisma;
    constructor(prisma: PrismaService);
    getTodayWeather(city: string): Promise<{
        id: number;
        city: string;
        temperature: number;
        feelslike: number | null;
        temp_min: number | null;
        temp_max: number | null;
        temp_avg: number | null;
        wind_kph: number | null;
        gust_kph: number | null;
        wind_dir: string | null;
        pressure_mb: number | null;
        humidity: number | null;
        cloud: number | null;
        uv_index: number | null;
        precipitation_mm: number | null;
        snow_cm: number | null;
        condition_text: string | null;
        sunrise: string | null;
        sunset: string | null;
        moonrise: string | null;
        moonset: string | null;
        moon_phase: string | null;
        moon_illumination: number | null;
        fetchedAt: Date;
    }>;
}
