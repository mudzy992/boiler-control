import { useEffect, useState } from "react";
import { Card, Spin, message } from "antd";
import type { TodayWeather } from "../interfaces/TodayWeather";
import type { TodayRecommendation } from "../interfaces/TodayRecommendation";
import { CloudOutlined, FireOutlined, DashboardOutlined } from "@ant-design/icons";
import { getDashboard } from "../api/dashboard.api";

const HomePage = () => {
  const [loading, setLoading] = useState(true);
  const [weather, setWeather] = useState<TodayWeather | null>(null);
  const [lastRecommendation, setLastRecommendation] = useState<TodayRecommendation | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const dashboard = await getDashboard();
        setWeather(dashboard.system.weather);
        setLastRecommendation(dashboard.system.recommendation);
      } catch (err: any) {
        message.error("Failed to load homepage data", err?.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" tip="Loading..." />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-8">
      {/* LAST RECOMMENDATION */}
      <Card
        className="w-full max-w-3xl rounded-2xl shadow-lg border border-green-200 hover:shadow-2xl transition-shadow duration-300"
      >
        {lastRecommendation ? (
          <div className="flex flex-col md:flex-row items-center justify-between p-6">
            <div className="flex-1 text-center md:text-left space-y-2">
              <div className="text-5xl font-extrabold text-green-700">
                {lastRecommendation.recommendedFlowTemp}°C
              </div>
              <div className="text-lg text-gray-700">
                Confidence: <span className="font-semibold">{lastRecommendation.confidenceScore}</span>
              </div>
              <div className="text-sm text-gray-400">
                {new Date(lastRecommendation.date).toLocaleString()}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8 text-xl">No recommendations available</div>
        )}
      </Card>

      {/* OPTIONAL WEATHER INFO */}
      {weather && (
        <Card
          className="w-full max-w-4xl rounded-2xl shadow-md border border-blue-200 hover:shadow-lg transition-shadow duration-300"
        >
          <div className="flex flex-col md:flex-row justify-between p-6 items-center gap-4 md:gap-6">
            <div className="text-center md:text-left space-y-2">
              <div className="flex items-center justify-center md:justify-start space-x-2 text-blue-600 font-semibold">
                <CloudOutlined />
                <span>{weather.city}</span>
              </div>
              <div className="flex items-center justify-center md:justify-start space-x-2 text-red-500 font-bold text-lg">
                <FireOutlined />
                <span>{weather.temperature.toFixed()}°C (feels like {weather.feelslike.toFixed()}°C)</span>
              </div>
              <div className="flex items-center justify-center md:justify-start space-x-2 text-yellow-600">
                <DashboardOutlined />
                <span>{weather.condition_text}</span>
              </div>
            </div>
            <div className="flex flex-col items-center md:items-end text-center md:text-right gap-1">
              <div className="text-blue-500 font-bold text-3xl">{weather.temperature.toFixed()}°C</div>
              <div className="text-gray-500 text-sm">
                Wind: {weather.wind_kph} kph {weather.wind_dir}<br />
                Sunrise/Sunset: {weather.sunrise} / {weather.sunset}
              </div>
            </div>
          </div>
        </Card>
      )}

    </div>
  );
};

export default HomePage;
