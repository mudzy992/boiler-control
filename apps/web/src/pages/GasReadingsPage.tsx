import React, { useState, useMemo } from 'react';
import { Button, Empty, Spin, Row, Col, Space, message } from 'antd';
import { PlusOutlined, DownloadOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { apiClient } from '../services/api';
import { GasReadingCard } from '../components/GasReadingCard';
import { GasForm } from '../components/GasForm';

export const GasReadingsPage: React.FC = () => {
  const [showAddModal, setShowAddModal] = useState(false);
  const queryClient = useQueryClient();

  // Fetch gas readings
  const { data: readings = [], isLoading, error } = useQuery({
    queryKey: ['gas-readings'],
    queryFn: async () => {
      const response = await apiClient.getGasReadings();
      return Array.isArray(response) ? response : [];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Add mutation
  const addMutation = useMutation({
    mutationFn: (data: { counterValue: number; readingDate: string }) =>
      apiClient.addGasReadingPayload(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gas-readings'] });
      queryClient.invalidateQueries({ queryKey: ['gas-analysis'] });
      setShowAddModal(false);
    },
    onError: (error: any) => {
      console.error('Failed to add reading:', error);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.deleteGasReading(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gas-readings'] });
      queryClient.invalidateQueries({ queryKey: ['gas-analysis'] });
    },
  });

  // Sort readings by date (newest first)
  const sortedReadings = useMemo(() => {
    return [...readings].sort((a, b) =>
      dayjs(b.readingDate).diff(dayjs(a.readingDate))
    );
  }, [readings]);

  // Export to CSV
  const handleExport = () => {
    if (sortedReadings.length === 0) {
      message.warning('No readings to export');
      return;
    }

    const headers = ['Counter Value (m³)', 'Reading Date', 'Created At'];
    const rows = sortedReadings.map((r) => [
      r.counterValue,
      dayjs(r.readingDate).format('YYYY-MM-DD HH:mm'),
      dayjs(r.createdAt).format('YYYY-MM-DD HH:mm'),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const element = document.createElement('a');
    element.setAttribute('href', `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`);
    element.setAttribute('download', `gas-readings-${dayjs().format('YYYY-MM-DD')}.csv`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    message.success('Readings exported successfully');
  };

  if (error) {
    return (
      <div style={{ padding: '24px' }}>
        <Empty
          description="Failed to load readings"
          style={{ marginTop: '50px' }}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: '24px' }}>
        <Col>
          <h1 style={{ margin: 0 }}>Gas Readings</h1>
          <p style={{ margin: '8px 0 0 0', color: '#666' }}>
            {sortedReadings.length} reading{sortedReadings.length !== 1 ? 's' : ''} recorded
          </p>
        </Col>
        <Col>
          <Space>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExport}
              disabled={sortedReadings.length === 0}
            >
              Export CSV
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setShowAddModal(true)}
            >
              Add Reading
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Content */}
      <Spin spinning={isLoading} size="large">
        {sortedReadings.length === 0 ? (
          <Empty
            description="No readings yet"
            style={{ marginTop: '50px' }}
          />
        ) : (
          <div>
            {sortedReadings.map((reading, index) => (
              <GasReadingCard
                key={reading.id}
                reading={reading}
                nextReading={
                  index < sortedReadings.length - 1
                    ? sortedReadings[index + 1]
                    : undefined
                }
                onDelete={(id) => deleteMutation.mutateAsync(id)}
                isLoading={deleteMutation.isPending && deleteMutation.variables === reading.id}
              />
            ))}
          </div>
        )}
      </Spin>

      {/* Add Modal */}
      <GasForm
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={(data) => addMutation.mutateAsync(data)}
        isLoading={addMutation.isPending}
      />
    </div>
  );
};
