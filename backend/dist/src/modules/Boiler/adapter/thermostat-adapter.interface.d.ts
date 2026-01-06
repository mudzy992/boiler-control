export interface ThermostatSnapshot {
    currentTemp: number;
    targetTemp: number;
    heatingOn: boolean;
    timestamp: Date;
}
export interface IThermostatAdapter {
    getCurrentTemperature(deviceId: string): Promise<number>;
    getTargetTemperature(deviceId: string): Promise<number>;
    isHeatingOn(deviceId: string): Promise<boolean>;
    fetchSnapshot(deviceId: string): Promise<ThermostatSnapshot>;
}
