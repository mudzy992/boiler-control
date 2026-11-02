import React from 'react';
import { Box, VStack, HStack, Text, useColorModeValue } from './ui/nativewind';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { HealthWarning } from '../types/Dashboard';
import { useTranslation } from '../hooks/useTranslation';
import {
  mapHealthWarningsToAlerts,
  type HealthAlertSeverity,
} from '../services/dashboard/healthAlerts';

interface AlertsCardProps {
  warnings?: HealthWarning[];
}

/**
 * MO2-12: alerts are rendered from `GET /api/dashboard/health`.
 * The client no longer recomputes flow/thermostat/confidence thresholds.
 */
export const AlertsCard = React.memo(function AlertsCard({ warnings = [] }: AlertsCardProps) {
  const { t } = useTranslation();

  // Hooks must be unconditional and stable across renders. The previous
  // implementation called useColorModeValue inside a map callback, which
  // changed the hook count with the number of alerts.
  const criticalBg = useColorModeValue('red.100', 'red.900');
  const criticalIcon = useColorModeValue('red.600', 'red.400');
  const criticalText = useColorModeValue('red.700', 'red.200');
  const criticalBorder = useColorModeValue('red.300', 'red.700');
  const warningBg = useColorModeValue('orange.100', 'orange.900');
  const warningIcon = useColorModeValue('orange.600', 'orange.400');
  const warningText = useColorModeValue('orange.700', 'orange.200');
  const warningBorder = useColorModeValue('orange.300', 'orange.700');
  const infoBg = useColorModeValue('blue.100', 'blue.900');
  const infoIcon = useColorModeValue('blue.600', 'blue.400');
  const infoText = useColorModeValue('blue.700', 'blue.200');
  const infoBorder = useColorModeValue('blue.300', 'blue.700');

  const alerts = mapHealthWarningsToAlerts(warnings);
  if (alerts.length === 0) {
    return null;
  }

  const colorsBySeverity: Record<
    HealthAlertSeverity,
    { bg: string; icon: string; text: string; border: string }
  > = {
    critical: {
      bg: criticalBg,
      icon: criticalIcon,
      text: criticalText,
      border: criticalBorder,
    },
    warning: {
      bg: warningBg,
      icon: warningIcon,
      text: warningText,
      border: warningBorder,
    },
    info: {
      bg: infoBg,
      icon: infoIcon,
      text: infoText,
      border: infoBorder,
    },
  };

  return (
    <VStack space={2} mb={3}>
      {alerts.map((alert) => {
        const colors = colorsBySeverity[alert.severity];
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
                name={alert.icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']}
                size={20}
                color={colors.icon}
                style={{ marginTop: 2 }}
              />
              <VStack flex={1} space={0}>
                <Text fontSize="xs" fontWeight="600" color={colors.text}>
                  {t(alert.titleKey)}
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
});
