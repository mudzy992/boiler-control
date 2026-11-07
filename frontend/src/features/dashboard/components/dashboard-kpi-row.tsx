import type { JSX } from 'react';
import { AlertTriangle, Home, Thermometer } from 'lucide-react';
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
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        size="hero"
        title={t('dashboard.healthScore')}
        value={Math.round(healthScore)}
        prefix={<Home className="h-4 w-4" aria-hidden />}
        suffix="%"
        trend={healthScore > 70 ? 'up' : 'down'}
        trendValue={`${healthScore > 70 ? '+' : ''}${Math.round(healthScore)}%`}
        valueClassName={healthScore > 70 ? 'text-success' : 'text-warning'}
      />
      <StatCard
        size="hero"
        title={t('dashboard.anomalyRate')}
        value={anomalyRate}
        prefix={<AlertTriangle className="h-4 w-4" aria-hidden />}
        suffix="%"
        trend={anomalyRate < 20 ? 'up' : 'down'}
        trendValue={`${anomalyRate < 20 ? '+' : '-'}${anomalyRate}%`}
        valueClassName={anomalyRate < 20 ? 'text-success' : 'text-destructive'}
      />
      <StatCard
        size="hero"
        title={t('dashboard.currentTemp')}
        value={currentTemp}
        prefix={<Thermometer className="h-4 w-4" aria-hidden />}
        suffix="°C"
        valueClassName="text-info"
      />
      <StatCard
        size="hero"
        title={t('dashboard.targetTemp')}
        value={targetTemp}
        prefix={<Thermometer className="h-4 w-4" aria-hidden />}
        suffix="°C"
        valueClassName="text-brand"
      />
    </div>
  );
};
