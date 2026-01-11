import api from "./api";

/* =========================
   Types
========================= */

export interface DashboardResponse {
  system: {
    weather: any;
    recommendation: any;
    boiler: any;
  };
  homes: HomeDashboard[];
}

export interface HomeDashboard {
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
  thermostats: {
    id: number;
    alias: string;
    vendor: string;
    deviceId: string;
    mode: string;
    lastSeen: string;
    program: {
      dayType: string;
      startMinute: number;
      targetTemp: number;
      orderIndex: number;
    }[];
  }[];
  learningIntervals: {
    intervalKey: string;
    avgReachTimeMin: number;
    avgOvershoot: number;
    offset: number;
    confidence: number;
    samples: number;
    lastUpdated: string;
  }[];
  recentHeatingEvents: any[];
  systemStatus: {
    lastSuggestedFlowTemp: number | null;
    lastActualFlowTemp: number | null;
    lastExternalTemp: number | null;
  };
  insights: {
    hasEnoughLearningData: boolean;
    averageConfidence: number;
  };
}

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

/* =========================
   API
========================= */

export const getDashboard = async (): Promise<DashboardResponse> => {
  const { data } = await api.get("/dashboard");
  return data;
};

export const getHeatingEvents = async (params: {
  homeProfileId: number;
  from: string;
  to: string;
}) => {
  const { data } = await api.get("/dashboard/heating-events", { params });
  return data;
};

export const getHeatingStats = async (params: {
  homeProfileId: number;
  from: string;
  to: string;
  bucket: "hour" | "day";
}) => {
  const { data } = await api.get("/dashboard/heating-stats", { params });
  return data;
};

export const getLearningTrends = async (params: {
  homeProfileId: number;
  from: string;
  to: string;
}) => {
  const { data } = await api.get("/dashboard/learning-trends", { params });
  return data;
};
