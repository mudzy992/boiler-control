import type { DashboardResponse, ProcessedDashboard } from './types';

export const processDashboardData = (
  raw: DashboardResponse,
): ProcessedDashboard => {
  const home = raw.homes[0];
  const thermostat = home?.thermostats[0];
  const recentEvents = home?.recentHeatingEvents || [];
  const thermostatPrograms = thermostat?.program ?? [];
  const anomalies = recentEvents.filter((e) => e.isAnomaly).length;
  const anomalyRate =
    recentEvents.length > 0
      ? Math.round((anomalies / recentEvents.length) * 100)
      : 0;

  return {
    anomalyCount: anomalies,
    anomalyRate,
    currentTemp: thermostat?.currentTemp || 0,
    targetTemp: thermostat?.targetTemp || 0,
    lastUpdate: new Date().toISOString(),
    recentEvents,
    boiler: raw.system.boiler,
    weather: raw.system.weather,
    thermostatPrograms,
    recommendation: raw.system.recommendation ?? null,
  };
};
