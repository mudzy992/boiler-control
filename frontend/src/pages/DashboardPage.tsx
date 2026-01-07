import { useEffect, useState } from "react";
import { Card, Row, Col, Typography, Spin, Table, Badge } from "antd";
import { getDashboardToday } from "../api/dashboard.api";
import { getTodayWeather, getTodayBoilerHistory, getTodayRecommendations } from "../api/readonly.api";
import type { HomeProfileDashboard } from "../interfaces/Dashboard";
import type { TodayBoilerEvent } from "../interfaces/TodayBoilerEvent";
import type { TodayRecommendation } from "../interfaces/TodayRecommendation";
import type { TodayWeather } from "../interfaces/TodayWeather";

const { Title, Text } = Typography;

const DashboardPage = () => {
  const [loading, setLoading] = useState(true);
  const [dashboards, setDashboards] = useState<HomeProfileDashboard[]>([]);
  const [weather, setWeather] = useState<TodayWeather | null>(null);
  const [boilerHistory, setBoilerHistory] = useState<TodayBoilerEvent[]>([]);
  const [recommendations, setRecommendations] = useState<TodayRecommendation[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [
          dashboardData,
          weatherData,
          boilerData,
          recommendationData,
        ] = await Promise.all([
          getDashboardToday(),
          getTodayWeather(),
          getTodayBoilerHistory(),
          getTodayRecommendations(),
        ]);

        setDashboards(dashboardData);
        setWeather(weatherData);
        setBoilerHistory(boilerData);
        setRecommendations(recommendationData);
      } catch (err) {
        console.error("Greška pri učitavanju dashboard podataka", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* ======================
          Weather widget
      ====================== */}
      {weather && (
        <Row gutter={[16, 16]}>
            <Col xs={24} md={18}>
                <Card
                title={`Vremenska prognoza - ${weather.city}`}
                className="bg-blue-50"
                >
                <Row justify="space-between" align="middle">
                    <Col>
                    <Title level={2}>{weather.temperature}°C</Title>
                    <Text>Osjećaj: {weather.feelslike}°C</Text>
                    </Col>
                    <Col>
                    <Badge
                        status={weather.condition_text.includes("sleet") ? "warning" : "success"}
                        text={weather.condition_text}
                    />
                    </Col>
                </Row>
                <Text>
                    Min: {weather.temp_min}°C | Max: {weather.temp_max}°C | Prosjek:{" "}
                    {weather.temp_avg.toFixed(1)}°C
                </Text>
            </Card>
        </Col>
            {/* Today's Recommendation */}
            <Col xs={24} md={6}>
              <Card title="Današnja preporuka temp. kotla">
                {recommendations.length === 0 && <Text>Nema preporuka</Text>}
                {recommendations.map((r, idx) => (
                  <div key={idx} className="my-2 flex flex-col items-center">
                    <Title level={2} className="text-red-500">
                      {r.recommendedFlowTemp}°C
                    </Title>
                    <Text>Pouzdanost: {r.confidenceScore}</Text>
                  </div>
                ))}
              </Card>
            </Col>
        </Row>
      )}

      {/* ======================
          Home Profiles
      ====================== */}
      {dashboards.map((home) => (
        <div key={home.id} className="space-y-4">
          <Title level={3}>Home Profile #{home.id}</Title>
          <Text>Tip grijanja: {home.heatingType}</Text> |{" "}
          <Text>Površina: {home.floorArea} m²</Text> |{" "}
          <Text>Visina plafona: {home.ceilingHeight} cm</Text>

          <Row gutter={[16, 16]}>
            {/* Heating Events */}
            <Col xs={24} md={24}>
              <Card title="Danasnji heating eventi">
                {home.recentHeatingEvents.length === 0 && <Text>Nema događaja</Text>}
                {home.recentHeatingEvents.map((e, idx) => {
                  const start = new Date(e.timestampStart);
                  const end = e.timestampEnd ? new Date(e.timestampEnd) : new Date();
                  const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);
                  const statusColor =
                    e.hvacAction === "HEATING_ON"
                      ? "red"
                      : e.hvacAction === "HEATING_OFF"
                      ? "grey"
                      : "blue";
                  return (
                    <div key={idx} className="flex justify-between my-1">
                      <Text>
                        {start.toLocaleTimeString()} - {end.toLocaleTimeString()} | Duration: {durationMin} min
                      </Text>
                      <Badge color={statusColor} text={e.hvacAction} />
                    </div>
                  );
                })}
              </Card>
            </Col>

          </Row>
        </div>
      ))}

      {/* ======================
          Boiler History Table
      ====================== */}
      <Card title="Boiler History - danas">
        {boilerHistory.length === 0 && <Text>Nema podataka</Text>}
        {boilerHistory.length > 0 && (
          <Table
            dataSource={boilerHistory}
            rowKey={(record) => record.id}
            pagination={false}
            columns={[
              {
                title: "Vrijeme start",
                dataIndex: "heatingStart",
                render: (val: string) => (val ? new Date(val).toLocaleTimeString() : "-"),
              },
              {
                title: "Vrijeme end",
                dataIndex: "heatingEnd",
                render: (val: string) => (val ? new Date(val).toLocaleTimeString() : "-"),
              },
              {
                title: "Vanjska temp",
                dataIndex: "externalTemp",
              },
              {
                title: "Suggested temp",
                dataIndex: "suggestedTemp",
              },
              {
                title: "Actual temp",
                dataIndex: "actualTemp",
              },
            ]}
          />
        )}
      </Card>
    </div>
  );
};

export default DashboardPage;
