// Dashboard data types
export interface DashboardCapabilities {
  hasProfile: boolean;
  hasThermostat: boolean;
  hasLearning: boolean;
}

export interface ThermostatProgram {
  dayType: string;
  startMinute: number;
  /** Cilj **sobe** za taj interval (`32`). */
  roomTargetTemp: number;
  orderIndex: number;
}

export interface ThermostatDevice {
  id: number;
  alias: string;
  vendor: string;
  deviceId: string;
  mode: string; // PROGRAM, MANUAL, OFF
  lastSeen: string;
  /** Soba, trenutno (`32`). `null` = termostat nije poslao — nije 0 °C. */
  roomCurrentTemp?: number | null;
  /** Cilj sobe (`32`). */
  roomTargetTemp?: number | null;
  isHeatingNow?: boolean;
  program: ThermostatProgram[];
}

export interface RecentHeatingEvent {
  deviceId: number;
  startedAt: string;
  endedAt: string | null;
  roomTargetTemp: number;
  roomCurrentTemp: number;
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
  actualFlowTemp: number | null;
  heatingStart: string | null;
  heatingEnd: string | null;
}

// MO2-15: additive backend snapshot from FE2-10. Older rows may omit it or
// send null; the client must not reconstruct the formula.
export interface RecommendationAppliedOffsets {
  home: number;
  interval: number;
  events: number;
}

export interface RecommendationBreakdown {
  version: number;
  mode: 'FULL' | 'PROFILE_ONLY' | 'ANONYMOUS';
  intervalKey: string | null;
  baseCurveTemp: number;
  weightedExternalTemp: number;
  appliedOffsets: RecommendationAppliedOffsets;
  finalTemp: number;
  confidence: number;
  samples: number | null;
  expectedHeatTimeMin: number | null;
}

export interface Recommendation {
  date: string;
  recommendedFlowTemp: number;
  confidenceScore: number;
  breakdown?: RecommendationBreakdown | null;
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

// MO2-12: health score and warnings come from GET /api/dashboard/health.
export type HealthComponentKey =
  | 'learningConfidence'
  | 'flowDelta'
  | 'thermostatFreshness'
  | 'anomalyRate';

export interface HealthComponent {
  key: HealthComponentKey;
  score: number;
  weight: number;
}

export type HealthWarningType =
  | 'shortCycles'
  | 'longCycles'
  | 'targetShortfall'
  | 'targetOvershoot'
  | 'anomalies';

export type HealthWarningLevel = 'info' | 'warning' | 'error';

export interface HealthWarning {
  type: HealthWarningType;
  level: HealthWarningLevel;
  message: string;
}

export interface DashboardHealthResponse {
  score: number;
  learningConfidence: number;
  components: HealthComponent[];
  warnings: HealthWarning[];
  computedAt: string;
}
