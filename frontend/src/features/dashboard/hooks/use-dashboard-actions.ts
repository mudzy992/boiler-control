import { useCallback, useState, useTransition } from 'react';
import type { QueryClient, UseQueryResult } from '@tanstack/react-query';
import { invalidateQueriesAfterTempSet } from '@/shared/lib/invalidate-after-temp-set';
import { queryKeys } from '@/lib/queryKeys';
import { apiClient } from '@/services/api';
import type { Boiler } from '../types';

interface UseDashboardActionsArgs {
  queryClient: QueryClient;
  dashboardQuery: UseQueryResult<unknown>;
  boiler: Boiler | undefined;
}

export const useDashboardActions = ({
  queryClient,
  dashboardQuery,
  boiler,
}: UseDashboardActionsArgs) => {
  const [, startTransition] = useTransition();
  const [tempOpen, setTempOpen] = useState(false);
  const [tempValue, setTempValue] = useState<number | null>(null);
  const [tempSubmitting, setTempSubmitting] = useState(false);
  const [tempSaved, setTempSaved] = useState(false);

  const openSetTemp = useCallback(() => {
    const fallback =
      typeof boiler?.actualFlowTemp === 'number'
        ? boiler.actualFlowTemp
        : (boiler?.suggestedFlowTemp ?? 52);
    setTempValue(Number(fallback.toFixed(1)));
    setTempOpen(true);
  }, [boiler]);

  const submitSetTemp = useCallback(
    async (value: number) => {
      try {
        setTempSubmitting(true);
        await apiClient.setBoilerCurrentTemp(value);
        await invalidateQueriesAfterTempSet(queryClient);
        startTransition(() => {
          void dashboardQuery.refetch();
        });
        setTempSaved(true);
        setTempOpen(false);
      } catch (error) {
        console.error('Failed to update current boiler temp:', error);
      } finally {
        setTempSubmitting(false);
      }
    },
    [dashboardQuery, queryClient],
  );

  const handleMarkRead = useCallback(
    async (id: number) => {
      try {
        await apiClient.markNotificationAsRead(id);
        startTransition(() => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
          void queryClient.invalidateQueries({
            queryKey: queryKeys.notificationsUnreadCount,
          });
        });
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    },
    [queryClient],
  );

  const handlePrefToggle = useCallback(
    async (type: string, enabled: boolean) => {
      try {
        await apiClient.updateNotificationPreference(type, enabled);
        await queryClient.invalidateQueries({
          queryKey: queryKeys.notificationPreferences,
        });
      } catch (error) {
        console.error('Failed to update preference:', error);
      }
    },
    [queryClient],
  );

  return {
    tempOpen,
    setTempOpen,
    tempValue,
    tempSubmitting,
    tempSaved,
    setTempSaved,
    openSetTemp,
    submitSetTemp,
    handleMarkRead,
    handlePrefToggle,
  };
};
