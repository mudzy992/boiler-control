import api from "./api";

/* =========================
   Types
========================= */

export interface DashboardCapabilities {
  hasProfile: boolean;
  hasThermostat: boolean;
  hasLearning: boolean;
}

export interface SystemDashboard {
  weather: any;
  boiler?: {
    externalTemp: number;
    suggestedTemp: number;
    actualTemp: number;
    heatingStart: string | null;
    heatingEnd: string | null;
  } | null;
  recommendation?: any | null;
}

export interface HomeDashboard {
  profile: {
    id: number;
    floorArea: number;
    ceilingHeight: number;
    insulationType: string;
    windowType: string;
    heatingType: string;
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
    offset: number;
    confidence: number;
    samples: number;
    lastUpdated: string;
  }[];

  recentHeatingEvents: {
    deviceId: number;
    startedAt: string;
    endedAt: string | null;
    targetTemp: number;
    currentTemp: number;
    hvacAction: string;
  }[];
}

export interface DashboardResponse {
  capabilities: DashboardCapabilities;
  system: SystemDashboard;
  homes: HomeDashboard[];
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
