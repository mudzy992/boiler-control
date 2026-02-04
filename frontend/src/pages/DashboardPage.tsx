import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Row, Col, Card, Spin, message, Table, Tag, DatePicker, Collapse, Badge, Drawer, List, Typography, Space, Modal, Switch, Alert, Button } from 'antd';
import { FireOutlined, AlertOutlined, HomeOutlined, ClockCircleOutlined, BellOutlined, SettingOutlined, WarningOutlined, InfoCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { apiClient } from '../services/api';
import { StatCard } from '../components/StatCard';
import { Column } from '@ant-design/plots';
import dayjs, { Dayjs } from 'dayjs';
import { useQuery } from '@tanstack/react-query';

const { Text } = Typography;

// Notification types
interface Notification {
  id: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  data?: any;
  sentAt: string;
  isRead: boolean;
  sourceRef?: string;
  createdAt: string;
}

interface NotificationPreference {
  userId: number;
  type: string;
  enabled: boolean;
}

// Type definitions matching actual backend response
interface Weather {
  temperature: number;
  feelslike: number;
  humidity?: number;
  condition_text?: string;
  wind_kph?: number;
  temp_min?: number;
  temp_max?: number;
  fetchedAt: string;
}

interface Boiler {
  externalTemp: number;
  suggestedFlowTemp: number;
  actualFlowTemp: number;
}

interface Recommendation {
  recommendedFlowTemp: number;
  expectedHeatTimeMin: number;
  confidenceScore: number;
}

interface ThermostatProgram {
  dayType: string;
  startMinute: number;
  targetTemp: number;
  orderIndex: number;
}

interface Thermostat {
  alias: string;
  currentTemp: number;
  targetTemp: number;
  mode: string;
  program: ThermostatProgram[];
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
  homeHealthScore: number;
  anomalyCount: number;
  anomalyRate: number;
  currentTemp: number;
  targetTemp: number;
  lastUpdate: string;
  recentEvents: HeatingEvent[];
  boiler: Boiler;
  weather: Weather;
  thermostatPrograms: ThermostatProgram[];
}

interface HeatingEventsResponse {
  data: HeatingEvent[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
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

interface HeatingStatusResponse {
  isHeatingNow: boolean;
  lastEvent: {
    id: number;
    deviceId: number;
    timestampStart: string;
    timestampEnd: string | null;
    roomCurrentTemp: number;
    roomTargetTemp: number;
    hvacAction: string;
    source: string;
    isAnomaly: boolean;
  } | null;
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

type PlotInstance = {
  on: (event: string, handler: (evt: PlotEvent) => void) => void;
};

export const DashboardPage: React.FC = () => {
  const [data, setData] = useState<ProcessedDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [rangeLoading, setRangeLoading] = useState(true);
  const [events, setEvents] = useState<HeatingEvent[]>([]);
  const [summary, setSummary] = useState<HeatingSummaryResponse | null>(null);
  const [isHeatingNow, setIsHeatingNow] = useState(false);
  const [activeBucket, setActiveBucket] = useState<string | null>(null);
  const [range, setRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf('day'), // 00:00:00 today
    dayjs(), // current time
  ]);

  // Notification states
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreference[]>([]);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [notificationSettingsOpen, setNotificationSettingsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  const { data: homeProfile } = useQuery({
    queryKey: ['home-profile'],
    queryFn: () => apiClient.getHomeProfile(),
    staleTime: 1000 * 60 * 5,
  });

  const homeProfileId = homeProfile?.id;

  const {
    data: currentWeather,
    isLoading: weatherLoading,
  } = useQuery({
    queryKey: ['weather-current', homeProfileId],
    queryFn: () => apiClient.getCurrentWeather(homeProfileId),
    enabled: !!homeProfileId,
    staleTime: 1000 * 60 * 10,
  });

  const loadNotifications = useCallback(async () => {
    try {
      setNotificationsLoading(true);
      const [notifs, prefs] = await Promise.all([
        apiClient.getNotifications(),
        apiClient.getNotificationPreferences(),
      ]);
      setNotifications(notifs);
      setNotificationPreferences(prefs);
    } catch (error) {
      console.error('Failed to load notifications:', error);
      message.error('Error loading notifications');
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !n.isRead),
    [notifications]
  );

  const handleMarkNotificationAsRead = useCallback(
    async (notificationId: number) => {
      try {
        await apiClient.markNotificationAsRead(notificationId);
        await loadNotifications();
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
        message.error('Failed to mark notification as read');
      }
    },
    [loadNotifications]
  );

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const result = await apiClient.getDashboard() as DashboardResponse;

        // Process the raw data to extract what we need
        const processed = processDashboardData(result);
        setData(processed);
      } catch (error) {
        console.error('Dashboard error:', error);
        message.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
    loadNotifications();
  }, [loadNotifications]);

  const loadHeatingRange = useCallback(async () => {
    if (!range?.[0] || !range?.[1]) return;

    const from = range[0].toISOString();
    const to = range[1].toISOString();
    const bucket = range[0].isSame(range[1], 'day') ? 'hour' : 'day';

    try {
      setRangeLoading(true);
      const [eventsResponse, summaryResponse, statusResponse] = await Promise.all([
        apiClient.getDashboardHeatingEvents({ from, to, limit: 500 }),
        apiClient.getDashboardHeatingSummary({ from, to, bucket }),
        apiClient.getDashboardHeatingStatus(),
      ]);

      const eventsData = (eventsResponse as HeatingEventsResponse)?.data ?? [];
      setEvents(eventsData);
      setSummary(summaryResponse as HeatingSummaryResponse);
      setIsHeatingNow((statusResponse as HeatingStatusResponse)?.isHeatingNow ?? false);
    } catch (error) {
      console.error('Heating range error:', error);
      message.error('Failed to load heating activity');
    } finally {
      setRangeLoading(false);
    }
  }, [range]);

  useEffect(() => {
    loadHeatingRange();
    const intervalId = window.setInterval(loadHeatingRange, 60000);
    return () => window.clearInterval(intervalId);
  }, [range, loadHeatingRange]);

  const processDashboardData = (raw: DashboardResponse): ProcessedDashboard => {
    const home = raw.homes[0];
    const thermostat = home?.thermostats[0];
    const recentEvents = home?.recentHeatingEvents || [];
    const thermostatPrograms = thermostat?.program ?? [];

    // Calculate health score (0-100)
    const anomalies = recentEvents.filter(e => e.isAnomaly).length;
    const healthScore = Math.max(0, 100 - (anomalies * 15));

    // Calculate anomaly rate
    const anomalyRate = recentEvents.length > 0
      ? Math.round((anomalies / recentEvents.length) * 100)
      : 0;

    return {
      homeHealthScore: healthScore,
      anomalyCount: anomalies,
      anomalyRate: anomalyRate,
      currentTemp: thermostat?.currentTemp || 0,
      targetTemp: thermostat?.targetTemp || 0,
      lastUpdate: new Date().toISOString(),
      recentEvents: recentEvents,
      boiler: raw.system.boiler,
      weather: raw.system.weather,
      thermostatPrograms,
    };
  };

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

  const getActiveProgram = (programs: ThermostatProgram[]) => {
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
  };

  const getBucketLabel = (dateStr: string) => {
    const date = dayjs(dateStr);
    return bucketType === 'hour'
      ? `${date.hour().toString().padStart(2, '0')}:00`
      : date.format('YYYY-MM-DD');
  };

  const eventsWithBucket = useMemo<HeatingEventRow[]>(() => {
    return events.map((e) => ({
      ...e,
      bucketLabel: getBucketLabel(e.startedAt),
    }));
  }, [events, bucketType]);

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
  }, [data?.thermostatPrograms]);

  const summaryMetrics = summary?.summary ?? {
    totalCycles: 0,
    totalDurationMin: 0,
    avgDurationMin: 0,
    avgIndoorTemp: 0,
  };

  const chartData = summary?.buckets ?? [];

  const isHeatingActive = isHeatingNow;

  // Calculate alerts and warnings
  const alerts = useMemo(() => {
    const a: { type: 'warning' | 'error' | 'info'; message: string; icon: React.ReactNode }[] = [];

    // Short cycles detection
    const shortCycles = events.filter((e) => e.durationMinutes < 20);
    if (shortCycles.length >= 3) {
      a.push({
        type: 'warning',
        message: `Detektovano ${shortCycles.length} kratkih ciklusa grijanja (< 20 min)`,
        icon: <WarningOutlined />,
      });
    }

    // Overshoot detection
    const overshootAvg =
      events.reduce((s, e) => s + (e.targetTemp - e.currentTemp), 0) /
      (events.length || 1);
    if (overshootAvg > 1.5) {
      a.push({
        type: 'warning',
        message: `Mogući overshoot - prosječna razlika: ${overshootAvg.toFixed(1)}°C`,
        icon: <WarningOutlined />,
      });
    }

    // Long cycles detection
    const longCycles = events.filter((e) => e.durationMinutes > 90);
    if (longCycles.length > 0) {
      a.push({
        type: 'info',
        message: `Detektovano ${longCycles.length} dugih ciklusa grijanja (> 90 min)`,
        icon: <InfoCircleOutlined />,
      });
    }

    // Anomalies
    const anomalies = events.filter((e) => e.isAnomaly);
    if (anomalies.length > 0) {
      a.push({
        type: 'error',
        message: `${anomalies.length} anomalija(e) u odabranom periodu`,
        icon: <WarningOutlined />,
      });
    }

    return a;
  }, [events]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spin size="large" />
      </div>
    );
  }

  if (!data) {
    return <Card>No data available</Card>;
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
      render: (value: string | null) => (value ? new Date(value).toLocaleString() : '—'),
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
      render: (value: string) => (value ? <Tag color="blue">{value}</Tag> : '—'),
    },
    {
      title: 'Anomaly',
      dataIndex: 'isAnomaly',
      key: 'isAnomaly',
      render: (value: boolean) => <Tag color={value ? 'red' : 'green'}>{value ? 'YES' : 'NO'}</Tag>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Overview of your heating system performance and alerts.
          </p>
        </div>
        <div className="flex items-center justify-between gap-4">
          <Badge count={unreadNotifications.length}>
            <Button
              onClick={() => setNotificationDrawerOpen(true)}
              type='primary'
            >
              <BellOutlined />
              <span>Notifications</span>
            </Button>
          </Badge>
          <Button
            onClick={() => setNotificationSettingsOpen(true)}
            type='primary'
          >
            <SettingOutlined />
            <span>Settings</span>
          </Button>
          <Tag
            color={isHeatingActive ? 'green' : 'default'}
            className={
              isHeatingActive
                ? 'rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-wide'
                : 'rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300'
            }
          >
            {isHeatingActive ? 'Heating Active' : 'Idle / Not Heating'}
          </Tag>
        </div>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="Home Health Score"
            value={Math.round(data.homeHealthScore)}
            prefix={<HomeOutlined />}
            suffix="%"
            valueStyle={{ color: data.homeHealthScore > 70 ? '#22c55e' : '#f59e0b' }}
          />
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="Anomaly Rate"
            value={data.anomalyRate}
            prefix={<AlertOutlined />}
            suffix="%"
            valueStyle={{ color: data.anomalyRate < 20 ? '#22c55e' : '#ef4444' }}
          />
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="Current Temp"
            value={data.currentTemp}
            suffix="°C"
            valueStyle={{ color: '#3b82f6' }}
          />
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="Target Temp"
            value={data.targetTemp}
            suffix="°C"
            valueStyle={{ color: '#ff6b3d' }}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12}>
          <Card title="System Information" className="shadow-sm">
            {weatherLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Spin size="small" />
                Loading weather...
              </div>
            ) : currentWeather ? (
              <div className="space-y-2">
                <p><strong>Outside Temp:</strong> {currentWeather.temperature?.toFixed?.(1) ?? currentWeather.temperature}°C</p>
                <p><strong>Feels Like:</strong> {currentWeather.feelslike?.toFixed?.(1) ?? currentWeather.feelslike ?? '—'}°C</p>
                <p><strong>Weather:</strong> {currentWeather.condition_text ?? '—'}</p>
                <p><strong>Humidity:</strong> {currentWeather.humidity ?? '—'}%</p>
                <p><strong>Wind Speed:</strong> {currentWeather.wind_kph ?? '—'} km/h</p>
                <p><strong>Today Min/Max:</strong> {currentWeather.temp_min ?? '—'}°C / {currentWeather.temp_max ?? '—'}°C</p>
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">No weather data available</p>
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card title="Boiler Status" className="shadow-sm">
            <div className="space-y-2">
              <p><strong>Suggested Flow Temp:</strong> {data.boiler.suggestedFlowTemp.toFixed(1)}°C</p>
              <p><strong>Actual Flow Temp:</strong> {data.boiler.actualFlowTemp.toFixed(1)}°C</p>
              <p><strong>Delta:</strong> {(data.boiler.actualFlowTemp - data.boiler.suggestedFlowTemp).toFixed(1)}°C</p>
            </div>
          </Card>
        </Col>
      </Row>

      {/* ALERTS AND WARNINGS */}
      {alerts.length > 0 && (
        <Card title={<div className="flex items-center gap-2"><WarningOutlined /> Upozorenja i preporuke</div>} className="shadow-sm">
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {alerts.map((a, idx) => (
              <Alert key={idx} type={a.type} showIcon icon={a.icon} message={a.message} />
            ))}
          </Space>
        </Card>
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <Card title="Daily Heating Schedule" className="shadow-sm">
            {scheduleByDay.length > 0 ? (
              <Collapse
                ghost
                items={[
                  {
                    key: 'active-program',
                    label: (
                      <div className="flex items-center gap-3">
                        <Badge color="#22c55e" text={null} />
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold tracking-wide uppercase text-slate-500 dark:text-slate-400">
                            Active Program
                          </span>
                          {activeProgram ? (
                            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
                              {formatStartMinute(activeProgram.startMinute)} · {activeProgram.targetTemp.toFixed(1)}°C
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              No active program
                            </span>
                          )}
                        </div>
                      </div>
                    ),
                    children: (
                      <div className="grid gap-3 mt-2 md:grid-cols-2 xl:grid-cols-3">
                        {scheduleByDay.map((day) => (
                          <div
                            key={day.dayType}
                            className="p-3 border rounded-lg border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40"
                          >
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold tracking-wide uppercase text-slate-600 dark:text-slate-300">
                                {day.dayType}
                              </p>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                {day.programs.length} blocks
                              </span>
                            </div>
                            <div className="mt-2 space-y-2">
                              {day.programs.map((p) => {
                                const isActive =
                                  activeProgram?.dayType === p.dayType &&
                                  activeProgram?.orderIndex === p.orderIndex;
                                return (
                                  <div
                                    key={`${day.dayType}-${p.orderIndex}`}
                                    className={`flex items-center justify-between rounded-md border px-3 py-2 text-xs shadow-sm ${
                                      isActive
                                        ? 'border-emerald-400 bg-emerald-100 font-bold text-emerald-800 shadow-lg shadow-emerald-200/50 dark:border-emerald-500/60 dark:bg-emerald-500/20 dark:text-emerald-100 dark:shadow-emerald-500/20'
                                        : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                                    }`}
                                  >
                                    <span className={`font-mono ${isActive ? 'font-bold' : ''}`}>
                                      {formatStartMinute(p.startMinute)}
                                    </span>
                                    <span className={`text-sm ${isActive ? 'font-bold' : 'font-semibold'}`}>
                                      {p.targetTemp.toFixed(1)}°C
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ),
                  },
                ]}
              />
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">No thermostat schedule configured.</p>
            )}
          </Card>
        </Col>
      </Row>

      <Card
        title="Heating Events"
        className="shadow-sm"
        extra={
          <DatePicker.RangePicker
            showTime
            value={range}
            onChange={(values) => {
              if (values?.[0] && values?.[1]) setRange([values[0], values[1]]);
            }}
          />
        }
      >
        <Row gutter={[16, 16]} className="mb-4">
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="Total Cycles"
              value={summaryMetrics.totalCycles}
              prefix={<FireOutlined />}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="Total Heating Time"
              value={summaryMetrics.totalDurationMin}
              suffix="min"
              prefix={<ClockCircleOutlined />}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="Avg Duration"
              value={summaryMetrics.avgDurationMin}
              suffix="min"
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="Avg Indoor Temp"
              value={summaryMetrics.avgIndoorTemp}
              suffix="°C"
            />
          </Col>
        </Row>

        <div className="mb-4">
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
              customContent: (title, items) => {
                if (!items || items.length === 0) return null;
                const datum = chartData.find(d => d.label === title);
                if (!datum) return null;

                return (
                  <div className="p-3 bg-white border rounded-lg shadow-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800">
                    <div className="space-y-1">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{title}</div>
                      <div className="text-sm text-slate-600 dark:text-slate-300">
                        Trajanje: <span className="font-medium">{datum.totalDurationMin} min</span>
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-300">
                        Ciklusa: <span className="font-medium">{datum.cycles}</span>
                      </div>
                      {(datum as any).avgTargetTemp && (
                        <div className="text-sm text-slate-600 dark:text-slate-300">
                          Prosj. target: <span className="font-medium">{(datum as any).avgTargetTemp.toFixed(1)}°C</span>
                        </div>
                      )}
                      {(datum as any).avgCurrentTemp && (
                        <div className="text-sm text-slate-600 dark:text-slate-300">
                          Prosj. stvarna: <span className="font-medium">{(datum as any).avgCurrentTemp.toFixed(1)}°C</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
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

        <Table
          loading={rangeLoading}
          dataSource={eventsWithBucket}
          columns={columns}
          pagination={{ pageSize: 10 }}
          rowKey={(record) => record.id}
          size="small"
          rowClassName={(record) =>
            record.bucketLabel === activeBucket
              ? 'bg-amber-50 dark:bg-amber-500/10'
              : ''
          }
          onRow={(record) => ({
            onMouseEnter: () => setActiveBucket(record.bucketLabel),
            onMouseLeave: () => setActiveBucket(null),
          })}
        />
      </Card>

      {/* NOTIFICATION DRAWER */}
      <Drawer
        title={<div className="flex items-center gap-2"><BellOutlined /> Notifikacije</div>}
        placement="right"
        width={400}
        onClose={() => setNotificationDrawerOpen(false)}
        open={notificationDrawerOpen}
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
            renderItem={(notif) => {
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
                  onClick={() => !notif.isRead && handleMarkNotificationAsRead(notif.id)}
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
            }}
          />
        )}
      </Drawer>

      {/* NOTIFICATION SETTINGS MODAL */}
      <Modal
        title={<div className="flex items-center gap-2"><SettingOutlined /> Postavke notifikacija</div>}
        open={notificationSettingsOpen}
        onCancel={() => setNotificationSettingsOpen(false)}
        footer={null}
        width={600}
      >
        {notificationsLoading ? (
          <div className="flex items-center justify-center h-64">
            <Spin size="large" />
          </div>
        ) : notificationPreferences.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <SettingOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
            <Text type="secondary">Učitavanje postavki...</Text>
            <Text type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
              Ako se postavke ne učitaju, pokušajte osvježiti stranicu
            </Text>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 16, padding: '12px 16px', backgroundColor: '#f0f9ff', borderRadius: 8 }}>
              <Space direction="vertical" size={4}>
                <Text strong style={{ color: '#0369a1' }}>
                  <InfoCircleOutlined /> Upravljajte vašim notifikacijama
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Odaberite koje tipove notifikacija želite primati. Sve promjene se odmah primjenjuju.
                </Text>
              </Space>
            </div>
            <List
              dataSource={notificationPreferences}
              renderItem={(pref) => {
                const getLabel = (type: string) => {
                  const labels: Record<string, string> = {
                    'DAILY_RECOMMENDATION': 'Dnevne preporuke',
                    'FLOW_TEMP_CHANGED': 'Promjena temperature polazne vode',
                    'HEATING_STARTED': 'Početak grijanja',
                    'HEATING_ENDED': 'Kraj grijanja',
                    'SYSTEM_ALERT': 'Sistemska upozorenja',
                    'GAS_READING_REMINDER': 'Podsjetnik za očitanje plina',
                  };
                  return labels[type] || type.replace(/_/g, ' ');
                };

                const getDescription = (type: string) => {
                  const descriptions: Record<string, string> = {
                    'DAILY_RECOMMENDATION': 'Preporuke za optimizaciju grijanja svakog dana',
                    'FLOW_TEMP_CHANGED': 'Obavještenja kada se promijeni temperatura bojlera',
                    'HEATING_STARTED': 'Obavještenje kada sistem počne grijati',
                    'HEATING_ENDED': 'Obavještenje kada sistem prestane grijati',
                    'SYSTEM_ALERT': 'Važna upozorenja o radu sistema',
                    'GAS_READING_REMINDER': 'Podsjetnici za unos očitanja plina',
                  };
                  return descriptions[type] || 'Primaj notifikacije za ovaj tip događaja';
                };

                return (
                  <List.Item>
                    <List.Item.Meta
                      title={getLabel(pref.type)}
                      description={
                        <Space direction="vertical" size={2}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {getDescription(pref.type)}
                          </Text>
                          {pref.updatedAt && (
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              Posljednja izmjena: {dayjs(pref.updatedAt).format('DD.MM.YYYY HH:mm')}
                            </Text>
                          )}
                        </Space>
                      }
                    />
                    <Switch
                      checked={pref.enabled}
                      onChange={async (checked) => {
                        try {
                          await apiClient.updateNotificationPreference(pref.type, checked);
                          message.success(`Postavke za "${getLabel(pref.type)}" ažurirane`);
                          await loadNotifications();
                        } catch (error) {
                          console.error('Failed to update preference:', error);
                          message.error('Greška pri ažuriranju postavki');
                        }
                      }}
                    />
                  </List.Item>
                );
              }}
            />
          </>
        )}
      </Modal>
    </div>
  );
};
