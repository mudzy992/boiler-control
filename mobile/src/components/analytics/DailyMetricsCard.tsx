import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { apiClient } from '../../services/api/client';
import { useTranslation } from '../../hooks/useTranslation';
import { MonoLabel, MonoMeta, Panel, PanelRow, Section, Skeleton, Text } from '../../ui';
import { space } from '../../theme/tokens';
import type { DailyMetricField } from '../../types/Dashboard';
import {
  averageOfMeasured,
  evaluateMetricsGate,
  fieldsWithData,
} from '../../features/analytics/metrics-gate';

/**
 * C1 — dnevne mjerne kolone na mobilnom.
 *
 * Isti kanal i ista kapija kao web (`features/heating/lib/metrics-gate.ts`,
 * prenesen 1:1) — dva klijenta ne smiju dati različit odgovor na isto pitanje
 * „ima li ovdje dovoljno podataka da se prikaže".
 *
 * **Prosjek ide samo preko dana koji IMAJU mjerenje.** Izostanak polja znači
 * „nije mjereno" (dogovor B1), pa bi prosjek preko svih dana tiho uračunao
 * nemjereno kao nulu i spustio broj bez ijednog izmjerenog podatka.
 */

const FIELD_META: Partial<
  Record<DailyMetricField, { labelKey: string; unit: string; digits: number }>
> = {
  dutyPercent: { labelKey: 'analytics.metricsDuty', unit: '%', digits: 0 },
  medianCycleMin: { labelKey: 'analytics.metricsMedianCycle', unit: 'min', digits: 0 },
  overshootC: { labelKey: 'analytics.metricsOvershoot', unit: 'K', digits: 2 },
  undershootC: { labelKey: 'analytics.metricsUndershoot', unit: 'K', digits: 2 },
  hysteresisK: { labelKey: 'analytics.metricsHysteresis', unit: 'K', digits: 2 },
  hysteresisAsymmetryK: { labelKey: 'analytics.metricsHysteresisAsymmetry', unit: 'K', digits: 2 },
  heatRateCPerHour: { labelKey: 'analytics.metricsHeatRate', unit: 'K/h', digits: 2 },
  nightUndershootC: { labelKey: 'analytics.metricsNightUndershoot', unit: 'K', digits: 2 },
  nightMinOutdoorMeasuredC: { labelKey: 'analytics.metricsNightOutdoor', unit: '°C', digits: 1 },
  nightFlowC: { labelKey: 'analytics.metricsNightFlow', unit: '°C', digits: 1 },
  flowSetC: { labelKey: 'analytics.metricsFlowSet', unit: '°C', digits: 1 },
  degreeHours: { labelKey: 'analytics.metricsDegreeHours', unit: 'Kh', digits: 1 },
};

interface DailyMetricsCardProps {
  homeProfileId: number | undefined;
  from: string;
  to: string;
}

export const DailyMetricsCard = ({ homeProfileId, from, to }: DailyMetricsCardProps) => {
  const { t } = useTranslation();
  const enabled = Boolean(homeProfileId);

  const metricsQuery = useQuery({
    queryKey: ['daily-metrics', homeProfileId, from, to],
    queryFn: () => apiClient.getDailyMetrics({ homeProfileId: homeProfileId as number, from, to }),
    enabled,
    staleTime: 1000 * 60 * 5,
  });

  if (!enabled) return null;
  if (metricsQuery.isLoading) return <Skeleton height={96} />;

  const gate = evaluateMetricsGate(metricsQuery.data?.coverage);
  /*
   * Kapija iz plana: ispod 25 % kartice NEMA. Ekran koji je prazan na 94 %
   * dana izgleda kao kvar, ne kao nedostatak podatka — a to je razlika koju
   * korisnik ne može sam napraviti.
   */
  if (!gate.visible) return null;

  const fields = fieldsWithData(metricsQuery.data?.coverage).filter(
    (entry) => FIELD_META[entry.field as DailyMetricField] !== undefined
  );

  return (
    <Section label={t('analytics.metricsTitle')} meta={t('analytics.metricsSubtitle')}>
      <Panel variant="flush" padded={false} testID="analytics-metrics">
        {fields.map((entry, index) => {
          const meta = FIELD_META[entry.field as DailyMetricField]!;
          const average = averageOfMeasured(
            metricsQuery.data?.rows ?? [],
            entry.field as DailyMetricField
          );
          return (
            <PanelRow key={entry.field} divider={index < fields.length - 1}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text size="body" style={{ flex: 1 }} numberOfLines={1}>
                  {t(meta.labelKey)}
                </Text>
                <MonoLabel>
                  {average === null ? '—' : `${average.value.toFixed(meta.digits)} ${meta.unit}`}
                </MonoLabel>
              </View>
              {/*
               * Broj dana uz vrijednost: prosjek iz 2 dana i prosjek iz 60 nisu
               * isti podatak, a iz same brojke se to ne vidi.
               */}
              <MonoMeta>{`${average?.days ?? 0} / ${metricsQuery.data?.coverage.days ?? 0}`}</MonoMeta>
            </PanelRow>
          );
        })}
      </Panel>
      <View style={{ marginTop: space.xs }}>
        <MonoMeta>
          {t('analytics.metricsCoverage', {
            best: gate.percent,
            days: fields[0]?.days ?? 0,
            total: metricsQuery.data?.coverage.days ?? 0,
          })}
        </MonoMeta>
      </View>
    </Section>
  );
};
