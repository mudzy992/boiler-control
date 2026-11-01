import { QueryClient } from '@tanstack/react-query';

/**
 * FE2-3: one shared QueryClient with conservative global defaults.
 *
 * - staleTime avoids immediate refetch storms when navigating between pages.
 * - retry is limited so a failing backend does not multiply load.
 * - refetchOnWindowFocus keeps data fresh when the user returns to the tab.
 * - refetchIntervalInBackground=false pauses interval polling while hidden.
 */
export const QUERY_DEFAULT_STALE_TIME_MS = 30_000;
export const QUERY_DEFAULT_RETRY = 1;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: QUERY_DEFAULT_STALE_TIME_MS,
        retry: QUERY_DEFAULT_RETRY,
        refetchOnWindowFocus: true,
        refetchIntervalInBackground: false,
      },
    },
  });
}

export const queryClient = createQueryClient();
