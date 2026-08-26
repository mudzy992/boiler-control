import React, { useMemo } from 'react';
import { Box, VStack, HStack, Text, Icon, useColorModeValue, Skeleton } from 'native-base';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { useTranslation } from '../../hooks/useTranslation';

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

export const GasAnalyticsCard: React.FC<GasAnalyticsCardProps> = ({ readings, isLoading }) => {
  const { t } = useTranslation();
  const cardBg = useColorModeValue('white', 'dark.800');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const subtextColor = useColorModeValue('gray.600', 'gray.400');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const consumptionText = useColorModeValue('orange.700', 'orange.200');
  const statBg = useColorModeValue('gray.50', 'dark.700');

  const stats = useMemo(() => {
    if (!readings || readings.length === 0) {
      return null;
    }

    // Sort by date (oldest first)
    const sorted = [...readings].sort(
      (a, b) => new Date(a.readingDate).getTime() - new Date(b.readingDate).getTime()
    );

    const consumptionDiffs: number[] = [];

    // Calculate consumption differences
    for (let i = 1; i < sorted.length; i++) {
      const diff = sorted[i].counterValue - sorted[i - 1].counterValue;
      if (diff >= 0) {
        consumptionDiffs.push(diff);
      }
    }

    const totalConsumption = consumptionDiffs.reduce((a, b) => a + b, 0);
    const minConsumption = consumptionDiffs.length > 0 ? Math.min(...consumptionDiffs) : 0;
    const maxConsumption = consumptionDiffs.length > 0 ? Math.max(...consumptionDiffs) : 0;

    // Calculate average daily consumption
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
      consumptionDiffs,
      sortedReadings: sorted,
    };
  }, [readings]);

  if (isLoading) {
    return (
      <Box bg={cardBg} rounded="xl" shadow={2} p={4} borderWidth={1} borderColor={borderColor}>
        <Skeleton h={40} rounded="lg" />
      </Box>
    );
  }

  if (!readings || readings.length === 0) {
    return (
      <Box bg={cardBg} rounded="xl" shadow={2} p={4} borderWidth={1} borderColor={borderColor}>
        <HStack space={3} alignItems="center">
          <Icon as={Ionicons} name="information-circle-outline" size={5} color={subtextColor} />
          <Text fontSize="sm" color={subtextColor}>
            {t('analytics.noGasReadings')}
          </Text>
        </HStack>
      </Box>
    );
  }

  if (!stats) {
    return null;
  }

  // Show last 5 readings (or fewer if available)
  const displayReadings = [...stats.sortedReadings].reverse().slice(0, 5).reverse();

  return (
    <Box bg={cardBg} rounded="xl" shadow={2} p={4} borderWidth={1} borderColor={borderColor}>
      <VStack space={4}>
        {/* Header */}
        <VStack space={1}>
          <HStack alignItems="center" space={2}>
            <Icon as={Ionicons} name="flame-outline" size={6} color="orange.500" />
            <Text fontSize="lg" fontWeight="600" color={textColor}>
              {t('analytics.gasConsumption')}
            </Text>
          </HStack>
          <Text fontSize="xs" color={subtextColor}>
            {t('analytics.gasConsumptionDesc')}
          </Text>
        </VStack>

        {/* Summary Stats */}
        <VStack space={2}>
          <HStack space={3}>
            <Box flex={1} bg={statBg} rounded="lg" p={3}>
              <Text fontSize="xs" color={subtextColor} fontWeight="600">
                {t('analytics.totalLabel')}
              </Text>
              <Text fontSize="md" fontWeight="bold" color={textColor}>
                {stats.totalConsumption.toFixed(2)} m³
              </Text>
            </Box>

            <Box flex={1} bg={statBg} rounded="lg" p={3}>
              <Text fontSize="xs" color={subtextColor} fontWeight="600">
                {t('analytics.avgDailyLabel')}
              </Text>
              <Text fontSize="md" fontWeight="bold" color={textColor}>
                {stats.avgDailyConsumption.toFixed(2)} m³
              </Text>
            </Box>
          </HStack>

          <HStack space={3}>
            <Box flex={1} bg={statBg} rounded="lg" p={3}>
              <Text fontSize="xs" color={subtextColor} fontWeight="600">
                {t('analytics.minLabel')}
              </Text>
              <Text fontSize="md" fontWeight="bold" color={textColor}>
                {stats.minConsumption.toFixed(2)} m³
              </Text>
            </Box>

            <Box flex={1} bg={statBg} rounded="lg" p={3}>
              <Text fontSize="xs" color={subtextColor} fontWeight="600">
                {t('analytics.maxLabel')}
              </Text>
              <Text fontSize="md" fontWeight="bold" color={textColor}>
                {stats.maxConsumption.toFixed(2)} m³
              </Text>
            </Box>
          </HStack>
        </VStack>

        {/* Recent Readings with Consumption Differences */}
        <VStack space={2} pt={2} borderTopWidth={1} borderTopColor={borderColor}>
          <Text fontSize="sm" fontWeight="600" color={textColor}>
            {t('analytics.recentReadings')} ({stats.readingCount})
          </Text>

          {displayReadings.map((reading, idx) => {
            const isNewest = idx === displayReadings.length - 1;
            const nextReading =
              idx < displayReadings.length - 1 ? displayReadings[idx + 1] : undefined;

            const consumption =
              nextReading && nextReading.counterValue >= reading.counterValue
                ? nextReading.counterValue - reading.counterValue
                : null;

            const daysDiff =
              nextReading && dayjs(nextReading.readingDate).isAfter(reading.readingDate)
                ? dayjs(nextReading.readingDate).diff(dayjs(reading.readingDate), 'day')
                : null;

            const dailyConsumption =
              consumption && daysDiff && daysDiff > 0 ? consumption / daysDiff : null;

            return (
              <VStack key={reading.id} space={1}>
                {/* Reading info */}
                <HStack justifyContent="space-between" alignItems="center" px={2} py={2}>
                  <VStack flex={1}>
                    <Text fontSize="sm" fontWeight="500" color={textColor}>
                      {reading.counterValue.toFixed(2)} m³
                    </Text>
                    <Text fontSize="xs" color={subtextColor}>
                      {dayjs(reading.readingDate).format('DD.MM.YYYY HH:mm')}
                    </Text>
                  </VStack>

                  {!isNewest && consumption !== null && (
                    <VStack alignItems="flex-end" space={0}>
                      <Text fontSize="xs" fontWeight="600" color={consumptionText}>
                        {consumption.toFixed(2)} m³
                      </Text>
                      {dailyConsumption !== null && (
                        <Text fontSize="xs" color={consumptionText}>
                          {t('analytics.perDay', { value: dailyConsumption.toFixed(2) })}
                        </Text>
                      )}
                    </VStack>
                  )}
                </HStack>

                {/* Divider between readings */}
                {idx < displayReadings.length - 1 && <Box h="1" bg={borderColor} rounded="full" />}
              </VStack>
            );
          })}
        </VStack>
      </VStack>
    </Box>
  );
};
