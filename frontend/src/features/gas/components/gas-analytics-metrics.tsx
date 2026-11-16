import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { StatCard } from '@/shared/components/stat-card';

interface GasAnalyticsMetricsProps {
  analysisData: Record<string, unknown>;
}

/**
 * D2 (audit analitike §2, §4): nedostajuće polje **nije** nula.
 *
 * Do 16.11. su sve metrike imale `?? 0`, pa je odgovor bez polja (pad servera,
 * djelimičan odgovor, ugašen izvoz) izgledao kao **izmjerenih 0 m³ / 0 KM**.
 * Nula je tada bila tvrdnja o mjerenju koju niko nije izmjerio — ista greška
 * kao `null` → `0` u `avgIndoorTemp` (B1).
 *
 * Pravilo: `0` ostaje `0` (stvarno izmjereno), `undefined`/`null`/`NaN` ide u
 * „—" (`StatCard` prima `number | string`).
 */
function metricOrDash(
  value: unknown,
  format: (value: number) => string = (v) => String(v),
): number | string {
  return typeof value === 'number' && Number.isFinite(value)
    ? format(value)
    : '—';
}

export const GasAnalyticsMetrics = ({
  analysisData,
}: GasAnalyticsMetricsProps): JSX.Element => {
  const { t } = useTranslation();
  const efficiency = analysisData.efficiency as
    | { m3PerHour?: number; label?: string }
    | undefined;

  /*
   * Ukupna potrošnja je jedina metrika sa dva moguća izvora. `??` lanac je
   * pogrešan ovdje: `consumptionFromReferenceM3: 0` je **mjerenje** i mora
   * pobijediti `totalGas`, a ne propasti u njega kao „nema vrijednosti".
   */
  const totalConsumption =
    typeof analysisData.consumptionFromReferenceM3 === 'number'
      ? analysisData.consumptionFromReferenceM3
      : analysisData.totalGas;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t('gas.metricTotalConsumption')}
          value={metricOrDash(totalConsumption, (v) => v.toFixed(2))}
          suffix="m³"
        />
        <StatCard
          title={t('gas.metricHeatingHours')}
          value={metricOrDash(analysisData.totalHeatingHours, (v) => v.toFixed(1))}
          suffix="h"
        />
        <StatCard
          title={t('gas.metricAvgFlowTemp')}
          value={metricOrDash(analysisData.avgFlowTemp, (v) => v.toFixed(1))}
          suffix="°C"
        />
        <StatCard
          title={t('gas.metricUsagePerHour')}
          value={metricOrDash(efficiency?.m3PerHour, (v) => v.toFixed(3))}
          suffix="m³/h"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title={t('gas.metricCostExVat')}
          value={metricOrDash(analysisData.costExVat, (v) => v.toFixed(2))}
          suffix="KM"
        />
        <StatCard
          title={t('gas.metricVat')}
          value={metricOrDash(analysisData.vatAmount, (v) => v.toFixed(2))}
          suffix="KM"
        />
        <StatCard
          title={t('gas.metricCostIncVat')}
          value={metricOrDash(analysisData.costIncVat, (v) => v.toFixed(2))}
          suffix="KM"
        />
      </div>
    </div>
  );
};
