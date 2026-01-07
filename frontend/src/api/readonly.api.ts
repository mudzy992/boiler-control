import type { TodayBoilerEvent } from "../interfaces/TodayBoilerEvent";
import type { TodayRecommendation } from "../interfaces/TodayRecommendation";
import type { TodayWeather } from "../interfaces/TodayWeather";
import api from "./api";

/* =========================
   Read-only API calls
========================= */

/**
 * Vraća samo današnji weather podatak
 */
export const getTodayWeather = async (): Promise<TodayWeather | null> => {
  const { data } = await api.get<TodayWeather[]>("/readonly/weather");
  if (!data || data.length === 0) return null;

  // filtriramo samo danas
  const today = new Date().toISOString().split("T")[0];
  return data.find((w) => w.fetchedAt.startsWith(today)) ?? data[0];
};

/**
 * Boiler history samo danas
 */
export const getTodayBoilerHistory = async (): Promise<TodayBoilerEvent[]> => {
  const { data } = await api.get<TodayBoilerEvent[]>("/readonly/boiler-history");
  const today = new Date().toISOString().split("T")[0];
  return data.filter((h) => h.createdAt.startsWith(today));
};

/**
 * Recommendations samo danas
 */
export const getTodayRecommendations = async (): Promise<TodayRecommendation[]> => {
  const { data } = await api.get<TodayRecommendation[]>("/readonly/recommendations");
  const today = new Date().toISOString().split("T")[0];
  return data.filter((r) => r.date.startsWith(today));
};

/**
 * Last recommendation samo danas
 */
export const getLastRecommendation = async (): Promise<TodayRecommendation | null> => {
  try {
    const { data } = await api.get<TodayRecommendation[]>("/readonly/last-recommendation");
    if (!data) return null;

    // Ako API vraća single objekt, vratimo ga
    return Array.isArray(data) ? data[0] : data;
  } catch (err) {
    console.error("Failed to fetch last recommendation", err);
    return null;
  }
};
