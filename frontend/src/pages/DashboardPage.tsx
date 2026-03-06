<<<<<<< Updated upstream
import { useEffect, useMemo, useState } from "react";
import {
  Card,
  Col,
  Row,
  Typography,
  Statistic,
  Table,
  Tag,
  Button,
  DatePicker,
  Spin,
  message,
  Badge,
  Space,
  Alert,
  Descriptions,
} from "antd";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { SyncOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
=======
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Row, Col, Card, Spin, message, Table, Tag, DatePicker, Collapse, Badge, Drawer, List, Typography, Space, Modal, Switch, Alert, Button, InputNumber } from 'antd';
import { FireOutlined, AlertOutlined, HomeOutlined, ClockCircleOutlined, BellOutlined, SettingOutlined, WarningOutlined, InfoCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { apiClient } from '../services/api';
import { StatCard } from '../components/StatCard';
import { Column } from '@ant-design/plots';
import dayjs, { Dayjs } from 'dayjs';
import { useQuery } from '@tanstack/react-query';
>>>>>>> Stashed changes

import {
  getDashboard,
  getHeatingEvents,
  getHeatingStats,
  getLearningTrends,
} from "../api/dashboard.api";
import { manualSyncBoiler } from "../api/boiler.api";
import { updateHeatingAnomaly } from "../api/heating.anomaly.api";

const { Title, Text } = Typography;

<<<<<<< Updated upstream
export const DashboardPage = () => {
=======
interface NotificationPreference {
  userId: number;
  type: string;
  enabled: boolean;
}

// Type definitions matching actual backend response
interface Weather {
  temp?: number;
  feelsLike?: number;
  condition?: string;
  humidity?: number;
  windSpeed?: number;
  tempMin?: number;
  tempMax?: number;
  fetchedAt?: string;
  // raw fields from current weather endpoint (WeatherCache)
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

const MIN_CURRENT_FLOW_TEMP = 48;
const MAX_CURRENT_FLOW_TEMP = 55;

export const DashboardPage: React.FC = () => {
  const [data, setData] = useState<ProcessedDashboard | null>(null);
>>>>>>> Stashed changes
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<any>(null);
  const [selectedHomeId, setSelectedHomeId] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().startOf("day"),
    dayjs().endOf("day"),
  ]);
  const [events, setEvents] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [learning, setLearning] = useState<any[]>([]);
  const [anomalyEndTime, setAnomalyEndTime] = useState<dayjs.Dayjs | null>(null);

<<<<<<< Updated upstream
  /* =========================
     HELPERS
  ========================= */
  const isSingleDay = useMemo(
    () => dateRange[0].isSame(dateRange[1], "day"),
    [dateRange]
  );
  const bucket: "hour" | "day" = isSingleDay ? "hour" : "day";
=======
  // Notification states
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreference[]>([]);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [notificationSettingsOpen, setNotificationSettingsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [setTempModalOpen, setSetTempModalOpen] = useState(false);
  const [setTempValue, setSetTempValue] = useState<number | null>(null);
  const [setTempSubmitting, setSetTempSubmitting] = useState(false);
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes

  const normalizedRange = useMemo(() => {
    if (isSingleDay) {
      return {
        from: dateRange[0].startOf("day").toISOString(),
        to: dateRange[0].endOf("day").toISOString(),
      };
    }
    return {
      from: dateRange[0].startOf("day").toISOString(),
      to: dateRange[1].endOf("day").toISOString(),
    };
  }, [dateRange, isSingleDay]);

  /* =========================
     DATA LOAD
  ========================= */
  const loadDashboard = async () => {
    setLoading(true);
    try {
      const data = await getDashboard();
      setDashboard(data);
      if (data.homes.length > 0) setSelectedHomeId(data.homes[0].profile.id);
    } catch {
      message.error("Greška prilikom učitavanja dashboarda");
    } finally {
      setLoading(false);
    }
  };

  const loadHeatingData = async () => {
    if (!selectedHomeId) return;
    try {
      const ev = await getHeatingEvents({
        homeProfileId: selectedHomeId,
        ...normalizedRange,
      });
      const st = await getHeatingStats({
        homeProfileId: selectedHomeId,
        ...normalizedRange,
        bucket,
      });
      const lr = await getLearningTrends({
        homeProfileId: selectedHomeId,
        from: dayjs().subtract(30, "day").toISOString(),
        to: new Date().toISOString(),
      });

      setEvents(ev.data);
      setStats(st.buckets);
      setLearning(lr.points);
    } catch {
      message.error("Greška prilikom učitavanja podataka grijanja");
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (selectedHomeId) loadHeatingData();
  }, [selectedHomeId, normalizedRange]);

  /* =========================
     DERIVED DATA
  ========================= */
  const home = useMemo(() => {
    if (!dashboard || !selectedHomeId) return null;
    return dashboard.homes.find((h: any) => h.profile.id === selectedHomeId);
  }, [dashboard, selectedHomeId]);

  const thermostat = useMemo(() => home?.thermostats?.[0] || null, [home]);

  const heatingActive = useMemo(() => {
    const lastEvent = home?.recentHeatingEvents?.[0];
    return lastEvent?.hvacAction === "HEATING_ON";
  }, [home]);

  const intervals = useMemo(() => {
    if (!thermostat) return null;
    const grouped: Record<string, string[]> = {
      WORKING_DAY: [],
      SATURDAY: [],
      SUNDAY: [],
    };
<<<<<<< Updated upstream
    thermostat.program.forEach((p: any) => {
      const h = Math.floor(p.startMinute / 60);
      const m = (p.startMinute % 60).toString().padStart(2, "0");
      const str = `${h}:${m} - ${p.targetTemp}°C`;
      if (p.dayType === "WORKDAY") grouped.WORKING_DAY.push(str);
      if (p.dayType === "SATURDAY") grouped.SATURDAY.push(str);
      if (p.dayType === "SUNDAY") grouped.SUNDAY.push(str);
=======

    fetchDashboard();
    loadNotifications();
  }, [loadNotifications]);

  const openSetTempModal = useCallback(() => {
    const boiler = data?.boiler;
    const fallback =
      typeof boiler?.actualFlowTemp === 'number'
        ? boiler.actualFlowTemp
        : boiler?.suggestedFlowTemp ?? 52;
    setSetTempValue(Number(fallback.toFixed(1)));
    setSetTempModalOpen(true);
  }, [data?.boiler]);

  const submitSetTemp = useCallback(async () => {
    if (typeof setTempValue !== 'number' || Number.isNaN(setTempValue)) {
      message.error('Enter a valid temperature value');
      return;
    }

    if (setTempValue < MIN_CURRENT_FLOW_TEMP || setTempValue > MAX_CURRENT_FLOW_TEMP) {
      message.error(
        `Temperature must be between ${MIN_CURRENT_FLOW_TEMP}°C and ${MAX_CURRENT_FLOW_TEMP}°C`,
      );
      return;
    }

    try {
      setSetTempSubmitting(true);
      await apiClient.setBoilerCurrentTemp(Number(setTempValue.toFixed(1)));

      const result = (await apiClient.getDashboard()) as DashboardResponse;
      setData(processDashboardData(result));

      message.success('Current boiler temperature updated');
      setSetTempModalOpen(false);
    } catch (error) {
      console.error('Failed to update current boiler temp:', error);
      message.error('Failed to update current boiler temperature');
    } finally {
      setSetTempSubmitting(false);
    }
  }, [setTempValue]);

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
>>>>>>> Stashed changes
    });
    return grouped;
  }, [thermostat]);

  const summary = useMemo(() => {
    if (events.length === 0) return null;
    const totalMinutes = events.reduce((s, e) => s + e.durationMinutes, 0);
    return {
      cycles: events.length,
      totalMinutes,
      avgDuration: Math.round(totalMinutes / events.length),
      avgTarget: (events.reduce((s, e) => s + e.targetTemp, 0) / events.length).toFixed(1),
    };
  }, [events]);

  const activeAnomaly = useMemo(() => {
    console.log(events)
  return events.find(
    (e) => e.isAnomaly && !e.endedAt
  );
}, [events]);

useEffect(() => {
  if (activeAnomaly?.proposedEndTime) {
    setAnomalyEndTime(dayjs(activeAnomaly.proposedEndTime));
  } else {
    setAnomalyEndTime(null);
  }
}, [activeAnomaly]);

  const alerts = useMemo(() => {
    const a: string[] = [];
    if (events.filter((e) => e.durationMinutes < 20).length >= 3) {
      a.push("Detektovani česti kratki ciklusi grijanja");
    }
    const overshootAvg =
      events.reduce((s, e) => s + (e.targetTemp - e.currentTemp), 0) /
      (events.length || 1);
    if (overshootAvg > 1.5) a.push("Mogući overshoot (previsoka ciljna temperatura)");
    return a;
  }, [events]);

  const getCurrentIntervalTemp = (
    intervals: Record<string, string[]>,
    events: any[]
  ) => {
    const now = dayjs();
    const dayOfWeek = now.day();
    let dayKey = "WORKING_DAY";
    if (dayOfWeek === 6) dayKey = "SATURDAY";
    else if (dayOfWeek === 0) dayKey = "SUNDAY";
    const dayIntervals = intervals[dayKey] || [];
    const nowMinutes = now.hour() * 60 + now.minute();
    let currentTarget = dayIntervals[0]?.match(/(\d+:\d+)/)?.[0] || null;
    for (let i = 0; i < dayIntervals.length; i++) {
      const match = dayIntervals[i].match(/(\d+):(\d+)/);
      if (!match) continue;
      const [, h, m] = match;
      const intervalStart = parseInt(h) * 60 + parseInt(m);
      if (intervalStart <= nowMinutes) currentTarget = dayIntervals[i];
      else break;
    }
    const lastEvent = events.find(
      (e) => dayjs(e.startedAt).isBefore(now) && dayjs(e.endedAt).isAfter(now)
    );
    if (lastEvent) return lastEvent.currentTemp;
    const tempMatch = currentTarget?.match(/(\d+(\.\d+)?)°C/);
    return tempMatch ? parseFloat(tempMatch[1]) : "-";
  };

  if (loading) return <Spin fullscreen />;
  if (!dashboard || !home) return null;

  const weather = dashboard.system.weather;
  const boiler = dashboard.system.boiler;

  return (
    <div style={{ padding: 16 }}>
      <Row justify="space-between" align="middle" gutter={[16, 16]}>
        <Col xs={24} sm={12}>
          <Title level={3}>Boiler Control Dashboard</Title>
        </Col>
        <Col xs={24} sm={12} style={{ textAlign: "right" }}>
          <Button icon={<SyncOutlined />} onClick={manualSyncBoiler}>
            Refresh
          </Button>
        </Col>
      </Row>

      {/* === TOP STATUS CARDS === */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={8}>
          <Card title="Vremenska prognoza">
            {weather ? (
              <Descriptions size="small" column={1}>
                <Descriptions.Item label="Temperatura">{weather.temperature.toFixed()} °C</Descriptions.Item>
                <Descriptions.Item label="Osjećaj">{weather.feelslike.toFixed()} °C</Descriptions.Item>
                <Descriptions.Item label="Vlažnost">{weather.humidity} %</Descriptions.Item>
                <Descriptions.Item label="Vjetar">{weather.wind_kph} km/h</Descriptions.Item>
                <Descriptions.Item label="Pritisak">{weather.pressure_mb} hPa</Descriptions.Item>
                <Descriptions.Item label="Stanje">{weather.condition_text}</Descriptions.Item>
              </Descriptions>
            ) : (
              <Text type="secondary">Nema podataka</Text>
            )}
          </Card>
        </Col>
<<<<<<< Updated upstream

        <Col xs={24} sm={12} lg={8}>
          <Card
            title="Aktivni termostat"
            extra={
              <Badge
                status={heatingActive ? "processing" : "default"}
                text={heatingActive ? "Grije" : "Miruje"}
              />
            }
          >
            {thermostat ? (
              <Descriptions size="small" column={1}>
                <Descriptions.Item label="Target temperatura">
                  {getCurrentIntervalTemp(intervals!, home.recentHeatingEvents)} °C
                </Descriptions.Item>
                <Descriptions.Item label="Temperatura polazne vode">{boiler.suggestedFlowTemp} °C</Descriptions.Item>
                <Descriptions.Item label="Mode">
                  <Tag color="blue">{thermostat.mode}</Tag>
                </Descriptions.Item>
              </Descriptions>
            ) : (
              <Text type="secondary">Nema aktivnog termostata</Text>
            )}
          </Card>
        </Col>

        <Col xs={24} sm={24} lg={8}>
          <Card title="Intervali grijanja">
            {intervals ? (
              <Descriptions size="small" column={1}>
                {["WORKING_DAY", "SATURDAY", "SUNDAY"].map((dayKey) => (
                  <Descriptions.Item key={dayKey} label={dayKey.replace("_", " ")}>
                    <Space wrap>
                      {intervals[dayKey]?.length > 0
                        ? intervals[dayKey].map((interval: string, idx: number) => {
                            const tempMatch = interval.match(/(\d+(\.\d+)?)°C/);
                            const temp = tempMatch ? parseFloat(tempMatch[1]) : 22;
                            let color = "blue";
                            if (temp <= 21) color = "cyan";
                            else if (temp >= 23) color = "volcano";
                            return <Tag color={color} key={idx}>{interval}</Tag>;
                          })
                        : <Text type="secondary">-</Text>}
                    </Space>
                  </Descriptions.Item>
                ))}
              </Descriptions>
            ) : (
              <Text type="secondary">Intervali nisu definirani</Text>
            )}
=======
        <Col xs={24} sm={12}>
          <Card
            title="Boiler Status"
            className="shadow-sm"
            extra={
              <Button size="small" type="primary" onClick={openSetTempModal}>
                Set current temp
              </Button>
            }
          >
            <div className="space-y-2">
              <p><strong>Suggested Flow Temp:</strong> {data.boiler.suggestedFlowTemp.toFixed(1)}°C</p>
              <p>
                <strong>Actual Flow Temp:</strong>{' '}
                {typeof data.boiler.actualFlowTemp === 'number'
                  ? `${data.boiler.actualFlowTemp.toFixed(1)}°C`
                  : '—'}
              </p>
              <p>
                <strong>Delta:</strong>{' '}
                {typeof data.boiler.actualFlowTemp === 'number'
                  ? `${(data.boiler.actualFlowTemp - data.boiler.suggestedFlowTemp).toFixed(1)}°C`
                  : '—'}
              </p>
            </div>
>>>>>>> Stashed changes
          </Card>
        </Col>
      </Row>

      {/* SUMMARY */}
      {summary && (
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={6}><Card><Statistic title="Ciklusi" value={summary.cycles} /></Card></Col>
          <Col xs={12} sm={6}><Card><Statistic title="Ukupno grijanje" value={summary.totalMinutes} suffix="min" /></Card></Col>
          <Col xs={12} sm={6}><Card><Statistic title="Prosj. trajanje" value={summary.avgDuration} suffix="min" /></Card></Col>
          <Col xs={12} sm={6}><Card><Statistic title="Prosj. target" value={summary.avgTarget} suffix="°C" /></Card></Col>
        </Row>
      )}

      {activeAnomaly && (
  <Card style={{ marginTop: 12 }}>
    <Alert
      type="warning"
      showIcon
      message="Detektovana anomalija grijanja"
      description={
        <Space direction="vertical" style={{ width: "100%" }}>
          <Text>
            Sistem je primijetio da trenutni ciklus grijanja značajno
            odstupa od uobičajenog trajanja za ovaj termin.
          </Text>

          <Text strong>
            Predloženi završetak:&nbsp;
            {activeAnomaly.proposedEndTime
              ? dayjs(activeAnomaly.proposedEndTime).format("DD.MM.YYYY HH:mm")
              : "nije dostupan"}
          </Text>

          <Space>
            <DatePicker
              showTime
              value={anomalyEndTime}
              onChange={(v) => setAnomalyEndTime(v)}
            />

            <Button
              type="primary"
              onClick={async () => {
                try {
                  await updateHeatingAnomaly(activeAnomaly.id, {
                    proposedEndTime: anomalyEndTime
                      ? anomalyEndTime.toISOString()
                      : undefined,
                    confirm: true,
                  });

                  message.success("Anomalija potvrđena");
                  await loadHeatingData();
                } catch {
                  message.error("Greška pri potvrdi anomalije");
                }
              }}
            >
              Potvrdi završetak
            </Button>
          </Space>
        </Space>
      }
    />
  </Card>
)}

      {alerts.length > 0 && (
        <Card style={{ marginTop: 12 }}>
          {alerts.map((a) => (
            <Alert key={a} type="warning" showIcon message={a} />
          ))}
        </Card>
      )}

      {/* RANGE + GRAPH */}
      <Card style={{ marginTop: 16 }}>
        <Space style={{ marginBottom: 12 }} wrap>
          <DatePicker.RangePicker value={dateRange} onChange={(v) => v && setDateRange([v[0]!, v[1]!])} />
          <Tag color="blue">{isSingleDay ? "Grafika po satu" : "Grafika po danu"}</Tag>
          <Badge status={heatingActive ? "processing" : "default"} text={heatingActive ? "Grijanje aktivno" : "Grijanje neaktivno"} />
        </Space>

        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={stats}>
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="totalDurationMin" />
          </BarChart>
        </ResponsiveContainer>

        <Table
          style={{ marginTop: 16 }}
          size="small"
          dataSource={events}
          rowKey={(r) => `${r.deviceId}-${r.startedAt}`}
          pagination={{ pageSize: 8 }}
          columns={[
            { title: "Start", dataIndex: "startedAt", render: (v) => dayjs(v).format("DD.MM HH:mm") },
            { title: "End", dataIndex: "endedAt", render: (v) => v ? dayjs(v).format("DD.MM HH:mm") : "-" },
            { title: "Target", dataIndex: "targetTemp" },
            { title: "Current", dataIndex: "currentTemp" },
            { title: "Trajanje", dataIndex: "durationMinutes", render: (v) => `${v} min` },
            {
  title: "Anomalija",
  dataIndex: "isAnomaly",
  render: (_, record) => {
    if (!record.isAnomaly) return null;
    return (
      <Space direction="vertical" size={4}>
        <Alert
          type="warning"
          message={`Predloženi završetak: ${record.proposedEndTime ? dayjs(record.proposedEndTime).format("DD.MM HH:mm") : "-"}`}

          showIcon
        />
        <Space>
          <DatePicker
            showTime
            value={record.proposedEndTime ? dayjs(record.proposedEndTime) : null}
            onChange={(v) => record.proposedEndTime = v?.toISOString() || null}
          />
          <Button
            type="primary"
            size="small"
            onClick={async () => {
              try {
                await updateHeatingAnomaly(record.id, {
                  proposedEndTime: record.proposedEndTime || undefined,
                  confirm: true
                });
                message.success("Anomalija potvrđena");
                await loadHeatingData(); // refresh events
              } catch {
                message.error("Greška pri potvrdi anomalije");
              }
            }}
          >
            Potvrdi
          </Button>
        </Space>
      </Space>
    );
  }
}

          ]}
        />
      </Card>

<<<<<<< Updated upstream
      {/* LEARNING */}
      <Card title="Learning trend (30 dana)" style={{ marginTop: 16 }}>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={learning}>
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line dataKey="avgConfidence" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
=======
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

      <Modal
        title="Set current flow temperature"
        open={setTempModalOpen}
        onCancel={() => setSetTempModalOpen(false)}
        onOk={submitSetTemp}
        confirmLoading={setTempSubmitting}
        okText={setTempSubmitting ? 'Saving...' : 'Save'}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Text type="secondary">
            Allowed range: {MIN_CURRENT_FLOW_TEMP}°C - {MAX_CURRENT_FLOW_TEMP}°C
          </Text>
          <InputNumber
            value={setTempValue ?? undefined}
            onChange={(value) => setSetTempValue(typeof value === 'number' ? value : null)}
            min={MIN_CURRENT_FLOW_TEMP}
            max={MAX_CURRENT_FLOW_TEMP}
            step={0.1}
            precision={1}
            style={{ width: '100%' }}
            addonAfter="°C"
          />
        </Space>
      </Modal>
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
    </div>
  );
};
