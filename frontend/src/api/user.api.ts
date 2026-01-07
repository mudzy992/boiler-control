import type { UpdateUser } from "../interfaces/UpdateUser";
import api from "./api";
import type { AuthUser } from "./auth.api";

/**
 * Dohvati podatke trenutnog korisnika
 */
export const getUserProfile = async (): Promise<AuthUser> => {
  const { data } = await api.get<AuthUser>("/user/me");
  return data;
};

/**
 * Update trenutnog korisnika
 */
export const updateUserProfile = async (payload: UpdateUser): Promise<AuthUser> => {
  const { data } = await api.patch<AuthUser>("/user/me", payload);
  return data;
};
