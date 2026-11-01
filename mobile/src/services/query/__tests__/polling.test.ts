import { DASHBOARD_POLL_INTERVAL_MS, dashboardRefetchInterval } from '../polling';

/**
 * MO2-13: background/inactive app must stop the dashboard refetch interval.
 */
describe('MO2-13 dashboardRefetchInterval', () => {
  it('polls every 60 seconds while active', () => {
    expect(dashboardRefetchInterval('active')).toBe(60_000);
    expect(DASHBOARD_POLL_INTERVAL_MS).toBe(60_000);
  });

  it.each(['background', 'inactive', 'unknown', null, undefined] as const)(
    'stops polling for %s',
    (state) => {
      expect(dashboardRefetchInterval(state as never)).toBe(false);
    }
  );
});
