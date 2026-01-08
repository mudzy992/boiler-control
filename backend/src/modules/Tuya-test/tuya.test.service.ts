// src/modules/tuya-test/tuya-test.service.ts
import { Injectable } from '@nestjs/common';
import { TuyaAdapter } from '../Boiler/adapter/tuya.adapter';
import { Buffer } from 'buffer';
import { ThermostatSnapshot } from '../Boiler/adapter/thermostat-adapter.interface';

@Injectable()
export class TuyaTestService {
  constructor(private readonly tuyaAdapter: TuyaAdapter) {}

  async getRawDeviceStatus(deviceId: string) {
    const status = await this.tuyaAdapter.getDeviceStatus(deviceId);
    const targetTemp = this.getCurrentProgramTemp(status.program);
    return { status: status, targetTemp: targetTemp };
  }

  /**
   * Dekodira Tuya program
   * Format: [minute, hour, temp*2] x 6 intervala po danu
   */
  private parseProgram(programB64: string) {
    const buf = Buffer.from(programB64, 'base64');
    const intervals: Array<{ startMinute: number; temp: number }> = [];

    for (let i = 0; i + 2 < buf.length; i += 3) {
      const minute = buf[i];
      const hour = buf[i + 1];
      const temp = buf[i + 2] / 2; // Tuya skalira temperaturu x2
      const startMinute = hour * 60 + minute;
      intervals.push({ startMinute, temp });
    }

    return intervals;
  }

  /**
   * Dobija aktivnu temperaturu iz programa po trenutnom vremenu i danu
   */
  private getCurrentProgramTemp(programB64: string): number {
    const intervals = this.parseProgram(programB64);

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Dan u sedmici: 0 = Sunday, 1 = Monday ... 6 = Saturday
    const dayOfWeek = now.getDay();

    // Svaki dan ima 6 intervala
    const startIndex = dayOfWeek === 0 ? 12 : dayOfWeek === 6 ? 6 : 0;
    const dayIntervals = intervals.slice(startIndex, startIndex + 6);

    // Default na prvu temp
    let activeTemp = dayIntervals[0].temp;

    for (const interval of dayIntervals) {
      if (currentMinutes >= interval.startMinute) {
        activeTemp = interval.temp;
      } else {
        break;
      }
    }

    return activeTemp;
  }

  /**
   * Snapshot koji uzima u obzir program modus
   */
  async getSnapshot(deviceId: string): Promise<ThermostatSnapshot> {
    const status = await this.tuyaAdapter.getDeviceStatus(deviceId);

    const currentTemp = status['TempCurrent'] ?? 0;
    let targetTemp = status['TempSet'] ?? 0;

    // Ako je u program modu, koristi aktivni setpoint iz programa
    if (status['Mode'] === '1' && status['program']) {
      targetTemp = this.getCurrentProgramTemp(status['program']);
    }

    const powerOn = status['Power'] === true;

    return {
      currentTemp,
      targetTemp,
      powerOn,
      timestamp: new Date(),
    };
  }
}
