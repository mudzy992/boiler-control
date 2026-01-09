import api from "./api";

/**
 * Sync
 */
export const manualSyncBoiler = async () => {
  const { data } = await api.post("/boiler/sync");
  return data;
};
