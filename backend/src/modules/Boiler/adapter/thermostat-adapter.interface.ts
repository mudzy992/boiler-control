export interface ThermostatSnapshot {
  currentTemp: number; // trenutna temperatura
  targetTemp: number; // zadana temperatura
  timestamp: Date; // kada je snapshot snimljen
  powerOn: boolean;
}

export interface IThermostatAdapter {
  getCurrentTemperature(deviceId: string): Promise<number>;
  getTargetTemperature(deviceId: string): Promise<number>;
  fetchSnapshot(deviceId: string): Promise<ThermostatSnapshot>;
}
