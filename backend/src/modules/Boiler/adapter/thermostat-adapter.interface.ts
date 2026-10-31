import { DayType } from 'src/generated/prisma';

export interface ThermostatSnapshot {
  /**
   * Trenutna temperatura u °C.
   *
   * REL-7 (B-026): `null` znači "uređaj nije poslao vrijednost". Prije ove
   * ispravke nedostajuće polje je postajalo `0` (jer `null / 2 === 0`), što je
   * poller čitao kao stvarnih 0 °C i na tome mijenjao ciklus grijanja.
   * Stvarna nula ostaje `0` — to je mjerena vrijednost, ne nepoznata.
   */
  currentTemp: number | null;
  /**
   * Zadana temperatura u °C.
   *
   * REL-7 (B-026): `null` = nepoznato, nije isto što `0`.
   */
  targetTemp: number | null;
  timestamp: Date; // kada je snapshot snimljen
  /**
   * Da li je termostat uključen (NE da li grijanje trenutno radi).
   *
   * REL-7 (B-026): `undefined` znači "uređaj nije poslao Power". Prije je
   * nedostajuće polje postajalo `false`, što je poller čitao kao "korisnik je
   * ugasio termostat" i gasio zabilježeni ciklus.
   */
  powerOn?: boolean;
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
