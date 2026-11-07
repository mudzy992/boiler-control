import * as React from 'react';
import { Panel, PanelBody, cn } from '@/ui';

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
  up: 'text-ok',
  down: 'text-fault',
  neutral: 'text-ink-muted',
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
  <Panel className={className}>
    <PanelBody className={size === 'hero' ? 'p-5' : 'p-4'}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
            {title}
          </p>
          <div className="flex items-baseline gap-1">
            <span
              className={cn(
                'font-mono font-semibold tabular-nums tracking-tight text-ink',
                size === 'hero' ? 'text-kpi' : 'text-2xl',
                valueClassName,
              )}
            >
              {value}
            </span>
            {suffix ? <span className="text-sm text-ink-muted">{suffix}</span> : null}
          </div>
          {trend && trendValue ? (
            <p className={cn('text-xs font-medium', trendClasses[trend])}>{trendValue}</p>
          ) : null}
        </div>
        {prefix ? <div className="text-ink-muted">{prefix}</div> : null}
      </div>
    </PanelBody>
  </Panel>
);
