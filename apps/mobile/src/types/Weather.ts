export interface TodayWeather {
  temp: number;
  feelsLike: number;
  condition: string; // e.g., "Sunny", "Cloudy", "Rainy"
  humidity: number; // 0-100
  windSpeed: number;
  windDirection: string;
  pressure: number;
  uvIndex: number;
  sunrise: string; // ISO datetime
  sunset: string; // ISO datetime
}
