import React, { useMemo, useState } from 'react';
import { Platform, Share } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import Svg, { Polyline } from 'react-native-svg';
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  useColorModeValue,
  Button,
  ScrollView,
  Icon,
  Select,
  CheckIcon,
  Skeleton,
  Spinner,
  useToast,
} from 'native-base';
import { Ionicons } from '@expo/vector-icons';
import { analyticsApi } from '../../services/api/analytics.api';
import { homeProfileApi } from '../../services/api/homeProfile.api';
import { apiClient } from '../../services/api/client';
import { GasAnalyticsCard } from '../../components/analytics/GasAnalyticsCard';

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
    bucket: timeRange === 'day' ? 'hour' : ('day' as const),
  };
};

export const AnalyticsScreen = () => {
  const { t } = useTranslation();
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [exporting, setExporting] = useState(false);
  const toast = useToast();

  const { data: activeHome } = useQuery({
    queryKey: ['activeHomeProfile'],
    queryFn: homeProfileApi.getActiveHomeProfile,
  });

  const dateRange = useMemo(() => getDateRange(timeRange), [timeRange]);

  const getVsLastLabel = (range: TimeRange) => {
    switch (range) {
      case 'day':
        return t('analytics.vsLastDay');
      case 'week':
        return t('analytics.vsLastWeek');
      case 'month':
        return t('analytics.vsLastMonth');
      case 'year':
        return t('analytics.vsLastYear');
      default:
        return t('analytics.vsLastWeek');
    }
  };

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

  const fileSystem = FileSystem as any;

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

      const candidates = (
        [
          fileSystem.documentDirectory,
          fileSystem.cacheDirectory,
          fileSystem.temporaryDirectory,
        ] as (string | null | undefined)[]
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
          await fileSystem.writeAsStringAsync(candidateUri, meta.content, {
            encoding: 'utf8',
          });
          fileUri = candidateUri;
          break;
        } catch (writeErr) {
          // fall through to next directory
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
        await Share.share({
          title: sanitizedName,
          ...sharePayload,
        });
        toast.show({ description: t('analytics.exportSuccess'), placement: 'top' });
      } catch (shareErr) {
        toast.show({ description: t('analytics.shareAsText'), placement: 'top' });
        try {
          await Share.share({
            title: sanitizedName,
            message: meta.content,
          });
          toast.show({ description: t('analytics.exportSuccess'), placement: 'top' });
        } catch (textErr) {
          toast.show({ description: t('analytics.couldNotShare'), placement: 'top' });
        }
      }
    } catch (err: any) {
      toast.show({
        description: t('analytics.exportFailed'),
        placement: 'top',
      });
    } finally {
      setExporting(false);
    }
  };

  const bgColor = useColorModeValue('gray.50', 'dark.900');
  const cardBg = useColorModeValue('white', 'dark.800');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const subtextColor = useColorModeValue('gray.600', 'gray.400');
  const brandAccent = useColorModeValue('brand.500', 'brand.400');
  const tempLineColor = useColorModeValue('#2563eb', '#63b3ed');

  const tempSeries = useMemo(() => statsQuery.data?.buckets ?? [], [statsQuery.data]);
  const cyclesSeries = useMemo(() => statsQuery.data?.buckets ?? [], [statsQuery.data]);

  const efficiency = useMemo(() => {
    if (!statsQuery.data?.buckets?.length) return null;
    const ratios = statsQuery.data.buckets
      .map((b) => (b.avgTargetTemp ? (b.avgCurrentTemp / b.avgTargetTemp) * 100 : null))
      .filter((v): v is number => v !== null && !Number.isNaN(v));
    if (!ratios.length) return null;
    return Math.min(
      120,
      Math.max(0, Number((ratios.reduce((a, b) => a + b, 0) / ratios.length).toFixed(1)))
    );
  }, [statsQuery.data]);

  const StatCard = ({
    icon,
    label,
    value,
    unit,
    trend,
    trendValue,
  }: {
    icon: string;
    label: string;
    value: string;
    unit: string;
    trend: 'up' | 'down';
    trendValue: string;
  }) => (
    <Box bg={cardBg} rounded="xl" shadow={2} p={4} flex={1}>
      <VStack space={2}>
        <HStack alignItems="center" space={2}>
          <Icon as={Ionicons} name={icon as any} size={5} color={brandAccent} />
          <Text fontSize="xs" color={subtextColor} textTransform="uppercase">
            {label}
          </Text>
        </HStack>
        <HStack alignItems="baseline" space={1}>
          <Text fontSize="2xl" fontWeight="bold" color={textColor}>
            {value}
          </Text>
          <Text fontSize="sm" color={subtextColor}>
            {unit}
          </Text>
        </HStack>
        <VStack space={1}>
          <HStack alignItems="center" space={1} flexWrap="wrap">
            <Icon
              as={Ionicons}
              name={trend === 'up' ? 'arrow-up' : 'arrow-down'}
              size={4}
              color={trend === 'up' ? 'red.500' : 'green.500'}
            />
            <Text
              fontSize="xs"
              color={trend === 'up' ? 'red.500' : 'green.500'}
              fontWeight="500"
              flexShrink={1}
            >
              {trendValue}
            </Text>
          </HStack>
          <Text fontSize="xs" color={subtextColor} numberOfLines={1} flexShrink={1}>
            {getVsLastLabel(timeRange)}
          </Text>
        </VStack>
      </VStack>
    </Box>
  );

  const InsightCard = ({
    icon,
    title,
    description,
    type,
  }: {
    icon: string;
    title: string;
    description: string;
    type: 'success' | 'warning' | 'info';
  }) => {
    const iconColor =
      type === 'success' ? 'green.500' : type === 'warning' ? 'orange.500' : 'blue.500';

    return (
      <Box bg={cardBg} rounded="xl" shadow={2} p={4}>
        <HStack space={3} alignItems="flex-start">
          <Icon as={Ionicons} name={icon as any} size={6} color={iconColor} />
          <VStack flex={1} space={1}>
            <Text fontSize="md" fontWeight="600" color={textColor}>
              {title}
            </Text>
            <Text fontSize="sm" color={subtextColor}>
              {description}
            </Text>
          </VStack>
        </HStack>
      </Box>
    );
  };

  return (
    <Box flex={1} bg={bgColor} safeArea>
      <ScrollView>
        <VStack px={4} py={6} space={4} pb={8}>
          {!activeHome && (
            <Box bg={cardBg} rounded="xl" p={4}>
              <Text color={textColor}>{t('analytics.noActiveHome')}</Text>
            </Box>
          )}

          <HStack justifyContent="space-between" alignItems="center">
            <VStack space={1}>
              <Heading size="2xl" color={textColor} fontWeight="700">
                {t('analytics.title')}
              </Heading>
              <Text fontSize="sm" color={subtextColor}>
                {t('analytics.subtitle')}
              </Text>
            </VStack>
            <Select
              selectedValue={timeRange}
              minWidth="120"
              accessibilityLabel={t('analytics.timeRange')}
              placeholder={t('analytics.timeRange')}
              _selectedItem={{
                bg: 'brand.100',
                endIcon: <CheckIcon size="5" />,
              }}
              onValueChange={(value) => setTimeRange(value as TimeRange)}
            >
              <Select.Item label={t('analytics.today')} value="day" />
              <Select.Item label={t('analytics.thisWeek')} value="week" />
              <Select.Item label={t('analytics.thisMonth')} value="month" />
              <Select.Item label={t('analytics.thisYear')} value="year" />
            </Select>
          </HStack>

          <VStack space={3}>
            <HStack space={3}>
              <Skeleton flex={1} rounded="xl" isLoaded={!summaryQuery.isLoading}>
                <StatCard
                  icon="flame-outline"
                  label={t('analytics.heatingHours')}
                  value={
                    summaryQuery.data
                      ? (summaryQuery.data.summary.totalDurationMin / 60).toFixed(1)
                      : '0'
                  }
                  unit={t('analytics.hrs')}
                  trend="down"
                  trendValue={
                    summaryQuery.data
                      ? `${summaryQuery.data.summary.totalCycles} ${t('analytics.cycles')}`
                      : ''
                  }
                />
              </Skeleton>
              <Skeleton flex={1} rounded="xl" isLoaded={!summaryQuery.isLoading}>
                <StatCard
                  icon="thermometer-outline"
                  label={t('analytics.avgIndoor')}
                  value={
                    summaryQuery.data ? summaryQuery.data.summary.avgIndoorTemp.toFixed(1) : '0'
                  }
                  unit="°C"
                  trend="down"
                  trendValue={
                    summaryQuery.data
                      ? t('analytics.avgMinutes', {
                          value: summaryQuery.data.summary.avgDurationMin.toFixed(1),
                        })
                      : ''
                  }
                />
              </Skeleton>
            </HStack>

            <HStack space={3}>
              <Skeleton flex={1} rounded="xl" isLoaded={!summaryQuery.isLoading}>
                <StatCard
                  icon="stats-chart-outline"
                  label={t('analytics.sessions')}
                  value={summaryQuery.data ? String(summaryQuery.data.summary.totalCycles) : '0'}
                  unit=""
                  trend="up"
                  trendValue={
                    summaryQuery.data
                      ? t('analytics.totalMinutes', {
                          value: summaryQuery.data.summary.totalDurationMin,
                        })
                      : ''
                  }
                />
              </Skeleton>
              <Skeleton flex={1} rounded="xl" isLoaded={!learningQuery.isLoading}>
                <StatCard
                  icon="pulse-outline"
                  label={t('analytics.confidence')}
                  value={
                    learningQuery.data && learningQuery.data.points.length > 0
                      ? learningQuery.data.points[
                          learningQuery.data.points.length - 1
                        ].avgConfidence.toFixed(2)
                      : '0.0'
                  }
                  unit=""
                  trend="up"
                  trendValue={
                    learningQuery.data
                      ? `${learningQuery.data.points.length} ${t('analytics.samples')}`
                      : ''
                  }
                />
              </Skeleton>
            </HStack>
          </VStack>

          {/* Heating Duration & Cycles */}
          <Box bg={cardBg} rounded="xl" shadow={2} p={4}>
            <Heading size="sm" color={textColor} mb={1}>
              {t('analytics.heatingTrends', { context: timeRange })}
            </Heading>
            <Text fontSize="xs" color={subtextColor} mb={3}>
              {t('analytics.trendDescription')}
            </Text>
            {statsQuery.isLoading ? (
              <VStack space={2}>
                {Array.from({ length: 4 }).map((_, idx) => (
                  <HStack key={idx} justifyContent="space-between" alignItems="center">
                    <Skeleton.Text lines={1} w="24" />
                    <Skeleton h={3} flex={1} rounded="full" ml={4} />
                  </HStack>
                ))}
              </VStack>
            ) : statsQuery.isError || !statsQuery.data || statsQuery.data.buckets.length === 0 ? (
              <Text color={subtextColor}>{t('analytics.noTrendData')}</Text>
            ) : (
              <VStack space={3}>
                {(() => {
                  const buckets = statsQuery.data.buckets.slice(0, 8);
                  const maxDuration = Math.max(...buckets.map((b) => b.totalDurationMin || 0), 1);
                  const maxCycles = Math.max(...buckets.map((b) => b.cycles || 0), 1);
                  return buckets.map((b) => {
                    const durationWidth = Math.min(100, (b.totalDurationMin / maxDuration) * 100);
                    const cyclesWidth = Math.min(100, (b.cycles / maxCycles) * 100);
                    return (
                      <VStack key={b.label} space={1}>
                        <HStack justifyContent="space-between" alignItems="center">
                          <Text color={textColor} fontWeight="600">
                            {b.label}
                          </Text>
                          <HStack space={3} alignItems="center">
                            <Text color={subtextColor}>{b.avgCurrentTemp.toFixed(1)}°C</Text>
                            <Text color={subtextColor}>
                              {b.totalDurationMin} {t('analytics.minutes')}
                            </Text>
                            <Text color={subtextColor}>
                              {b.cycles} {t('analytics.cycles')}
                            </Text>
                          </HStack>
                        </HStack>
                        <VStack space={1}>
                          <Box bg="gray.200" rounded="full" h={2} overflow="hidden">
                            <Box bg="brand.500" h={2} width={`${durationWidth}%`} rounded="full" />
                          </Box>
                          <Box bg="gray.200" rounded="full" h={1.5} overflow="hidden">
                            <Box bg="green.400" h={1.5} width={`${cyclesWidth}%`} rounded="full" />
                          </Box>
                        </VStack>
                      </VStack>
                    );
                  });
                })()}
              </VStack>
            )}
          </Box>

          {/* Temperature Trend */}
          <Box bg={cardBg} rounded="xl" shadow={2} p={4}>
            <Heading size="sm" color={textColor} mb={1}>
              {t('analytics.temperatureTrend')}
            </Heading>
            <Text fontSize="xs" color={subtextColor} mb={3}>
              {t('analytics.tempDescription')}
            </Text>
            {statsQuery.isLoading ? (
              <Skeleton h={24} rounded="xl" />
            ) : !tempSeries.length ? (
              <Text color={subtextColor}>{t('analytics.noTempData')}</Text>
            ) : (
              <VStack space={2}>
                <Box h={32}>
                  <Svg height="100%" width="100%" viewBox="0 0 100 100">
                    <Polyline
                      points={(() => {
                        const series = tempSeries.slice(0, 24);
                        const max = Math.max(...series.map((p) => p.avgCurrentTemp), 1);
                        const min = Math.min(...series.map((p) => p.avgCurrentTemp), 0);
                        const span = max - min || 1;
                        const step = series.length > 1 ? 100 / (series.length - 1) : 100;
                        return series
                          .map((p, idx) => {
                            const x = idx * step;
                            const y = 100 - ((p.avgCurrentTemp - min) / span) * 100;
                            return `${x},${y}`;
                          })
                          .join(' ');
                      })()}
                      fill="none"
                      stroke={tempLineColor}
                      strokeWidth="2.4"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  </Svg>
                </Box>
                <HStack justifyContent="space-between" alignItems="center">
                  <VStack>
                    <Text fontSize="xs" color={subtextColor}>
                      {t('analytics.start')}
                    </Text>
                    <Text fontSize="sm" color={textColor} fontWeight="600">
                      {tempSeries[0]?.avgCurrentTemp.toFixed(1)}°C
                    </Text>
                  </VStack>
                  <VStack alignItems="flex-end">
                    <Text fontSize="xs" color={subtextColor}>
                      {t('analytics.end')}
                    </Text>
                    <Text fontSize="sm" color={textColor} fontWeight="600">
                      {tempSeries[tempSeries.length - 1]?.avgCurrentTemp.toFixed(1)}°C
                    </Text>
                  </VStack>
                </HStack>
              </VStack>
            )}
          </Box>

          {/* Efficiency & Cycles */}
          <Box bg={cardBg} rounded="xl" shadow={2} p={4}>
            <Heading size="sm" color={textColor} mb={1}>
              {t('analytics.efficiency')} & {t('analytics.cycleDensity')}
            </Heading>
            <Text fontSize="xs" color={subtextColor} mb={3}>
              {`${t('analytics.efficiencyRatio')} • ${t('analytics.cycleDensityDesc')}`}
            </Text>
            <VStack space={3}>
              <VStack space={1}>
                <HStack justifyContent="space-between" alignItems="center">
                  <Text color={textColor} fontWeight="600">
                    {t('analytics.efficiency')}
                  </Text>
                  <Text color={subtextColor}>{efficiency !== null ? `${efficiency}%` : '—'}</Text>
                </HStack>
                <Box bg="gray.200" rounded="full" h={2} overflow="hidden">
                  <Box
                    bg={efficiency && efficiency < 90 ? 'orange.400' : 'green.500'}
                    h={2}
                    width={`${Math.min(100, Math.max(0, efficiency ?? 0))}%`}
                    rounded="full"
                  />
                </Box>
              </VStack>

              <VStack space={2}>
                <Text fontSize="xs" color={subtextColor}>
                  {t('analytics.cycleDensity')}
                </Text>
                {cyclesSeries.length ? (
                  <HStack space={1} alignItems="flex-end">
                    {(() => {
                      const maxCycles = Math.max(...cyclesSeries.map((c) => c.cycles), 1);
                      return cyclesSeries.slice(0, 24).map((c, idx) => {
                        const height = Math.min(100, (c.cycles / maxCycles) * 100);
                        return (
                          <Box
                            key={`${c.label}-${idx}`}
                            bg="purple.400"
                            w={2}
                            h={`${Math.max(6, height)}%`}
                            rounded="sm"
                          />
                        );
                      });
                    })()}
                  </HStack>
                ) : (
                  <Text color={subtextColor}>{t('analytics.noCycleData')}</Text>
                )}
              </VStack>
            </VStack>
          </Box>

          {/* Gas Analytics */}
          <Skeleton rounded="xl" isLoaded={!gasReadingsQuery.isLoading}>
            <GasAnalyticsCard
              readings={gasReadingsQuery.data}
              isLoading={gasReadingsQuery.isLoading}
            />
          </Skeleton>

          {/* AI Insights */}
          <Box>
            <Heading size="md" color={textColor} mb={1}>
              {t('analytics.aiInsights')}
            </Heading>
            <Text fontSize="xs" color={subtextColor} mb={3}>
              {t('analytics.insightsDescription')}
            </Text>
            {learningQuery.isLoading ? (
              <HStack space={3} alignItems="center">
                <Spinner
                  accessibilityLabel={t('analytics.loadingInsights')}
                  size="sm"
                  color="brand.500"
                />
                <Text color={subtextColor}>{t('analytics.loadingInsights')}</Text>
              </HStack>
            ) : learningQuery.isError ||
              !learningQuery.data ||
              learningQuery.data.points.length === 0 ? (
              <Text color={subtextColor}>{t('analytics.noInsights')}</Text>
            ) : (
              <VStack space={4}>
                <VStack space={2}>
                  <Text fontSize="xs" color={subtextColor}>
                    {t('analytics.confidenceTrend')}
                  </Text>
                  <HStack space={1} alignItems="flex-end">
                    {learningQuery.data.points.slice(-24).map((p, idx) => {
                      const height = Math.min(100, Math.max(5, p.avgConfidence * 100));
                      return (
                        <Box
                          key={`${p.date}-${idx}`}
                          bg="brand.500"
                          w={3}
                          h={`${height}%`}
                          rounded="sm"
                        />
                      );
                    })}
                  </HStack>
                </VStack>

                <InsightCard
                  icon="bulb-outline"
                  title={t('analytics.modelConfidence')}
                  description={t('analytics.confidenceValue', {
                    confidence:
                      learningQuery.data.points[
                        learningQuery.data.points.length - 1
                      ].avgConfidence.toFixed(2),
                    samples:
                      learningQuery.data.points[learningQuery.data.points.length - 1].samples,
                  })}
                  type="success"
                />
                <InsightCard
                  icon="alert-circle-outline"
                  title={t('analytics.trainingCoverage')}
                  description={t('analytics.trainingDescription', {
                    points: learningQuery.data.points.length,
                  })}
                  type="info"
                />
              </VStack>
            )}
          </Box>

          {/* Comparison */}
          <Box bg={cardBg} rounded="xl" shadow={2} p={4}>
            <Heading size="sm" color={textColor} mb={3}>
              {t('analytics.performanceComparison')}
            </Heading>
            <VStack space={3}>
              <HStack justifyContent="space-between">
                <Text color={subtextColor}>{t('analytics.vsSimilarHomes')}</Text>
                <HStack alignItems="center" space={1}>
                  <Text color="green.500" fontWeight="600">
                    {t('analytics.better', { percent: '12' })}
                  </Text>
                  <Icon as={Ionicons} name="arrow-down" size={4} color="green.500" />
                </HStack>
              </HStack>
              <HStack justifyContent="space-between">
                <Text color={subtextColor}>{t('analytics.vsLastYear')}</Text>
                <HStack alignItems="center" space={1}>
                  <Text color="green.500" fontWeight="600">
                    {t('analytics.improvement', { percent: '18' })}
                  </Text>
                  <Icon as={Ionicons} name="arrow-down" size={4} color="green.500" />
                </HStack>
              </HStack>
            </VStack>
          </Box>

          {/* Export Button */}
          <Button
            variant="outline"
            leftIcon={<Icon as={Ionicons} name="download-outline" />}
            size="lg"
            onPress={handleExport}
            isLoading={exporting}
            isDisabled={!activeHome || exporting}
          >
            {t('analytics.exportData')}
          </Button>
        </VStack>
      </ScrollView>
    </Box>
  );
};
