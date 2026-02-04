import React, { useMemo, useState } from 'react';
import { Row, Col, Card, Spin, Empty, Statistic, Space, Select } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { apiClient } from '../services/api';
import { Column } from '@ant-design/plots';

interface DailyConsumption {
  date: string;
  consumption: number;
  daysDiff: number;
  dailyAverage: number;
}

export const GasAnalyticsPage: React.FC = () => {
  const [periodDays, setPeriodDays] = useState(30);

  // Fetch gas readings
  const { data: readings = [], isLoading, error } = useQuery({
    queryKey: ['gas-readings'],
    queryFn: async () => {
      const response = await apiClient.getGasReadings();
      return Array.isArray(response) ? response : [];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Calculate statistics
  const stats = useMemo(() => {
    if (readings.length === 0) {
      return {
        totalConsumption: 0,
        avgDaily: 0,
        minDaily: 0,
        maxDaily: 0,
        medianDaily: 0,
        stdDev: 0,
        trend: 'stable' as const,
        trendValue: 0,
        dailyReadings: [],
        last30Days: [],
      };
    }

    // Sort by date (oldest first)
    const sorted = [...readings].sort((a, b) =>
      dayjs(a.readingDate).diff(dayjs(b.readingDate))
    );

    // Calculate consumption between consecutive readings
    const dailyReadings: DailyConsumption[] = [];
    let totalConsumption = 0;

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const previous = sorted[i - 1];

      const consumption = current.counterValue - previous.counterValue;
      const daysDiff = dayjs(current.readingDate).diff(
        dayjs(previous.readingDate),
        'day'
      );

      if (daysDiff > 0) {
        const dailyAverage = Math.round((consumption / daysDiff) * 100) / 100;
        totalConsumption += consumption;

        dailyReadings.push({
          date: dayjs(current.readingDate).format('YYYY-MM-DD'),
          consumption,
          daysDiff,
          dailyAverage,
        });
      }
    }

    // Filter by period (last X days)
    const cutoffDate = dayjs().subtract(periodDays, 'days');
    const last30Days = dailyReadings.filter((r) =>
      dayjs(r.date).isAfter(cutoffDate)
    );

    // Calculate metrics
    const dailyAverages = dailyReadings.map((r) => r.dailyAverage);
    const avgDaily = Math.round(
      (dailyAverages.reduce((a, b) => a + b, 0) / dailyAverages.length) * 100
    ) / 100;
    const minDaily = Math.min(...dailyAverages);
    const maxDaily = Math.max(...dailyAverages);

    // Median
    const sorted_avgs = [...dailyAverages].sort((a, b) => a - b);
    const medianDaily = sorted_avgs.length % 2 === 0
      ? Math.round(
          ((sorted_avgs[sorted_avgs.length / 2 - 1] +
            sorted_avgs[sorted_avgs.length / 2]) /
            2) * 100
        ) / 100
      : sorted_avgs[Math.floor(sorted_avgs.length / 2)];

    // Standard deviation
    const meanDaily = dailyAverages.reduce((a, b) => a + b, 0) / dailyAverages.length;
    const variance =
      dailyAverages.reduce((a, b) => a + Math.pow(b - meanDaily, 2), 0) /
      dailyAverages.length;
    const stdDev = Math.round(Math.sqrt(variance) * 100) / 100;

    // Trend calculation (first half vs second half)
    const halfPoint = Math.floor(dailyReadings.length / 2);
    const firstHalf = dailyReadings.slice(0, halfPoint);
    const secondHalf = dailyReadings.slice(halfPoint);

    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    let trendValue = 0;

    if (firstHalf.length > 0 && secondHalf.length > 0) {
      const avgFirstHalf =
        firstHalf.reduce((a, b) => a + b.dailyAverage, 0) / firstHalf.length;
      const avgSecondHalf =
        secondHalf.reduce((a, b) => a + b.dailyAverage, 0) / secondHalf.length;

      const percentChange = ((avgSecondHalf - avgFirstHalf) / avgFirstHalf) * 100;
      trendValue = Math.round(Math.abs(percentChange) * 100) / 100;

      if (Math.abs(percentChange) > 5) {
        trend = percentChange > 0 ? 'increasing' : 'decreasing';
      }
    }

    return {
      totalConsumption: Math.round(totalConsumption * 100) / 100,
      avgDaily,
      minDaily: Math.round(minDaily * 100) / 100,
      maxDaily: Math.round(maxDaily * 100) / 100,
      medianDaily,
      stdDev,
      trend,
      trendValue,
      dailyReadings,
      last30Days,
    };
  }, [readings, periodDays]);

  // Chart data
  const chartData = useMemo(() => {
    return stats.last30Days.map((r) => ({
      date: r.date,
      consumption: r.dailyAverage,
    }));
  }, [stats.last30Days]);

  if (error) {
    return (
      <div style={{ padding: '24px' }}>
        <Empty description="Failed to load analytics" />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <h1 style={{ marginBottom: '24px' }}>Gas Analytics</h1>

      {/* Period Selector */}
      <Card style={{ marginBottom: '24px' }}>
        <Space size="large">
          <div>
            <label style={{ marginRight: '8px', fontWeight: '500' }}>
              Period:
            </label>
            <Select
              value={periodDays}
              onChange={setPeriodDays}
              style={{ width: '150px' }}
            >
              <Select.Option value={7}>Last 7 days</Select.Option>
              <Select.Option value={14}>Last 14 days</Select.Option>
              <Select.Option value={30}>Last 30 days</Select.Option>
              <Select.Option value={90}>Last 90 days</Select.Option>
              <Select.Option value={365}>Last 365 days</Select.Option>
            </Select>
          </div>
        </Space>
      </Card>

      {/* Content */}
      <Spin spinning={isLoading}>
        {readings.length === 0 ? (
          <Empty
            description="No readings available for analytics"
            style={{ marginTop: '50px' }}
          />
        ) : (
          <>
            {/* Summary Statistics */}
            <Row gutter={16} style={{ marginBottom: '24px' }}>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="Total Consumption"
                    value={stats.totalConsumption}
                    suffix="m³"
                    precision={2}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="Avg Daily Usage"
                    value={stats.avgDaily}
                    suffix="m³/day"
                    precision={2}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="Min Daily"
                    value={stats.minDaily}
                    suffix="m³"
                    precision={2}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="Max Daily"
                    value={stats.maxDaily}
                    suffix="m³"
                    precision={2}
                  />
                </Card>
              </Col>
            </Row>

            {/* Detailed Metrics */}
            <Row gutter={16} style={{ marginBottom: '24px' }}>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="Median Daily"
                    value={stats.medianDaily}
                    suffix="m³"
                    precision={2}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="Std Deviation"
                    value={stats.stdDev}
                    suffix="m³"
                    precision={2}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={12}>
                <Card>
                  <div>
                    <div style={{ marginBottom: '8px', fontWeight: '500' }}>
                      Consumption Trend
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {stats.trend === 'increasing' && (
                        <>
                          <ArrowUpOutlined style={{ color: '#ff4d4f', fontSize: '20px' }} />
                          <span style={{ fontSize: '16px', fontWeight: '500', color: '#ff4d4f' }}>
                            Increasing ({stats.trendValue}%)
                          </span>
                        </>
                      )}
                      {stats.trend === 'decreasing' && (
                        <>
                          <ArrowDownOutlined style={{ color: '#52c41a', fontSize: '20px' }} />
                          <span style={{ fontSize: '16px', fontWeight: '500', color: '#52c41a' }}>
                            Decreasing ({stats.trendValue}%)
                          </span>
                        </>
                      )}
                      {stats.trend === 'stable' && (
                        <span style={{ fontSize: '16px', fontWeight: '500', color: '#1890ff' }}>
                          → Stable
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              </Col>
            </Row>

            {/* Chart */}
            {chartData.length > 0 ? (
              <Card title={`Daily Consumption - Last ${periodDays} Days`}>
                <Column
                  data={chartData}
                  xField="date"
                  yField="consumption"
                  seriesField="consumption"
                  xAxis={{
                    type: 'ordinal',
                    label: {
                      autoHide: true,
                      autoRotate: false,
                    },
                  }}
                  yAxis={{
                    label: {
                      formatter: (v: any) => `${v} m³`,
                    },
                  }}
                  tooltip={{
                    formatter: (datum: any) => {
                      return {
                        name: 'Daily Consumption',
                        value: `${datum.consumption.toFixed(2)} m³`,
                      };
                    },
                  }}
                  height={400}
                  columnStyle={{
                    radius: [4, 4, 0, 0],
                  }}
                  color="#1890ff"
                />
              </Card>
            ) : (
              <Card title="Daily Consumption Chart">
                <Empty description="No consumption data for selected period" />
              </Card>
            )}

            {/* Recent Readings */}
            <Card title="Last 5 Readings" style={{ marginTop: '24px' }}>
              {readings.length === 0 ? (
                <Empty description="No readings" />
              ) : (
                <div>
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
                        <div
                          key={reading.id}
                          style={{
                            padding: '12px 0',
                            borderBottom: '1px solid #f0f0f0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: '500' }}>
                              {reading.counterValue} m³
                            </div>
                            <div style={{ fontSize: '12px', color: '#666' }}>
                              {dayjs(reading.readingDate).format('MMM DD, YYYY HH:mm')}
                            </div>
                          </div>
                          {consumption !== null && (
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: '500', color: '#1890ff' }}>
                                +{consumption.toFixed(2)} m³
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </Card>
          </>
        )}
      </Spin>
    </div>
  );
};
