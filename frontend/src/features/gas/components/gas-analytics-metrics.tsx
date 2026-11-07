import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { StatCard } from '@/shared/components/stat-card';

interface GasAnalyticsMetricsProps {
  analysisData: Record<string, unknown>;
}

export const GasAnalyticsMetrics = ({
  analysisData,
}: GasAnalyticsMetricsProps): JSX.Element => {
  const { t } = useTranslation();
  const efficiency = analysisData.efficiency as
    | { m3PerHour?: number; label?: string }
    | undefined;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t('gas.metricTotalConsumption')}
          value={
            (analysisData.consumptionFromReferenceM3 as number | undefined) ??
            (analysisData.totalGas as number | undefined) ??
            0
          }
          suffix="m³"
        />
        <StatCard
          title={t('gas.metricHeatingHours')}
          value={(analysisData.totalHeatingHours as number | undefined) ?? 0}
          suffix="h"
        />
        <StatCard
          title={t('gas.metricAvgFlowTemp')}
          value={(analysisData.avgFlowTemp as number | undefined) ?? 0}
          suffix="°C"
        />
        <StatCard
          title={t('gas.metricUsagePerHour')}
          value={efficiency?.m3PerHour ?? 0}
          suffix="m³/h"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title={t('gas.metricCostExVat')}
          value={(analysisData.costExVat as number | undefined) ?? 0}
          suffix="KM"
        />
        <StatCard
          title={t('gas.metricVat')}
          value={(analysisData.vatAmount as number | undefined) ?? 0}
          suffix="KM"
        />
        <StatCard
          title={t('gas.metricCostIncVat')}
          value={(analysisData.costIncVat as number | undefined) ?? 0}
          suffix="KM"
        />
      </div>
    </div>
  );
};
