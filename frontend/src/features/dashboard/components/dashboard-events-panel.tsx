import type { JSX } from 'react';
import { Clock, Flame } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { StatCard } from '@/shared/components/stat-card';
import { Card, CardContent } from '@/shared/components/ui/Card';
import type { HeatingBucket, HeatingEventRow } from '../types';
import { DashboardBucketChart } from './dashboard-bucket-chart';
import { DashboardEventsTable } from './dashboard-events-table';
import { DashboardRangeBar } from './dashboard-range-bar';

interface SummaryMetrics {
  totalCycles: number;
  totalDurationMin: number;
  avgDurationMin: number;
  avgIndoorTemp: number;
}

interface DashboardEventsPanelProps {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  summaryMetrics: SummaryMetrics;
  buckets: HeatingBucket[];
  events: HeatingEventRow[];
  activeBucket: string | null;
  onActiveBucketChange: (label: string | null) => void;
}

export const DashboardEventsPanel = ({
  from,
  to,
  onFromChange,
  onToChange,
  summaryMetrics,
  buckets,
  events,
  activeBucket,
  onActiveBucketChange,
}: DashboardEventsPanelProps): JSX.Element => {
  const { t } = useTranslation();

  return (
    <Card variant="elevated">
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">
            {t('dashboard.eventsTitle')}
          </h2>
          <DashboardRangeBar
            from={from}
            to={to}
            onFromChange={onFromChange}
            onToChange={onToChange}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title={t('dashboard.totalCycles')}
            value={summaryMetrics.totalCycles}
            prefix={<Flame className="h-4 w-4" aria-hidden />}
          />
          <StatCard
            title={t('dashboard.totalHeatingTime')}
            value={summaryMetrics.totalDurationMin}
            suffix="min"
            prefix={<Clock className="h-4 w-4" aria-hidden />}
          />
          <StatCard
            title={t('dashboard.avgDuration')}
            value={summaryMetrics.avgDurationMin}
            suffix="min"
          />
          <StatCard
            title={t('dashboard.avgIndoorTemp')}
            value={summaryMetrics.avgIndoorTemp}
            suffix="°C"
          />
        </div>
        <DashboardBucketChart
          buckets={buckets}
          activeBucket={activeBucket}
          onActiveBucketChange={onActiveBucketChange}
        />
        <DashboardEventsTable events={events} activeBucket={activeBucket} />
      </CardContent>
    </Card>
  );
};
