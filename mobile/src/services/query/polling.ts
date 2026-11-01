import type { AppStateStatus } from 'react-native';

export const DASHBOARD_POLL_INTERVAL_MS = 60_000;

/**
 * MO2-13: one dashboard cache entry is shared by Dashboard and Heating.
 * Polling is enabled only while the native app is active.
 */
export function dashboardRefetchInterval(appState: AppStateStatus): number | false {
  return appState === 'active' ? DASHBOARD_POLL_INTERVAL_MS : false;
}
