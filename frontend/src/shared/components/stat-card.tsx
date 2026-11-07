import * as React from 'react';
import { Card, CardContent } from '@/shared/components/ui/Card';
import { cn } from '@/shared/lib/utils';

/** Compact KPI card built on shadcn Card (token colors only). */
export interface StatCardProps {
  title: string;
  value: number | string;
  prefix?: React.ReactNode;
  suffix?: string;
  valueClassName?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  className?: string;
}

const trendClasses: Record<NonNullable<StatCardProps['trend']>, string> = {
  up: 'text-success',
  down: 'text-error',
  neutral: 'text-muted-foreground',
};

export const StatCard = ({
  title,
  value,
  prefix,
  suffix,
  valueClassName,
  trend,
  trendValue,
  className,
}: StatCardProps): React.JSX.Element => (
  <Card className={cn(className)} variant="elevated">
    <CardContent className="p-4 pt-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="flex items-baseline gap-1">
            <span
              className={cn(
                'text-2xl font-semibold tracking-tight text-foreground',
                valueClassName,
              )}
            >
              {value}
            </span>
            {suffix ? (
              <span className="text-sm text-muted-foreground">{suffix}</span>
            ) : null}
          </div>
          {trend && trendValue ? (
            <span className={cn('text-xs font-medium', trendClasses[trend])}>
              {trendValue}
            </span>
          ) : null}
        </div>
        {prefix ? (
          <div className="rounded-md bg-muted p-2 text-primary">{prefix}</div>
        ) : null}
      </div>
    </CardContent>
  </Card>
);
