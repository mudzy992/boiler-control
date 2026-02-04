import React from 'react';
import { RefreshControl } from 'react-native';
import {
  Box,
  VStack,
  Heading,
  Text,
  useColorModeValue,
  Spinner,
  Center,
  ScrollView,
  HStack,
  Pressable,
  Icon,
  useToast,
} from 'native-base';
import { useQuery } from '@tanstack/react-query';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getDashboard } from '../../api/dashboard.api';
import { useErrorHandler } from '../../services/api/error.handler';
import { HealthScoreCard } from '../../components/HealthScoreCard';
import { WeatherCard } from '../../components/WeatherCard';
import { BoilerStatusCard } from '../../components/BoilerStatusCard';
import { ThermostatCard } from '../../components/ThermostatCard';
import { RecentHeatingEvents } from '../../components/RecentHeatingEvents';
import { AlertsCard } from '../../components/AlertsCard';

export const DashboardScreen = () => {
  const bgColor = useColorModeValue('gray.50', 'dark.900');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const mutedColor = useColorModeValue('gray.600', 'gray.400');
  const navigation = useNavigation();
  const toast = useToast();
  const { showError } = useErrorHandler();

  const {
    data: dashboardData,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes cache
    onError: (error) => {
      showError(error, 'Failed to load dashboard data');
    },
  });

  // Calculate health score based on learning confidence
  const calculateHealthScore = () => {
    if (!dashboardData?.homes || dashboardData.homes.length === 0) {
      return 0;
    }

    const firstHome = dashboardData.homes[0];
    const learningIntervals = firstHome.learningIntervals || [];

    if (learningIntervals.length === 0) {
      return 50; // Default if no learning data
    }

    // Average confidence across all intervals
    const avgConfidence =
      learningIntervals.reduce((sum, interval) => sum + interval.confidence, 0) /
      learningIntervals.length;

    // Scale confidence to health score (0-100)
    return Math.min(avgConfidence * 100, 100);
  };

  if (isLoading) {
    return (
      <Box flex={1} bg={bgColor} safeArea>
        <Center flex={1}>
          <VStack space={4} alignItems="center">
            <Spinner size="lg" color="brand.400" />
            <Text fontSize="lg" color={mutedColor}>
              Loading dashboard...
            </Text>
          </VStack>
        </Center>
      </Box>
    );
  }

  if (isError) {
    return (
      <Box flex={1} bg={bgColor} safeArea>
        <VStack flex={1} px={4} py={6} space={4} justifyContent="center">
          <Center>
            <VStack space={4} alignItems="center" w="100%">
              <MaterialCommunityIcons name="alert-circle" size={40} color={mutedColor} />
              <Text fontSize="lg" fontWeight="600" color={textColor}>
                Unable to load dashboard
              </Text>
              <Text fontSize="sm" color={mutedColor} textAlign="center">
                {error instanceof Error
                  ? error.message
                  : 'An error occurred while fetching dashboard data'}
              </Text>
              <Pressable mt={4} onPress={() => refetch()} bg="brand.500" px={6} py={3} rounded="md">
                <Text fontWeight="600" color="white">
                  Try Again
                </Text>
              </Pressable>
            </VStack>
          </Center>
        </VStack>
      </Box>
    );
  }

  const primaryHome = dashboardData?.homes?.[0];
  const healthScore = calculateHealthScore();
  const avgConfidence = primaryHome?.learningIntervals?.[0]?.confidence ?? 0;

  return (
    <Box flex={1} bg={bgColor} safeArea>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={() => refetch()}
            tintColor="brand.400"
          />
        }
      >
        <VStack px={4} py={4} space={4} pb={8}>
          {/* Header */}
          <HStack justifyContent="space-between" alignItems="center">
            <Heading size="xl" color={textColor}>
              Dashboard
            </Heading>
            <HStack space={2} alignItems="center">
              <Pressable
                onPress={() => (navigation as any).navigate('Settings', { screen: 'Analytics' })}
                _pressed={{ opacity: 0.7 }}
              >
                <Icon as={Ionicons} name="bar-chart-outline" size={6} color="brand.400" />
              </Pressable>
              <Pressable onPress={() => refetch()} opacity={isFetching ? 0.5 : 1}>
                <MaterialCommunityIcons
                  name={isFetching ? 'loading' : 'refresh'}
                  size={24}
                  color="brand.400"
                />
              </Pressable>
            </HStack>
          </HStack>

          {/* Alerts Section */}
          <AlertsCard dashboardData={dashboardData} />

          {/* Health Score */}
          {primaryHome && <HealthScoreCard score={healthScore} confidence={avgConfidence * 100} />}

          {/* Weather */}
          {dashboardData?.system?.weather && <WeatherCard weather={dashboardData.system.weather} />}

          {/* Boiler Status */}
          <BoilerStatusCard boiler={dashboardData?.system?.boiler} />

          {/* Thermostats */}
          {primaryHome?.thermostats && primaryHome.thermostats.length > 0 && (
            <VStack space={2}>
              <Text fontSize="sm" fontWeight="600" color={mutedColor}>
                Thermostats ({primaryHome.thermostats.length})
              </Text>
              {primaryHome.thermostats.map((thermostat) => {
                // Find matching recent event for current temp
                const recentEvent = primaryHome.recentHeatingEvents?.find(
                  (event) => event.deviceId === thermostat.id
                );
                return (
                  <ThermostatCard
                    key={thermostat.id}
                    thermostat={thermostat}
                    currentTemp={recentEvent?.currentTemp}
                  />
                );
              })}
            </VStack>
          )}

          {/* Recent Heating Events */}
          {primaryHome?.recentHeatingEvents && primaryHome.recentHeatingEvents.length > 0 && (
            <RecentHeatingEvents events={primaryHome.recentHeatingEvents} />
          )}

          {/* Additional homes (if any) */}
          {dashboardData?.homes && dashboardData.homes.length > 1 && (
            <Box bg={useColorModeValue('blue.100', 'blue.900')} rounded="lg" p={3}>
              <Text fontSize="xs" color="blue.600">
                Additional {dashboardData.homes.length - 1} home(s) available in Home Profile
                section
              </Text>
            </Box>
          )}
        </VStack>
      </ScrollView>
    </Box>
  );
};
