import api from "./api";
import type {
  ThermostatDevice,
  ThermostatProgram,
  UpdateThermostatDevice,
} from "../interfaces/ThermostatDevice";

/**
 * Dohvati sve thermostatske uređaje korisnika
 */
export const getAllDevices = async (): Promise<ThermostatDevice[]> => {
  const { data } = await api.get<ThermostatDevice[]>("/devices");
  return data;
};

/**
 * Dohvati jedan thermostatski uređaj sa detaljima
 */
export const getDeviceById = async (deviceId: number): Promise<ThermostatDevice> => {
  const { data } = await api.get<ThermostatDevice>(`/devices/${deviceId}`);
  return data;
};

/**
 * Dohvati sve programe za thermostatski uređaj
 */
export const getDevicePrograms = async (
  deviceId: number
): Promise<ThermostatProgram[]> => {
  const { data } = await api.get<ThermostatProgram[]>(
    `/devices/${deviceId}/programs`
  );
  return data;
};

/**
 * Update thermostatski uređaj
 */
export const updateDevice = async (
  deviceId: number,
  payload: Partial<UpdateThermostatDevice>
): Promise<ThermostatDevice> => {
  const { data } = await api.patch<ThermostatDevice>(
    `/devices/${deviceId}`,
    payload
  );
  return data;
};

/**
 * Obriši thermostatski uređaj
 */
export const deleteDevice = async (deviceId: number): Promise<void> => {
  await api.delete(`/devices/${deviceId}`);
};
