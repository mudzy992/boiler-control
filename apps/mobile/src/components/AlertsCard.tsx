import React from 'react';
import { Box, VStack, HStack, Text, useColorModeValue } from 'native-base';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { DashboardResponse } from '../types/Dashboard';
import { useTranslation } from '../hooks/useTranslation';

interface AlertsCardProps {
  dashboardData?: DashboardResponse;
}

interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  icon: string;
}

export const AlertsCard: React.FC<AlertsCardProps> = ({ dashboardData }) => {
  const { t } = useTranslation();
  // Generate alerts based on dashboard data
  const generateAlerts = (): Alert[] => {
    const alerts: Alert[] = [];

    // Check boiler heating issues
    if (dashboardData?.system?.boiler) {
      const boiler = dashboardData.system.boiler;

      // Flow temperature deviation alert
      if (boiler.actualFlowTemp && boiler.suggestedFlowTemp) {
        const tempDiff = Math.abs(boiler.actualFlowTemp - boiler.suggestedFlowTemp);
        if (tempDiff > 5) {
          alerts.push({
            id: 'flow-temp-critical',
            type: 'critical',
            title: t('alerts.flowTempCriticalTitle'),
            message: t('alerts.flowTempCriticalMessage', {
              actual: boiler.actualFlowTemp.toFixed(1),
              suggested: boiler.suggestedFlowTemp.toFixed(1),
              diff: tempDiff.toFixed(1),
            }),
            icon: 'thermometer-alert',
          });
        } else if (tempDiff > 2) {
          alerts.push({
            id: 'flow-temp-warning',
            type: 'warning',
            title: t('alerts.flowTempWarningTitle'),
            message: t('alerts.flowTempWarningMessage', { diff: tempDiff.toFixed(1) }),
            icon: 'thermometer',
          });
        }
      }
    }

    // Check thermostat health
    if (dashboardData?.homes && dashboardData.homes.length > 0) {
      const primaryHome = dashboardData.homes[0];

      // Check for offline/unreachable thermostats
      primaryHome.thermostats?.forEach((thermostat) => {
        if (thermostat.lastSeen) {
          const lastSeenTime = new Date(thermostat.lastSeen).getTime();
          const currentTime = Date.now();
          const hoursSinceLastSeen = (currentTime - lastSeenTime) / (1000 * 60 * 60);

          if (hoursSinceLastSeen > 24) {
            alerts.push({
              id: `thermostat-offline-${thermostat.id}`,
              type: 'critical',
              title: t('alerts.thermostatOfflineTitle'),
              message: t('alerts.thermostatOfflineMessage', {
                name: thermostat.alias,
                hours: Math.floor(hoursSinceLastSeen),
              }),
              icon: 'wifi-off',
            });
          } else if (hoursSinceLastSeen > 1) {
            alerts.push({
              id: `thermostat-unresponsive-${thermostat.id}`,
              type: 'warning',
              title: t('alerts.thermostatUnresponsiveTitle'),
              message: t('alerts.thermostatUnresponsiveMessage', {
                name: thermostat.alias,
                hours: Math.floor(hoursSinceLastSeen),
              }),
              icon: 'wifi-alert',
            });
          }
        }
      });

      // Check learning confidence
      if (primaryHome.learningIntervals && primaryHome.learningIntervals.length > 0) {
        const avgConfidence =
          primaryHome.learningIntervals.reduce((sum, interval) => sum + interval.confidence, 0) /
          primaryHome.learningIntervals.length;

        if (avgConfidence < 0.3) {
          alerts.push({
            id: 'low-confidence',
            type: 'info',
            title: t('alerts.learningLowTitle'),
            message: t('alerts.learningLowMessage', {
              confidence: (avgConfidence * 100).toFixed(0),
            }),
            icon: 'lightbulb-question',
          });
        }
      }
    }

    // Check weather data
    if (!dashboardData?.system?.weather || !dashboardData.system.weather.temp) {
      alerts.push({
        id: 'weather-unavailable',
        type: 'warning',
        title: t('alerts.weatherUnavailableTitle'),
        message: t('alerts.weatherUnavailableMessage'),
        icon: 'weather-cloudy-alert',
      });
    }

    return alerts;
  };

  const alerts = generateAlerts();

  if (alerts.length === 0) {
    return null; // Don't show alerts card if no alerts
  }

  const getAlertColors = (type: 'critical' | 'warning' | 'info') => {
    switch (type) {
      case 'critical':
        return {
          bg: useColorModeValue('red.100', 'red.900'),
          icon: useColorModeValue('red.600', 'red.400'),
          text: useColorModeValue('red.700', 'red.200'),
          border: useColorModeValue('red.300', 'red.700'),
        };
      case 'warning':
        return {
          bg: useColorModeValue('orange.100', 'orange.900'),
          icon: useColorModeValue('orange.600', 'orange.400'),
          text: useColorModeValue('orange.700', 'orange.200'),
          border: useColorModeValue('orange.300', 'orange.700'),
        };
      case 'info':
        return {
          bg: useColorModeValue('blue.100', 'blue.900'),
          icon: useColorModeValue('blue.600', 'blue.400'),
          text: useColorModeValue('blue.700', 'blue.200'),
          border: useColorModeValue('blue.300', 'blue.700'),
        };
    }
  };

  return (
    <VStack space={2} mb={3}>
      {alerts.map((alert) => {
        const colors = getAlertColors(alert.type);
        return (
          <Box
            key={alert.id}
            bg={colors.bg}
            borderWidth={1}
            borderColor={colors.border}
            rounded="lg"
            p={3}
          >
            <HStack space={2} alignItems="flex-start">
              <MaterialCommunityIcons
                name={alert.icon as any}
                size={20}
                color={colors.icon}
                style={{ marginTop: 2 }}
              />
              <VStack flex={1} space={0}>
                <Text fontSize="xs" fontWeight="600" color={colors.text}>
                  {alert.title}
                </Text>
                <Text fontSize="xs" color={colors.text}>
                  {alert.message}
                </Text>
              </VStack>
            </HStack>
          </Box>
        );
      })}
    </VStack>
  );
};
