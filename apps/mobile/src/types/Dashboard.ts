// Dashboard data types
export interface DashboardCapabilities {
  hasProfile: boolean;
  hasThermostat: boolean;
  hasLearning: boolean;
}

export interface ThermostatProgram {
  dayType: string;
  startMinute: number;
  targetTemp: number;
  orderIndex: number;
}

export interface ThermostatDevice {
  id: number;
  alias: string;
  vendor: string;
  deviceId: string;
  mode: string; // PROGRAM, MANUAL, OFF
  lastSeen: string;
  currentTemp?: number | null;
  targetTemp?: number | null;
  isHeatingNow?: boolean;
  program: ThermostatProgram[];
}

export interface RecentHeatingEvent {
  deviceId: number;
  startedAt: string;
  endedAt: string | null;
  targetTemp: number;
  currentTemp: number;
  hvacAction: string; // HEATING_ON, HEATING_OFF
  isAnomaly?: boolean;
}

export interface LearningInterval {
  intervalKey: string;
  offset: number;
  confidence: number;
  samples: number;
  lastUpdated: string;
}

export interface HomeProfile {
  id: number;
  floorArea: number;
  ceilingHeight: number;
  insulationType: string;
  windowType: string;
  heatingType: string;
}

export interface HomeDashboard {
  profile: HomeProfile;
  thermostats: ThermostatDevice[];
  learningIntervals: LearningInterval[];
  recentHeatingEvents: RecentHeatingEvent[];
}

export interface BoilerData {
  externalTemp: number;
  suggestedFlowTemp: number;
  actualFlowTemp: number;
  heatingStart: string | null;
  heatingEnd: string | null;
}

export interface Recommendation {
  date: string;
  recommendedFlowTemp: number;
  confidenceScore: number;
}

export interface SystemDashboard {
  weather: any; // Weather type will be defined separately
  boiler?: BoilerData | null;
  recommendation?: Recommendation | null;
}

export interface DashboardResponse {
  capabilities: DashboardCapabilities;
  system: SystemDashboard;
  homes: HomeDashboard[];
}

// Statistics
export interface HeatingEventRow {
  deviceId: number;
  startedAt: string;
  endedAt: string | null;
  currentTemp: number;
  targetTemp: number;
  hvacAction: string;
  source: string;
  durationMinutes: number;
}

export interface HeatingStatsBucket {
  label: string;
  avgTargetTemp: number;
  avgCurrentTemp: number;
  totalDurationMin: number;
  cycles: number;
}
