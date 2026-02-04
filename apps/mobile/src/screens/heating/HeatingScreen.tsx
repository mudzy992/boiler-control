import React, { useState, useMemo } from 'react';
import { RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  useColorModeValue,
  Center,
  ScrollView,
  Icon,
  Badge,
  Skeleton,
  Spinner,
  useToast,
} from 'native-base';
import { Ionicons } from '@expo/vector-icons';
import { analyticsApi } from '../../services/api/analytics.api';
import { homeProfileApi } from '../../services/api/homeProfile.api';

interface ThermostatProgram {
  dayType: string;
  startMinute: number;
  targetTemp: number;
  orderIndex: number;
}

type DayType = 'WORKDAY' | 'SATURDAY' | 'SUNDAY';

const getDayTypeLabel = (dayType: string): string => {
  switch (dayType) {
    case 'WORKDAY':
      return 'Weekday';
    case 'SATURDAY':
      return 'Saturday';
    case 'SUNDAY':
      return 'Sunday';
    default:
      return dayType;
  }
};

const formatMinutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const getCurrentDayType = (): DayType => {
  const today = new Date();
  const day = today.getDay();
  if (day === 0) return 'SUNDAY';
  if (day === 6) return 'SATURDAY';
  return 'WORKDAY';
};

const getCurrentIntervalIndex = (programs: ThermostatProgram[], dayType: DayType): number => {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const dayPrograms = programs
    .filter((p) => p.dayType === dayType)
    .sort((a, b) => a.startMinute - b.startMinute);
  let currentIdx = -1;
  for (let i = 0; i < dayPrograms.length; i++) {
    if (dayPrograms[i].startMinute <= currentMinutes) {
      currentIdx = i;
    } else {
      break;
    }
  }
  return currentIdx;
};

export const HeatingScreen = () => {
  const [timeRange] = useState<'day' | 'week' | 'month' | 'year'>('week');
  const toast = useToast();

  const bgColor = useColorModeValue('gray.50', 'dark.900');
  const cardBg = useColorModeValue('white', 'dark.800');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const subtextColor = useColorModeValue('gray.600', 'gray.400');
  const accentColor = useColorModeValue('brand.500', 'brand.400');

  const { data: activeHome } = useQuery({
    queryKey: ['activeHomeProfile'],
    queryFn: homeProfileApi.getActiveHomeProfile,
  });

  const {
    data: summaryData,
    isLoading: summaryLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['heating-summary', activeHome?.id],
    queryFn: () =>
      analyticsApi.getHeatingSummary({
        homeProfileId: activeHome!.id,
        from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        to: new Date().toISOString(),
        bucket: 'day',
      }),
    enabled: Boolean(activeHome?.id),
  });

  const currentDayType = useMemo(() => getCurrentDayType(), []);
  const dayPrograms = useMemo(() => {
    if (!summaryData?.buckets) return [];
    return summaryData.buckets
      .filter((b) => b.dayType === currentDayType || !b.dayType)
      .sort((a, b) => (a.startMinute ?? 0) - (b.startMinute ?? 0));
  }, [summaryData, currentDayType]);

  const currentIntervalIdx = useMemo(() => {
    if (!dayPrograms.length) return -1;
    return getCurrentIntervalIndex(
      dayPrograms.map((p) => ({ ...p, dayType: currentDayType })),
      currentDayType
    );
  }, [dayPrograms, currentDayType]);

  const nextInterval = useMemo(() => {
    if (currentIntervalIdx < 0 || currentIntervalIdx >= dayPrograms.length - 1) {
      return null;
    }
    return dayPrograms[currentIntervalIdx + 1];
  }, [dayPrograms, currentIntervalIdx]);

  const TemperatureDisplay = ({ current, target }: { current: number; target: number }) => (
    <Box bg={cardBg} rounded="xl" shadow={2} p={4}>
      <VStack space={3}>
        <HStack justifyContent="space-between" alignItems="center">
          <VStack>
            <Text fontSize="xs" color={subtextColor}>
              Current
            </Text>
            <HStack alignItems="baseline" space={1}>
              <Text fontSize="3xl" fontWeight="bold" color={textColor}>
                {current.toFixed(1)}
              </Text>
              <Text fontSize="lg" color={subtextColor}>
                °C
              </Text>
            </HStack>
          </VStack>

          <VStack alignItems="flex-end">
            <Text fontSize="xs" color={subtextColor}>
              Target
            </Text>
            <HStack alignItems="baseline" space={1}>
              <Text fontSize="3xl" fontWeight="bold" color={accentColor}>
                {target.toFixed(1)}
              </Text>
              <Text fontSize="lg" color={subtextColor}>
                °C
              </Text>
            </HStack>
          </VStack>
        </HStack>

        <Box bg="gray.200" rounded="full" h={2} overflow="hidden">
          <Box
            bg={Math.abs(current - target) < 1 ? 'green.500' : 'orange.400'}
            h={2}
            width={`${Math.min(100, (current / target) * 100)}%`}
            rounded="full"
          />
        </Box>

        <HStack alignItems="center" space={2}>
          <Icon
            as={Ionicons}
            name={current < target ? 'arrow-up' : 'arrow-down'}
            size={4}
            color="gray.500"
          />
          <Text fontSize="sm" color={subtextColor}>
            {Math.abs(current - target).toFixed(1)}°C {current < target ? 'to reach' : 'above'}{' '}
            target
          </Text>
        </HStack>
      </VStack>
    </Box>
  );

  const IntervalCard = ({ program, isCurrent }: { program: any; isCurrent: boolean }) => (
    <Box
      bg={isCurrent ? 'brand.50' : cardBg}
      rounded="xl"
      shadow={isCurrent ? 3 : 1}
      p={4}
      borderLeftWidth={isCurrent ? 4 : 0}
      borderLeftColor="brand.500"
    >
      <HStack justifyContent="space-between" alignItems="center">
        <VStack space={1}>
          <HStack alignItems="center" space={2}>
            <Text fontSize="sm" color={subtextColor}>
              {formatMinutesToTime(program.startMinute)}
            </Text>
            {isCurrent && (
              <Badge colorScheme="success" variant="solid">
                Now
              </Badge>
            )}
          </HStack>
          <Text fontSize="xs" color={subtextColor}>
            Interval {program.orderIndex + 1}
          </Text>
        </VStack>

        <HStack alignItems="center" space={3}>
          <Icon as={Ionicons} name="thermometer" size={5} color={accentColor} />
          <Text fontSize="2xl" fontWeight="bold" color={textColor}>
            {program.targetTemp}°C
          </Text>
        </HStack>
      </HStack>
    </Box>
  );

  return (
    <Box flex={1} bg={bgColor} safeArea>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={Boolean(isRefetching)} onRefresh={() => refetch()} />
        }
      >
        <VStack px={4} py={6} space={4} pb={8}>
          <HStack justifyContent="space-between" alignItems="center">
            <Heading size="xl" color={textColor}>
              Heating Control
            </Heading>
            <Badge colorScheme={currentIntervalIdx >= 0 ? 'success' : 'gray'}>
              {currentIntervalIdx >= 0 ? 'Active' : 'Idle'}
            </Badge>
          </HStack>

          {!activeHome && (
            <Box bg={cardBg} rounded="xl" p={4}>
              <Text color={textColor}>
                No active home found. Create or select a home to view heating control.
              </Text>
            </Box>
          )}

          {activeHome && (
            <>
              {summaryLoading ? (
                <VStack space={3}>
                  <Skeleton h={24} rounded="xl" />
                  <Skeleton h={20} rounded="xl" />
                </VStack>
              ) : summaryData ? (
                <>
                  <TemperatureDisplay
                    current={summaryData.buckets[0]?.avgCurrentTemp ?? 18}
                    target={summaryData.buckets[0]?.avgTargetTemp ?? 20}
                  />

                  <Box>
                    <HStack justifyContent="space-between" alignItems="center" mb={3}>
                      <Heading size="md" color={textColor}>
                        {getDayTypeLabel(currentDayType)} Schedule
                      </Heading>
                      <Text fontSize="xs" color={subtextColor}>
                        {dayPrograms.length} intervals
                      </Text>
                    </HStack>

                    {dayPrograms.length === 0 ? (
                      <Box bg={cardBg} rounded="xl" p={4} alignItems="center">
                        <Text color={subtextColor}>No heating intervals configured for today.</Text>
                      </Box>
                    ) : (
                      <VStack space={2}>
                        {dayPrograms.map((p, idx) => (
                          <IntervalCard
                            key={`${currentDayType}-${idx}`}
                            program={p}
                            isCurrent={idx === currentIntervalIdx}
                          />
                        ))}
                      </VStack>
                    )}
                  </Box>

                  {nextInterval && currentIntervalIdx >= 0 && (
                    <Box bg={cardBg} rounded="xl" shadow={2} p={4}>
                      <VStack space={2}>
                        <Text fontSize="xs" color={subtextColor} textTransform="uppercase">
                          Next Change
                        </Text>
                        <HStack justifyContent="space-between" alignItems="center">
                          <VStack>
                            <Text fontSize="sm" color={textColor} fontWeight="600">
                              {formatMinutesToTime(nextInterval.startMinute)}
                            </Text>
                            <Text fontSize="xs" color={subtextColor}>
                              Switch to {nextInterval.targetTemp}°C
                            </Text>
                          </VStack>
                          <Icon as={Ionicons} name="arrow-forward" size={6} color={accentColor} />
                        </HStack>
                      </VStack>
                    </Box>
                  )}

                  <Box bg={cardBg} rounded="xl" p={4}>
                    <VStack space={2}>
                      <Text fontSize="xs" color={subtextColor} textTransform="uppercase">
                        System Info
                      </Text>
                      <HStack justifyContent="space-between">
                        <Text color={textColor}>Mode</Text>
                        <Badge colorScheme="info">Program</Badge>
                      </HStack>
                      <HStack justifyContent="space-between">
                        <Text color={textColor}>Status</Text>
                        <Badge
                          colorScheme={summaryData.buckets[0]?.cycles > 0 ? 'warning' : 'success'}
                        >
                          {summaryData.buckets[0]?.cycles > 0 ? 'Heating' : 'Idle'}
                        </Badge>
                      </HStack>
                    </VStack>
                  </Box>
                </>
              ) : (
                <Center flex={1}>
                  <VStack space={2} alignItems="center">
                    <Spinner size="lg" color={accentColor} />
                    <Text color={subtextColor}>Loading heating data...</Text>
                  </VStack>
                </Center>
              )}
            </>
          )}
        </VStack>
      </ScrollView>
    </Box>
  );
};
