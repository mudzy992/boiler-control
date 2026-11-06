import React, { useMemo, useState, useCallback, useTransition } from 'react';
import { Spin, message, List, Typography, Space, Alert } from 'antd';
import { FireOutlined, AlertOutlined, HomeOutlined, ClockCircleOutlined, BellOutlined, SettingOutlined, WarningOutlined, InfoCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { apiClient } from '../../../services/api';
import { StatCard } from '../../../components/StatCard';
import { RecommendationBreakdown } from '../../heating/components/RecommendationBreakdown';
import type { RecommendationBreakdownData } from '../../heating/components/RecommendationBreakdown';
import { Column } from '@ant-design/plots';
import dayjs, { Dayjs } from 'dayjs';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { useNotificationsQuery, useNotificationPreferencesQuery } from '../../notifications/hooks/useNotifications';
import { useDashboardHeatingRange } from '../hooks/useDashboardHeatingRange';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { InputNumber } from '../../../components/InputNumber';
import {
  MIN_CURRENT_FLOW_TEMP,
  MAX_CURRENT_FLOW_TEMP,
} from '../../../constants/boilerLimits';

const { Text } = Typography;

// Type definitions matching actual backend response
interface Weather {
  temp?: number;
  feelsLike?: number;
  condition?: string;
  humidity?: number;
  windSpeed?: number;
  tempMin?: number;
  tempMax?: number;
  temperature?: number;
  feelslike?: number;
  condition_text?: string;
  wind_kph?: number;
  temp_min?: number;
  temp_max?: number;
}

interface Boiler {
  externalTemp: number;
  suggestedFlowTemp: number;
  actualFlowTemp: number | null;
}

interface Recommendation {
  recommendedFlowTemp: number;
  expectedHeatTimeMin?: number;
  confidenceScore?: number;
  breakdown?: RecommendationBreakdownData | null;
}

interface ThermostatProgram {
  dayType: string;
  startMinute: number;
  targetTemp: number;
  orderIndex: number;
}

interface HeatingEvent {
  id: number;
  startedAt: string;
  endedAt: string | null;
  targetTemp: number;
  currentTemp: number;
  durationMinutes: number;
  hvacAction?: string;
  isAnomaly: boolean;
}

interface HeatingEventRow extends HeatingEvent {
  bucketLabel: string;
}

interface Home {
  profile: { floorArea: number };
  thermostats: Thermostat[];
  recentHeatingEvents: HeatingEvent[];
}

interface Thermostat {
  alias: string;
  currentTemp: number;
  targetTemp: number;
  mode: string;
  program: ThermostatProgram[];
}

interface DashboardResponse {
  capabilities: any;
  system: {
    weather: Weather;
    boiler: Boiler;
    recommendation: Recommendation;
  };
  homes: Home[];
}

interface ProcessedDashboard {
  anomalyCount: number;
  anomalyRate: number;
  currentTemp: number;
  targetTemp: number;
  lastUpdate: string;
  recentEvents: HeatingEvent[];
  boiler: Boiler;
  weather: Weather;
  thermostatPrograms: ThermostatProgram[];
  recommendation: Recommendation | null;
}

interface HeatingSummaryResponse {
  summary: {
    totalCycles: number;
    totalDurationMin: number;
    avgDurationMin: number;
    avgIndoorTemp: number;
  };
  buckets: Array<{
    label: string;
    totalDurationMin: number;
    cycles: number;
  }>;
}

type ChartDatum = {
  label: string;
  totalDurationMin: number;
  cycles: number;
};

type PlotEvent = {
  data?: {
    data?: ChartDatum;
  };
};

// FE2-14 (FE-010): granice su ranije bile kopirane ovdje i u BoilerPage.tsx.
// Sada dolaze iz jednog mjesta, usklađenog s backend `SetCurrentTempDto`.
type PlotInstance = {
  on: (event: string, handler: (evt: PlotEvent) => void) => void;
};

function processDashboardData(raw: DashboardResponse): ProcessedDashboard {
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
    anomalyRate: anomalyRate,
    currentTemp: thermostat?.currentTemp || 0,
    targetTemp: thermostat?.targetTemp || 0,
    lastUpdate: new Date().toISOString(),
    recentEvents: recentEvents,
    boiler: raw.system.boiler,
    weather: raw.system.weather,
    thermostatPrograms,
    recommendation: raw.system.recommendation ?? null,
  };
}

export const DashboardPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeBucket, setActiveBucket] = useState<string | null>(null);
  const [range, setRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf('day'),
    dayjs(),
  ]);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [notificationSettingsOpen, setNotificationSettingsOpen] = useState(false);
  const [setTempModalOpen, setSetTempModalOpen] = useState(false);
  const [setTempValue, setSetTempValue] = useState<number | null>(null);
  const [setTempSubmitting, setSetTempSubmitting] = useState(false);

  // FE2-15 (FE-024): `useTransition` za teže UI ažuriranja (INP metrika).
  // `startTransition` označava ažuriranje kao neslužno, tako da React može
  // prekinuti render ako korisnik unese novi unos dok se prethodni još obradjuje.
  const [, startTransition] = useTransition();

  // FE2-3: dashboard payload is a React Query cache entry, not local state.
  const dashboardQuery = useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: () => apiClient.getDashboard() as Promise<DashboardResponse>,
  });
  const data = useMemo(
    () => (dashboardQuery.data ? processDashboardData(dashboardQuery.data) : null),
    [dashboardQuery.data],
  );
  const loading = dashboardQuery.isLoading;

  const notificationsQuery = useNotificationsQuery();
  const notificationPreferencesQuery = useNotificationPreferencesQuery();
  const notifications = useMemo(
    () => notificationsQuery.data ?? [],
    [notificationsQuery.data],
  );
  const notificationPreferences = useMemo(
    () => notificationPreferencesQuery.data ?? [],
    [notificationPreferencesQuery.data],
  );
  const notificationsLoading =
    notificationsQuery.isLoading || notificationPreferencesQuery.isLoading;

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

  const weatherDisplay = useMemo(() => {
    if (currentWeather) {
      return {
        outsideTemp: currentWeather.temperature ?? currentWeather.temp ?? null,
        feelsLike: currentWeather.feelslike ?? currentWeather.feelsLike ?? null,
        condition:
          currentWeather.condition_text ?? currentWeather.condition ?? null,
        humidity: currentWeather.humidity ?? null,
        windSpeed: currentWeather.wind_kph ?? currentWeather.windSpeed ?? null,
        tempMin: currentWeather.temp_min ?? currentWeather.tempMin ?? null,
        tempMax: currentWeather.temp_max ?? currentWeather.tempMax ?? null,
      };
    }

    if (data?.weather) {
      return {
        outsideTemp: data.weather.temp ?? data.weather.temperature ?? null,
        feelsLike: data.weather.feelsLike ?? data.weather.feelslike ?? null,
        condition:
          data.weather.condition ?? data.weather.condition_text ?? null,
        humidity: data.weather.humidity ?? null,
        windSpeed:
          data.weather.windSpeed ?? data.weather.wind_kph ?? null,
        tempMin:
          data.weather.tempMin ?? data.weather.temp_min ?? null,
        tempMax:
          data.weather.tempMax ?? data.weather.temp_max ?? null,
      };
    }

    return null;
  }, [currentWeather, data?.weather]);

  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !n.isRead),
    [notifications],
  );

  const handleMarkNotificationAsRead = useCallback(
    async (notificationId: number) => {
      try {
        await apiClient.markNotificationAsRead(notificationId);
        // FE2-15: invalidacija u transitionu — UI ostaje responsivan dok se
        // podaci osvežavaju u pozadini.
        startTransition(() => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
          void queryClient.invalidateQueries({ queryKey: queryKeys.notificationsUnreadCount });
        });
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    },
    [queryClient],
  );

  const openSetTempModal = useCallback(() => {
    const boiler = data?.boiler;
    const fallback =
      typeof boiler?.actualFlowTemp === 'number'
        ? boiler.actualFlowTemp
        : boiler?.suggestedFlowTemp ?? 52;
    setSetTempValue(Number(fallback.toFixed(1)));
    setSetTempModalOpen(true);
  }, [data?.boiler]);

  const submitSetTemp = useCallback(
    async () => {
    if (typeof setTempValue !== 'number' || Number.isNaN(setTempValue)) {
      return;
    }

    if (
      setTempValue < MIN_CURRENT_FLOW_TEMP ||
      setTempValue > MAX_CURRENT_FLOW_TEMP
    ) {
      return;
    }

    try {
      setSetTempSubmitting(true);
      await apiClient.setBoilerCurrentTemp(Number(setTempValue.toFixed(1)));
      // FE2-15: refetch u transitionu da UI ostaje responsivan tokom re-fetch-a.
      startTransition(async () => {
        await dashboardQuery.refetch();
      });

      message.success('Current boiler temperature updated');
      setSetTempModalOpen(false);
    } catch (error) {
      console.error('Failed to update current boiler temp:', error);
    } finally {
      setSetTempSubmitting(false);
    }
  }, [dashboardQuery, setTempValue]);

  const heatingRangeParams = {
    from: range[0].toISOString(),
    to: range[1].toISOString(),
    bucket: range[0].isSame(range[1], 'day')
      ? ('hour' as const)
      : ('day' as const),
  };
  const heatingRangeQuery = useDashboardHeatingRange(heatingRangeParams);
  const summary =
    (heatingRangeQuery.data?.summary ?? null) as
      | HeatingSummaryResponse
      | null;
  const isHeatingNow = heatingRangeQuery.data?.isHeatingNow ?? false;

  const bucketType: 'hour' | 'day' = range[0].isSame(range[1], 'day')
    ? 'hour'
    : 'day';

  const formatStartMinute = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const getTodayDayType = () => {
    const day = dayjs().day();
    if (day === 0) return 'SUNDAY';
    if (day === 6) return 'SATURDAY';
    return 'WORKDAY';
  };

  const getActiveProgram = useCallback(
    (programs: ThermostatProgram[]) => {
      if (!programs.length) return null;
      const today = getTodayDayType();
      const todaysPrograms = programs
        .filter((p) => p.dayType === today)
        .sort((a, b) => a.startMinute - b.startMinute);
      if (!todaysPrograms.length) return null;
      const nowMinutes = dayjs().hour() * 60 + dayjs().minute();
      const current =
        [...todaysPrograms]
          .reverse()
          .find((p) => p.startMinute <= nowMinutes) ??
        todaysPrograms[todaysPrograms.length - 1];
      return current;
    },
    [],
  );

  const getBucketLabel = useCallback(
    (dateStr: string) => {
      const date = dayjs(dateStr);
      return bucketType === 'hour'
        ? `${date.hour().toString().padStart(2, '0')}:00`
        : date.format('YYYY-MM-DD');
    },
    [bucketType],
  );

  const eventsWithBucket = useMemo<HeatingEventRow[]>(() => {
    const ev =
      (heatingRangeQuery.data?.events ?? []) as unknown as HeatingEvent[];
    return ev.map((e) => ({
      ...e,
      bucketLabel: getBucketLabel(e.startedAt),
    }));
  }, [heatingRangeQuery.data, getBucketLabel]);

  const scheduleByDay = useMemo(() => {
    const map = new Map<string, ThermostatProgram[]>();
    (data?.thermostatPrograms ?? []).forEach((p) => {
      if (!map.has(p.dayType)) map.set(p.dayType, []);
      map.get(p.dayType)!.push(p);
    });
    return Array.from(map.entries()).map(([dayType, programs]) => ({
      dayType,
      programs: programs.sort((a, b) => a.orderIndex - b.orderIndex),
    }));
  }, [data?.thermostatPrograms]);

  const activeProgram = useMemo(() => {
    return getActiveProgram(data?.thermostatPrograms ?? []);
  }, [data?.thermostatPrograms, getActiveProgram]);

  const summaryMetrics = summary?.summary ?? {
    totalCycles: 0,
    totalDurationMin: 0,
    avgDurationMin: 0,
    avgIndoorTemp: 0,
  };

  const chartData = summary?.buckets ?? [];

  const isHeatingActive = isHeatingNow;

  const healthQuery = useQuery({
    queryKey: queryKeys.dashboardHealth,
    queryFn: () => apiClient.getDashboardHealth(),
    staleTime: 1000 * 60,
  });

  const healthScore = healthQuery.data?.score ?? 0;

  const alerts = useMemo(() => {
    const warnings = healthQuery.data?.warnings ?? [];
    return warnings.map((w) => ({
      type: w.level,
      message: w.message,
      icon:
        w.level === 'info' ? <InfoCircleOutlined /> : <WarningOutlined />,
    }));
  }, [healthQuery.data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-border rounded-full animate-spin border-t-brand"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <Card padding="lg">
        <div className="text-sm text-text-secondary">No data available</div>
      </Card>
    );
  }

  const columns = [
    {
      title: 'Start Time',
      dataIndex: 'startedAt',
      key: 'startedAt',
      render: (value: string) => new Date(value).toLocaleString(),
    },
    {
      title: 'End Time',
      dataIndex: 'endedAt',
      key: 'endedAt',
      render: (value: string | null) =>
        value ? new Date(value).toLocaleString() : '—',
    },
    {
      title: 'Duration (min)',
      dataIndex: 'durationMinutes',
      key: 'durationMinutes',
    },
    {
      title: 'Current Temp',
      dataIndex: 'currentTemp',
      key: 'currentTemp',
      render: (value: number) => `${value.toFixed(1)}°C`,
    },
    {
      title: 'Target Temp',
      dataIndex: 'targetTemp',
      key: 'targetTemp',
      render: (value: number) => `${value}°C`,
    },
    {
      title: 'Action',
      dataIndex: 'hvacAction',
      key: 'hvacAction',
      render: (value: string) =>
        value ? (
          <span className="px-2 py-0.5 rounded bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-100 text-xs font-medium">
            {value}
          </span>
        ) : (
          '—'
        ),
    },
    {
      title: 'Anomaly',
      dataIndex: 'isAnomaly',
      key: 'isAnomaly',
      render: (value: boolean) => (
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
          value
            ? 'bg-error-50 text-error-700 dark:bg-error-900/20 dark:text-error-100'
            : 'bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-100'
        }`}>
          {value ? 'YES' : 'NO'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6" id="content">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">
            Dashboard
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Overview of your heating system performance and alerts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setNotificationDrawerOpen(true)} icon={<BellOutlined />}>
            Notifications
          </Button>
          <Button
            variant="secondary"
            onClick={() => setNotificationSettingsOpen(true)}
            icon={<SettingOutlined />}
          >
            Settings
          </Button>
          <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-semibold ${
            isHeatingActive
              ? 'bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-100'
              : 'bg-surface-muted text-text-tertiary dark:bg-dark-surface-muted dark:text-dark-text-tertiary'
          }`}>
            {isHeatingActive ? 'Heating Active' : 'Idle / Not Heating'}
          </span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Home Health Score"
          value={Math.round(healthScore)}
          prefix={<HomeOutlined />}
          suffix="%"
          trend={healthScore > 70 ? 'up' : 'down'}
          trendValue={`${healthScore > 70 ? '+' : ''}${Math.round(healthScore)}%`}
          valueStyle={{
            color: healthScore > 70 ? 'rgb(var(--success))' : 'rgb(var(--warning))',
          }}
        />
        <StatCard
          title="Anomaly Rate"
          value={data.anomalyRate}
          prefix={<AlertOutlined />}
          suffix="%"
          trend={data.anomalyRate < 20 ? 'up' : 'down'}
          trendValue={`${data.anomalyRate < 20 ? '+' : '-'}${data.anomalyRate}%`}
          valueStyle={{
            color: data.anomalyRate < 20 ? 'rgb(var(--success))' : 'rgb(var(--error))',
          }}
        />
        <StatCard
          title="Current Temp"
          value={data.currentTemp}
          suffix="°C"
          valueStyle={{ color: 'rgb(var(--info))' }}
        />
        <StatCard
          title="Target Temp"
          value={data.targetTemp}
          suffix="°C"
          valueStyle={{ color: 'rgb(var(--brand))' }}
        />
      </div>

      {/* System info row */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card padding="md" elevated>
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-info-50 text-info-700 dark:bg-info-900/20 dark:text-info-100">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-text-secondary">Outside Temp</p>
              <p className="text-lg font-bold text-text-primary">
                {weatherDisplay?.outsideTemp != null ? `${Number(weatherDisplay.outsideTemp).toFixed(1)}°C` : '—'}
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {weatherDisplay ? (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-tertiary">Feels Like</span>
                  <span className="text-text-primary">
                    {weatherDisplay?.feelsLike !== null ? `${Number(weatherDisplay.feelsLike).toFixed(1)}°C` : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-tertiary">Condition</span>
                  <span className="text-text-primary">{weatherDisplay?.condition ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-tertiary">Humidity</span>
                  <span className="text-text-primary">
                    {weatherDisplay?.humidity ?? '—'}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-tertiary">Wind Speed</span>
                  <span className="text-text-primary">
                    {weatherDisplay?.windSpeed ?? '—'} km/h
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-tertiary">Today Min/Max</span>
                  <span className="text-text-primary">
                    {weatherDisplay?.tempMin ?? '—'}°C / {weatherDisplay?.tempMax ?? '—'}°C
                  </span>
                </div>
              </>
            ) : (
              <p className="text-sm text-text-tertiary">No weather data available</p>
            )}
          </div>
        </Card>

        <Card padding="md" elevated>
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-100">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-text-secondary">Boiler Status</p>
              <p className="text-lg font-bold text-text-primary">
                {typeof data.boiler.actualFlowTemp === 'number'
                  ? `${data.boiler.actualFlowTemp.toFixed(1)}°C`
                  : '—'}
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-tertiary">Suggested Flow Temp</span>
              <span className="text-text-primary">
                {data.boiler.suggestedFlowTemp.toFixed(1)}°C
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-tertiary">Actual Flow Temp</span>
              <span className="text-text-primary">
                {typeof data.boiler.actualFlowTemp === 'number'
                  ? `${data.boiler.actualFlowTemp.toFixed(1)}°C`
                  : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-tertiary">Delta</span>
              <span className="text-text-primary">
                {typeof data.boiler.actualFlowTemp === 'number'
                  ? `${(data.boiler.actualFlowTemp - data.boiler.suggestedFlowTemp).toFixed(1)}°C`
                  : '—'}
              </span>
            </div>
          </div>
          <div className="mt-4">
            <Button
              variant="primary"
              size="sm"
              onClick={openSetTempModal}
              fullWidth
            >
              Set current temp
            </Button>
            <div className="text-xs text-text-tertiary mt-2">
              Allowed range: {MIN_CURRENT_FLOW_TEMP}°C - {MAX_CURRENT_FLOW_TEMP}°C
            </div>
          </div>
        </Card>
      </div>

      {/* Recommendation breakdown */}
      <RecommendationBreakdown breakdown={data.recommendation?.breakdown} />

      {/* Alerts and warnings */}
      {alerts.length > 0 && (
        <Card padding="md" elevated>
          <div className="flex items-center gap-2 mb-3">
            <WarningOutlined className="w-4 h-4 text-warning" />
            <h3 className="text-sm font-semibold text-text-primary">Upozorenja i preporuke</h3>
          </div>
          <div className="space-y-2">
            {alerts.map((a, idx) => (
              <AlertRow key={idx} alert={a} />
            ))}
          </div>
        </Card>
      )}

      {/* Heating schedule */}
      <Card padding="md" elevated>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text-primary">
            Daily Heating Schedule
          </h3>
          {activeProgram ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-100 text-xs font-semibold">
              Active: {formatStartMinute(activeProgram.startMinute)} · {activeProgram.targetTemp.toFixed(1)}°C
            </span>
          ) : (
            <span className="text-xs text-text-tertiary">No active program</span>
          )}
        </div>
        {scheduleByDay.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {scheduleByDay.map((day) => (
              <div key={day.dayType} className="p-3 rounded-lg border border-border bg-surface-muted dark:border-dark-border dark:bg-dark-surface-muted">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-uppercase tracking-wider text-text-secondary">
                    {day.dayType}
                  </p>
                  <span className="text-[10px] text-text-tertiary">
                    {day.programs.length} blocks
                  </span>
                </div>
                <div className="space-y-1.5">
                  {day.programs.map((p) => {
                    const isActive =
                      activeProgram?.dayType === p.dayType &&
                      activeProgram?.orderIndex === p.orderIndex;
                    return (
                      <div
                        key={`${day.dayType}-${p.orderIndex}`}
                        className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                          isActive
                            ? 'border border-success bg-success-50 text-success-800 dark:border-success dark:bg-success-900/20 dark:text-success-100 shadow-sm'
                            : 'border border-border bg-white text-text-primary dark:border-dark-border dark:bg-dark-surface-elevated dark:text-dark-text-primary'
                        }`}
                      >
                        <span className="font-mono">{formatStartMinute(p.startMinute)}</span>
                        <span>{p.targetTemp.toFixed(1)}°C</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-tertiary">No thermostat schedule configured.</p>
        )}
      </Card>

      {/* Heating events */}
      <Card padding="md" elevated>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text-primary">
            Heating Events
          </h3>
          <div className="relative inline-block w-64">
            <input
              type="date"
              className="block w-full rounded-lg border border-border px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand dark:border-dark-border dark:bg-dark-surface-elevated dark:text-dark-text-primary"
              defaultValue={range[0].format('YYYY-MM-DD')}
              onChange={(e) => {
                if (e.target.value) {
                  setRange([dayjs(e.target.value), range[1]]);
                }
              }}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-4">
          <StatCard
            title="Total Cycles"
            value={summaryMetrics.totalCycles}
            prefix={<FireOutlined />}
          />
          <StatCard
            title="Total Heating Time"
            value={summaryMetrics.totalDurationMin}
            suffix="min"
            prefix={<ClockCircleOutlined />}
          />
          <StatCard
            title="Avg Duration"
            value={summaryMetrics.avgDurationMin}
            suffix="min"
          />
          <StatCard
            title="Avg Indoor Temp"
            value={summaryMetrics.avgIndoorTemp}
            suffix="°C"
          />
        </div>

        <div className="h-[260px]">
          <Column
            data={chartData}
            xField="label"
            yField="totalDurationMin"
            height={260}
            columnWidthRatio={0.6}
            color={(datum: ChartDatum) =>
              activeBucket === datum.label ? '#f59e0b' : '#60a5fa'
            }
            tooltip={{
              customContent: (title: string, items: any[]) => {
                if (!items || items.length === 0) return null;
                const datum = chartData.find((d) => d.label === title);
                if (!datum) return null;

                return (
                  <div className="p-3 rounded-lg border border-border bg-surface shadow-lg dark:border-dark-border dark:bg-dark-surface-elevated">
                    <div className="space-y-1">
                      <div className="font-semibold text-text-primary">{title}</div>
                      <div className="text-sm text-text-secondary">
                        Trajanje: <span className="font-medium">{datum.totalDurationMin} min</span>
                      </div>
                      <div className="text-sm text-text-secondary">
                        Ciklusa: <span className="font-medium">{datum.cycles}</span>
                      </div>
                    </div>
                  </div>
                );
              },
            }}
            onReady={(plot: PlotInstance) => {
              plot.on('element:mouseenter', (evt: PlotEvent) => {
                const label = evt?.data?.data?.label;
                if (label) setActiveBucket(label);
              });
              plot.on('element:mouseleave', () => setActiveBucket(null));
            }}
          />
        </div>

        <div className="overflow-x-auto mt-4">
          <table className="min-w-full divide-y divide-border dark:divide-dark-border">
            <thead>
              <tr className="bg-surface-muted text-xs text-text-secondary dark:bg-dark-surface-muted dark:text-dark-text-secondary">
                {columns.map((col) => (
                  <th key={col.key} className="px-4 py-3 text-left font-medium">
                    {col.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-sm text-text-primary divide-y divide-border dark:divide-dark-border">
              {eventsWithBucket.map((record) => (
                <tr
                  key={record.id}
                  className={`hover:bg-surface-muted dark:hover:bg-dark-surface-muted transition-colors duration-150 ${
                    record.bucketLabel === activeBucket
                      ? 'bg-amber-50 dark:bg-amber-500/10'
                      : ''
                  }`}
                >
                  <td className="px-4 py-3">{new Date(record.startedAt).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    {record.endedAt ? new Date(record.endedAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3">{record.durationMinutes}</td>
                  <td className="px-4 py-3">{record.currentTemp.toFixed(1)}°C</td>
                  <td className="px-4 py-3">{record.targetTemp}°C</td>
                  <td className="px-4 py-3">
                    {record.hvacAction ? (
                      <span className="px-2 py-0.5 rounded bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-100 text-xs font-medium">
                        {record.hvacAction}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      record.isAnomaly
                        ? 'bg-error-50 text-error-700 dark:bg-error-900/20 dark:text-error-100'
                        : 'bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-100'
                    }`}>
                      {record.isAnomaly ? 'YES' : 'NO'}
                    </span>
                  </td>
                </tr>
              ))}
              {eventsWithBucket.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-text-tertiary">
                    No heating events in the selected range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Notification Drawer */}
      <div
        className={`fixed inset-y-0 right-0 z-modal transform transition-transform duration-300 ${
          notificationDrawerOpen ? 'translate-x-0' : 'translate-x-full'
        } w-80 bg-surface border-l border-border shadow-lg dark:border-dark-border dark:bg-dark-surface`}
      >
        {notificationsLoading ? (
          <div className="flex items-center justify-center h-64">
            <Spin size="large" />
          </div>
        ) : unreadNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <BellOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
            <Text type="secondary">Nema novih notifikacija</Text>
            <Text type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
              Notifikacije će se prikazati ovdje kada stignu novi događaji
            </Text>
          </div>
        ) : (
          <List
            dataSource={unreadNotifications}
            renderItem={(notif) => (
              <NotificationItem notif={notif} onMarkAsRead={handleMarkNotificationAsRead} />
            )}
          />
        )}
      </div>

      {/* Notification Settings Modal */}
      <div
        className={`fixed inset-0 z-modal-backdrop bg-black/40 ${
          notificationSettingsOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        } transition-opacity duration-200`}
        onClick={() => setNotificationSettingsOpen(false)}
      />
      <div
        className={`fixed inset-y-0 right-0 z-modal w-full max-w-md transform transition-transform duration-300 ${
          notificationSettingsOpen ? 'translate-x-0' : 'translate-x-full'
        } bg-surface shadow-xl dark:bg-dark-surface`}
      >
        <div className="p-4 border-b border-border dark:border-dark-border">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <SettingOutlined className="w-4 h-4" /> Notification Settings
          </h3>
        </div>
        <div className="p-4 overflow-y-auto max-h-[70vh]">
          {notificationsLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-6 h-6 border-4 border-border rounded-full animate-spin border-t-brand"></div>
            </div>
          ) : notificationPreferences.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <p className="text-sm text-text-secondary">Loading settings...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notificationPreferences.map((pref) => {
                const labels: Record<string, string> = {
                  DAILY_RECOMMENDATION: 'Daily Recommendations',
                  FLOW_TEMP_CHANGED: 'Flow Temperature Changes',
                  HEATING_STARTED: 'Heating Started',
                  HEATING_ENDED: 'Heating Ended',
                  SYSTEM_ALERT: 'System Alerts',
                  GAS_READING_REMINDER: 'Gas Reading Reminder',
                };
                const descriptions: Record<string, string> = {
                  DAILY_RECOMMENDATION: 'Heating optimization recommendations every day',
                  FLOW_TEMP_CHANGED: 'Notifications when boiler flow temperature changes',
                  HEATING_STARTED: 'Notification when the system starts heating',
                  HEATING_ENDED: 'Notification when the system stops heating',
                  SYSTEM_ALERT: 'Important system alerts',
                  GAS_READING_REMINDER: 'Reminders to record gas readings',
                };

                return (
                  <div
                    key={pref.type}
                    className="flex items-center justify-between p-3 rounded-lg border border-border dark:border-dark-border"
                  >
                    <div>
                      <p className="text-sm font-semibold text-text-primary">
                        {labels[pref.type] || pref.type}
                      </p>
                      <p className="text-xs text-text-secondary">
                        {descriptions[pref.type] || 'Receive notifications for this event type'}
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={pref.enabled}
                      onChange={async (e) => {
                        try {
                          await apiClient.updateNotificationPreference(
                            pref.type,
                            e.target.checked,
                          );
                          await queryClient.invalidateQueries({
                            queryKey: queryKeys.notificationPreferences,
                          });
                        } catch (error) {
                          console.error('Failed to update preference:', error);
                        }
                      }}
                      className="rounded border-border text-brand focus:ring-brand dark:border-dark-border dark:text-dark-text-primary"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Set temp modal */}
      <div
        className={`fixed inset-0 z-modal-backdrop bg-black/40 ${
          setTempModalOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        } transition-opacity duration-200`}
        onClick={() => setSetTempModalOpen(false)}
      />
      <div
        className={`fixed inset-y-0 left-1/2 top-1/2 z-modal -translate-x-1/2 -translate-y-1/2 w-full max-w-md transform transition-transform duration-300 ${
          setTempModalOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        } bg-surface rounded-xl shadow-xl p-6 dark:bg-dark-surface`}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text-primary">
            Set Current Flow Temperature
          </h3>
          <Button variant="ghost" size="sm" onClick={() => setSetTempModalOpen(false)}>
            <span className="sr-only">Close</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </Button>
        </div>
        <p className="text-sm text-text-secondary mb-6">
          Allowed range: {MIN_CURRENT_FLOW_TEMP}°C - {MAX_CURRENT_FLOW_TEMP}°C
        </p>
        <InputNumber
          value={setTempValue ?? undefined}
          onChange={(value) =>
            setSetTempValue(typeof value === 'number' ? value : null)
          }
          min={MIN_CURRENT_FLOW_TEMP}
          max={MAX_CURRENT_FLOW_TEMP}
          step={0.1}
          precision={1}
          className="w-full mb-4"
          addonAfter="°C"
        />
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setSetTempModalOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={submitSetTemp}
            isLoading={setTempSubmitting}
            disabled={typeof setTempValue !== 'number'}
          >
            {setTempSubmitting ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
};

/** FE2-15: memoizovana stavka notifikacije — sprječava niepotreban re-render
 * cijele liste kada se samo jedna notifikacija označi kao pročitana. */
const NotificationItem = React.memo(
  ({
    notif,
    onMarkAsRead,
  }: {
    notif: { id: number; isRead: boolean; type: string; title: string; message: string; sentAt: string };
    onMarkAsRead: (id: number) => void;
  }) => {
    const getIcon = () => {
      if (notif.type.includes('ANOMALY') || notif.type.includes('ALERT')) {
        return <WarningOutlined style={{ color: '#faad14' }} />;
      }
      if (notif.type.includes('ERROR')) {
        return <WarningOutlined style={{ color: '#ff4d4f' }} />;
      }
      if (notif.type.includes('STARTED') || notif.type.includes('SUCCESS')) {
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      }
      return <InfoCircleOutlined style={{ color: '#1890ff' }} />;
    };

    return (
      <List.Item
        onClick={() => !notif.isRead && onMarkAsRead(notif.id)}
        className="cursor-pointer"
      >
        <List.Item.Meta
          avatar={getIcon()}
          title={notif.title}
          description={
            <Space direction="vertical" size="small">
              <Text>{notif.message}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {dayjs(notif.sentAt).format('DD.MM.YYYY HH:mm')}
              </Text>
            </Space>
          }
        />
      </List.Item>
    );
  }
);
NotificationItem.displayName = 'NotificationItem';

/** FE2-15: memoizovani red upozorenja. */
const AlertRow = React.memo(({ alert }: { alert: { type: string; message: string; icon: React.ReactNode } }) => (
  <Alert type={alert.type as 'info' | 'success' | 'warning' | 'error'} showIcon icon={alert.icon} message={alert.message} />
));
AlertRow.displayName = 'AlertRow';

