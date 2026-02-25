import React, { useMemo } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Heading,
  useColorModeValue,
  Spinner,
  ScrollView,
  Icon,
} from 'native-base';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Dimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../services/api/client';
import dayjs from 'dayjs';

let LineChart: any = null;
try {
  LineChart = require('react-native-chart-kit').LineChart;
} catch (e) {
  // Chart-kit not installed
}

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
  priceBreakdown?: Array<{
    priceExVat: number;
    consumptionM3: number;
    costExVat: number;
    source?: string;
    effectiveFrom?: string | null;
    effectiveTo?: string | null;
  }>;
  efficiency?: {
    heatingHours?: number;
    averageFlowTemp?: number;
    gasUsagePerHeatingHour?: number;
    m3PerHour?: number;
  };
  monthlyTrends?: Array<{
    month: string;
    consumption: number;
    heatingHours: number;
  }>;
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

export const GasAnalysisScreen: React.FC = () => {
  const { t } = useTranslation();
  const bgColor = useColorModeValue('gray.50', 'dark.900');
  const cardBg = useColorModeValue('white', 'dark.800');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const subtextColor = useColorModeValue('gray.600', 'gray.400');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const chartBg = useColorModeValue('white', '#1a202c');
  const spinnerColor = useColorModeValue('brand.500', 'brand.400');
  const chartLabelColor = useColorModeValue('gray.600', 'gray.400');
  const amberBg = useColorModeValue('amber.50', 'amber.900');
  const amberBorder = useColorModeValue('amber.200', 'amber.700');
  const amberIcon = useColorModeValue('amber.600', 'amber.300');
  const amberText = useColorModeValue('amber.700', 'amber.200');
  const blueBg = useColorModeValue('blue.50', 'blue.900');
  const blueBorder = useColorModeValue('blue.200', 'blue.700');
  const blueIcon = useColorModeValue('blue.600', 'blue.300');
  const blueText = useColorModeValue('blue.700', 'blue.200');
  const greenBg = useColorModeValue('green.50', 'green.900');
  const greenBorder = useColorModeValue('green.200', 'green.700');
  const greenIcon = useColorModeValue('green.600', 'green.300');
  const greenText = useColorModeValue('green.700', 'green.200');
  const purpleBg = useColorModeValue('purple.50', 'purple.900');
  const purpleBorder = useColorModeValue('purple.200', 'purple.700');
  const purpleIcon = useColorModeValue('purple.600', 'purple.300');
  const purpleText = useColorModeValue('purple.700', 'purple.200');
  const slateBg = useColorModeValue('gray.50', 'dark.700');
  const slateBorder = useColorModeValue('gray.200', 'dark.600');

  const { data: analysis, isLoading } = useQuery({
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

  const chartData = useMemo(() => {
    if (!analysis?.monthlyTrends || analysis.monthlyTrends.length === 0) {
      return null;
    }

    const labels = analysis.monthlyTrends.map((m) => {
      const date = dayjs(m.month);
      return date.format('MMM');
    });

    const datasets = [
      {
        data: analysis.monthlyTrends.map((m) => m.consumption),
        color: () => '#3b82f6',
        strokeWidth: 2,
      },
    ];

    return { labels, datasets };
  }, [analysis?.monthlyTrends]);

  if (isLoading) {
    return (
      <Box flex={1} bg={bgColor} safeArea alignItems="center" justifyContent="center">
        <Spinner size="lg" color={spinnerColor} />
        <Text mt={3} color={subtextColor}>
          {t('gas.analysisLoading')}
        </Text>
      </Box>
    );
  }

  if (!analysis) {
    return (
      <Box flex={1} bg={bgColor} safeArea p={4}>
        <Text color={subtextColor}>{t('gas.analysisNoData')}</Text>
      </Box>
    );
  }

  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - 32;

  const periodStart = analysis.period?.startDate ?? analysis.period?.from;
  const periodEnd = analysis.period?.endDate ?? analysis.period?.to;
  const periodMode = analysis.period?.mode;
  const totalConsumption =
    analysis.consumptionFromReferenceM3 ??
    analysis.totalConsumption ??
    analysis.totalGas ??
    0;
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

  return (
    <Box flex={1} bg={bgColor} safeArea>
      <ScrollView>
        <VStack px={5} py={5} space={4} pb={8}>
          {/* Header */}
          <VStack space={1}>
            <Heading size="2xl" color={textColor} fontWeight="700">
              {t('gas.analyticsTitle')}
            </Heading>
            <Text fontSize="sm" color={subtextColor}>
              {t('gas.analyticsSubtitle')}
            </Text>
          </VStack>

          <Box bg={blueBg} rounded="lg" p={4} borderWidth={1} borderColor={blueBorder}>
            <VStack space={1}>
              <HStack alignItems="center" space={2}>
                <Icon as={Ionicons} name="git-compare-outline" size={5} color={blueIcon} />
                <Text fontSize="sm" fontWeight="700" color={blueText}>
                  {t('gas.analysisWindowTitle')}
                </Text>
              </HStack>
              <Text fontSize="xs" color={blueIcon}>
                {periodModeLabel}
              </Text>
              <Text fontSize="xs" color={blueIcon}>
                {periodStart ? dayjs(periodStart).format('DD.MM.YYYY') : '—'} -{' '}
                {periodEnd ? dayjs(periodEnd).format('DD.MM.YYYY') : '—'}
              </Text>
              {analysis.referenceReading && (
                <Text fontSize="xs" color={blueIcon}>
                  {t('gas.analysisReferenceReading')}:{' '}
                  {dayjs(analysis.referenceReading.readingDate).format('DD.MM.YYYY')} (
                  {analysis.referenceReading.counterValue.toFixed(2)} m³)
                </Text>
              )}
            </VStack>
          </Box>

          {/* Summary Stats */}
          <HStack space={3}>
            <Box flex={1} bg={cardBg} rounded="lg" borderWidth={1} borderColor={borderColor} p={4}>
              <VStack space={2}>
                <HStack alignItems="center" space={2}>
                  <Icon as={Ionicons} name="flame-outline" size={5} color="orange.500" />
                  <Text
                    fontSize="xs"
                    fontWeight="600"
                    color={subtextColor}
                    textTransform="uppercase"
                  >
                    {periodMode === 'reference_to_current'
                      ? t('gas.analysisTotalUseReference')
                      : t('gas.analysisTotalUse')}
                  </Text>
                </HStack>
                <Text fontSize="lg" fontWeight="bold" color={textColor}>
                  {totalConsumption.toFixed(2)} m³
                </Text>
              </VStack>
            </Box>

            <Box flex={1} bg={cardBg} rounded="lg" borderWidth={1} borderColor={borderColor} p={4}>
              <VStack space={2}>
                <HStack alignItems="center" space={2}>
                  <Icon as={Ionicons} name="calculator-outline" size={5} color="blue.500" />
                  <Text
                    fontSize="xs"
                    fontWeight="600"
                    color={subtextColor}
                    textTransform="uppercase"
                  >
                    {t('gas.analysisAvgDaily')}
                  </Text>
                </HStack>
                <Text fontSize="lg" fontWeight="bold" color={textColor}>
                  {averageDaily.toFixed(2)} m³
                </Text>
              </VStack>
            </Box>
          </HStack>

          {/* Efficiency Stats */}
          <Box bg={cardBg} rounded="lg" borderWidth={1} borderColor={borderColor} p={4}>
            <VStack space={3}>
              <Text fontSize="md" fontWeight="600" color={textColor}>
                {t('gas.analysisHeatingEfficiency')}
              </Text>
              <HStack
                justifyContent="space-between"
                alignItems="center"
                pb={3}
                borderBottomWidth={1}
                borderBottomColor={borderColor}
              >
                <VStack>
                  <Text fontSize="sm" color={subtextColor}>
                    {t('gas.analysisHeatingHours')}
                  </Text>
                  <Text fontSize="lg" fontWeight="bold" color={textColor}>
                    {heatingHours.toFixed(1)} h
                  </Text>
                </VStack>
                <VStack>
                  <Text fontSize="sm" color={subtextColor}>
                    {t('gas.analysisAvgFlowTemp')}
                  </Text>
                  <Text fontSize="lg" fontWeight="bold" color={textColor}>
                    {averageFlowTemp.toFixed(1)}°C
                  </Text>
                </VStack>
                <VStack>
                  <Text fontSize="sm" color={subtextColor}>
                    {t('gas.analysisUsagePerHour')}
                  </Text>
                  <Text fontSize="lg" fontWeight="bold" color={textColor}>
                    {gasUsagePerHeatingHour.toFixed(3)} m³
                  </Text>
                </VStack>
              </HStack>
            </VStack>
          </Box>

          <Box bg={cardBg} rounded="lg" borderWidth={1} borderColor={borderColor} p={4}>
            <VStack space={3}>
              <Text fontSize="md" fontWeight="600" color={textColor}>
                {t('gas.analysisCostBreakdown')}
              </Text>
              <HStack justifyContent="space-between" alignItems="center">
                <VStack>
                  <Text fontSize="sm" color={subtextColor}>
                    {t('gas.analysisCostExVat')}
                  </Text>
                  <Text fontSize="lg" fontWeight="bold" color={textColor}>
                    {(analysis.costExVat ?? 0).toFixed(2)}
                  </Text>
                </VStack>
                <VStack>
                  <Text fontSize="sm" color={subtextColor}>
                    {t('gas.analysisCostVat')}
                  </Text>
                  <Text fontSize="lg" fontWeight="bold" color={textColor}>
                    {(analysis.vatAmount ?? 0).toFixed(2)}
                  </Text>
                </VStack>
                <VStack>
                  <Text fontSize="sm" color={subtextColor}>
                    {t('gas.analysisCostIncVat')}
                  </Text>
                  <Text fontSize="lg" fontWeight="bold" color={textColor}>
                    {(analysis.costIncVat ?? 0).toFixed(2)}
                  </Text>
                </VStack>
              </HStack>
            </VStack>
          </Box>

          {!!analysis.priceBreakdown?.length && (
            <Box bg={cardBg} rounded="lg" borderWidth={1} borderColor={borderColor} p={4}>
              <VStack space={3}>
                <Text fontSize="md" fontWeight="600" color={textColor}>
                  {t('gas.analysisPriceWindows')}
                </Text>
                {analysis.priceBreakdown.map((row, idx) => (
                  <Box key={`${row.priceExVat}-${idx}`} bg={slateBg} borderWidth={1} borderColor={slateBorder} rounded="md" p={3}>
                    <HStack justifyContent="space-between" alignItems="center" mb={1}>
                      <Text fontSize="sm" color={textColor} fontWeight="600">
                        {t('gas.analysisPriceExVatValue', { value: row.priceExVat.toFixed(4) })}
                      </Text>
                      <Text fontSize="xs" color={subtextColor}>
                        {(row.source || t('gas.analysisPriceSourceManual')).toUpperCase()}
                      </Text>
                    </HStack>
                    <Text fontSize="xs" color={subtextColor}>
                      {(row.effectiveFrom && dayjs(row.effectiveFrom).format('DD.MM.YYYY')) || '—'} -{' '}
                      {(row.effectiveTo && dayjs(row.effectiveTo).format('DD.MM.YYYY')) ||
                        t('gas.analysisPriceCurrent')}
                    </Text>
                    <Text fontSize="xs" color={subtextColor}>
                      {t('gas.analysisPriceConsumptionCost', {
                        consumption: row.consumptionM3.toFixed(2),
                        costExVat: (row.costExVat ?? 0).toFixed(2),
                      })}
                    </Text>
                  </Box>
                ))}
              </VStack>
            </Box>
          )}

          {/* Chart */}
          {LineChart && chartData && chartData.datasets[0].data.length > 0 && (
            <Box bg={cardBg} rounded="lg" borderWidth={1} borderColor={borderColor} p={2}>
              <Text fontSize="md" fontWeight="600" color={textColor} px={4} pt={4}>
                {t('gas.analysisMonthlyConsumption')}
              </Text>
              <LineChart
                data={chartData}
                width={chartWidth}
                height={220}
                chartConfig={{
                  backgroundColor: chartBg,
                  backgroundGradientFrom: chartBg,
                  backgroundGradientTo: chartBg,
                  decimalPlaces: 2,
                  color: () => '#64748b',
                  labelColor: () => chartLabelColor as any,
                  style: {
                    borderRadius: 16,
                  },
                  propsForDots: {
                    r: '5',
                    strokeWidth: '2',
                    stroke: '#3b82f6',
                  },
                  propsForBackgroundLines: {
                    strokeDasharray: '0',
                    stroke: borderColor,
                  },
                }}
                bezier
                style={{
                  marginVertical: 8,
                  borderRadius: 16,
                }}
              />
            </Box>
          )}

          {!LineChart && (
            <Box bg={amberBg} rounded="lg" p={4} borderWidth={1} borderColor={amberBorder}>
              <HStack space={2} alignItems="center">
                <Icon as={Ionicons} name="alert-circle-outline" size={5} color={amberIcon} />
                <Text fontSize="sm" color={amberText}>
                  {t('gas.analysisChartUnavailable')}
                </Text>
              </HStack>
            </Box>
          )}

          {/* Daily Consumption Stats */}
          {dailyStats ? (
            <Box bg={greenBg} rounded="lg" borderWidth={1} borderColor={greenBorder} p={4}>
              <VStack space={3}>
                <HStack alignItems="center" space={2}>
                  <Icon as={Ionicons} name="stats-chart-outline" size={5} color={greenIcon} />
                  <Text fontSize="md" fontWeight="600" color={greenText}>
                    {t('gas.analysisDailyStats')}
                  </Text>
                </HStack>

                <VStack space={2} divider={<Box h="1" bg={greenBorder} />}>
                  <HStack justifyContent="space-between" alignItems="center">
                    <Text fontSize="sm" color={greenText}>
                      {t('gas.analysisMinDaily')}
                    </Text>
                    <Text fontSize="md" fontWeight="bold" color={greenText}>
                      {dailyStats.minDaily.toFixed(2)} m³
                    </Text>
                  </HStack>

                  <HStack justifyContent="space-between" alignItems="center">
                    <Text fontSize="sm" color={greenText}>
                      {t('gas.analysisMaxDaily')}
                    </Text>
                    <Text fontSize="md" fontWeight="bold" color={greenText}>
                      {dailyStats.maxDaily.toFixed(2)} m³
                    </Text>
                  </HStack>

                  <HStack justifyContent="space-between" alignItems="center">
                    <Text fontSize="sm" color={greenText}>
                      {t('gas.analysisAvgDailyLabel')}
                    </Text>
                    <Text fontSize="md" fontWeight="bold" color={greenText}>
                      {dailyStats.meanDaily.toFixed(2)} m³
                    </Text>
                  </HStack>

                  <HStack justifyContent="space-between" alignItems="center">
                    <Text fontSize="sm" color={greenText}>
                      {t('gas.analysisMedianDaily')}
                    </Text>
                    <Text fontSize="md" fontWeight="bold" color={greenText}>
                      {dailyStats.medianDaily.toFixed(2)} m³
                    </Text>
                  </HStack>

                  {dailyStats.stdDev !== null && (
                    <HStack justifyContent="space-between" alignItems="center">
                      <Text fontSize="sm" color={greenText}>
                        {t('gas.analysisStdDev')}
                      </Text>
                      <Text fontSize="md" fontWeight="bold" color={greenText}>
                        {dailyStats.stdDev.toFixed(2)}
                      </Text>
                    </HStack>
                  )}
                </VStack>
              </VStack>
            </Box>
          ) : (
            <Box bg={purpleBg} rounded="lg" borderWidth={1} borderColor={purpleBorder} p={4}>
              <HStack space={2} alignItems="center">
                <Icon as={Ionicons} name="information-circle-outline" size={5} color={purpleIcon} />
                <Text fontSize="sm" color={purpleText} flex={1}>
                  {t('gas.analysisNeedTwoReadings')}
                </Text>
              </HStack>
            </Box>
          )}

          {/* Consumption Trend */}
          {dailyStats && (
            <Box bg={blueBg} rounded="lg" borderWidth={1} borderColor={blueBorder} p={4}>
              <VStack space={3}>
                <HStack alignItems="center" space={2}>
                  <Icon
                    as={Ionicons}
                    name={
                      dailyStats.trend === 'increasing'
                        ? 'trending-up-outline'
                        : dailyStats.trend === 'decreasing'
                          ? 'trending-down-outline'
                          : 'swap-horizontal-outline'
                    }
                    size={5}
                    color={blueIcon}
                  />
                  <Text fontSize="md" fontWeight="600" color={blueText}>
                    {t('gas.analysisTrend')}
                  </Text>
                </HStack>

                <HStack justifyContent="space-between" alignItems="center">
                  <Text fontSize="sm" color={blueText}>
                    {t('gas.analysisDirection')}
                  </Text>
                  <HStack
                    bg={
                      dailyStats.trend === 'increasing'
                        ? 'green.500'
                        : dailyStats.trend === 'decreasing'
                          ? 'blue.500'
                          : 'amber.500'
                    }
                    rounded="md"
                    px={3}
                    py={1}
                    alignItems="center"
                    space={1}
                  >
                    <Icon
                      as={Ionicons}
                      name={
                        dailyStats.trend === 'increasing'
                          ? 'arrow-up'
                          : dailyStats.trend === 'decreasing'
                            ? 'arrow-down'
                            : 'remove'
                      }
                      size={4}
                      color="white"
                    />
                    <Text fontSize="sm" fontWeight="bold" color="white" textTransform="capitalize">
                      {dailyStats.trend === 'increasing'
                        ? t('gas.analysisTrendIncreasing')
                        : dailyStats.trend === 'decreasing'
                          ? t('gas.analysisTrendDecreasing')
                          : t('gas.analysisTrendStable')}
                    </Text>
                  </HStack>
                </HStack>

                <Text fontSize="xs" color={blueText} mt={2}>
                  {dailyStats.trend === 'increasing'
                    ? t('gas.analysisTrendMessageIncreasing')
                    : dailyStats.trend === 'decreasing'
                      ? t('gas.analysisTrendMessageDecreasing')
                      : t('gas.analysisTrendMessageStable')}
                </Text>
              </VStack>
            </Box>
          )}

          {/* Period Info */}
          <Box bg={blueBg} rounded="lg" p={4} borderWidth={1} borderColor={blueBorder}>
            <HStack space={2} alignItems="flex-start">
              <Icon
                as={Ionicons}
                name="information-circle-outline"
                size={5}
                color={blueIcon}
                mt={1}
              />
              <VStack flex={1} space={1}>
                <Text fontSize="sm" fontWeight="600" color={blueText}>
                  {t('gas.analysisPeriod')}
                </Text>
                <Text fontSize="xs" color={blueIcon}>
                  {periodStart ? dayjs(periodStart).format('DD.MM.YYYY') : '—'} -{' '}
                  {periodEnd ? dayjs(periodEnd).format('DD.MM.YYYY') : '—'}
                </Text>
                <Text fontSize="xs" color={blueIcon}>
                  {periodModeLabel}
                </Text>
                {analysis.referenceReading && (
                  <Text fontSize="xs" color={blueIcon}>
                    {t('gas.analysisReferenceReading')}:{' '}
                    {dayjs(analysis.referenceReading.readingDate).format('DD.MM.YYYY')} (
                    {analysis.referenceReading.counterValue.toFixed(2)} m³)
                  </Text>
                )}
              </VStack>
            </HStack>
          </Box>
        </VStack>
      </ScrollView>
    </Box>
  );
};
