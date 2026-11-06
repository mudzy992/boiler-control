import React from 'react';
import { Card } from './Card';

interface StatCardProps {
  title: string;
  value: number | string;
  prefix?: React.ReactNode;
  suffix?: string;
  valueStyle?: React.CSSProperties;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  prefix,
  suffix,
  valueStyle,
  trend,
  trendValue,
}) => {
  const trendClasses: Record<string, string> = {
    up: 'text-success dark:text-dark-success',
    down: 'text-error dark:text-dark-error',
    neutral: 'text-text-tertiary dark:text-dark-text-tertiary',
  };

  return (
    <Card padding="md" elevated>
      <div className="flex items-start justify-between space-y-4 md:space-y-0 md:flex-row">
        <div>
          <p className="text-sm font-semibold text-text-secondary dark:text-dark-text-secondary">
            {title}
          </p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-text-primary dark:text-dark-text-primary" style={valueStyle}>
              {value}
            </span>
            {suffix && <span className="text-sm text-text-tertiary dark:text-dark-text-tertiary">{suffix}</span>}
          </div>
        </div>
        {prefix && <div className="p-2 rounded-lg bg-surface-muted text-brand dark:bg-dark-surface-muted dark:text-brand">{prefix}</div>}
        {trend && trendValue && (
          <span className={`text-xs font-medium ${trendClasses[trend]}`}>
            {trendValue}
          </span>
        )}
      </div>
    </Card>
  );
};

StatCard.displayName = 'StatCard';
