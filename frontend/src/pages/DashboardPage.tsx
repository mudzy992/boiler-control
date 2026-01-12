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

import {
  getDashboard,
  getHeatingEvents,
  getHeatingStats,
  getLearningTrends,
} from "../api/dashboard.api";
import { manualSyncBoiler } from "../api/boiler.api";

const { Title, Text } = Typography;

export const DashboardPage = () => {
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

  /* =========================
     HELPERS
  ========================= */
  const isSingleDay = useMemo(
    () => dateRange[0].isSame(dateRange[1], "day"),
    [dateRange]
  );
  const bucket: "hour" | "day" = isSingleDay ? "hour" : "day";

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
    thermostat.program.forEach((p: any) => {
      const h = Math.floor(p.startMinute / 60);
      const m = (p.startMinute % 60).toString().padStart(2, "0");
      const str = `${h}:${m} - ${p.targetTemp}°C`;
      if (p.dayType === "WORKDAY") grouped.WORKING_DAY.push(str);
      if (p.dayType === "SATURDAY") grouped.SATURDAY.push(str);
      if (p.dayType === "SUNDAY") grouped.SUNDAY.push(str);
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
                <Descriptions.Item label="Temperatura polazne vode">{boiler.suggestedTemp} °C</Descriptions.Item>
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
          ]}
        />
      </Card>

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
    </div>
  );
};
