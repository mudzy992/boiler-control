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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getDashboard } from '../../api/dashboard.api';
import { useErrorHandler } from '../../services/api/error.handler';
import { HealthScoreCard } from '../../components/HealthScoreCard';
import { WeatherCard } from '../../components/WeatherCard';
import { BoilerStatusCard } from '../../components/BoilerStatusCard';
import { ThermostatCard } from '../../components/ThermostatCard';
import { AlertsCard } from '../../components/AlertsCard';
import { useTranslation } from '../../hooks/useTranslation';
import { BottomSheetModal } from '../../components/BottomSheetModal';
import { apiClient } from '../../services/api/client';
import { FormInput } from '../../components/FormInput';

const MIN_CURRENT_FLOW_TEMP = 48;
const MAX_CURRENT_FLOW_TEMP = 55;

export const DashboardScreen = () => {
  const { t, i18n } = useTranslation();
  const bgColor = useColorModeValue('gray.50', 'dark.900');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const mutedColor = useColorModeValue('gray.600', 'gray.400');
  const headerBtnBg = useColorModeValue('gray.100', 'gray.700');
  const additionalHomesBg = useColorModeValue('blue.100', 'blue.900');
  const sheetCancelBg = useColorModeValue('gray.200', 'gray.700');
  const navigation = useNavigation();
  const { showError } = useErrorHandler();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [showSetTempSheet, setShowSetTempSheet] = React.useState(false);
  const [currentTempInput, setCurrentTempInput] = React.useState('');

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
  });

  // Handle query errors outside the query config to maintain hook order
  React.useEffect(() => {
    if (error) {
      showError(error, t('dashboard.loadError'));
    }
  }, [error, showError, t]);

  const setCurrentTempMutation = useMutation({
    mutationFn: async (temp: number) => {
      return await apiClient.setBoilerCurrentTemp(temp);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['gas-analysis'] }),
      ]);
      setShowSetTempSheet(false);
      toast.show({
        render: () => (
          <Box bg="green.500" px={3} py={2} rounded="md" mb={2}>
            <Text color="white" fontSize="sm">
              {t('boiler.currentTempUpdated')}
            </Text>
          </Box>
        ),
        duration: 2000,
        placement: 'top',
      });
    },
    onError: (mutationError) => {
      showError(mutationError, t('boiler.currentTempUpdateError'));
    },
  });

  const openSetCurrentTempSheet = React.useCallback(() => {
    const boiler = dashboardData?.system?.boiler;
    const suggested =
      typeof boiler?.actualFlowTemp === 'number'
        ? boiler.actualFlowTemp
        : typeof boiler?.suggestedFlowTemp === 'number'
          ? boiler.suggestedFlowTemp
          : 52;
    setCurrentTempInput(suggested.toFixed(1));
    setShowSetTempSheet(true);
  }, [dashboardData?.system?.boiler]);

  const submitCurrentTemp = React.useCallback(() => {
    const normalized = currentTempInput.replace(',', '.').trim();
    const parsed = Number(normalized);

    if (!Number.isFinite(parsed)) {
      toast.show({
        render: () => (
          <Box bg="red.500" px={3} py={2} rounded="md" mb={2}>
            <Text color="white" fontSize="sm">
              {t('boiler.currentTempValidation')}
            </Text>
          </Box>
        ),
        duration: 2500,
        placement: 'top',
      });
      return;
    }

    const rounded = Math.round(parsed * 10) / 10;
    if (rounded < MIN_CURRENT_FLOW_TEMP || rounded > MAX_CURRENT_FLOW_TEMP) {
      toast.show({
        render: () => (
          <Box bg="red.500" px={3} py={2} rounded="md" mb={2}>
            <Text color="white" fontSize="sm">
              {t('boiler.currentTempRangeError', {
                min: MIN_CURRENT_FLOW_TEMP,
                max: MAX_CURRENT_FLOW_TEMP,
              })}
            </Text>
          </Box>
        ),
        duration: 2500,
        placement: 'top',
      });
      return;
    }

    setCurrentTempMutation.mutate(rounded);
  }, [currentTempInput, setCurrentTempMutation, t, toast]);

  const clamp = (value: number, min = 0, max = 100) =>
    Math.max(min, Math.min(max, value));

  const calculateSystemHealthMetrics = () => {
    const primaryHome = dashboardData?.homes?.[0];
    if (!primaryHome) {
      return { score: 50, confidence: 0 };
    }

    const components: Array<{ score: number; weight: number }> = [];

    const learningIntervals = primaryHome.learningIntervals || [];
    let learningConfidencePercent = 0;
    if (learningIntervals.length > 0) {
      const avgLearningConfidence =
        learningIntervals.reduce((sum, interval) => sum + interval.confidence, 0) /
        learningIntervals.length;
      learningConfidencePercent = clamp(avgLearningConfidence * 100);
      components.push({ score: learningConfidencePercent, weight: 35 });
    }

    const boiler = dashboardData?.system?.boiler;
    if (
      boiler &&
      typeof boiler.actualFlowTemp === 'number' &&
      typeof boiler.suggestedFlowTemp === 'number'
    ) {
      const flowDelta = Math.abs(boiler.actualFlowTemp - boiler.suggestedFlowTemp);
      const flowScore = clamp(100 - flowDelta * 12.5);
      components.push({ score: flowScore, weight: 25 });
    }

    const thermostats = primaryHome.thermostats || [];
    if (thermostats.length > 0) {
      const now = Date.now();
      const freshCount = thermostats.filter((t) => {
        if (!t.lastSeen) return false;
        const lastSeenTime = new Date(t.lastSeen).getTime();
        if (Number.isNaN(lastSeenTime)) return false;
        const ageMinutes = (now - lastSeenTime) / 60000;
        return ageMinutes <= 10;
      }).length;
      const freshnessScore = clamp((freshCount / thermostats.length) * 100);
      components.push({ score: freshnessScore, weight: 25 });
    }

    const recentEvents = primaryHome.recentHeatingEvents || [];
    if (recentEvents.length > 0) {
      const anomalyCount = recentEvents.filter((e) => !!e.isAnomaly).length;
      const anomalyRatio = anomalyCount / recentEvents.length;
      const anomalyScore = clamp(100 - anomalyRatio * 100);
      components.push({ score: anomalyScore, weight: 15 });
    }

    if (components.length === 0) {
      return { score: 50, confidence: learningConfidencePercent };
    }

    const weightedScoreSum = components.reduce(
      (sum, component) => sum + component.score * component.weight,
      0,
    );
    const totalWeight = components.reduce(
      (sum, component) => sum + component.weight,
      0,
    );

    return {
      score: clamp(weightedScoreSum / totalWeight),
      confidence: learningConfidencePercent,
    };
  };

  if (isLoading) {
    return (
      <Box flex={1} bg={bgColor} safeArea>
        <Center flex={1}>
          <VStack space={4} alignItems="center">
            <Spinner size="lg" color="brand.400" />
            <Text fontSize="lg" color={mutedColor}>
              {t('dashboard.loading')}
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
                {t('dashboard.unableToLoad')}
              </Text>
              <Text fontSize="sm" color={mutedColor} textAlign="center">
                {error instanceof Error ? error.message : t('dashboard.loadErrorGeneric')}
              </Text>
              <Pressable mt={4} onPress={() => refetch()} bg="brand.500" px={6} py={3} rounded="md">
                <Text fontWeight="600" color="white">
                  {t('common.retry')}
                </Text>
              </Pressable>
            </VStack>
          </Center>
        </VStack>
      </Box>
    );
  }

  const primaryHome = dashboardData?.homes?.[0];
  const { score: healthScore, confidence: learningConfidencePercent } =
    calculateSystemHealthMetrics();
  const isHeating =
    dashboardData?.system?.boiler?.heatingStart && !dashboardData?.system?.boiler?.heatingEnd;

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
        <VStack px={5} py={5} space={5} pb={8}>
          {/* Header */}
          <HStack justifyContent="space-between" alignItems="center" mb={1}>
            <VStack space={0}>
              <Heading size="2xl" color={textColor} fontWeight="700">
                {t('dashboard.title')}
              </Heading>
              <Text fontSize="sm" color={mutedColor} mt={1}>
                {new Date().toLocaleDateString(i18n.language, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>
            </VStack>
            <HStack space={3} alignItems="center">
              <Pressable bg={headerBtnBg} rounded="full" p={2}>
                <Icon
                  as={Ionicons}
                  name="flame"
                  size={6}
                  color={isHeating ? 'red.500' : mutedColor}
                />
              </Pressable>
              <Pressable
                onPress={() => (navigation as any).navigate('Analytics')}
                _pressed={{ opacity: 0.6 }}
                bg={headerBtnBg}
                rounded="full"
                p={2}
              >
                <Icon as={Ionicons} name="bar-chart-outline" size={5} color="brand.400" />
              </Pressable>
              <Pressable
                onPress={() => refetch()}
                opacity={isFetching ? 0.5 : 1}
                bg={headerBtnBg}
                rounded="full"
                p={2}
              >
                <MaterialCommunityIcons
                  name={isFetching ? 'loading' : 'refresh'}
                  size={20}
                  color="brand.400"
                />
              </Pressable>
            </HStack>
          </HStack>

          {/* Alerts Section */}
          <AlertsCard dashboardData={dashboardData} />

          {/* Health Score */}
          {primaryHome && (
            <HealthScoreCard
              score={healthScore}
              confidence={learningConfidencePercent}
            />
          )}

          {/* Boiler Status */}
          <BoilerStatusCard
            boiler={dashboardData?.system?.boiler}
            onSetCurrentTempPress={openSetCurrentTempSheet}
            setCurrentTempLoading={setCurrentTempMutation.isPending}
          />

          {/* Weather */}
          {dashboardData?.system?.weather && <WeatherCard weather={dashboardData.system.weather} />}

          {/* Thermostats */}
          {primaryHome?.thermostats && primaryHome.thermostats.length > 0 && (
            <VStack space={2}>
              <Text fontSize="sm" fontWeight="600" color={mutedColor}>
                {t('dashboard.thermostats', { count: primaryHome.thermostats.length })}
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

          {/* Additional homes (if any) */}
          {dashboardData?.homes && dashboardData.homes.length > 1 && (
            <Box bg={additionalHomesBg} rounded="lg" p={3}>
              <Text fontSize="xs" color="blue.600">
                {t('dashboard.additionalHomes', { count: dashboardData.homes.length - 1 })}
              </Text>
            </Box>
          )}
        </VStack>
      </ScrollView>

      <BottomSheetModal
        isOpen={showSetTempSheet}
        onClose={() => setShowSetTempSheet(false)}
        snapPoints={['45%', '60%']}
      >
        <VStack space={4} py={2}>
          <Text fontSize="lg" fontWeight="700" color={textColor}>
            {t('boiler.setCurrentTemp')}
          </Text>
          <Text fontSize="sm" color={mutedColor}>
            {t('boiler.currentTempRangeHint', {
              min: MIN_CURRENT_FLOW_TEMP,
              max: MAX_CURRENT_FLOW_TEMP,
            })}
          </Text>

          <FormInput
            value={currentTempInput}
            onChangeText={setCurrentTempInput}
            keyboardType="decimal-pad"
            placeholder={`${MIN_CURRENT_FLOW_TEMP} - ${MAX_CURRENT_FLOW_TEMP}`}
            style={{ fontSize: 18 }}
            isDisabled={setCurrentTempMutation.isPending}
          />

          <HStack space={3}>
            <Pressable
              flex={1}
              onPress={() => setShowSetTempSheet(false)}
              _pressed={{ opacity: 0.7 }}
              disabled={setCurrentTempMutation.isPending}
            >
              <Box
                bg={sheetCancelBg}
                rounded="lg"
                py={3}
                alignItems="center"
              >
                <Text fontWeight="600" color={textColor}>
                  {t('common.cancel')}
                </Text>
              </Box>
            </Pressable>

            <Pressable
              flex={1}
              onPress={submitCurrentTemp}
              _pressed={{ opacity: 0.7 }}
              disabled={setCurrentTempMutation.isPending}
            >
              <Box bg="brand.500" rounded="lg" py={3} alignItems="center">
                <Text fontWeight="600" color="white">
                  {setCurrentTempMutation.isPending
                    ? t('boiler.savingCurrentTemp')
                    : t('boiler.saveCurrentTemp')}
                </Text>
              </Box>
            </Pressable>
          </HStack>
        </VStack>
      </BottomSheetModal>
    </Box>
  );
};
