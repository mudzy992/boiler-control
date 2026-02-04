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
} from 'native-base';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../services/api/client';
import { useErrorHandler } from '../../services/api/error.handler';
import { useTranslation } from '../../hooks/useTranslation';

interface Thermostat {
  id: number;
  name: string;
  currentTemp: number;
  targetTemp: number;
  isHeating: boolean;
}

interface DashboardData {
  homes: Array<{
    id: number;
    name: string;
    thermostats?: Thermostat[];
  }>;
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

  // Handle query errors outside the query config to maintain hook order
  React.useEffect(() => {
    if (queryError) {
      showError(queryError, t('heating.loadError') || 'Failed to load heating data');
    }
  }, [queryError, showError, t]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
      toast.show({
        render: ({ id }) => (
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

  const homes = dashboardData?.homes || [];
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

  // Get first home (current active home)
  const currentHome = homes[0];
  const thermostats = currentHome.thermostats || [];

  return (
    <Box flex={1} bg={bgColor} safeArea>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing || isRefetching} onRefresh={handleRefresh} />
        }
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16 }}
      >
        {/* Header */}
        <VStack space={2} mb={6}>
          <Heading color={textColor} size="lg">
            {t('heating.title')}
          </Heading>
          <Text color={subtextColor} fontSize="sm">
            {currentHome.name}
          </Text>
          <Text color={subtextColor} fontSize="xs">
            {t('heating.lastUpdated')}: {new Date().toLocaleTimeString()}
          </Text>
        </VStack>

        {/* Thermostats Status */}
        <VStack space={4}>
          {thermostats.length > 0 ? (
            thermostats.map((thermostat) => (
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
      </ScrollView>
    </Box>
  );
};
