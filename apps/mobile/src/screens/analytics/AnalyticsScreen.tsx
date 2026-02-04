import React, { useMemo, useState } from 'react';
import { Platform, Share } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { useQuery } from '@tanstack/react-query';
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

const getDateRange = (timeRange: TimeRange) => {
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
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [exporting, setExporting] = useState(false);
  const toast = useToast();

  const { data: activeHome } = useQuery({
    queryKey: ['activeHomeProfile'],
    queryFn: homeProfileApi.getActiveHomeProfile,
  });

  const dateRange = useMemo(() => getDateRange(timeRange), [timeRange]);

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

  const ensureDirectory = async (dir: string) => {
    const info = await FileSystem.getInfoAsync(dir);
    if (info.exists && !info.isDirectory) {
      await FileSystem.deleteAsync(dir, { idempotent: true });
    }
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
    return dir;
  };

  const handleExport = async () => {
    if (!activeHome) {
      toast.show({ description: 'Select a home to export analytics.', placement: 'top' });
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
        toast.show({ description: 'Export unavailable. Please try again.', placement: 'top' });
        return;
      }

      if (meta.contentType && !meta.contentType.includes('csv')) {
        toast.show({ description: 'Unexpected export format returned.', placement: 'top' });
        return;
      }

      const safeName = meta.filename.endsWith('.csv') ? meta.filename : `${meta.filename}.csv`;
      const sanitizedName = safeName.replace(/[^a-zA-Z0-9._-]/g, '_');

      const candidates = (
        [
          FileSystem.documentDirectory,
          FileSystem.cacheDirectory,
          FileSystem.temporaryDirectory,
        ] as (string | null | undefined)[]
      ).filter(Boolean) as string[];

      if (!candidates.length) {
        toast.show({ description: 'Storage unavailable for export.', placement: 'top' });
        return;
      }

      let fileUri: string | null = null;
      for (const baseDir of candidates) {
        try {
          const targetDir = `${baseDir}analytics_exports/`;
          await ensureDirectory(targetDir);
          const candidateUri = `${targetDir}${sanitizedName}`;
          await FileSystem.writeAsStringAsync(candidateUri, meta.content, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          fileUri = candidateUri;
          break;
        } catch (writeErr) {
          // fall through to next directory
        }
      }

      if (!fileUri) {
        toast.show({ description: 'Could not write export file.', placement: 'top' });
        return;
      }

      const sharePayload =
        Platform.OS === 'ios'
          ? { url: fileUri }
          : { url: fileUri, message: `Analytics report saved: ${fileUri}` };

      try {
        await Share.share({
          title: sanitizedName,
          ...sharePayload,
        });
        toast.show({ description: 'Export ready to share.', placement: 'top' });
      } catch (shareErr) {
        toast.show({ description: 'Share failed. Retrying as text...', placement: 'top' });
        try {
          await Share.share({
            title: sanitizedName,
            message: meta.content,
          });
          toast.show({ description: 'Shared as text fallback.', placement: 'top' });
        } catch (textErr) {
          toast.show({ description: 'Could not share export.', placement: 'top' });
        }
      }
    } catch (err: any) {
      toast.show({
        description: 'Could not export analytics. Please try again.',
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
        <HStack alignItems="center" space={1}>
          <Icon
            as={Ionicons}
            name={trend === 'up' ? 'arrow-up' : 'arrow-down'}
            size={4}
            color={trend === 'up' ? 'red.500' : 'green.500'}
          />
          <Text fontSize="xs" color={trend === 'up' ? 'red.500' : 'green.500'} fontWeight="500">
            {trendValue}
          </Text>
          <Text fontSize="xs" color={subtextColor}>
            vs last {timeRange}
          </Text>
        </HStack>
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
              <Text color={textColor}>
                No active home found. Create or select a home to view analytics.
              </Text>
            </Box>
          )}

          <HStack justifyContent="space-between" alignItems="center">
            <Heading size="xl" color={textColor}>
              Analytics
            </Heading>
            <Select
              selectedValue={timeRange}
              minWidth="120"
              accessibilityLabel="Choose Time Range"
              placeholder="Time Range"
              _selectedItem={{
                bg: 'brand.100',
                endIcon: <CheckIcon size="5" />,
              }}
              onValueChange={(value) => setTimeRange(value as TimeRange)}
            >
              <Select.Item label="Today" value="day" />
              <Select.Item label="This Week" value="week" />
              <Select.Item label="This Month" value="month" />
              <Select.Item label="This Year" value="year" />
            </Select>
          </HStack>

          <VStack space={3}>
            <HStack space={3}>
              <Skeleton flex={1} rounded="xl" isLoaded={!summaryQuery.isLoading}>
                <StatCard
                  icon="flame-outline"
                  label="Heating Hours"
                  value={
                    summaryQuery.data
                      ? (summaryQuery.data.summary.totalDurationMin / 60).toFixed(1)
                      : '0'
                  }
                  unit="hrs"
                  trend="down"
                  trendValue={
                    summaryQuery.data ? `${summaryQuery.data.summary.totalCycles} cycles` : ''
                  }
                />
              </Skeleton>
              <Skeleton flex={1} rounded="xl" isLoaded={!summaryQuery.isLoading}>
                <StatCard
                  icon="thermometer-outline"
                  label="Avg Indoor"
                  value={
                    summaryQuery.data ? summaryQuery.data.summary.avgIndoorTemp.toFixed(1) : '0'
                  }
                  unit="°C"
                  trend="down"
                  trendValue={
                    summaryQuery.data
                      ? `${summaryQuery.data.summary.avgDurationMin.toFixed(1)} min avg`
                      : ''
                  }
                />
              </Skeleton>
            </HStack>

            <HStack space={3}>
              <Skeleton flex={1} rounded="xl" isLoaded={!summaryQuery.isLoading}>
                <StatCard
                  icon="stats-chart-outline"
                  label="Sessions"
                  value={summaryQuery.data ? String(summaryQuery.data.summary.totalCycles) : '0'}
                  unit=""
                  trend="up"
                  trendValue={
                    summaryQuery.data
                      ? `${summaryQuery.data.summary.totalDurationMin} min total`
                      : ''
                  }
                />
              </Skeleton>
              <Skeleton flex={1} rounded="xl" isLoaded={!learningQuery.isLoading}>
                <StatCard
                  icon="pulse-outline"
                  label="Confidence"
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
                    learningQuery.data ? `${learningQuery.data.points.length} samples` : ''
                  }
                />
              </Skeleton>
            </HStack>
          </VStack>

          {/* Heating Duration & Cycles */}
          <Box bg={cardBg} rounded="xl" shadow={2} p={4}>
            <Heading size="sm" color={textColor} mb={1}>
              Heating Trends ({timeRange})
            </Heading>
            <Text fontSize="xs" color={subtextColor} mb={3}>
              Duration, cycles, and average indoor temperature across the selected range.
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
              <Text color={subtextColor}>No data available</Text>
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
                            <Text color={subtextColor}>{b.totalDurationMin} min</Text>
                            <Text color={subtextColor}>{b.cycles} cycles</Text>
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
              Temperature Trend
            </Heading>
            <Text fontSize="xs" color={subtextColor} mb={3}>
              Average indoor temperature per bucket.
            </Text>
            {statsQuery.isLoading ? (
              <Skeleton h={24} rounded="xl" />
            ) : !tempSeries.length ? (
              <Text color={subtextColor}>No temperature data in this range.</Text>
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
                      Start
                    </Text>
                    <Text fontSize="sm" color={textColor} fontWeight="600">
                      {tempSeries[0]?.avgCurrentTemp.toFixed(1)}°C
                    </Text>
                  </VStack>
                  <VStack alignItems="flex-end">
                    <Text fontSize="xs" color={subtextColor}>
                      End
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
              Efficiency & Cycles
            </Heading>
            <Text fontSize="xs" color={subtextColor} mb={3}>
              Ratio of achieved vs target temps and cycle density.
            </Text>
            <VStack space={3}>
              <VStack space={1}>
                <HStack justifyContent="space-between" alignItems="center">
                  <Text color={textColor} fontWeight="600">
                    Efficiency
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
                  Cycle Density
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
                  <Text color={subtextColor}>No cycle data for this range.</Text>
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
              AI Insights & Learning
            </Heading>
            <Text fontSize="xs" color={subtextColor} mb={3}>
              Model confidence and sample coverage over time.
            </Text>
            {learningQuery.isLoading ? (
              <HStack space={3} alignItems="center">
                <Spinner accessibilityLabel="Loading insights" size="sm" color="brand.500" />
                <Text color={subtextColor}>Loading insights...</Text>
              </HStack>
            ) : learningQuery.isError ||
              !learningQuery.data ||
              learningQuery.data.points.length === 0 ? (
              <Text color={subtextColor}>No learning insights available for this range.</Text>
            ) : (
              <VStack space={4}>
                <VStack space={2}>
                  <Text fontSize="xs" color={subtextColor}>
                    Confidence Trend
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
                  title="Model Confidence"
                  description={`Latest confidence: ${learningQuery.data.points[learningQuery.data.points.length - 1].avgConfidence.toFixed(2)} across ${learningQuery.data.points[learningQuery.data.points.length - 1].samples} samples.`}
                  type="success"
                />
                <InsightCard
                  icon="alert-circle-outline"
                  title="Training Coverage"
                  description={`Data points in range: ${learningQuery.data.points.length}. Keep schedules steady to improve predictions.`}
                  type="info"
                />
              </VStack>
            )}
          </Box>

          {/* Comparison */}
          <Box bg={cardBg} rounded="xl" shadow={2} p={4}>
            <Heading size="sm" color={textColor} mb={3}>
              Performance Comparison
            </Heading>
            <VStack space={3}>
              <HStack justifyContent="space-between">
                <Text color={subtextColor}>vs. Similar Homes</Text>
                <HStack alignItems="center" space={1}>
                  <Text color="green.500" fontWeight="600">
                    12% better
                  </Text>
                  <Icon as={Ionicons} name="arrow-down" size={4} color="green.500" />
                </HStack>
              </HStack>
              <HStack justifyContent="space-between">
                <Text color={subtextColor}>vs. Last Year</Text>
                <HStack alignItems="center" space={1}>
                  <Text color="green.500" fontWeight="600">
                    18% improvement
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
            Export Analytics Report
          </Button>
        </VStack>
      </ScrollView>
    </Box>
  );
};
