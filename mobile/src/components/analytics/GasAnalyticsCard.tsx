import React, { useMemo } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';

import { useTranslation } from '../../hooks/useTranslation';
import { formatDate, formatNumber } from '../../utils/format';
import { space } from '../../theme/tokens';
import {
  Kpi,
  MonoLabel,
  MonoMeta,
  Panel,
  PanelRow,
  Skeleton,
  Text,
  useTokens,
} from '../../ui';

interface GasReading {
  id: number;
  userId: number;
  counterValue: number;
  readingDate: string;
  createdAt: string;
}

interface GasAnalyticsCardProps {
  readings: GasReading[] | undefined;
  isLoading: boolean;
}

/**
 * F10 (ANALYTICS-GAS): kartica „Potrošnja plina" na Analitici bila je jedina
 * kartica na tom ekranu koja NIJE koristila `src/ui` — `Box`/`VStack`/`HStack`
 * sa `shadow={2}`, `rounded="xl"`, `orange.500` ikonom i četiri sive pločice sa
 * `gray.50`/`dark.700` podlogom. Pored susjednih `Panel`/`Kpi` kartica izgledala
 * je kao da pripada drugoj aplikaciji (na svjetloj temi: tamnija siva; na
 * tamnoj: svjetlija pločica od podloge panela).
 *
 * Sada: isti `Panel` bez sjene, `Kpi` za četiri brojke (dvije po redu, kao na
 * Početnoj), `Readout` za vrijednost očitanja, `PanelRow` sa hairline-om za
 * listu. Nijedna boja nije hardkodirana — sve dolazi iz `useTokens()`.
 *
 * Računanje je NEPROMIJENJENO (`toFixed` → `formatNumber`, koji poštuje
 * decimalni zarez u bs-BS, pa je i to ispravka prikaza, ne logike).
 */
export const GasAnalyticsCard: React.FC<GasAnalyticsCardProps> = ({ readings, isLoading }) => {
  const { t } = useTokens();
  const { t: tr } = useTranslation();

  const stats = useMemo(() => {
    if (!readings || readings.length === 0) {
      return null;
    }

    const sorted = [...readings].sort(
      (a, b) => new Date(a.readingDate).getTime() - new Date(b.readingDate).getTime(),
    );

    const consumptionDiffs: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const diff = sorted[i].counterValue - sorted[i - 1].counterValue;
      if (diff >= 0) {
        consumptionDiffs.push(diff);
      }
    }

    const totalConsumption = consumptionDiffs.reduce((a, b) => a + b, 0);
    const minConsumption = consumptionDiffs.length > 0 ? Math.min(...consumptionDiffs) : 0;
    const maxConsumption = consumptionDiffs.length > 0 ? Math.max(...consumptionDiffs) : 0;

    const oldestDate = new Date(sorted[0].readingDate);
    const newestDate = new Date(sorted[sorted.length - 1].readingDate);
    const daysDiff = dayjs(newestDate).diff(dayjs(oldestDate), 'day', true);
    const avgDailyConsumption = daysDiff > 0 ? totalConsumption / daysDiff : 0;

    return {
      totalConsumption,
      minConsumption,
      maxConsumption,
      avgDailyConsumption,
      readingCount: sorted.length,
      sortedReadings: sorted,
    };
  }, [readings]);

  if (isLoading) {
    return (
      <Panel testID="analytics-gas-card-skeleton">
        <View style={{ gap: space.sm }}>
          <Skeleton width="45%" height={14} />
          <Skeleton width="70%" height={10} />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Skeleton width="48%" height={64} />
            <Skeleton width="48%" height={64} />
          </View>
        </View>
      </Panel>
    );
  }

  if (!readings || readings.length === 0) {
    return (
      <Panel testID="analytics-gas-card-empty">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Ionicons name="information-circle-outline" size={16} color={t.inkDim} />
          <Text size="body" tone="muted" style={{ flex: 1 }}>
            {tr('analytics.noGasReadings')}
          </Text>
        </View>
      </Panel>
    );
  }

  if (!stats) {
    return null;
  }

  const displayReadings = stats.sortedReadings.slice(-5).reverse();

  return (
    <Panel variant="flush" padded={false} testID="analytics-gas-card">
      {/* Zaglavlje */}
      <PanelRow divider>
        <View style={{ flex: 1, gap: 2 }}>
          <MonoLabel>{tr('analytics.gasConsumption')}</MonoLabel>
          <MonoMeta>{tr('analytics.gasConsumptionDesc')}</MonoMeta>
        </View>
        <Ionicons name="flame-outline" size={18} color={t.signal} />
      </PanelRow>

      {/* Četiri brojke: dvije po redu, isti rang kao KPI na Početnoj. */}
      <PanelRow divider>
        <View style={{ flex: 1, gap: space.sm }}>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Kpi
              label={tr('analytics.totalLabel')}
              value={formatNumber(stats.totalConsumption)}
              unit="m³"
              testID="analytics-gas-total"
            />
            <Kpi
              label={tr('analytics.avgDailyLabel')}
              value={formatNumber(stats.avgDailyConsumption)}
              unit="m³"
              testID="analytics-gas-avg"
            />
          </View>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Kpi
              label={tr('analytics.minLabel')}
              value={formatNumber(stats.minConsumption)}
              unit="m³"
              testID="analytics-gas-min"
            />
            <Kpi
              label={tr('analytics.maxLabel')}
              value={formatNumber(stats.maxConsumption)}
              unit="m³"
              testID="analytics-gas-max"
            />
          </View>
        </View>
      </PanelRow>

      {/* Zadnjih pet očitanja sa razlikom prema prethodnom. */}
      <PanelRow divider>
        <MonoLabel>{`${tr('analytics.recentReadings')} (${stats.readingCount})`}</MonoLabel>
      </PanelRow>

      {displayReadings.map((reading, index) => {
        const isNewest = index === 0;
        // `displayReadings` je obrnut (najnovije prvo), pa je „prethodno"
        // očitanje ono sa INDEKSOM IZA u ovom nizu.
        const previous = displayReadings[index + 1];
        const consumption =
          previous && reading.counterValue >= previous.counterValue
            ? reading.counterValue - previous.counterValue
            : null;

        const daysDiff =
          previous && dayjs(reading.readingDate).isAfter(previous.readingDate)
            ? dayjs(reading.readingDate).diff(dayjs(previous.readingDate), 'day')
            : null;

        const dailyConsumption =
          consumption && daysDiff && daysDiff > 0 ? consumption / daysDiff : null;

        return (
          <PanelRow
            key={reading.id}
            divider={index < displayReadings.length - 1}
            testID={`analytics-gas-reading-${reading.id}`}
          >
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text size="bodyLg" weight="monoSemiBold">
                {`${formatNumber(reading.counterValue)} m³`}
              </Text>
              <MonoMeta>{formatDate(reading.readingDate)}</MonoMeta>
            </View>
            {!isNewest && consumption !== null ? (
              <View style={{ alignItems: 'flex-end', gap: 2 }}>
                <MonoMeta tone="signal">{`+${formatNumber(consumption)} m³`}</MonoMeta>
                {dailyConsumption !== null ? (
                  <MonoMeta>{tr('analytics.perDay', { value: formatNumber(dailyConsumption) })}</MonoMeta>
                ) : null}
              </View>
            ) : null}
          </PanelRow>
        );
      })}
    </Panel>
  );
};
