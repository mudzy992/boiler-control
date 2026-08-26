import axios from 'axios';
import { API_CONFIG } from '../../config/api.config';
import { SecureStorage } from '../storage/SecureStorage';

export type DayType = 'WORKDAY' | 'SATURDAY' | 'SUNDAY';

export interface ThermostatProgram {
  id: number;
  deviceId: number;
  dayType: DayType;
  startMinute: number; // 0-1440 (minutes since midnight)
  targetTemp: number;
  orderIndex: number; // 0-5
  programHash?: string;
}

export interface ThermostatDevice {
  id: number;
  alias: string;
  deviceId: string;
  vendor: string;
  mode: 'MANUAL' | 'PROGRAM' | 'OFF';
  homeProfileId: number;
  lastSeen: string;
  program?: ThermostatProgram[];
}

const getClient = async () => {
  const token = await SecureStorage.getToken();
  return axios.create({
    baseURL: API_CONFIG.BASE_URL,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    timeout: API_CONFIG.TIMEOUT,
  });
};

export const thermostatApi = {
  /**
   * Fetch all thermostat devices for the current user
   */
  getAllDevices: async (): Promise<ThermostatDevice[]> => {
    const client = await getClient();
    const response = await client.get('/devices');
    return response.data;
  },

  /**
   * Fetch a single thermostat device by ID
   */
  getDeviceById: async (id: number): Promise<ThermostatDevice> => {
    const client = await getClient();
    const response = await client.get(`/devices/${id}`);
    return response.data;
  },

  /**
   * Fetch all programs for a specific thermostat device
   * This returns the synced programs from Tuya Cloud (read-only)
   */
  getDevicePrograms: async (deviceId: number): Promise<ThermostatProgram[]> => {
    const client = await getClient();
    const response = await client.get(`/devices/${deviceId}/programs`);
    return response.data;
  },

  /**
   * Update thermostat device metadata (alias, mode, etc.)
   * NOTE: Mode changes are LOCAL ONLY - does not send command to device
   */
  updateDevice: async (
    id: number,
    data: {
      alias?: string;
      mode?: 'MANUAL' | 'PROGRAM' | 'OFF';
      vendor?: string;
    }
  ): Promise<ThermostatDevice> => {
    const client = await getClient();
    const response = await client.patch(`/devices/${id}`, data);
    return response.data;
  },
};
