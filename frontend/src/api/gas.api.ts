import api from "./api";
import type { CreateGasReadingDto, GasReading, GasEfficiencyAnalysis } from "../interfaces/GasReading";

export const getGasReadings = async (): Promise<GasReading[]> => {
  const { data } = await api.get("/gas/readings");
  return data;
};

export const createGasReading = async (dto: CreateGasReadingDto): Promise<GasReading> => {
  const { data } = await api.post("/gas/reading", dto);
  return data;
};

export const deleteGasReading = async (id: number): Promise<void> => {
  await api.delete(`/gas/reading/${id}`);
};

export const getGasAnalysis = async (params: { from?: string; to?: string }): Promise<GasEfficiencyAnalysis> => {
  const { data } = await api.get("/gas/analysis", { params });
  return data;
};
