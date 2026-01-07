import type { HomeProfileDashboard } from "../interfaces/Dashboard";
import api from "./api";

/**
 * Dashboard podaci
 */
export const getDashboard = async (): Promise<HomeProfileDashboard[]> => {
  const { data } = await api.get<HomeProfileDashboard[]>("/dashboard");
  return data;
};

/**
 * Dashboard samo današnji events i recommendations
 */
export const getDashboardToday = async (): Promise<HomeProfileDashboard[]> => {
  const dashboard = await getDashboard();
  const today = new Date().toISOString().split("T")[0];

  return dashboard.map((home) => ({
    ...home,
    recentHeatingEvents: home.recentHeatingEvents.filter((e) =>
      e.timestampStart.startsWith(today)
    ),
    recommendations: home.recommendations.filter((r) =>
      r.date.startsWith(today)
    ),
    intervalLearnings: home.intervalLearnings.filter((i: any) =>
      (i.startTime?.startsWith(today) || i.endTime?.startsWith(today))
    ),
  }));
};
