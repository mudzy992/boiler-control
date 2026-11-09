import type { DashboardResponse, ProcessedDashboard } from './types';

/**
 * Dashboard podaci za prikaz (`18` §5: nema izmišljenih brojeva).
 *
 * Tri stvari su se ovdje **izmišljale** i sada se ne izmišljaju:
 *
 * 1. `roomCurrentTemp ?? 0` — kad termostat nije poslao temperaturu, UI je pisao
 *    „0.0 °C". To nije „nema podataka", to je tvrdnja da je u kući nula
 *    stepeni. Sada je `null` i prikazuje se kao „—".
 * 2. `lastUpdate: new Date().toISOString()` — vrijeme je bilo vrijeme
 *    *računanja*, ne zadnje mjerenje, pa je uvijek izgledalo svježe. Sada je
 *    `lastSeen` termostata ili `null`.
 * 3. `homes[0]` — prvi profil nije nužno aktivan. Sada se traži profil koji
 *    odgovara aktivnom `homeProfileId`, ako ga pozivalac proslijedi.
 */
export const processDashboardData = (
  raw: DashboardResponse,
  activeHomeProfileId?: number | null,
): ProcessedDashboard => {
  const home =
    raw.homes.find((candidate) => candidate.profile.id === activeHomeProfileId) ??
    raw.homes[0];
  const thermostat = home?.thermostats[0];
  const recentEvents = home?.recentHeatingEvents || [];
  const thermostatPrograms = thermostat?.program ?? [];
  const anomalies = recentEvents.filter((e) => e.isAnomaly).length;
  const anomalyRate =
    recentEvents.length > 0
      ? Math.round((anomalies / recentEvents.length) * 100)
      : 0;

  /*
   * `lastSeen` uzima se kao **najnoviji** među termostatima, jer kuća može
   * imati više njih, a ono što korisnika zanima je kad je bilo koji od njih
   * zadnji put javio stanje. Neispravan datum se preskače, a ne pretvara u
   * „sada".
   */
  const lastSeen = (home?.thermostats ?? [])
    .map((candidate) => candidate.lastSeen)
    .filter((value): value is string => typeof value === 'string' && value !== '')
    .sort()
    .at(-1) ?? null;

  return {
    anomalyCount: anomalies,
    anomalyRate,
    roomCurrentTemp: thermostat?.roomCurrentTemp ?? null,
    roomTargetTemp: thermostat?.roomTargetTemp ?? null,
    lastSeen,
    recentEvents,
    boiler: raw.system.boiler,
    weather: raw.system.weather,
    thermostatPrograms,
    recommendation: raw.system.recommendation ?? null,
  };
};
