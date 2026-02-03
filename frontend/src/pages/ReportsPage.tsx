import React, { useEffect, useState } from 'react';
import { Card, Table, Spin, message } from 'antd';
import { apiClient } from '../services/api';

interface Recommendation {
  id: number;
  date: string;
  recommendedFlowTemp: number;
  expectedHeatTimeMin: number;
  confidenceScore: number;
}

export const ReportsPage: React.FC = () => {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiClient.getReports();
        setRecommendations(Array.isArray(data) ? data : data?.recommendations ?? []);
      } catch (error) {
        message.error('Failed to load recommendations');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const columns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      render: (value: string) => new Date(value).toLocaleDateString(),
    },
    {
      title: 'Flow Temp',
      dataIndex: 'recommendedFlowTemp',
      key: 'recommendedFlowTemp',
      render: (value: number) => `${value.toFixed(1)}°C`,
    },
    {
      title: 'Expected Heat Time',
      dataIndex: 'expectedHeatTimeMin',
      key: 'expectedHeatTimeMin',
      render: (value: number) => `${value.toFixed(0)} min`,
    },
    {
      title: 'Confidence',
      dataIndex: 'confidenceScore',
      key: 'confidenceScore',
      render: (value: number) => `${Math.round(value * 100)}%`,
    },
  ];

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Reports</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Daily recommendations generated from your heating profile.
        </p>
      </div>
      <Card className="shadow-sm" title="Recommendations">
        <Table rowKey="id" dataSource={recommendations} columns={columns} pagination={{ pageSize: 8 }} />
      </Card>
    </div>
  );
};
