import api from "./api";

/**
 * Tipovi koji odgovaraju novom backendu
 */
export interface DashboardSystem {
  weather?: any;
  recommendation?: {
    date: string;
    recommendedFlowTemp: number;
    confidenceScore: number;
  } | null;
  boiler?: {
    externalTemp: number;
    suggestedTemp: number;
    actualTemp?: number;
    heatingStart?: string;
    heatingEnd?: string;
  } | null;
}

export interface DashboardThermostat {
  id: number;
  alias?: string;
  vendor: string;
  deviceId: string;
  mode: string;
  lastSeen?: string;
}

export interface DashboardLearningInterval {
  intervalKey: string;
  avgReachTimeMin: number;
  avgOvershoot: number;
  offset: number;
  confidence: number;
  samples: number;
  lastUpdated: string;
}

export interface DashboardHeatingEvent {
  deviceId: number;
  startedAt: string;
  endedAt?: string;
  currentTemp: number;
  targetTemp: number;
  hvacAction: string;
  source: string;
}

export interface DashboardInsights {
  hasEnoughLearningData: boolean;
  averageConfidence: number;
}

export interface DashboardHome {
  profile: {
    id: number;
    floorArea: number;
    ceilingHeight: number;
    insulationType: string;
    windowType: string;
    heatingType: string;
    learningOffset: number;
    learningConfidence: number;
  };
  thermostats: DashboardThermostat[];
  learningIntervals: DashboardLearningInterval[];
  recentHeatingEvents: DashboardHeatingEvent[];
  systemStatus: {
    lastSuggestedFlowTemp?: number | null;
    lastActualFlowTemp?: number | null;
    lastExternalTemp?: number | null;
    lastHeatingStart?: string | null;
    lastHeatingEnd?: string | null;
  };
  insights: DashboardInsights;
}

export interface DashboardResponse {
  system: DashboardSystem;
  homes: DashboardHome[];
}

/**
 * Dohvati kompletan dashboard
 */
export const getDashboard = async (): Promise<DashboardResponse> => {
  const { data } = await api.get<DashboardResponse>("/dashboard");
  return data;
};

/**
 * Dohvati samo današnji events i preporuke
 */
export const getDashboardToday = async (): Promise<DashboardResponse> => {
  const dashboard = await getDashboard();
  const today = new Date().toISOString().split("T")[0];

  return {
    system: dashboard.system,
    homes: dashboard.homes.map((home) => ({
      ...home,
      recentHeatingEvents: home.recentHeatingEvents.filter((e) =>
        e.startedAt.startsWith(today)
      ),
      learningIntervals: home.learningIntervals, // optional: filtrirati po datumu ako želiš
    })),
  };
};
