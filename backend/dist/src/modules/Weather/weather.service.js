"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeatherService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const prisma_service_1 = require("../../prisma/prisma.service");
let WeatherService = class WeatherService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getTodayWeather(city) {
        const cached = await this.prisma.weatherCache.findFirst({
            where: { city },
            orderBy: { fetchedAt: 'desc' },
        });
        const now = new Date();
        if (cached && now.getTime() - cached.fetchedAt.getTime() < 10 * 60 * 1000) {
            return cached;
        }
        try {
            const apiKey = process.env.WEATHER_API_KEY;
            const { data } = await axios_1.default.get('https://api.weatherapi.com/v1/forecast.json', {
                params: {
                    key: apiKey,
                    q: city,
                    days: 1,
                    aqi: 'no',
                    alerts: 'no',
                },
            });
            const current = data.current;
            const today = data.forecast.forecastday[0];
            const hours = today.hour;
            const avg = (arr) => arr.reduce((s, h) => s + h.temp_c, 0) / arr.length;
            const mornTemp = avg(hours.filter((h) => {
                const hr = new Date(h.time).getHours();
                return hr >= 6 && hr <= 9;
            }));
            const dayTemp = avg(hours.filter((h) => {
                const hr = new Date(h.time).getHours();
                return hr >= 12 && hr <= 15;
            }));
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
        }
        catch (e) {
            throw new common_1.HttpException('Weather fetch failed', common_1.HttpStatus.BAD_GATEWAY);
        }
    }
};
exports.WeatherService = WeatherService;
exports.WeatherService = WeatherService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], WeatherService);
//# sourceMappingURL=weather.service.js.map