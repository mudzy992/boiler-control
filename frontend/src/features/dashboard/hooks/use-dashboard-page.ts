import { useCallback, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryStateStatus } from '@/shared/components/query-state';
import { queryKeys } from '@/lib/queryKeys';
import { apiClient } from '@/services/api';
import {
  useNotificationPreferencesQuery,
  useNotificationsQuery,
} from '../../notifications/hooks/useNotifications';
import {
  buildWeatherDisplay,
  findActiveProgram,
  groupProgramsByDay,
} from '../lib/schedule-helpers';
import { processDashboardData } from '../process-dashboard-data';
import type {
  DashboardResponse,
  HeatingEvent,
  HeatingEventRow,
  HeatingSummaryResponse,
} from '../types';
import { useDashboardActions } from './use-dashboard-actions';
import { useDashboardHeatingRange } from './useDashboardHeatingRange';

export const useDashboardPage = () => {
  const queryClient = useQueryClient();
  const [fromDate, setFromDate] = useState(dayjs().startOf('day').format('YYYY-MM-DD'));
  const [toDate, setToDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [activeBucket, setActiveBucket] = useState<string | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);

  const dashboardQuery = useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: () => apiClient.getDashboard() as Promise<DashboardResponse>,
  });
  const data = useMemo(
    () => (dashboardQuery.data ? processDashboardData(dashboardQuery.data) : null),
    [dashboardQuery.data],
  );

  const actions = useDashboardActions({
    queryClient,
    dashboardQuery,
    boiler: data?.boiler,
  });

  const notificationsQuery = useNotificationsQuery();
  const prefsQuery = useNotificationPreferencesQuery();
  const unread = useMemo(
    () => (notificationsQuery.data ?? []).filter((n) => !n.isRead),
    [notificationsQuery.data],
  );

  const { data: homeProfile } = useQuery({
    queryKey: queryKeys.homeProfile,
    queryFn: () => apiClient.getHomeProfile(),
    staleTime: 1000 * 60 * 5,
  });
  const homeProfileId = homeProfile?.id;
  const { data: currentWeather } = useQuery({
    queryKey: queryKeys.weatherCurrent(homeProfileId),
    queryFn: () => apiClient.getCurrentWeather(homeProfileId!),
    enabled: !!homeProfileId,
    staleTime: 1000 * 60 * 10,
  });
  const weatherDisplay = useMemo(
    () =>
      buildWeatherDisplay(
        (currentWeather as Record<string, unknown> | undefined) ??
          (data?.weather as unknown as Record<string, unknown> | undefined),
      ),
    [currentWeather, data?.weather],
  );

  const fromIso = dayjs(fromDate).startOf('day').toISOString();
  const toIso = dayjs(toDate).endOf('day').toISOString();
  const bucketType: 'hour' | 'day' = dayjs(fromDate).isSame(dayjs(toDate), 'day')
    ? 'hour'
    : 'day';
  const heatingRangeQuery = useDashboardHeatingRange({
    from: fromIso,
    to: toIso,
    bucket: bucketType,
  });
  const summary = (heatingRangeQuery.data?.summary ?? null) as HeatingSummaryResponse | null;
  const summaryMetrics = summary?.summary ?? {
    totalCycles: 0,
    totalDurationMin: 0,
    avgDurationMin: 0,
    avgIndoorTemp: 0,
  };

  const getBucketLabel = useCallback(
    (dateStr: string) => {
      const d = dayjs(dateStr);
      return bucketType === 'hour'
        ? `${d.hour().toString().padStart(2, '0')}:00`
        : d.format('YYYY-MM-DD');
    },
    [bucketType],
  );
  const eventsWithBucket = useMemo<HeatingEventRow[]>(() => {
    const ev = (heatingRangeQuery.data?.events ?? []) as unknown as HeatingEvent[];
    return ev.map((e) => ({ ...e, bucketLabel: getBucketLabel(e.startedAt) }));
  }, [heatingRangeQuery.data, getBucketLabel]);

  const scheduleByDay = useMemo(
    () => groupProgramsByDay(data?.thermostatPrograms ?? []),
    [data?.thermostatPrograms],
  );
  const activeProgram = useMemo(
    () => findActiveProgram(data?.thermostatPrograms ?? []),
    [data?.thermostatPrograms],
  );

  const healthQuery = useQuery({
    queryKey: queryKeys.dashboardHealth,
    queryFn: () => apiClient.getDashboardHealth(),
    staleTime: 1000 * 60,
  });

  const status: QueryStateStatus = dashboardQuery.isLoading
    ? 'loading'
    : dashboardQuery.isError
      ? 'error'
      : !data
        ? 'empty'
        : 'success';

  return {
    data,
    status,
    refetchDashboard: () => void dashboardQuery.refetch(),
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    activeBucket,
    setActiveBucket,
    notifOpen,
    setNotifOpen,
    prefsOpen,
    setPrefsOpen,
    ...actions,
    weatherDisplay,
    summaryMetrics,
    buckets: summary?.buckets ?? [],
    eventsWithBucket,
    scheduleByDay,
    activeProgram,
    healthScore: healthQuery.data?.score ?? 0,
    warnings: healthQuery.data?.warnings ?? [],
    isHeatingActive: heatingRangeQuery.data?.isHeatingNow ?? false,
    unread,
    notificationsLoading: notificationsQuery.isLoading,
    notificationsError: notificationsQuery.isError,
    refetchNotifications: () => void notificationsQuery.refetch(),
    prefs: prefsQuery.data ?? [],
    prefsLoading: prefsQuery.isLoading,
    prefsError: prefsQuery.isError,
    refetchPrefs: () => void prefsQuery.refetch(),
  };
};
