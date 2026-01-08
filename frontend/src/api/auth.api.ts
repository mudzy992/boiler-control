import api from "./api";

/* =========================
   DTOs (frontend copy)
========================= */

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthUser {
  id: number;
  email: string;
  name?: string;
  createdAt?: string;
  homeLocation?: string;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
}

/* =========================
   API calls
========================= */

export const register = async (
  payload: RegisterRequest
): Promise<AuthResponse> => {
  const { data } = await api.post<AuthResponse>(
    "/auth/register",
    payload
  );

  localStorage.setItem("token", data.token);
  return data;
};

export const login = async (
  payload: LoginRequest
): Promise<AuthResponse> => {
  const { data } = await api.post<AuthResponse>(
    "/auth/login",
    payload
  );

  localStorage.setItem("token", data.token);
  return data;
};

export const getMe = async (): Promise<AuthUser> => {
  const { data } = await api.get<AuthUser>("/auth/me");
  return data;
};

export const logout = () => {
  localStorage.removeItem("token");
};
