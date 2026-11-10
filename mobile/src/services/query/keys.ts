/** MO2-13: shared React Query keys for the native app. */
export const DASHBOARD_QUERY_KEY = ['dashboard'] as const;
export const DASHBOARD_HEALTH_QUERY_KEY = ['dashboard-health'] as const;

/**
 * F13: granica polazne je po domu, pa se kešira po korisniku — promjena profila
 * doma mora oboriti ovaj upit, a ne cijeli dashboard.
 */
export const BOILER_FLOW_RANGE_QUERY_KEY = ['boiler-flow-range'] as const;
