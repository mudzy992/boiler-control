import { DayType } from 'src/generated/prisma';

export interface ThermostatSnapshot {
  currentTemp: number; // trenutna temperatura
  targetTemp: number; // zadana temperatura
  timestamp: Date; // kada je snapshot snimljen
  powerOn: boolean;
  externalTempMin?: number;
  externalTempMax?: number;
  dayType?: DayType;
  activeInterval?: {
    startMinute: number;
    targetTemp: number;
    orderIndex: number;
  };
}

export interface IThermostatAdapter {
  getCurrentTemperature(deviceId: string): Promise<number>;
  getTargetTemperature(deviceId: string): Promise<number>;
  fetchSnapshot(
    deviceId: string,
    runId?: string,
  ): Promise<ThermostatSnapshot | null>;
}
