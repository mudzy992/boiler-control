import React from 'react';
import { Card, Statistic } from 'antd';

interface StatCardProps {
  title: string;
  value: number | string;
  prefix?: React.ReactNode;
  suffix?: string;
  valueStyle?: React.CSSProperties;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, prefix, suffix, valueStyle }) => {
  return (
    <Card className="shadow-sm">
      <Statistic title={title} value={value} prefix={prefix} suffix={suffix} valueStyle={valueStyle} />
    </Card>
  );
};
