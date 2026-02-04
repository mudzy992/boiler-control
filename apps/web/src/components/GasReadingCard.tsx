import React from 'react';
import { Card, Tag, Space, Button, Popconfirm, message } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

interface GasReading {
  id: number;
  userId: number;
  counterValue: number;
  readingDate: string;
  createdAt: string;
}

interface GasReadingCardProps {
  reading: GasReading;
  nextReading?: GasReading; // Older reading for consumption calculation
  onDelete: (id: number) => Promise<void>;
  isLoading?: boolean;
}

export const GasReadingCard: React.FC<GasReadingCardProps> = ({
  reading,
  nextReading,
  onDelete,
  isLoading = false,
}) => {
  const handleDelete = async () => {
    try {
      await onDelete(reading.id);
      message.success('Reading deleted successfully');
    } catch (error) {
      console.error('Failed to delete reading:', error);
      message.error('Failed to delete reading');
    }
  };

  // Calculate consumption difference
  let consumption: number | null = null;
  let daysDiff: number | null = null;
  let dailyConsumption: number | null = null;

  if (nextReading) {
    consumption = reading.counterValue - nextReading.counterValue;
    daysDiff = dayjs(reading.readingDate).diff(dayjs(nextReading.readingDate), 'day');

    if (daysDiff > 0) {
      dailyConsumption = Math.round((consumption / daysDiff) * 100) / 100;
    }
  }

  const readingDate = dayjs(reading.readingDate);
  const createdDate = dayjs(reading.createdAt);

  return (
    <Card
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
      style={{ marginBottom: '16px' }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {/* Reading Counter Value and Date */}
        <div className="flex justify-between items-start">
          <div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {reading.counterValue.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              m³ - {readingDate.format('MMM DD, YYYY')} at {readingDate.format('HH:mm')}
            </div>
          </div>
          <Popconfirm
            title="Delete reading"
            description="Are you sure you want to delete this reading?"
            onConfirm={handleDelete}
            okText="Yes"
            cancelText="No"
            okButtonProps={{ danger: true }}
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              loading={isLoading}
              disabled={isLoading}
            />
          </Popconfirm>
        </div>

        {/* Consumption Information */}
        {consumption !== null && daysDiff !== null && (
          <div className="bg-blue-50 dark:bg-blue-900 p-3 rounded border border-blue-200 dark:border-blue-700">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-600 dark:text-gray-300">Total Consumption</div>
                <div className="font-semibold text-gray-900 dark:text-gray-100">
                  {consumption.toFixed(2)} m³
                </div>
              </div>
              {dailyConsumption !== null && (
                <div>
                  <div className="text-gray-600 dark:text-gray-300">Daily Average</div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100">
                    {dailyConsumption.toFixed(2)} m³/day
                  </div>
                </div>
              )}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Based on {daysDiff} day{daysDiff !== 1 ? 's' : ''} since previous reading
            </div>
          </div>
        )}

        {/* Entry Details */}
        <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
          <span>Added: {createdDate.format('MMM DD, YYYY HH:mm')}</span>
          {daysDiff === null && <Tag color="blue">Latest Reading</Tag>}
        </div>
      </Space>
    </Card>
  );
};
