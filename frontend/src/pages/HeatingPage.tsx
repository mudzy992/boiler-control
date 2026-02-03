import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Spin, message } from 'antd';
import { apiClient } from '../services/api';

interface HeatingEvent {
  id: number;
  timestampStart: string;
  timestampEnd: string | null;
  roomCurrentTemp: number;
  roomTargetTemp: number;
  hvacAction: string;
  source: string;
  isAnomaly: boolean;
}

export const HeatingPage: React.FC = () => {
  const [events, setEvents] = useState<HeatingEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiClient.getHeatingEvents();
        setEvents(Array.isArray(data) ? data : data?.events ?? []);
      } catch (error) {
        message.error('Failed to load heating events');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const columns = [
    {
      title: 'Start',
      dataIndex: 'timestampStart',
      key: 'timestampStart',
      render: (value: string) => new Date(value).toLocaleString(),
    },
    {
      title: 'End',
      dataIndex: 'timestampEnd',
      key: 'timestampEnd',
      render: (value: string | null) => (value ? new Date(value).toLocaleString() : '—'),
    },
    {
      title: 'Room Temp',
      dataIndex: 'roomCurrentTemp',
      key: 'roomCurrentTemp',
      render: (value: number) => `${value.toFixed(1)}°C`,
    },
    {
      title: 'Target',
      dataIndex: 'roomTargetTemp',
      key: 'roomTargetTemp',
      render: (value: number) => `${value.toFixed(1)}°C`,
    },
    {
      title: 'Action',
      dataIndex: 'hvacAction',
      key: 'hvacAction',
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: 'Anomaly',
      dataIndex: 'isAnomaly',
      key: 'isAnomaly',
      render: (value: boolean) => <Tag color={value ? 'red' : 'green'}>{value ? 'Yes' : 'No'}</Tag>,
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
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Heating Events</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Track heating sessions, targets, and anomaly detection.
        </p>
      </div>
      <Card className="shadow-sm" title="Recent Heating Sessions">
        <Table rowKey="id" dataSource={events} columns={columns} pagination={{ pageSize: 8 }} />
      </Card>
    </div>
  );
};
