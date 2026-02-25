import React, { useState } from 'react';
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
  Spinner,
  useToast,
  Divider,
} from 'native-base';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../services/api/client';
import { useErrorHandler } from '../../services/api/error.handler';
import { useTranslation } from '../../hooks/useTranslation';

interface Thermostat {
  id: number;
  alias?: string;
  name?: string;
  currentTemp?: number | null;
  targetTemp?: number | null;
  isHeatingNow?: boolean;
}

interface DashboardData {
  homes: Array<{
    id: number;
    name: string;
    thermostats?: Thermostat[];
  }>;
}

interface HeatingEvent {
  id: number;
  deviceId?: number;
  timestampStart: string;
  timestampEnd: string | null;
  roomCurrentTemp: number;
  roomTargetTemp: number;
  hvacAction: string;
  source: string;
  isAnomaly: boolean;
}

export const HeatingScreen = () => {
  const toast = useToast();
  const { showError } = useErrorHandler();
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);

  const bgColor = useColorModeValue('gray.50', 'dark.900');
  const cardBg = useColorModeValue('white', 'dark.800');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const subtextColor = useColorModeValue('gray.600', 'gray.400');
  const accentColor = useColorModeValue('brand.500', 'brand.400');
  const heatingActiveColor = useColorModeValue('red.500', 'red.400');
  const heatingInactiveColor = useColorModeValue('blue.500', 'blue.400');
  const borderColor = useColorModeValue('gray.200', 'dark.700');
  const infoBoxBg = useColorModeValue('blue.50', 'blue.900');

  // Fetch live dashboard data with heating status
  const {
    data: dashboardData,
    isLoading,
    isRefetching,
    refetch,
    error: queryError,
  } = useQuery({
    queryKey: ['dashboard-heating'],
    queryFn: () => apiClient.getDashboard() as Promise<DashboardData>,
    staleTime: 1000 * 60 * 2, // Stale after 2 minutes
    refetchInterval: 1000 * 60 * 1, // Auto-refresh every 1 minute
  });

  // Fetch heating events
  const {
    data: heatingEventsData,
    isLoading: eventsLoading,
    refetch: refetchEvents,
  } = useQuery({
    queryKey: ['heating-events'],
    queryFn: () => apiClient.getHeatingEvents({ limit: 20 }),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Get data early to use in hooks
  const homes = dashboardData?.homes || [];
  const currentHome = homes[0];
  const thermostats = currentHome?.thermostats || [];
  const allHeatingEvents = Array.isArray(heatingEventsData)
    ? heatingEventsData
    : (heatingEventsData as any)?.events || [];

  // Calculate isHeating for each thermostat based on latest heating event
  const getIsHeatingForThermostat = (thermostatId: number): boolean => {
    if (!allHeatingEvents || allHeatingEvents.length === 0) return false;

    // Filter events for this thermostat
    const thermostatEvents = allHeatingEvents.filter(
      (event: HeatingEvent) => event.deviceId === thermostatId
    );

    if (thermostatEvents.length === 0) return false;

    // Sort by timestampStart descending to get the latest event
    const sortedEvents = [...thermostatEvents].sort(
      (a, b) => new Date(b.timestampStart).getTime() - new Date(a.timestampStart).getTime()
    );

    const latestEvent = sortedEvents[0];

    // Check if the latest event is still ongoing (no timestampEnd) and has HEATING_ON action
    return !latestEvent.timestampEnd && latestEvent.hvacAction === 'HEATING_ON';
  };

  // Enhance thermostats with correct isHeating status
  const enhancedThermostats = thermostats.map((thermostat) => ({
    ...thermostat,
    name: thermostat.alias || thermostat.name || `Thermostat ${thermostat.id}`,
    currentTemp: Number(thermostat.currentTemp ?? 0),
    targetTemp: Number(thermostat.targetTemp ?? 0),
    isHeating:
      typeof thermostat.isHeatingNow === 'boolean'
        ? thermostat.isHeatingNow
        : getIsHeatingForThermostat(thermostat.id),
  }));

  // Filter events to only show today's events
  const getTodayEvents = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return allHeatingEvents.filter((event: HeatingEvent) => {
      const eventDate = new Date(event.timestampStart);
      eventDate.setHours(0, 0, 0, 0);
      return eventDate.getTime() === today.getTime();
    });
  };

  const heatingEvents = getTodayEvents();

  // Handle query errors outside the query config to maintain hook order
  React.useEffect(() => {
    if (queryError) {
      showError(queryError, t('heating.loadError') || 'Failed to load heating data');
    }
  }, [queryError, showError, t]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetch(), refetchEvents()]);
      toast.show({
        render: () => (
          <Box bg="green.500" px={3} py={2} rounded="md" mb={2}>
            <Text color="white" fontSize="sm">
              {t('heating.updated')}
            </Text>
          </Box>
        ),
        duration: 2000,
        placement: 'top',
      });
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <Box flex={1} bg={bgColor} safeArea alignItems="center" justifyContent="center">
        <Spinner size="lg" color={accentColor} />
        <Text mt={3} color={subtextColor}>
          {t('heating.loading')}
        </Text>
      </Box>
    );
  }

  if (homes.length === 0) {
    return (
      <Box flex={1} bg={bgColor} safeArea p={4} justifyContent="center">
        <Center>
          <Text color={subtextColor} textAlign="center">
            {t('heating.noHomes')}
          </Text>
        </Center>
      </Box>
    );
  }

  // Helper functions for heating events
  const formatEventTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return t('heatingEvents.today');
    if (date.toDateString() === yesterday.toDateString()) return t('heatingEvents.yesterday');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const calculateDuration = (start: string, end: string | null) => {
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();
    const minutes = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60));
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  };

  return (
    <Box flex={1} bg={bgColor} safeArea>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing || isRefetching} onRefresh={handleRefresh} />
        }
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16 }}
      >
        {/* Header */}
        <VStack space={1} mb={6}>
          <Heading color={textColor} size="2xl" fontWeight="700">
            {t('heating.title') || 'Heating'}
          </Heading>
          <Text fontSize="sm" color={subtextColor}>
            {t('heating.subtitle') || 'Monitor your heating system and thermostat status'}
          </Text>
        </VStack>

        {/* Thermostats Status */}
        <VStack space={4}>
          {enhancedThermostats.length > 0 ? (
            enhancedThermostats.map((thermostat) => (
              <Box
                key={thermostat.id}
                bg={cardBg}
                rounded="xl"
                p={4}
                borderLeftWidth={4}
                borderLeftColor={thermostat.isHeating ? heatingActiveColor : heatingInactiveColor}
                shadow={1}
                borderColor={borderColor}
                borderWidth={1}
              >
                <HStack justifyContent="space-between" alignItems="center" mb={4}>
                  <VStack flex={1}>
                    <Text fontWeight="bold" color={textColor} fontSize="md">
                      {thermostat.name}
                    </Text>
                    <HStack space={2} mt={1}>
                      <Badge colorScheme={thermostat.isHeating ? 'error' : 'info'} variant="solid">
                        <Text color="white" fontSize="xs">
                          {thermostat.isHeating ? t('heating.heating') : t('heating.idle')}
                        </Text>
                      </Badge>
                    </HStack>
                  </VStack>
                </HStack>

                {/* Temperature Display Grid */}
                <HStack justifyContent="space-around" space={4} mb={4}>
                  {/* Current Temperature */}
                  <VStack alignItems="center" flex={1}>
                    <Text color={subtextColor} fontSize="xs" mb={1}>
                      {t('heating.current')}
                    </Text>
                    <HStack alignItems="baseline">
                      <Text color={textColor} fontSize="2xl" fontWeight="bold">
                        {thermostat.currentTemp.toFixed(1)}
                      </Text>
                      <Text color={subtextColor} fontSize="sm">
                        °C
                      </Text>
                    </HStack>
                  </VStack>

                  {/* Target Temperature */}
                  <VStack alignItems="center" flex={1}>
                    <Text color={subtextColor} fontSize="xs" mb={1}>
                      {t('heating.target')}
                    </Text>
                    <HStack alignItems="baseline">
                      <Text color={textColor} fontSize="2xl" fontWeight="bold">
                        {thermostat.targetTemp.toFixed(1)}
                      </Text>
                      <Text color={subtextColor} fontSize="sm">
                        °C
                      </Text>
                    </HStack>
                  </VStack>

                  {/* Difference */}
                  <VStack alignItems="center" flex={1}>
                    <Text color={subtextColor} fontSize="xs" mb={1}>
                      {t('heating.difference')}
                    </Text>
                    <HStack alignItems="baseline">
                      <Text
                        color={
                          thermostat.currentTemp < thermostat.targetTemp
                            ? heatingActiveColor
                            : heatingInactiveColor
                        }
                        fontSize="2xl"
                        fontWeight="bold"
                      >
                        {(thermostat.targetTemp - thermostat.currentTemp).toFixed(1)}
                      </Text>
                      <Text color={subtextColor} fontSize="sm">
                        °C
                      </Text>
                    </HStack>
                  </VStack>
                </HStack>

                {/* Status Indicator */}
                <HStack mt={4} alignItems="center" space={2}>
                  <Icon
                    as={Ionicons}
                    name={thermostat.isHeating ? 'flame' : 'water'}
                    size={5}
                    color={thermostat.isHeating ? heatingActiveColor : heatingInactiveColor}
                  />
                  <Text color={subtextColor} fontSize="sm">
                    {thermostat.isHeating ? t('heating.heatingActive') : t('heating.standby')}
                  </Text>
                </HStack>
              </Box>
            ))
          ) : (
            <Center p={8}>
              <Text color={subtextColor}>{t('heating.noThermostats')}</Text>
            </Center>
          )}
        </VStack>

        {/* Auto-refresh Info */}
        <Box bg={infoBoxBg} rounded="lg" p={3} mt={6}>
          <HStack space={2} alignItems="center">
            <Icon as={Ionicons} name="information-circle" size={5} color={accentColor} />
            <Text color={subtextColor} fontSize="xs" flex={1}>
              {t('heating.autoRefreshInfo')}
            </Text>
          </HStack>
        </Box>

        {/* Recent Heating Sessions */}
        {heatingEvents.length > 0 && (
          <VStack space={3} mt={6}>
            <Divider />
            <Heading color={textColor} size="md" mt={2}>
              {t('heating.recentSessions') || 'Recent Heating Sessions'}
            </Heading>
            <Text color={subtextColor} fontSize="xs">
              {t('heating.sessionsDesc') || 'History of heating events and cycles'}
            </Text>

            {eventsLoading ? (
              <Center py={8}>
                <Spinner size="sm" color={accentColor} />
              </Center>
            ) : (
              <VStack space={3} mt={2}>
                {heatingEvents.map((event: HeatingEvent) => {
                  const isActive = !event.timestampEnd;
                  const duration = calculateDuration(event.timestampStart, event.timestampEnd);
                  const tempChange = (event.roomCurrentTemp - event.roomTargetTemp).toFixed(1);
                  const isHeating = event.hvacAction.includes('HEATING_ON');

                  return (
                    <Box
                      key={event.id}
                      bg={cardBg}
                      rounded="lg"
                      p={4}
                      borderLeftWidth={3}
                      borderLeftColor={
                        event.isAnomaly
                          ? 'orange.500'
                          : isHeating
                            ? heatingActiveColor
                            : heatingInactiveColor
                      }
                      shadow={1}
                      borderColor={borderColor}
                      borderWidth={1}
                    >
                      {/* Header */}
                      <HStack justifyContent="space-between" alignItems="flex-start" mb={3}>
                        <VStack flex={1}>
                          <HStack space={2} alignItems="center">
                            <Icon
                              as={Ionicons}
                              name={isHeating ? 'flame' : 'water'}
                              size={4}
                              color={isHeating ? heatingActiveColor : heatingInactiveColor}
                            />
                            <Text fontWeight="600" color={textColor} fontSize="sm">
                              {formatEventDate(event.timestampStart)}
                            </Text>
                          </HStack>
                          <Text color={subtextColor} fontSize="xs" mt={1}>
                            {formatEventTime(event.timestampStart)} -{' '}
                            {event.timestampEnd
                              ? formatEventTime(event.timestampEnd)
                              : t('heatingEvents.active')}
                          </Text>
                        </VStack>
                        <HStack space={2}>
                          {isActive && (
                            <Badge colorScheme="error" variant="solid" rounded="md">
                              <Text fontSize="2xs" color="white">
                                {t('heatingEvents.active')}
                              </Text>
                            </Badge>
                          )}
                          {event.isAnomaly && (
                            <Badge colorScheme="warning" variant="solid" rounded="md">
                              <Text fontSize="2xs" color="white">
                                {t('heatingEvents.anomaly')}
                              </Text>
                            </Badge>
                          )}
                        </HStack>
                      </HStack>

                      {/* Stats Grid */}
                      <HStack justifyContent="space-between" space={2}>
                        <VStack flex={1} bg={infoBoxBg} rounded="md" p={2}>
                          <Text color={subtextColor} fontSize="2xs">
                            {t('heatingEvents.duration')}
                          </Text>
                          <Text color={textColor} fontSize="sm" fontWeight="600">
                            {duration}
                          </Text>
                        </VStack>
                        <VStack flex={1} bg={infoBoxBg} rounded="md" p={2}>
                          <Text color={subtextColor} fontSize="2xs">
                            {t('heatingEvents.current')}
                          </Text>
                          <Text color={textColor} fontSize="sm" fontWeight="600">
                            {event.roomCurrentTemp.toFixed(1)}°C
                          </Text>
                        </VStack>
                        <VStack flex={1} bg={infoBoxBg} rounded="md" p={2}>
                          <Text color={subtextColor} fontSize="2xs">
                            {t('heatingEvents.target')}
                          </Text>
                          <Text color={textColor} fontSize="sm" fontWeight="600">
                            {event.roomTargetTemp.toFixed(1)}°C
                          </Text>
                        </VStack>
                        <VStack flex={1} bg={infoBoxBg} rounded="md" p={2}>
                          <Text color={subtextColor} fontSize="2xs">
                            {t('heatingEvents.diff')}
                          </Text>
                          <Text
                            color={parseFloat(tempChange) < 0 ? heatingActiveColor : 'green.500'}
                            fontSize="sm"
                            fontWeight="600"
                          >
                            {tempChange}°C
                          </Text>
                        </VStack>
                      </HStack>

                      {/* Source */}
                      <HStack mt={2} space={1} alignItems="center">
                        <Icon
                          as={Ionicons}
                          name="information-circle-outline"
                          size={3}
                          color={subtextColor}
                        />
                        <Text color={subtextColor} fontSize="2xs">
                          {t('heatingEvents.source', {
                            source: event.source || t('heatingEvents.system'),
                          })}
                        </Text>
                      </HStack>
                    </Box>
                  );
                })}
              </VStack>
            )}
          </VStack>
        )}
      </ScrollView>
    </Box>
  );
};
