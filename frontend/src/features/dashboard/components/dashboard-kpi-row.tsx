import type { JSX } from 'react';
import { AlertTriangle, Home } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { StatCard } from '@/shared/components/stat-card';

interface DashboardKpiRowProps {
  healthScore: number;
  anomalyRate: number;
  currentTemp: number;
  targetTemp: number;
}

export const DashboardKpiRow = ({
  healthScore,
  anomalyRate,
  currentTemp,
  targetTemp,
}: DashboardKpiRowProps): JSX.Element => {
  const { t } = useTranslation();

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title={t('dashboard.healthScore')}
        value={Math.round(healthScore)}
        prefix={<Home className="h-4 w-4" aria-hidden />}
        suffix="%"
        trend={healthScore > 70 ? 'up' : 'down'}
        trendValue={`${healthScore > 70 ? '+' : ''}${Math.round(healthScore)}%`}
        valueClassName={healthScore > 70 ? 'text-success' : 'text-warning'}
      />
      <StatCard
        title={t('dashboard.anomalyRate')}
        value={anomalyRate}
        prefix={<AlertTriangle className="h-4 w-4" aria-hidden />}
        suffix="%"
        trend={anomalyRate < 20 ? 'up' : 'down'}
        trendValue={`${anomalyRate < 20 ? '+' : '-'}${anomalyRate}%`}
        valueClassName={anomalyRate < 20 ? 'text-success' : 'text-destructive'}
      />
      <StatCard
        title={t('dashboard.currentTemp')}
        value={currentTemp}
        suffix="°C"
        valueClassName="text-info"
      />
      <StatCard
        title={t('dashboard.targetTemp')}
        value={targetTemp}
        suffix="°C"
        valueClassName="text-primary"
      />
    </div>
  );
};
