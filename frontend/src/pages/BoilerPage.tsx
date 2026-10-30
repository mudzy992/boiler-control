import React, { useEffect, useState, useCallback } from 'react';
import { Card, Table, Tag, Spin, message, Modal, Button, InputNumber, Space, Typography } from 'antd';
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

const MIN_CURRENT_FLOW_TEMP = 48;
const MAX_CURRENT_FLOW_TEMP = 55;

export const BoilerPage: React.FC = () => {
  const [events, setEvents] = useState<BoilerEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [setTempModalOpen, setSetTempModalOpen] = useState(false);
  const [setTempValue, setSetTempValue] = useState<number | null>(null);
  const [setTempSubmitting, setSetTempSubmitting] = useState(false);

  const loadEvents = useCallback(async () => {
    try {
      const data = await apiClient.getBoilerEvents();
      setEvents(Array.isArray(data) ? data : data?.events ?? []);
    } catch (error) {
      console.error('Error loading boiler events:', error);
      message.error('Failed to load boiler history!');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const openSetTempModal = useCallback(() => {
    const latest = events[0];
    const fallback =
      typeof latest?.actualFlowTemp === 'number'
        ? latest.actualFlowTemp
        : latest?.suggestedFlowTemp ?? 52;
    setSetTempValue(Number(fallback.toFixed(1)));
    setSetTempModalOpen(true);
  }, [events]);

  const submitSetTemp = useCallback(async () => {
    if (typeof setTempValue !== 'number' || Number.isNaN(setTempValue)) {
      message.error('Enter a valid temperature value');
      return;
    }

    if (setTempValue < MIN_CURRENT_FLOW_TEMP || setTempValue > MAX_CURRENT_FLOW_TEMP) {
      message.error(
        `Temperature must be between ${MIN_CURRENT_FLOW_TEMP}°C and ${MAX_CURRENT_FLOW_TEMP}°C`,
      );
      return;
    }

    try {
      setSetTempSubmitting(true);
      await apiClient.setBoilerCurrentTemp(Number(setTempValue.toFixed(1)));
      message.success('Current boiler temperature updated');
      setSetTempModalOpen(false);
      await loadEvents();
    } catch (error) {
      console.error('Failed to set boiler current temp:', error);
      message.error('Failed to update current boiler temperature');
    } finally {
      setSetTempSubmitting(false);
    }
  }, [loadEvents, setTempValue]);

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
      render: (value: number | null) =>
        typeof value === 'number' ? `${value.toFixed(1)}°C` : '—',
    },
    {
      title: 'Delta',
      key: 'delta',
      render: (_: unknown, record: BoilerEvent) => {
        if (typeof record.actualFlowTemp !== 'number') return '—';
        const delta = record.actualFlowTemp - record.suggestedFlowTemp;
        const color = Math.abs(delta) <= 2 ? 'green' : delta > 0 ? 'orange' : 'volcano';
        return <Tag color={color}>{delta >= 0 ? '+' : ''}{delta.toFixed(1)}°C</Tag>;
      },
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
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
        <div className="mt-3">
          <Button type="primary" onClick={openSetTempModal}>
            Set current temp
          </Button>
        </div>
      </div>
      <Card className="shadow-sm" title={`Recent Boiler Events (${events.length})`}>
        <Table
          rowKey="id"
          dataSource={events}
          columns={columns}
          pagination={{ pageSize: 8 }}
          // FE2-13 (FE-021): bez scroll={{ x }} tabela prelijeva na uskim ekranima,
          // a `overflow-x: hidden` na body-u to prelijevanje tiho odsjeca — korisnik
          // ne vidi dio kolona i ne zna da postoji jos.
          scroll={{ x: 'max-content' }}
        />
      </Card>

      <Modal
        title="Set current flow temperature"
        open={setTempModalOpen}
        onCancel={() => setSetTempModalOpen(false)}
        onOk={submitSetTemp}
        confirmLoading={setTempSubmitting}
        okText={setTempSubmitting ? 'Saving...' : 'Save'}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Typography.Text type="secondary">
            Allowed range: {MIN_CURRENT_FLOW_TEMP}°C - {MAX_CURRENT_FLOW_TEMP}°C
          </Typography.Text>
          <InputNumber
            value={setTempValue ?? undefined}
            onChange={(value) => setSetTempValue(typeof value === 'number' ? value : null)}
            min={MIN_CURRENT_FLOW_TEMP}
            max={MAX_CURRENT_FLOW_TEMP}
            step={0.1}
            precision={1}
            style={{ width: '100%' }}
            addonAfter="°C"
          />
        </Space>
      </Modal>
    </div>
  );
};
