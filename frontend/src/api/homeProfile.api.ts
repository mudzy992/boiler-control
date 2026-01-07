import api from "./api";
import type { HomeProfileDashboard } from "../interfaces/Dashboard";
import type { HomeProfile, UpdateHomeProfile } from "../interfaces/HomeProfile";

/**
 * Dohvati sve home profile za korisnika
 */
export const getHomeProfiles = async (): Promise<HomeProfileDashboard[]> => {
  const { data } = await api.get<HomeProfileDashboard[]>("/home-profiles");
  return data;
};

/**
 * Dohvati jedan home profile
 */
export const getHomeProfile = async (id: number): Promise<HomeProfileDashboard> => {
  const { data } = await api.get<HomeProfileDashboard>(`/home-profiles/${id}`);
  return data;
};

/**
 * Kreiraj novi home profile
 */
export const createHomeProfile = async (payload: HomeProfile): Promise<HomeProfileDashboard> => {
  const { data } = await api.post<HomeProfileDashboard>("/home-profiles", payload);
  return data;
};

/**
 * Update postojeći home profile
 */
export const updateHomeProfile = async (
  id: number,
  payload: Partial<UpdateHomeProfile>
): Promise<HomeProfileDashboard> => {
  const { data } = await api.patch<HomeProfileDashboard>(`/home-profiles/${id}`, payload);
  return data;
};

/**
 * Delete home profile
 */
export const deleteHomeProfile = async (id: number): Promise<void> => {
  await api.delete(`/home-profiles/${id}`);
};
