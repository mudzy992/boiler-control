export interface ThermostatSnapshot {
  currentTemp: number; // trenutna temperatura
  targetTemp: number; // zadana temperatura
  heatingOn: boolean; // da li trenutno grijanje radi
  timestamp: Date; // kada je snapshot snimljen
}

export interface IThermostatAdapter {
  getCurrentTemperature(deviceId: string): Promise<number>;
  getTargetTemperature(deviceId: string): Promise<number>;
  isHeatingOn(deviceId: string): Promise<boolean>;
  fetchSnapshot(deviceId: string): Promise<ThermostatSnapshot>;
}
