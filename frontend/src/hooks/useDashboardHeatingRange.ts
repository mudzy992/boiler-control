import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { queryKeys } from '../lib/queryKeys';

export const DASHBOARD_HEATING_POLL_MS = 60_000;

export interface DashboardHeatingRange {
  from: string;
  to: string;
  bucket: 'hour' | 'day';
}

export interface DashboardHeatingRangeData {
  events: Array<Record<string, unknown>>;
  summary: Record<string, unknown> | null;
  isHeatingNow: boolean;
}

/**
 * FE2-3: replaces the old window.setInterval loop.
 *
 * React Query owns the interval. `refetchIntervalInBackground: false` means a
 * hidden/background tab does not keep polling the three heating endpoints.
 */
export function useDashboardHeatingRange(range: DashboardHeatingRange) {
  const { from, to, bucket } = range;

  return useQuery<DashboardHeatingRangeData>({
    queryKey: queryKeys.dashboardHeatingRange(from, to, bucket),
    queryFn: async () => {
      const [eventsResponse, summaryResponse, statusResponse] = await Promise.all([
        apiClient.getDashboardHeatingEvents({ from, to, limit: 500 }),
        apiClient.getDashboardHeatingSummary({ from, to, bucket }),
        apiClient.getDashboardHeatingStatus(),
      ]);

      return {
        events: Array.isArray(eventsResponse?.data) ? eventsResponse.data : [],
        summary: summaryResponse ?? null,
        isHeatingNow: statusResponse?.isHeatingNow ?? false,
      };
    },
    refetchInterval: DASHBOARD_HEATING_POLL_MS,
    refetchIntervalInBackground: false,
  });
}
