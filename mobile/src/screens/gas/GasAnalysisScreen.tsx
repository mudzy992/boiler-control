import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';

import { apiClient } from '../../services/api/client';
import { useTranslation } from '../../hooks/useTranslation';
import { formatDate, formatDateRange, formatNumber } from '../../utils/format';
import { space } from '../../theme/tokens';
import {
  EmptyState,
  InlineBanner,
  Kpi,
  Led,
  MonoLabel,
  MonoMeta,
  Panel,
  PanelRow,
  Readout,
  Screen,
  ScreenBody,
  ScreenHeader,
  Skeleton,
  SkeletonRows,
  Text,
  TrendChart,
  TrendSummary,
  type TrendPoint,
} from '../../ui';

interface GasAnalysisData {
  period?: {
    startDate?: string;
    endDate?: string;
    from?: string;
    to?: string;
    mode?: 'explicit' | 'reference_to_current' | 'last_30_days';
  };
  totalConsumption?: number;
  totalGas?: number;
  consumptionFromReferenceM3?: number;
  averageDaily?: number;
  totalHeatingHours?: number;
  avgFlowTemp?: number;
  costExVat?: number;
  vatAmount?: number;
  costIncVat?: number;
  referenceReading?: {
    id: number;
    readingDate: string;
    counterValue: number;
  } | null;
  priceBreakdown?: {
    priceExVat: number;
    consumptionM3: number;
    costExVat: number;
    source?: string;
    effectiveFrom?: string | null;
    effectiveTo?: string | null;
  }[];
  efficiency?: {
    heatingHours?: number;
    averageFlowTemp?: number;
    gasUsagePerHeatingHour?: number;
    m3PerHour?: number;
  };
  monthlyTrends?: {
    month: string;
    consumption: number;
    heatingHours: number;
  }[];
}

interface GasReading {
  id: number;
  userId: number;
  counterValue: number;
  readingDate: string;
  createdAt: string;
}

interface DailyConsumptionStats {
  minDaily: number;
  maxDaily: number;
  medianDaily: number;
  meanDaily: number;
  stdDev: number | null;
  trend: 'increasing' | 'decreasing' | 'stable';
}

// Utility function to calculate daily consumption differences
const calculateDailyConsumptionStats = (readings: GasReading[]): DailyConsumptionStats | null => {
  if (!readings || readings.length < 2) {
    return null;
  }

  // Sort readings by date (oldest first)
  const sorted = [...readings].sort(
    (a, b) => new Date(a.readingDate).getTime() - new Date(b.readingDate).getTime()
  );

  const dailyConsumptions: number[] = [];

  // Calculate consumption differences
  for (let i = 1; i < sorted.length; i++) {
    const diff = sorted[i].counterValue - sorted[i - 1].counterValue;
    const daysDiff = dayjs(sorted[i].readingDate).diff(
      dayjs(sorted[i - 1].readingDate),
      'day',
      true
    );

    if (diff >= 0 && daysDiff > 0) {
      const dailyConsumption = diff / daysDiff;
      dailyConsumptions.push(dailyConsumption);
    }
  }

  if (dailyConsumptions.length === 0) {
    return null;
  }

  // Calculate statistics
  const sorted_consumption = [...dailyConsumptions].sort((a, b) => a - b);
  const minDaily = Math.min(...dailyConsumptions);
  const maxDaily = Math.max(...dailyConsumptions);
  const meanDaily = dailyConsumptions.reduce((a, b) => a + b, 0) / dailyConsumptions.length;

  // Median
  const mid = Math.floor(sorted_consumption.length / 2);
  const medianDaily =
    sorted_consumption.length % 2 !== 0
      ? sorted_consumption[mid]
      : (sorted_consumption[mid - 1] + sorted_consumption[mid]) / 2;

  // Standard deviation (optional)
  let stdDev: number | null = null;
  if (dailyConsumptions.length > 1) {
    const squaredDiffs = dailyConsumptions.map((x) => Math.pow(x - meanDaily, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / dailyConsumptions.length;
    stdDev = Math.sqrt(variance);
  }

  // Trend direction
  const firstHalf = dailyConsumptions.slice(0, Math.ceil(dailyConsumptions.length / 2));
  const secondHalf = dailyConsumptions.slice(Math.ceil(dailyConsumptions.length / 2));
  const avgFirstHalf = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avgSecondHalf = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  const trendThreshold = meanDaily * 0.05; // 5% threshold

  if (avgSecondHalf > avgFirstHalf + trendThreshold) {
    trend = 'increasing';
  } else if (avgSecondHalf < avgFirstHalf - trendThreshold) {
    trend = 'decreasing';
  }

  return {
    minDaily,
    maxDaily,
    medianDaily,
    meanDaily,
    stdDev,
    trend,
  };
};

type GasAnalysisScreenProps = {
  /**
   * F1 (nalaz UX-03 / UX-02): Analiza više nije zaseban tab, nego sekcija Plina.
   * `onBack` je obavezan izlaz — prije ga nije bilo nigdje u ekranu.
   */
  onBack?: () => void;
  /** Ista „Očitanja | Analiza" traka kao na Očitanjima — kontrola ne smije nestati. */
  headerSlot?: React.ReactNode;
};

/**
 * Detaljni prolaz kroz Analizu (F6, GAS-01…GAS-07).
 *
 * Šta je bilo pogrešno i zašto je promijenjeno:
 *
 *  GAS-01 · Ista informacija je bila ispisana DVA puta — „Analysis Window"
 *    (plava kutija na vrhu) i „Analysis Period" (plava kutija na dnu) imale su
 *    identičan period i istu referentnu očitanje. Sada postoji jedno mjesto:
 *    `AnalysisPeriodRow` u sažetku.
 *  GAS-02 · Brojevi su išli kroz `toFixed(2)`, dakle uvijek tačka i bez
 *    razdvajača hiljada, a datumi kroz `dayjs.format('DD.MM.YYYY')` i
 *    `toLocaleDateString('en-US')` u istom ekranu. Sada `utils/format` po jeziku.
 *  GAS-03 · Četiri obojene kutije (`blue.50`, `green.50`, `purple.50`,
 *    `gray.50`) sa po tri nijanse u svakoj — 13 `useColorModeValue` poziva i
 *    boje koje ne postoje u paleti. Sada `Panel` + `InlineBanner` + `Led`; boja
 *    nosi značenje (ok/warn/fault/info), ne ukras.
 *  GAS-04 · Tri metrike „efikasnosti" i tri stavke cijene stajale su u
 *    `HStack`-u bez `flex`, pa se na 360 dp treća kolona lomila u dva reda.
 *    Sada `Kpi` pločice koje se same prelamaju u mrežu.
 *  GAS-05 · Trend je bio obojena značka sa `bg="green.500"` za RAST potrošnje —
 *    zelena je u ostatku aplikacije „u redu", pa je najgorši scenario izgledao
 *    kao dobra vijest. Sada `Led` sa semantičkim stanjem (rast = `warn`).
 *  GAS-06 · Kalkulacija je bila bez ikakvog objašnjenja: brojevi „min/avg/max"
 *    su se pojavljivali bez definicije šta je uzorak. Sada sekcija ima
 *    podnaslov koji kaže da je uzorak razlika između uzastopnih očitanja.
 *  GAS-07 · Zaglavlje bez `ScrollView` paddinga i bez `ScreenBody`: analiza je
 *    imala `px={5}` i `py={5}` ručno, pa se horizontalni ritam razlikovao od
 *    Očitanja. Sada `ScreenBody` (16 px, isti kao svuda).
 */
/**
 * Jedan red „labela → vrijednost" za liste metrika.
 *
 * Izvan komponente namjerno: komponenta definirana unutar `render`-a se pri
 * svakom renderu smatra novim tipom i React je remountuje, što gubi fokus i
 * stanje (i ESLint to prijavljuje kao `react-hooks/static-components`).
 */
function MetricRow({
  label,
  value,
  unit,
  tone = 'ink',
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: 'ink' | 'signal' | 'ok' | 'warn' | 'fault';
}) {
  return (
    <PanelRow>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: space.sm,
          flex: 1,
        }}
      >
        <Text size="body" tone="muted">
          {label}
        </Text>
        <Readout value={value} unit={unit} size="md" tone={tone} />
      </View>
    </PanelRow>
  );
}

const GasAnalysisScreenContent: React.FC<GasAnalysisScreenProps> = ({ onBack, headerSlot }) => {
  const { t } = useTranslation();

  const { data: analysis, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['gas-analysis'],
    queryFn: () => apiClient.getGasAnalysis() as Promise<GasAnalysisData>,
  });

  const { data: readings } = useQuery({
    queryKey: ['gas-readings'],
    queryFn: () => apiClient.getGasReadings() as Promise<GasReading[]>,
  });

  const dailyStats = useMemo(() => {
    return readings ? calculateDailyConsumptionStats(readings) : null;
  }, [readings]);

  // F3 (AN-03): isti `TrendChart` kao na analitici — nema treće biblioteke za
  // grafove, a širinu daje `onLayout` kontejnera (ne ekran).
  const monthlyPoints = useMemo<TrendPoint[]>(
    () =>
      (analysis?.monthlyTrends ?? []).map((m) => ({
        label: dayjs(m.month).format('MMM'),
        value: m.consumption,
      })),
    [analysis?.monthlyTrends],
  );

  const currency = t('gas.currencyKM');

  const header = (
    <ScreenHeader
      title={t('gas.analyticsTitle')}
      subtitle={t('gas.analyticsSubtitle')}
      onBack={onBack}
      backLabel={t('common.back')}
      testID="gas-analysis-header"
    />
  );

  if (isLoading) {
    // F4 (UX-07): isti okvir (zaglavlje + nazad) i skeleton umjesto spinnera,
    // pa ekran ne „nestane" i ne izgubi način za nazad dok se podaci čitaju.
    return (
      <Screen edges={['top']}>
        {header}
        {headerSlot ? <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>{headerSlot}</View> : null}
        <ScreenBody>
          <SkeletonRows count={2} />
          <Skeleton height={200} />
        </ScreenBody>
      </Screen>
    );
  }

  // F6 (GAS-08): greška mreže je prije padala na „nema podataka", pa je
  // korisnik dobijao savjet „dodaj dva očitanja" iako očitanja postoje — samo
  // analiza nije stigla. Sada se greška i prazno stanje razlikuju.
  if (isError) {
    return (
      <Screen edges={['top']}>
        {header}
        {headerSlot ? <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>{headerSlot}</View> : null}
        <ScreenBody>
          <InlineBanner
            tone="fault"
            title={t('gas.analysisLoadError')}
            message={t('gas.analysisLoadErrorBody')}
            action={{ label: t('common.retry'), onPress: () => void refetch(), loading: isFetching }}
            testID="gas-analysis-error"
          />
        </ScreenBody>
      </Screen>
    );
  }

  if (!analysis) {
    return (
      <Screen edges={['top']}>
        {header}
        {headerSlot ? <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>{headerSlot}</View> : null}
        {/* F4 (UX-24): analiza bez podataka nudi prelazak na očitanja, jer je
           jedini put do podataka — novo očitanje. */}
        <EmptyState
          icon="bar-chart-outline"
          title={t('gas.analysisNoData')}
          message={t('gas.analysisNoDataBody')}
          action={onBack ? { label: t('gas.analysisNoDataAction'), onPress: onBack } : undefined}
        />
      </Screen>
    );
  }

  const periodStart = analysis.period?.startDate ?? analysis.period?.from;
  const periodEnd = analysis.period?.endDate ?? analysis.period?.to;
  const periodMode = analysis.period?.mode;
  const totalConsumption =
    analysis.consumptionFromReferenceM3 ?? analysis.totalConsumption ?? analysis.totalGas ?? 0;
  const daysInPeriod =
    periodStart && periodEnd ? Math.max(1, dayjs(periodEnd).diff(dayjs(periodStart), 'day')) : 0;
  const averageDaily =
    analysis.averageDaily ?? (daysInPeriod ? totalConsumption / daysInPeriod : 0);
  const heatingHours = analysis.efficiency?.heatingHours ?? analysis.totalHeatingHours ?? 0;
  const averageFlowTemp = analysis.efficiency?.averageFlowTemp ?? analysis.avgFlowTemp ?? 0;
  const gasUsagePerHeatingHour =
    analysis.efficiency?.gasUsagePerHeatingHour ?? analysis.efficiency?.m3PerHour ?? 0;
  const periodModeLabel =
    periodMode === 'reference_to_current'
      ? t('gas.analysisModeReference')
      : periodMode === 'last_30_days'
        ? t('gas.analysisModeLast30')
        : t('gas.analysisModeExplicit');

  const referenceReading = analysis.referenceReading;

  return (
    <Screen edges={['top']} testID="gas-analysis-screen">
      {header}
      {headerSlot ? <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>{headerSlot}</View> : null}
      <ScreenBody testID="gas-analysis-body">
        {/*
          Sažetak: period na JEDNOM mjestu (GAS-01), dvije glavne brojke kao KPI
          (GAS-04), pa metrike kao redovi u `flush` panelu.
        */}
        <Panel variant="flush" padded={false} testID="gas-analysis-period">
          <PanelRow divider={false}>
            <View style={{ gap: 2 }}>
              <MonoLabel>{t('gas.analysisWindowTitle')}</MonoLabel>
              <Text size="bodyLg" weight="medium">
                {periodStart || periodEnd
                  ? formatDateRange(periodStart, periodEnd)
                  : t('gas.analysisPeriodUnknown')}
              </Text>
              <MonoMeta>{periodModeLabel}</MonoMeta>
              {referenceReading ? (
                <MonoMeta>
                  {`${t('gas.analysisReferenceReading')}: ${formatDate(referenceReading.readingDate)} · ${formatNumber(referenceReading.counterValue)} m³`}
                </MonoMeta>
              ) : null}
            </View>
          </PanelRow>
        </Panel>

        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          <Kpi
            label={
              periodMode === 'reference_to_current'
                ? t('gas.analysisTotalUseReference')
                : t('gas.analysisTotalUse')
            }
            value={formatNumber(totalConsumption)}
            unit="m³"
            testID="gas-kpi-total"
          />
          <Kpi
            label={t('gas.analysisAvgDaily')}
            value={formatNumber(averageDaily)}
            unit="m³"
            testID="gas-kpi-daily"
          />
        </View>

        <Panel variant="flush" padded={false} testID="gas-analysis-efficiency">
          <PanelRow divider>
            <View style={{ gap: 2 }}>
              <MonoLabel>{t('gas.analysisHeatingEfficiency')}</MonoLabel>
              {/* GAS-06: uzorak je eksplicitan, pa broj nije „iz vedra neba". */}
              <MonoMeta>{t('gas.analysisEfficiencyHint')}</MonoMeta>
            </View>
          </PanelRow>
          <MetricRow label={t('gas.analysisHeatingHours')} value={formatNumber(heatingHours, 1)} unit="h" />
          <MetricRow label={t('gas.analysisAvgFlowTemp')} value={formatNumber(averageFlowTemp, 1)} unit="°C" />
          <MetricRow
            label={t('gas.analysisUsagePerHour')}
            value={formatNumber(gasUsagePerHeatingHour, 3)}
            unit="m³"
          />
        </Panel>

        <Panel variant="flush" padded={false} testID="gas-analysis-cost">
          <PanelRow divider>
            <View style={{ gap: 2 }}>
              <MonoLabel>{t('gas.analysisCostBreakdown')}</MonoLabel>
              <MonoMeta>{t('gas.analysisCostHint')}</MonoMeta>
            </View>
          </PanelRow>
          <MetricRow label={t('gas.analysisCostExVat')} value={formatNumber(analysis.costExVat ?? 0)} unit={currency} />
          <MetricRow label={t('gas.analysisCostVat')} value={formatNumber(analysis.vatAmount ?? 0)} unit={currency} />
          {/* Ukupno je jedina brojka koja nosi odluku — zato `signal`. */}
          <MetricRow
            label={t('gas.analysisCostIncVat')}
            value={formatNumber(analysis.costIncVat ?? 0)}
            unit={currency}
            tone="signal"
          />
        </Panel>

        {analysis.priceBreakdown?.length ? (
          <Panel variant="flush" padded={false} testID="gas-analysis-price-windows">
            <PanelRow divider>
              <MonoLabel>{t('gas.analysisPriceWindows')}</MonoLabel>
            </PanelRow>
            {analysis.priceBreakdown.map((row, index) => (
              <PanelRow key={`${row.priceExVat}-${index}`} divider={index < analysis.priceBreakdown!.length - 1}>
                <View style={{ gap: 2, flex: 1 }}>
                  <Text size="bodyLg" weight="medium">
                    {t('gas.analysisPriceExVatValue', { value: formatNumber(row.priceExVat, 4) })}
                  </Text>
                  <MonoMeta>
                    {`${formatDate(row.effectiveFrom)} – ${
                      row.effectiveTo ? formatDate(row.effectiveTo) : t('gas.analysisPriceCurrent')
                    }`}
                  </MonoMeta>
                  <MonoMeta>
                    {t('gas.analysisPriceConsumptionCost', {
                      consumption: formatNumber(row.consumptionM3),
                      costExVat: formatNumber(row.costExVat ?? 0),
                    })}
                  </MonoMeta>
                </View>
                <MonoMeta>{String(row.source || t('gas.analysisPriceSourceManual')).toUpperCase()}</MonoMeta>
              </PanelRow>
            ))}
          </Panel>
        ) : null}

        {/* Graf — jedan vizuelni jezik sa analitikom (F3, AN-03). */}
        {monthlyPoints.length > 0 ? (
          <Panel testID="gas-analysis-chart-panel">
            <View style={{ gap: space.sm }}>
              <MonoLabel>{t('gas.analysisMonthlyConsumption')}</MonoLabel>
              <TrendChart
                points={monthlyPoints}
                height={200}
                accessibilityLabel={t('gas.analysisMonthlyConsumption')}
                testID="gas-analysis-chart"
              />
              <TrendSummary points={monthlyPoints} unit="m³" />
            </View>
          </Panel>
        ) : null}

        {/* Dnevna statistika: uzorak je eksplicitan (GAS-06). */}
        {dailyStats ? (
          <Panel variant="flush" padded={false} testID="gas-analysis-daily-stats">
            <PanelRow divider>
              <View style={{ gap: 2 }}>
                <MonoLabel>{t('gas.analysisDailyStats')}</MonoLabel>
                <MonoMeta>{t('gas.analysisDailyStatsHint')}</MonoMeta>
              </View>
            </PanelRow>
            <MetricRow label={t('gas.analysisMinDaily')} value={formatNumber(dailyStats.minDaily)} unit="m³" />
            <MetricRow label={t('gas.analysisMaxDaily')} value={formatNumber(dailyStats.maxDaily)} unit="m³" />
            <MetricRow
              label={t('gas.analysisAvgDailyLabel')}
              value={formatNumber(dailyStats.meanDaily)}
              unit="m³"
            />
            <MetricRow
              label={t('gas.analysisMedianDaily')}
              value={formatNumber(dailyStats.medianDaily)}
              unit="m³"
            />
            {dailyStats.stdDev !== null ? (
              <MetricRow label={t('gas.analysisStdDev')} value={formatNumber(dailyStats.stdDev)} unit="m³" />
            ) : null}
            <PanelRow divider={false}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flex: 1 }}>
                {/*
                  GAS-05: rast potrošnje je prije bio zelena značka. Zelena u
                  ostatku aplikacije znači „u redu", pa je najgorši scenario
                  izgledao kao dobra vijest. Sada boju nosi `Led`, a značenje
                  tekst: rast = `warn`, pad = `ok`, stabilno = `off`.
                */}
                <Led
                  state={
                    dailyStats.trend === 'increasing'
                      ? 'warn'
                      : dailyStats.trend === 'decreasing'
                        ? 'ok'
                        : 'off'
                  }
                />
                <View style={{ flex: 1, gap: 1 }}>
                  <Text size="body" weight="medium">
                    {dailyStats.trend === 'increasing'
                      ? t('gas.analysisTrendIncreasing')
                      : dailyStats.trend === 'decreasing'
                        ? t('gas.analysisTrendDecreasing')
                        : t('gas.analysisTrendStable')}
                  </Text>
                  <MonoMeta>
                    {dailyStats.trend === 'increasing'
                      ? t('gas.analysisTrendMessageIncreasing')
                      : dailyStats.trend === 'decreasing'
                        ? t('gas.analysisTrendMessageDecreasing')
                        : t('gas.analysisTrendMessageStable')}
                  </MonoMeta>
                </View>
              </View>
            </PanelRow>
          </Panel>
        ) : (
          <InlineBanner
            tone="info"
            title={t('gas.analysisNeedTwoReadings')}
            testID="gas-analysis-need-readings"
          />
        )}

        <MonoMeta>{t('gas.analysisUpdatedAt', { value: formatDate(new Date()) })}</MonoMeta>
      </ScreenBody>
    </Screen>
  );
};

export const GasAnalysisScreen = GasAnalysisScreenContent;
