import React, { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { useQuery } from '@tanstack/react-query';
import { apiClient, ApiClient } from '../services/api';
import { StatCard } from '../components/StatCard';
import { Button } from 'antd';

export const GasAnalyticsPage: React.FC = () => {
  const [periodDays, setPeriodDays] = useState(30);

  // Calculate date range for the selected period
  const dateRange = useMemo(() => {
    const endDate = dayjs();
    const startDate = endDate.subtract(periodDays, 'days');
    return {
      from: startDate.format('YYYY-MM-DD'),
      to: endDate.format('YYYY-MM-DD'),
    };
  }, [periodDays]);

  // Fetch analysis data from API
  const gasApi = apiClient as ApiClient & { getGasAnalysis: (from: string, to: string) => Promise<any> };

  const { data: analysisData = {}, isLoading, error } = useQuery({
    queryKey: ['gas-analysis', dateRange.from, dateRange.to],
    queryFn: async () => {
      try {
        const result = await gasApi.getGasAnalysis(dateRange.from, dateRange.to);
        console.log('Gas Analysis API Response:', result);
        return result;
      } catch (err) {
        console.error('Error fetching gas analysis:', err);
        return {};
      }
    },
    staleTime: 1000 * 60 * 5,
  });

  // Also fetch all readings for the "Recent Readings" section
  const { data: readings = [] } = useQuery({
    queryKey: ['gas-readings'],
    queryFn: async () => {
      const response = await apiClient.getGasReadings();
      return Array.isArray(response) ? response : [];
    },
    staleTime: 1000 * 60 * 5,
  });

  if (error) {
    return (
      <div className="p-6 text-red-600 rounded-lg bg-red-50 dark:bg-red-900/20 dark:text-red-400">
        Failed to load analytics. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          Gas Analytics
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
          Analyze your consumption patterns and trends over time. Data for {dateRange.from} to {dateRange.to}.
        </p>
      </div>

      {/* Period Selector */}
      <div className="p-4 bg-white border border-gray-200 rounded-lg dark:border-slate-700 dark:bg-slate-800">
        <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300">
          Analyze Period
        </label>
        <div className="flex flex-wrap gap-2 mt-3 sm:gap-3">
          {[7, 14, 30, 90, 365].map((days) => (
            <Button
              key={days}
              onClick={() => setPeriodDays(days)}
              type={periodDays === days ? 'primary' : 'default'}
            >
              {days === 7 ? '7d' : days === 14 ? '14d' : days === 30 ? '30d' : days === 90 ? '90d' : '1y'}
            </Button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-gray-300 rounded-full animate-spin border-t-blue-600 dark:border-slate-700 dark:border-t-blue-500"></div>
        </div>
      )}

      {!isLoading && readings.length === 0 && (
        <div className="px-6 py-12 text-center border-2 border-gray-300 border-dashed rounded-lg bg-gray-50 dark:border-slate-700 dark:bg-slate-800/30">
          <svg className="w-12 h-12 mx-auto mb-4 text-gray-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-gray-600 dark:text-slate-400">No readings available yet.</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-500">
            Add gas readings to see analytics and trends.
          </p>
        </div>
      )}

      {!isLoading && readings.length > 0 && (
        <>
          {/* Primary Metrics Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Consumption"
              value={analysisData.totalGas ?? 0}
              suffix="m³"
            />
            <StatCard
              title="Heating Hours"
              value={analysisData.totalHeatingHours ?? 0}
              suffix="hours"
            />
            <StatCard
              title="Avg Flow Temp"
              value={analysisData.avgFlowTemp ?? 0}
              suffix="°C"
            />
            <StatCard
              title="Usage Per Hour"
              value={analysisData.efficiency?.m3PerHour ?? 0}
              suffix="m³/h"
            />
          </div>

          {/* Efficiency Card */}
          <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <p className="text-xs font-semibold tracking-wide text-gray-700 uppercase dark:text-slate-300">
              Heating Efficiency
            </p>
            <div className="flex items-center gap-3 mt-4">
              <span className="text-3xl">{analysisData.efficiency?.label ? '✓' : '?'}</span>
              <div>
                <p className="font-bold text-blue-600 dark:text-blue-400">
                  {analysisData.efficiency?.label || 'NO DATA'}
                </p>
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  {typeof analysisData.efficiency?.m3PerHour === 'number' ? analysisData.efficiency.m3PerHour.toFixed(3) : '0.000'} m³/hour
                </p>
              </div>
            </div>
          </div>

          {/* Recent Readings Section */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="px-4 py-4 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Recent Readings
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
                Last 5 recorded readings with consumption data
              </p>
            </div>
            {readings.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-gray-600 dark:text-slate-400">No readings available</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-slate-700">
                {[...readings]
                  .sort((a, b) => dayjs(b.readingDate).diff(dayjs(a.readingDate)))
                  .slice(0, 5)
                  .map((reading, index) => {
                    const prevReading = [...readings]
                      .sort((a, b) => dayjs(b.readingDate).diff(dayjs(a.readingDate)))
                      .slice(0, 6)[index + 1];

                    let consumption = null;
                    if (prevReading) {
                      consumption = reading.counterValue - prevReading.counterValue;
                    }

                    return (
                      <div key={reading.id} className="flex items-center justify-between px-4 py-4 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {reading.counterValue} m³
                          </p>
                          <p className="mt-0.5 text-sm text-gray-600 dark:text-slate-400">
                            {dayjs(reading.readingDate).format('MMM DD, YYYY HH:mm')}
                          </p>
                        </div>
                        {consumption !== null && (
                          <div className="text-right">
                            <p className="font-semibold text-blue-600 dark:text-blue-400">
                              +{consumption.toFixed(2)} m³
                            </p>
                            <p className="text-xs text-gray-500 dark:text-slate-500">
                              since last reading
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
