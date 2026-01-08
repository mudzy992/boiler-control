import { useEffect, useState} from "react";
import { Card, Col, Row, Typography, Statistic, Table, Tag } from "antd";
import { Thermometer, Wind, Sun, Cloud, CheckCircle, AlertCircle } from "lucide-react";
import {
  type DashboardResponse,
  getDashboard,
  type DashboardHeatingEvent,
  type DashboardHome,
} from "../api/dashboard.api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

const { Title, Text } = Typography;

export const DashboardPage = () => {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true);
      const data = await getDashboard();
      setDashboard(data);
      setLoading(false);
    };
    fetchDashboard();
  }, []);

  if (loading || !dashboard) {
    return <Text>Loading dashboard...</Text>;
  }

  // Helper za status tag
  const renderConfidenceTag = (confidence: number) => {
    if (confidence > 0.75) return <Tag color="green">High</Tag>;
    if (confidence > 0.4) return <Tag color="orange">Medium</Tag>;
    return <Tag color="red">Low</Tag>;
  };

  // Helper: izračun trajanja grijanja u minutama
  const calculateHeatingDuration = (event: DashboardHeatingEvent) => {
    if (!event.endedAt) return null;
    const start = new Date(event.startedAt);
    const end = new Date(event.endedAt);
    return Math.round((end.getTime() - start.getTime()) / 60000); // u minutama
  };

  const renderHeatingEventsTable = (events: DashboardHeatingEvent[]) => {
    const columns = [
      {
        title: "Device ID",
        dataIndex: "deviceId",
        key: "deviceId",
      },
      {
        title: "Start",
        dataIndex: "startedAt",
        key: "startedAt",
        render: (v: string) => new Date(v).toLocaleString(),
      },
      {
        title: "End",
        dataIndex: "endedAt",
        key: "endedAt",
        render: (v?: string) => (v ? new Date(v).toLocaleString() : "-"),
      },
      {
        title: "Duration (min)",
        key: "duration",
        render: (_: any, record: DashboardHeatingEvent) => {
          const duration = calculateHeatingDuration(record);
          return duration !== null ? duration : "-";
        },
      },
      {
        title: "Current Temp",
        dataIndex: "currentTemp",
        key: "currentTemp",
      },
      {
        title: "Target Temp",
        dataIndex: "targetTemp",
        key: "targetTemp",
      },
      {
        title: "HVAC Action",
        dataIndex: "hvacAction",
        key: "hvacAction",
      },
      {
        title: "Source",
        dataIndex: "source",
        key: "source",
      },
    ];
    return <Table columns={columns} dataSource={events} pagination={false} rowKey={(r) => `${r.deviceId}-${r.startedAt}`} />;
  };

  // Prepare data for graphs
  const prepareHeatingChartData = (events: DashboardHeatingEvent[]) => {
    return events.map((e) => ({
      device: e.deviceId,
      start: new Date(e.startedAt).toLocaleTimeString(),
      targetTemp: e.targetTemp,
      currentTemp: e.currentTemp,
      duration: calculateHeatingDuration(e) || 0,
    }));
  };

  return (
    <div className="max-w-7xl mx-auto p-4 bg-gray-50 rounded-md mt-3">
      <Title level={2}>Boiler Control Dashboard</Title>

      {/* SYSTEM STATUS */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title={
                <>
                  <Thermometer size={18} /> Predložena temperatura
                </>
              }
              value={dashboard.system.boiler?.suggestedTemp ?? "-"}
              suffix="°C"
            />
            <Text>Predložena temperatura podlazne vode kotla</Text>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title={
                <>
                  <Thermometer size={18} /> Min. Vanjska temp.
                </>
              }
              value={dashboard.system.boiler?.externalTemp ?? "-"}
              suffix="°C"
            />
            <Text>Minimalna dnevna vanjska temperatura</Text>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title={
                <>
                  <Sun size={18} /> Pouzdanost
                </>
              }
              value={
                dashboard.system.recommendation?.confidenceScore
                  ? Math.round(dashboard.system.recommendation.confidenceScore * 100)
                  : "-"
              }
              suffix="%"
            />
            <Text>Pouzdanost ovisi o tome koliko stvarnih podataka imamo u bazi</Text>
          </Card>
        </Col>
      </Row>

      {/* WEATHER */}
      {dashboard.system.weather && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} md={24}>
            <Card title="Trenutno vrijeme">
              <Row gutter={[16, 16]}>
                <Col>
                  <Thermometer /> Temperatura: {dashboard.system.weather.temperature}°C
                </Col>
                {dashboard.system.weather.feelslike && (
                  <Col>Osjeti se kao: {dashboard.system.weather.feelslike}°C</Col>
                )}
                {dashboard.system.weather.wind_kph && (
                  <Col>
                    <Wind /> Vjetar: {dashboard.system.weather.wind_kph} kph
                  </Col>
                )}
                {dashboard.system.weather.condition_text && (
                  <Col>
                    <Cloud /> {dashboard.system.weather.condition_text}
                  </Col>
                )}
              </Row>
            </Card>
          </Col>
        </Row>
      )}

      {/* HOME PROFILES */}
      {dashboard.homes.map((home: DashboardHome) => (
        <Card
          key={home.profile.id}
          title={`Profil doma #${home.profile.id}`}
          style={{ marginBottom: 24 }}
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Card type="inner" title="Profil Info">
                <p>Grejni prostor: {home.profile.floorArea} m²</p>
                <p>Visina boja/plafona: {home.profile.ceilingHeight} m</p>
                <p>Tip zagrijavanja: {home.profile.heatingType}</p>
                <p>Pomak učenja: {home.profile.learningOffset}</p>
                <p>Samopouzdanje u učenju: {home.profile.learningConfidence}</p>
              </Card>
            </Col>

            <Col xs={24} md={8}>
              <Card type="inner" title="Aktivni termostati">
                {home.thermostats.map((t) => (
                  <div key={t.id} style={{ marginBottom: 8 }}>
                    <Text strong>{t.alias || t.deviceId}</Text>
                    <br />
                    <Text>Proizvođač: {t.vendor}</Text>
                    <br />
                    <Text>Radi u modu: {t.mode}</Text>
                    <br />
                    <Text>Posljednja prozivka: {t.lastSeen ? new Date(t.lastSeen).toLocaleString() : "-"}</Text>
                  </div>
                ))}
              </Card>
            </Col>

            <Col xs={24} md={8}>
              <Card type="inner" title="Uvidi u učenje">
                <p>
                  Prosječno samopouzdanje:{" "}
                  {Math.round(home.insights.averageConfidence * 100)}%
                  {renderConfidenceTag(home.insights.averageConfidence)}
                </p>
                <p>Dovoljno podataka za učenje: {home.insights.hasEnoughLearningData ? <CheckCircle color="green" /> : <AlertCircle color="red" />}</p>
              </Card>
            </Col>
          </Row>

          {/* RECENT HEATING EVENTS */}
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24}>
              <Card type="inner" title="Posljednji zapisi grijanja">
                {home.recentHeatingEvents.length > 0 ? (
                  <>
                    {renderHeatingEventsTable(home.recentHeatingEvents)}

                    {/* LINE CHART: target vs current temp */}
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={prepareHeatingChartData(home.recentHeatingEvents)}>
                        <XAxis dataKey="start" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="targetTemp" stroke="#1890ff" name="Target Temp" />
                        <Line type="monotone" dataKey="currentTemp" stroke="#52c41a" name="Current Temp" />
                        <Line type="monotone" dataKey="duration" stroke="#fa8c16" name="Duration (min)" />
                      </LineChart>
                    </ResponsiveContainer>

                    {/* OPTIONAL: Bar chart samo trajanje */}
                    <ResponsiveContainer width="100%" height={150}>
                      <BarChart data={prepareHeatingChartData(home.recentHeatingEvents)}>
                        <XAxis dataKey="start" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="duration" fill="#fa8c16" name="Duration (min)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </>
                ) : (
                  <Text>Nema zapisa</Text>
                )}
              </Card>
            </Col>
          </Row>
        </Card>
      ))}
    </div>
  );
};
