import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Spin, message } from 'antd';
import { apiClient } from '../services/api';

interface BoilerEvent {
  id: number;
  userId: number;
  externalTemp: number;
  suggestedFlowTemp: number;
  actualFlowTemp: number | null;
  heatingStart: string | null;
  heatingEnd: string | null;
  createdAt: string;
}

export const BoilerPage: React.FC = () => {
  const [events, setEvents] = useState<BoilerEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiClient.getBoilerEvents();
        setEvents(Array.isArray(data) ? data : data?.events ?? []);
      } catch (error) {
        console.error('Error loading boiler events:', error);
        message.error('Failed to load boiler history');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const columns = [
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (value: string) => new Date(value).toLocaleString(),
    },
    {
      title: 'Heating Start',
      dataIndex: 'heatingStart',
      key: 'heatingStart',
      render: (value: string | null) => (value ? new Date(value).toLocaleString() : '—'),
    },
    {
      title: 'Heating End',
      dataIndex: 'heatingEnd',
      key: 'heatingEnd',
      render: (value: string | null) => (value ? new Date(value).toLocaleString() : '—'),
    },
    {
      title: 'Outside Temp',
      dataIndex: 'externalTemp',
      key: 'externalTemp',
      render: (value: number) => `${value.toFixed(1)}°C`,
    },
    {
      title: 'Suggested Flow',
      dataIndex: 'suggestedFlowTemp',
      key: 'suggestedFlowTemp',
      render: (value: number) => `${value.toFixed(1)}°C`,
    },
    {
      title: 'Actual Flow',
      dataIndex: 'actualFlowTemp',
      key: 'actualFlowTemp',
      render: (value: number | null) => (value ? `${value.toFixed(1)}°C` : '—'),
    },
    {
      title: 'Delta',
      key: 'delta',
      render: (_: unknown, record: BoilerEvent) => {
        if (!record.actualFlowTemp) return '—';
        const delta = record.actualFlowTemp - record.suggestedFlowTemp;
        const color = Math.abs(delta) <= 2 ? 'green' : delta > 0 ? 'orange' : 'volcano';
        return <Tag color={color}>{delta >= 0 ? '+' : ''}{delta.toFixed(1)}°C</Tag>;
      },
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
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Boiler History</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Review boiler performance, flow temperature accuracy, and runtime history.
        </p>
      </div>
      <Card className="shadow-sm" title={`Recent Boiler Events (${events.length})`}>
        <Table rowKey="id" dataSource={events} columns={columns} pagination={{ pageSize: 8 }} />
      </Card>
    </div>
  );
};
