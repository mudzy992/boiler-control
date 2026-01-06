import { TuyaAuthService } from '../../../modules/Tuya/tuya.auth.service';
import { ThermostatSnapshot } from './thermostat-adapter.interface';
export declare class TuyaAdapter {
    private readonly tokenService;
    private readonly baseUrl;
    constructor(tokenService: TuyaAuthService);
    private generateHeaders;
    getDeviceStatus(deviceId: string): Promise<Record<string, any>>;
    getCurrentTemperature(deviceId: string): Promise<number>;
    getTargetTemperature(deviceId: string): Promise<number>;
    isHeatingOn(deviceId: string): Promise<boolean>;
    fetchSnapshot(deviceId: string): Promise<ThermostatSnapshot>;
}
