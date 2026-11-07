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
  size?: 'default' | 'hero';
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
  size = 'default',
}: StatCardProps): React.JSX.Element => (
  <Card
    className={cn(
      'border-border/80 bg-card/90 shadow-cockpit',
      className,
    )}
    variant="elevated"
  >
    <CardContent className={cn('pt-5', size === 'hero' ? 'p-5' : 'p-4')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {title}
          </p>
          <div className="flex items-baseline gap-1">
            <span
              className={cn(
                'font-mono font-semibold tracking-tight text-foreground',
                size === 'hero' ? 'text-kpi' : 'text-2xl',
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
          <div className="rounded-lg bg-brand/10 p-2.5 text-brand">{prefix}</div>
        ) : null}
      </div>
    </CardContent>
  </Card>
);
