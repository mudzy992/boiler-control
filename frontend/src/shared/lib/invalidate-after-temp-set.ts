import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

/**
 * After a successful set-current-temp mutation, both callers (dashboard + boiler)
 * must refresh the same caches so neither screen shows stale flow temp.
 *
 * Invalidates:
 * - `queryKeys.boilerEvents` — BoilerPage event list / current reading
 * - `queryKeys.dashboard` — Dashboard overview payload that embeds boiler temp
 * - `queryKeys.dashboardHealth` — health strip that may depend on boiler state
 */
export const invalidateQueriesAfterTempSet = async (
  queryClient: QueryClient,
): Promise<void> => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.boilerEvents }),
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboardHealth }),
  ]);
};
