import { useEffect, useMemo, useState, useCallback } from "react";
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
  Modal,
  Switch,
  List,
  Drawer,
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
import {
  SyncOutlined,
  BellOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

import {
  getDashboard,
  getHeatingEvents,
  getHeatingStats,
  getLearningTrends,
} from "../api/dashboard.api";
import { manualSyncBoiler } from "../api/boiler.api";
import { updateHeatingAnomaly } from "../api/heating.anomaly.api";
import {
  getNotifications,
  getNotificationPreferences,
  updateNotificationPreference,
  type Notification,
  type NotificationPreference,
} from "../api/notification.api";

const { Title, Text } = Typography;

export const DashboardPage = () => {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<any>(null);
  const [selectedHomeId, setSelectedHomeId] = useState<number | null>(null);
  // Default to today's range (00:00:00 to now)
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().startOf("day"),
    dayjs(),
  ]);
  const [events, setEvents] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [learning, setLearning] = useState<any[]>([]);
  const [anomalyEndTime, setAnomalyEndTime] = useState<dayjs.Dayjs | null>(null);

  // Notifications
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreference[]>([]);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [notificationSettingsOpen, setNotificationSettingsOpen] = useState(false);

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
        // Use current time instead of end of day for today
        to: dateRange[0].isSame(dayjs(), "day")
          ? dayjs().toISOString()
          : dateRange[0].endOf("day").toISOString(),
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

  const loadNotifications = useCallback(async () => {
    try {
      const [notifs, prefs] = await Promise.all([
        getNotifications(),
        getNotificationPreferences(),
      ]);
      setNotifications(notifs);
      setNotificationPreferences(prefs);
    } catch (error) {
      console.error("Failed to load notifications:", error);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    loadNotifications();
  }, [loadNotifications]);

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
    const a: { type: "warning" | "error" | "info"; message: string; icon: any }[] = [];

    // Short cycles detection
    const shortCycles = events.filter((e) => e.durationMinutes < 20);
    if (shortCycles.length >= 3) {
      a.push({
        type: "warning",
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
        type: "warning",
        message: `Mogući overshoot - prosječna razlika: ${overshootAvg.toFixed(1)}°C`,
        icon: <WarningOutlined />,
      });
    }

    // Long cycles detection
    const longCycles = events.filter((e) => e.durationMinutes > 90);
    if (longCycles.length > 0) {
      a.push({
        type: "info",
        message: `Detektovano ${longCycles.length} dugih ciklusa grijanja (> 90 min)`,
        icon: <InfoCircleOutlined />,
      });
    }

    // Anomalies
    const anomalies = events.filter((e) => e.isAnomaly);
    if (anomalies.length > 0) {
      a.push({
        type: "error",
        message: `${anomalies.length} anomalija(e) u odabranom periodu`,
        icon: <WarningOutlined />,
      });
    }

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

  // Custom tooltip for graph
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Card size="small" style={{ minWidth: 200 }}>
          <Space direction="vertical" size="small">
            <Text strong>{data.label}</Text>
            <Text>Trajanje: {data.totalDurationMin} min</Text>
            <Text>Ciklusa: {data.cycles}</Text>
            {data.avgTargetTemp && (
              <Text>Prosj. target: {data.avgTargetTemp.toFixed(1)}°C</Text>
            )}
            {data.avgCurrentTemp && (
              <Text>Prosj. stvarna: {data.avgCurrentTemp.toFixed(1)}°C</Text>
            )}
          </Space>
        </Card>
      );
    }
    return null;
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
          <Space>
            <Badge count={notifications.filter(n => !n.sourceRef?.includes('read')).length}>
              <Button
                icon={<BellOutlined />}
                onClick={() => setNotificationDrawerOpen(true)}
              >
                Notifikacije
              </Button>
            </Badge>
            <Button
              icon={<SettingOutlined />}
              onClick={() => setNotificationSettingsOpen(true)}
            >
              Postavke
            </Button>
            <Button icon={<SyncOutlined />} onClick={manualSyncBoiler}>
              Refresh
            </Button>
          </Space>
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

                            // Better color scheme for light/dark theme compatibility
                            let color = "blue";
                            if (temp <= 21) color = "cyan";
                            else if (temp >= 23) color = "red";

                            // Check if this is the active interval
                            const now = dayjs();
                            const dayOfWeek = now.day();
                            let currentDayKey = "WORKING_DAY";
                            if (dayOfWeek === 6) currentDayKey = "SATURDAY";
                            else if (dayOfWeek === 0) currentDayKey = "SUNDAY";

                            const isActiveDay = currentDayKey === dayKey;
                            const nowMinutes = now.hour() * 60 + now.minute();
                            const timeMatch = interval.match(/(\d+):(\d+)/);
                            let isActive = false;

                            if (isActiveDay && timeMatch) {
                              const [, h, m] = timeMatch;
                              const intervalStart = parseInt(h) * 60 + parseInt(m);
                              const nextInterval = intervals[dayKey][idx + 1];
                              let intervalEnd = 24 * 60; // end of day

                              if (nextInterval) {
                                const nextMatch = nextInterval.match(/(\d+):(\d+)/);
                                if (nextMatch) {
                                  const [, nh, nm] = nextMatch;
                                  intervalEnd = parseInt(nh) * 60 + parseInt(nm);
                                }
                              }

                              isActive = nowMinutes >= intervalStart && nowMinutes < intervalEnd;
                            }

                            return (
                              <Tag
                                color={isActive ? "green" : color}
                                key={idx}
                                style={isActive ? {
                                  fontWeight: "bold",
                                  border: "2px solid",
                                  boxShadow: "0 0 8px rgba(82, 196, 26, 0.5)"
                                } : {}}
                              >
                                {interval}
                              </Tag>
                            );
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
        <Card style={{ marginTop: 12 }} title={<><WarningOutlined /> Upozorenja i preporuke</>}>
          <Space direction="vertical" style={{ width: "100%" }}>
            {alerts.map((a, idx) => (
              <Alert key={idx} type={a.type} showIcon icon={a.icon} message={a.message} />
            ))}
          </Space>
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
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="totalDurationMin" fill="#1890ff" />
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

      {/* NOTIFICATION DRAWER */}
      <Drawer
        title={<><BellOutlined /> Notifikacije</>}
        placement="right"
        width={400}
        onClose={() => setNotificationDrawerOpen(false)}
        open={notificationDrawerOpen}
      >
        <List
          dataSource={notifications}
          locale={{ emptyText: "Nema notifikacija" }}
          renderItem={(notif) => {
            const getIcon = () => {
              if (notif.type.includes("ANOMALY")) return <WarningOutlined style={{ color: "#faad14" }} />;
              if (notif.type.includes("ERROR")) return <WarningOutlined style={{ color: "#ff4d4f" }} />;
              if (notif.type.includes("SUCCESS")) return <CheckCircleOutlined style={{ color: "#52c41a" }} />;
              return <InfoCircleOutlined style={{ color: "#1890ff" }} />;
            };

            return (
              <List.Item>
                <List.Item.Meta
                  avatar={getIcon()}
                  title={notif.title}
                  description={
                    <Space direction="vertical" size="small">
                      <Text>{notif.message}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {dayjs(notif.sentAt).format("DD.MM.YYYY HH:mm")}
                      </Text>
                    </Space>
                  }
                />
              </List.Item>
            );
          }}
        />
      </Drawer>

      {/* NOTIFICATION SETTINGS MODAL */}
      <Modal
        title={<><SettingOutlined /> Postavke notifikacija</>}
        open={notificationSettingsOpen}
        onCancel={() => setNotificationSettingsOpen(false)}
        footer={null}
        width={500}
      >
        <List
          dataSource={notificationPreferences}
          locale={{ emptyText: "Nema dostupnih postavki" }}
          renderItem={(pref) => (
            <List.Item>
              <List.Item.Meta
                title={pref.type.replace(/_/g, " ")}
                description={`Posljednje ažurirano: ${dayjs(pref.updatedAt).format("DD.MM.YYYY HH:mm")}`}
              />
              <Switch
                checked={pref.enabled}
                onChange={async (checked) => {
                  try {
                    await updateNotificationPreference(pref.type, checked);
                    message.success("Postavke ažurirane");
                    await loadNotifications();
                  } catch {
                    message.error("Greška pri ažuriranju postavki");
                  }
                }}
              />
            </List.Item>
          )}
        />
      </Modal>
    </div>
  );
};
