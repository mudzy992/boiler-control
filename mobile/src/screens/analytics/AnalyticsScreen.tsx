import { useMemo, useState } from 'react';
import { Share, Platform, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';

import { analyticsApi, type HeatingStatsBucket } from '../../services/api/analytics.api';
import { homeProfileApi } from '../../services/api/homeProfile.api';
import { apiClient } from '../../services/api/client';
import { useTranslation } from '../../hooks/useTranslation';
import { useToast } from '../../components/ui/nativewind';
import { GasAnalyticsCard } from '../../components/analytics/GasAnalyticsCard';
import {
  Button,
  GaugeBar,
  InlineBanner,
  Kpi,
  MonoLabel,
  MonoMeta,
  Panel,
  PanelRow,
  Readout,
  Screen,
  ScreenBody,
  ScreenHeader,
  Section,
  Segmented,
  Skeleton,
  Text,
  TrendChart,
  TrendSummary,
  type TrendPoint,
} from '../../ui';
import { space } from '../../theme/tokens';

/**
 * Analitika (prototip §05, nalazi UX-01 i UX-13).
 *
 * Prije:
 *  - „12 % bolji od sličnih domova" i „18 % poboljšanje" bili su STRING LITERALI
 *    u kodu, prikazani kao mjerenja (UX-01). U domenu grijanja i potrošnje plina
 *    to može uticati na odluke o temperaturi polaza. Blok je uklonjen u MO2-19 i
 *    ovdje se ne vraća; vraća se kad backend vrati stvarnu normalizaciju.
 *  - Četiri kartice imale su hardkodiran `trend="up"|"down"` uz tekst „u odnosu
 *    na prošlu sedmicu", a dohvatan je samo tekući raspon (UX-13).
 *
 * Sada: eksplicitna tabela „Vrijednost / Prethodno" (stvarni brojevi iz API-ja
 * za OBA raspona), cilj-vs-postignuto po termostatu kao gauge redovi, jedan graf
 * na `react-native-svg` (umjesto chart-kita, UX-18) i izvor podataka napisan na
 * ekranu.
 */

type TimeRange = 'day' | 'week' | 'month' | 'year';

const getDateRange = (
  timeRange: TimeRange,
): { from: string; to: string; bucket: 'hour' | 'day' } => {
  const end = new Date();
  const start = new Date();
  switch (timeRange) {
    case 'day':
      start.setDate(end.getDate() - 1);
      break;
    case 'week':
      start.setDate(end.getDate() - 7);
      break;
    case 'month':
      start.setMonth(end.getMonth() - 1);
      break;
    case 'year':
      start.setFullYear(end.getFullYear() - 1);
      break;
  }
  return {
    from: start.toISOString(),
    to: end.toISOString(),
    bucket: timeRange === 'day' ? 'hour' : 'day',
  };
};

/**
 * Prethodni raspon iste dužine: pomak oba kraja unazad za trajanje perioda.
 * Bez ovoga „u odnosu na prošlu sedmicu" nema šta da uporedi.
 */
const getPreviousDateRange = (
  timeRange: TimeRange,
): { from: string; to: string; bucket: 'hour' | 'day' } => {
  const { from, to } = getDateRange(timeRange);
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();
  const duration = toMs - fromMs;
  return {
    from: new Date(fromMs - duration).toISOString(),
    to: new Date(fromMs).toISOString(),
    bucket: timeRange === 'day' ? 'hour' : 'day',
  };
};

/** Razlika u procentima, ili `null` kad prethodno nije bilo podataka. */
const relativeDelta = (current: number | undefined, previous: number | undefined) => {
  if (current === undefined || previous === undefined || previous === 0) return null;
  return ((current - previous) / previous) * 100;
};

const bucketPoints = (buckets: HeatingStatsBucket[]): TrendPoint[] =>
  buckets
    .filter((bucket) => Number.isFinite(bucket.avgCurrentTemp))
    .map((bucket) => ({ label: bucket.label, value: bucket.avgCurrentTemp }));

export const AnalyticsScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const toast = useToast();

  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [exporting, setExporting] = useState(false);

  const { data: activeHome } = useQuery({
    queryKey: ['activeHomeProfile'],
    queryFn: homeProfileApi.getActiveHomeProfile,
  });

  const dateRange = useMemo(() => getDateRange(timeRange), [timeRange]);
  const previousRange = useMemo(() => getPreviousDateRange(timeRange), [timeRange]);

  const summaryQuery = useQuery({
    queryKey: ['analytics-summary', activeHome?.id, timeRange],
    queryFn: () =>
      analyticsApi.getHeatingSummary({
        homeProfileId: activeHome!.id,
        from: dateRange.from,
        to: dateRange.to,
        bucket: dateRange.bucket,
      }),
    enabled: Boolean(activeHome?.id),
  });

  /**
   * F3 (UX-13): stvarni prethodni period. Ključ sadrži `previous` da se ne
   * sudara sa tekućim rasponom istog imena.
   */
  const previousSummaryQuery = useQuery({
    queryKey: ['analytics-summary', 'previous', activeHome?.id, timeRange],
    queryFn: () =>
      analyticsApi.getPreviousSummary({
        homeProfileId: activeHome!.id,
        from: previousRange.from,
        to: previousRange.to,
        bucket: previousRange.bucket,
      }),
    enabled: Boolean(activeHome?.id),
  });

  const statsQuery = useQuery({
    queryKey: ['analytics-stats', activeHome?.id, timeRange],
    queryFn: () =>
      analyticsApi.getHeatingStats({
        homeProfileId: activeHome!.id,
        from: dateRange.from,
        to: dateRange.to,
        bucket: dateRange.bucket,
      }),
    enabled: Boolean(activeHome?.id),
  });

  const learningQuery = useQuery({
    queryKey: ['analytics-learning', activeHome?.id, timeRange],
    queryFn: () =>
      analyticsApi.getLearningTrends({
        homeProfileId: activeHome!.id,
        from: dateRange.from,
        to: dateRange.to,
      }),
    enabled: Boolean(activeHome?.id),
  });

  const gasReadingsQuery = useQuery({
    queryKey: ['gas-readings'],
    queryFn: () => apiClient.getGasReadings(),
  });

  // Termostati dolaze iz dashboarda; koriste se za „cilj vs postignuto".
  const dashboardQuery = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiClient.getDashboard(),
  });

  const fileSystem = FileSystem;

  const ensureDirectory = async (dir: string) => {
    const info = await fileSystem.getInfoAsync(dir);
    if (info.exists && !info.isDirectory) {
      await fileSystem.deleteAsync(dir, { idempotent: true });
    }
    if (!info.exists) {
      await fileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
    return dir;
  };

  const handleExport = async () => {
    if (!activeHome) {
      toast.show({ description: t('analytics.selectHome'), placement: 'top' });
      return;
    }

    try {
      setExporting(true);
      const data = await analyticsApi.exportAnalytics({
        homeProfileId: activeHome.id,
        from: dateRange.from,
        to: dateRange.to,
        bucket: dateRange.bucket,
      });

      const meta = data.export;
      if (!meta?.content || !meta?.filename) {
        toast.show({ description: t('analytics.exportUnavailable'), placement: 'top' });
        return;
      }

      if (meta.contentType && !meta.contentType.includes('csv')) {
        toast.show({ description: t('analytics.unexpectedFormat'), placement: 'top' });
        return;
      }

      const safeName = meta.filename.endsWith('.csv') ? meta.filename : `${meta.filename}.csv`;
      const sanitizedName = safeName.replace(/[^a-zA-Z0-9._-]/g, '_');

      // MO2-22: legacy API izvozi samo documentDirectory i cacheDirectory.
      const candidates = (
        [fileSystem.documentDirectory, fileSystem.cacheDirectory] as (
          | string
          | null
          | undefined
        )[]
      ).filter(Boolean) as string[];

      if (!candidates.length) {
        toast.show({ description: t('analytics.storageUnavailable'), placement: 'top' });
        return;
      }

      let fileUri: string | null = null;
      for (const baseDir of candidates) {
        try {
          const targetDir = `${baseDir}analytics_exports/`;
          await ensureDirectory(targetDir);
          const candidateUri = `${targetDir}${sanitizedName}`;
          await fileSystem.writeAsStringAsync(candidateUri, meta.content, { encoding: 'utf8' });
          fileUri = candidateUri;
          break;
        } catch {
          // probaj sljedeći direktorij
        }
      }

      if (!fileUri) {
        toast.show({ description: t('analytics.couldNotWriteFile'), placement: 'top' });
        return;
      }

      const sharePayload =
        Platform.OS === 'ios'
          ? { url: fileUri }
          : { url: fileUri, message: t('analytics.reportSaved', { path: fileUri }) };

      try {
        await Share.share({ title: sanitizedName, ...sharePayload });
        toast.show({ description: t('analytics.exportSuccess'), placement: 'top' });
      } catch {
        toast.show({ description: t('analytics.shareAsText'), placement: 'top' });
        try {
          await Share.share({ title: sanitizedName, message: meta.content });
          toast.show({ description: t('analytics.exportSuccess'), placement: 'top' });
        } catch {
          toast.show({ description: t('analytics.couldNotShare'), placement: 'top' });
        }
      }
    } catch {
      toast.show({ description: t('analytics.exportFailed'), placement: 'top' });
    } finally {
      setExporting(false);
    }
  };

  const summary = summaryQuery.data?.summary;
  const previousSummary = previousSummaryQuery.data?.summary;
  const buckets = statsQuery.data?.buckets ?? [];
  const tempPoints = useMemo(() => bucketPoints(buckets), [buckets]);

  const avgTarget = useMemo(() => {
    const targets = buckets
      .map((bucket) => bucket.avgTargetTemp)
      .filter((value) => Number.isFinite(value) && value > 0);
    if (!targets.length) return undefined;
    return targets.reduce((sum, value) => sum + value, 0) / targets.length;
  }, [buckets]);

  const latestLearning = learningQuery.data?.points?.length
    ? learningQuery.data.points[learningQuery.data.points.length - 1]
    : undefined;

  const thermostats = useMemo(() => {
    const home = (dashboardQuery.data as { homes?: { thermostats?: unknown[] }[] } | undefined)
      ?.homes?.[0];
    const list = (home?.thermostats ?? []) as {
      id: number;
      alias?: string;
      currentTemp?: number | null;
      targetTemp?: number | null;
    }[];
    return list.filter(
      (thermostat) =>
        typeof thermostat.currentTemp === 'number' && typeof thermostat.targetTemp === 'number',
    );
  }, [dashboardQuery.data]);

  const periodRows = [
    {
      key: 'heatingHours',
      label: t('analytics.heatingHours'),
      current: summary ? summary.totalDurationMin / 60 : undefined,
      previous: previousSummary ? previousSummary.totalDurationMin / 60 : undefined,
      format: (value: number) => value.toFixed(1),
      unit: t('analytics.hrs'),
    },
    {
      key: 'sessions',
      label: t('analytics.sessions'),
      current: summary?.totalCycles,
      previous: previousSummary?.totalCycles,
      format: (value: number) => String(Math.round(value)),
      unit: '',
    },
    {
      key: 'avgDuration',
      label: t('analytics.avgDuration'),
      current: summary?.avgDurationMin,
      previous: previousSummary?.avgDurationMin,
      format: (value: number) => value.toFixed(1),
      unit: t('analytics.minutes'),
    },
    {
      key: 'avgIndoor',
      label: t('analytics.avgIndoor'),
      current: summary?.avgIndoorTemp,
      previous: previousSummary?.avgIndoorTemp,
      format: (value: number) => value.toFixed(1),
      unit: '°C',
    },
  ];

  const rangeOptions = [
    { value: 'day' as TimeRange, label: t('analytics.today') },
    { value: 'week' as TimeRange, label: t('analytics.thisWeek') },
    { value: 'month' as TimeRange, label: t('analytics.thisMonth') },
    { value: 'year' as TimeRange, label: t('analytics.thisYear') },
  ];

  return (
    <Screen edges={['top']} testID="analytics-screen">
      <ScreenHeader
        title={t('analytics.title')}
        subtitle={t('analytics.dataSource')}
        onBack={() => (navigation as any).goBack()}
        backLabel={t('common.back')}
        testID="analytics-header"
      />

      <ScreenBody>
        {!activeHome ? (
          <InlineBanner tone="info" title={t('analytics.noActiveHome')} />
        ) : null}

        {/* Vremenski period je uvijek vidljiva traka, ne select u zaglavlju. */}
        <Segmented<TimeRange>
          options={rangeOptions}
          value={timeRange}
          onChange={setTimeRange}
          accessibilityLabel={t('analytics.timeRange')}
          testID="analytics-range"
        />

        {summaryQuery.isLoading ? (
          <Skeleton height={92} />
        ) : (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Kpi
              label={t('analytics.avgIndoor')}
              value={summary ? summary.avgIndoorTemp.toFixed(1) : '—'}
              unit="°C"
              testID="kpi-avg-indoor"
            />
            <Kpi
              label={t('analytics.heatingHours')}
              value={summary ? (summary.totalDurationMin / 60).toFixed(1) : '—'}
              unit={t('analytics.hrs')}
              meta={
                summary
                  ? t('analytics.sessionsValue', { value: summary.totalCycles })
                  : undefined
              }
              testID="kpi-heating-hours"
            />
            <Kpi
              label={t('analytics.confidence')}
              value={latestLearning ? latestLearning.avgConfidence.toFixed(2) : '—'}
              meta={
                latestLearning
                  ? t('analytics.samplesValue', { value: latestLearning.samples })
                  : t('analytics.noInsights')
              }
              tone={latestLearning ? 'ok' : 'neutral'}
              testID="kpi-confidence"
            />
          </View>
        )}

        {/* Jedan graf, hairline grid, brand linija. */}
        <Section
          label={t('analytics.temperatureTrend')}
          meta={avgTarget !== undefined ? `cilj ${avgTarget.toFixed(1)}°C` : undefined}
        >
          <Panel padded={false} variant="flush">
            <PanelRow divider={false}>
              {statsQuery.isLoading ? (
                <Skeleton height={140} />
              ) : tempPoints.length === 0 ? (
                <Text tone="muted" size="body">
                  {t('analytics.noTempData')}
                </Text>
              ) : (
                <View style={{ gap: space.sm }}>
                  <TrendChart
                    points={tempPoints}
                    target={avgTarget}
                    height={150}
                    accessibilityLabel={t('analytics.temperatureTrend')}
                    testID="analytics-chart"
                  />
                  <TrendSummary points={tempPoints} unit="°C" />
                </View>
              )}
            </PanelRow>
          </Panel>
        </Section>

        {/* Cilj vs postignuto — odluka koju korisnik traži. */}
        <Section label={t('analytics.targetVsActual')}>
          <Panel variant="flush" padded={false} testID="analytics-target-panel">
            {thermostats.length === 0 ? (
              <PanelRow divider={false}>
                <Text tone="muted" size="body">
                  {t('heating.noThermostats')}
                </Text>
              </PanelRow>
            ) : (
              thermostats.map((thermostat, index) => {
                const actual = thermostat.currentTemp as number;
                const target = thermostat.targetTemp as number;
                const ratio = target > 0 ? actual / target : 0;
                return (
                  <PanelRow
                    key={thermostat.id}
                    divider={index < thermostats.length - 1}
                    accessibilityLabel={`${thermostat.alias ?? ''}: ${actual.toFixed(
                      1,
                    )} / ${target.toFixed(1)} °C`}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                      <Text size="body" weight="medium" style={{ flex: 1 }} numberOfLines={1}>
                        {thermostat.alias ?? t('thermostat.title')}
                      </Text>
                      <Readout
                        value={t('analytics.targetDash', {
                          actual: actual.toFixed(1),
                          target: target.toFixed(1),
                        })}
                        unit="°C"
                        size="md"
                        tone={ratio >= 1 ? 'ok' : 'warn'}
                      />
                    </View>
                    <View style={{ marginTop: 6 }}>
                      <GaugeBar
                        value={Math.min(1, ratio)}
                        target={1}
                        tone={ratio >= 1 ? 'ok' : 'warn'}
                        height={3}
                        accessibilityLabel={`${thermostat.alias ?? ''} ${actual.toFixed(
                          1,
                        )} / ${target.toFixed(1)} °C`}
                      />
                    </View>
                  </PanelRow>
                );
              })
            )}
          </Panel>
        </Section>

        {/* Tabela „Vrijednost / Prethodno" — eksplicitno poređenje. */}
        <Section
          label={t('analytics.periodSummary')}
          meta={previousSummaryQuery.isSuccess ? undefined : t('analytics.noPreviousData')}
        >
          <Panel variant="flush" padded={false} testID="analytics-summary-table">
            <PanelRow divider>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }} />
                <MonoLabel style={{ width: 84, textAlign: 'right' }}>
                  {t('analytics.periodValue')}
                </MonoLabel>
                <MonoLabel style={{ width: 84, textAlign: 'right' }}>
                  {t('analytics.periodPrevious')}
                </MonoLabel>
              </View>
            </PanelRow>
            {periodRows.map((row, index) => {
              const delta = relativeDelta(row.current, row.previous);
              return (
                <PanelRow
                  key={row.key}
                  divider={index < periodRows.length - 1}
                  accessibilityLabel={`${row.label}: ${
                    row.current !== undefined ? row.format(row.current) : '—'
                  } ${row.unit}, ${t('analytics.periodPrevious')}: ${
                    row.previous !== undefined ? row.format(row.previous) : '—'
                  } ${row.unit}`}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text size="body" style={{ flex: 1 }} numberOfLines={1}>
                      {row.label}
                    </Text>
                    <View style={{ width: 84, alignItems: 'flex-end' }}>
                      <Readout
                        value={row.current !== undefined ? row.format(row.current) : '—'}
                        unit={row.unit || undefined}
                        size="md"
                        tone="ink"
                      />
                    </View>
                    <View style={{ width: 84, alignItems: 'flex-end' }}>
                      <Readout
                        value={row.previous !== undefined ? row.format(row.previous) : '—'}
                        unit={row.unit || undefined}
                        size="md"
                        tone="dim"
                      />
                    </View>
                  </View>
                  {delta !== null ? (
                    <MonoMeta tone={delta > 0 ? 'warn' : delta < 0 ? 'ok' : 'dim'}>
                      {`${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`}
                    </MonoMeta>
                  ) : null}
                </PanelRow>
              );
            })}
          </Panel>
        </Section>

        <GasAnalyticsCard
          readings={gasReadingsQuery.data}
          isLoading={gasReadingsQuery.isLoading}
        />

        {/* Model učenja — samo ono što backend stvarno vraća. */}
        <Section label={t('analytics.modelSection')}>
          <Panel variant="flush" padded={false} testID="analytics-model">
            <PanelRow divider={false}>
              {learningQuery.isLoading ? (
                <Skeleton height={44} />
              ) : !latestLearning ? (
                <Text tone="muted" size="body">
                  {t('analytics.noInsights')}
                </Text>
              ) : (
                <View style={{ gap: 6 }}>
                  <Text size="body" weight="medium">
                    {t('analytics.modelConfidenceLine', {
                      confidence: Math.round(latestLearning.avgConfidence * 100),
                      samples: learningQuery.data?.points.length ?? 0,
                    })}
                  </Text>
                  <MonoMeta>{t('analytics.modelHint')}</MonoMeta>
                </View>
              )}
            </PanelRow>
          </Panel>
        </Section>

        <MonoMeta>{t('analytics.dataSourceNote')}</MonoMeta>

        <Button
          label={t('analytics.exportData')}
          variant="secondary"
          block
          loading={exporting}
          disabled={!activeHome || exporting}
          onPress={handleExport}
        />
      </ScreenBody>
    </Screen>
  );
};
