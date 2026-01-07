export interface TodayWeather {
  id: number;
  city: string;
  temperature: number;     // trenutna temperatura
  feelslike: number;
  temp_min: number;
  temp_max: number;
  temp_avg: number;
  wind_kph: number;
  gust_kph: number;
  wind_dir: string;
  pressure_mb: number;
  humidity: number;
  cloud: number;
  uv_index: number;
  precipitation_mm: number;
  snow_cm: number;
  condition_text: string;
  sunrise: string;
  sunset: string;
  moonrise: string;
  moonset: string;
  moon_phase: string;
  moon_illumination: number;
  fetchedAt: string;
}
