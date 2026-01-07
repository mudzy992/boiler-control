import { useEffect, useState } from "react";
import { Card, Spin, message, Divider } from "antd";
import { getTodayWeather, getLastRecommendation } from "../api/readonly.api";
import type { TodayWeather } from "../interfaces/TodayWeather";
import type { TodayRecommendation } from "../interfaces/TodayRecommendation";
import { CloudOutlined, FireOutlined, RiseOutlined, FallOutlined, DashboardOutlined } from "@ant-design/icons";
import { Wind } from "lucide-react";

const HomePage = () => {
  const [loading, setLoading] = useState(true);
  const [weather, setWeather] = useState<TodayWeather | null>(null);
  const [lastRecommendation, setLastRecommendation] = useState<TodayRecommendation | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [w, rec] = await Promise.all([getTodayWeather(), getLastRecommendation()]);
        setWeather(w);
        setLastRecommendation(rec);
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
      <div className="flex items-center justify-center min-h-screen bg-linear-to-b from-blue-100 to-white">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8 flex flex-col gap-4">
      {/* WEATHER WIDGET */}
      <Card
        title="Today's Weather"
        className="rounded-2xl shadow-xl bg-linear-to-r from-blue-50 to-white hover:shadow-2xl transition-shadow duration-300"
      >
        {weather ? (
          <div className="grid grid-cols-1 md:grid-cols-2 ">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <CloudOutlined className="text-blue-500 text-lg" />
                <span><strong>City:</strong> {weather.city}</span>
              </div>
              <div className="flex items-center space-x-2">
                <FireOutlined className="text-red-500 text-lg" />
                <span><strong>Temperature:</strong> {weather.temperature}°C (feels like {weather.feelslike}°C)</span>
              </div>
              <div className="flex items-center space-x-2">
                <DashboardOutlined className="text-yellow-500 text-lg" />
                <span><strong>Condition:</strong> {weather.condition_text}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Wind className="text-purple-500 text-lg" />
                <span><strong>Wind:</strong> {weather.wind_kph} kph {weather.wind_dir}</span>
              </div>
              <div className="flex items-center space-x-2">
                <RiseOutlined className="text-orange-500 text-lg" />
                <FallOutlined className="text-orange-500 text-lg" />
                <span><strong>Sunrise/Sunset:</strong> {weather.sunrise} / {weather.sunset}</span>
              </div>
            </div>
            <div className="flex flex-col justify-center items-center">
              <div className="text-6xl font-bold text-blue-600">{weather.temperature}°C</div>
              <div className="text-gray-500">Feels like {weather.feelslike}°C</div>
              <div className="mt-2 text-sm text-gray-400">Humidity: {weather.humidity}% | Cloud: {weather.cloud}% | Precipitation: {weather.precipitation_mm} mm</div>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500">No weather data available for today</div>
        )}
      </Card>

      {/* LAST RECOMMENDATION WIDGET */}
      <Card
        title="Last Recommendation"
        className="rounded-2xl shadow-xl bg-linear-to-r from-green-50 to-white hover:shadow-2xl transition-shadow duration-300"
      >
        {lastRecommendation ? (
          <div className="flex flex-col md:flex-row justify-between items-center md:items-start">
            <div className="space-y-2">
              <div className="text-xl font-semibold text-green-600">
                Recommended Flow Temp: {lastRecommendation.recommendedFlowTemp}°C
              </div>
              <div className="text-gray-500">
                Confidence Score: {lastRecommendation.confidenceScore}
              </div>
              <div className="text-gray-400 text-sm">
                Date: {new Date(lastRecommendation.date).toLocaleString()}
              </div>
            </div>
            <Divider type="vertical" className="hidden md:block" />
            <div className="flex-1 flex justify-center md:justify-end mt-4 md:mt-0">
              <div className="bg-green-100 text-green-700 p-6 rounded-xl shadow-md text-center text-3xl font-bold">
                {lastRecommendation.recommendedFlowTemp}°C
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500">No recommendations available</div>
        )}
      </Card>
    </div>
  );
};

export default HomePage;
