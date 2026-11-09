import type { RecommendationBreakdownData } from '../heating/components/RecommendationBreakdown';

export interface Weather {
  temp?: number;
  feelsLike?: number;
  condition?: string;
  humidity?: number;
  windSpeed?: number;
  tempMin?: number;
  tempMax?: number;
  temperature?: number;
  feelslike?: number;
  condition_text?: string;
  wind_kph?: number;
  temp_min?: number;
  temp_max?: number;
}

export interface Boiler {
  externalTemp: number;
  suggestedFlowTemp: number;
  actualFlowTemp: number | null;
}

export interface Recommendation {
  recommendedFlowTemp: number;
  expectedHeatTimeMin?: number;
  confidenceScore?: number;
  breakdown?: RecommendationBreakdownData | null;
}

export interface ThermostatProgram {
  dayType: string;
  startMinute: number;
  targetTemp: number;
  orderIndex: number;
}

export interface HeatingEvent {
  id: number;
  startedAt: string;
  endedAt: string | null;
  targetTemp: number;
  currentTemp: number;
  durationMinutes: number;
  hvacAction?: string;
  isAnomaly: boolean;
}

export interface HeatingEventRow extends HeatingEvent {
  bucketLabel: string;
}

export interface Thermostat {
  alias: string;
  /** `null` = termostat nije poslao temperaturu; nije isto što i 0 °C. */
  currentTemp: number | null;
  targetTemp: number | null;
  mode: string;
  /** Zadnje javljanje uređaja; `null` = nikad (ili polje nije poslano). */
  lastSeen?: string | null;
  program: ThermostatProgram[];
}

export interface Home {
  profile: { id?: number; floorArea: number };
  thermostats: Thermostat[];
  recentHeatingEvents: HeatingEvent[];
}

export interface DashboardResponse {
  capabilities: unknown;
  system: {
    weather: Weather;
    boiler: Boiler;
    recommendation: Recommendation;
  };
  homes: Home[];
}

export interface ProcessedDashboard {
  anomalyCount: number;
  anomalyRate: number;
  /** `null` = nema mjerenja. Nikad 0 kao zamjena za „nema podataka". */
  currentTemp: number | null;
  targetTemp: number | null;
  /** Zadnje javljanje termostata; `null` = nema podataka o svježini. */
  lastSeen: string | null;
  recentEvents: HeatingEvent[];
  boiler: Boiler;
  weather: Weather;
  thermostatPrograms: ThermostatProgram[];
  recommendation: Recommendation | null;
}

export interface HeatingBucket {
  label: string;
  totalDurationMin: number;
  cycles: number;
}

export interface HeatingSummaryResponse {
  summary: {
    totalCycles: number;
    totalDurationMin: number;
    avgDurationMin: number;
    avgIndoorTemp: number;
  };
  buckets: HeatingBucket[];
}

export interface WeatherDisplay {
  outsideTemp: number | null;
  feelsLike: number | null;
  condition: string | null;
  humidity: number | null;
  windSpeed: number | null;
  tempMin: number | null;
  tempMax: number | null;
}
