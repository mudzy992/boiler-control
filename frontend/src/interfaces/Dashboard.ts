export interface ThermostatDevice {
  id: number;
  alias: string;
  mode: string;          // PROGRAM, MANUAL, OFF
  deviceId: string;
  vendor: string;
  lastSeen: string;
}

export interface RecentHeatingEvent {
  deviceId: number;
  timestampStart: string;
  timestampEnd: string;
  currentTemp: number;
  targetTemp: number;
  hvacAction: "HEATING_ON" | "HEATING_OFF";
  source: string; // npr. "THERMOSTAT"
}

export interface DashboardRecommendation {
  date: string;
  recommendedFlowTemp: number;
  confidenceScore: number;
}

export interface HomeProfileDashboard {
  id: number;
  floorArea: number;
  ceilingHeight: number;
  insulationType: string;
  windowType: string;
  heatingType: string;
  learningOffset: number;
  learningConfidence: number;
  thermostatDevices: ThermostatDevice[];
  intervalLearnings: any[]; // kasnije možemo tipizirati
  recentHeatingEvents: RecentHeatingEvent[];
  recommendations: DashboardRecommendation[];
}
