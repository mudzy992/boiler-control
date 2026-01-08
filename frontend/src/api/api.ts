import axios, { type AxiosInstance,  type InternalAxiosRequestConfig } from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "https://boiler-control.hopto.org/backend/api";
  //import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3020/api";

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Request interceptor
 * - automatski dodaje JWT ako postoji
 */
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem("token");

  // Ensure headers object exists to satisfy InternalAxiosRequestConfig typings
  config.headers = config.headers ?? {};

  if (token) {
    (config.headers as any).Authorization = `Bearer ${token}`;
  }

  return config;
});

/**
 * Response interceptor
 * - ovdje ćemo kasnije hvatati 401 globalno
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
