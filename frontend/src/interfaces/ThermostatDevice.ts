export const DayType = {
  WORKDAY: "WORKDAY",
  SATURDAY: "SATURDAY",
  SUNDAY: "SUNDAY",
} as const;

export type DayType = typeof DayType[keyof typeof DayType];

export interface ThermostatProgram {
  id: number;
  deviceId: number;
  dayType: DayType;
  startMinute: number; // e.g., 6:30 = 390
  targetTemp: number;
  orderIndex: number; // 0..5
  programHash?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ThermostatDevice {
  id: number;
  userId: number;
  homeProfileId: number;
  tuyaDeviceId: string;
  name: string;
  currentTemp: number | null;
  lastUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  homeProfile?: {
    id: number;
    name: string;
    city: string;
  };
  programs?: ThermostatProgram[];
}

export interface UpdateThermostatDevice {
  name?: string;
  homeProfileId?: number;
}
