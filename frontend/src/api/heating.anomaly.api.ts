import api from "./api";

/** Interface za anomaliju */
export interface HeatingAnomaly {
  id: number;
  deviceId: number;
  timestampStart: string; // ISO string
  timestampEnd: string | null;
  isAnomaly: boolean;
  proposedEndTime: string | null; // predloženo vrijeme završetka
  currentTemp: number;
  targetTemp: number;
  hvacAction: string;
  source: string;
  thermostatId: number;
  userId: number;
}

/** DTO za update/confirm anomalije */
export interface UpdateHeatingAnomalyDto {
  proposedEndTime?: string; // ISO string ako korisnik ručno mijenja
  confirm?: boolean; // potvrda predloženog završetka
}

/** Dohvati sve otvorene anomalije */
export const getOpenHeatingAnomalies = async (): Promise<HeatingAnomaly[]> => {
  const { data } = await api.get<HeatingAnomaly[]>("/heating-anomalies");
  return data;
};

/** Potvrdi ili izmijeni predloženi završetak anomalije */
export const updateHeatingAnomaly = async (
  eventId: number,
  dto: UpdateHeatingAnomalyDto
): Promise<{ success: boolean; eventId: number; timestampEnd: string }> => {
  const { data } = await api.patch(`/heating-anomalies/${eventId}`, dto);
  return data;
};
