import React from 'react';
import { Box, VStack, HStack, Text, useColorModeValue, Badge } from 'native-base';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ThermostatDevice } from '../types/Dashboard';
import { useTranslation } from '../hooks/useTranslation';

interface ThermostatCardProps {
  thermostat: ThermostatDevice;
  currentTemp?: number;
}

export const ThermostatCard: React.FC<ThermostatCardProps> = ({ thermostat, currentTemp }) => {
  const { t } = useTranslation();
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const mutedColor = useColorModeValue('gray.600', 'gray.400');
  const accentColor = useColorModeValue('brand.500', 'brand.400');

  // Get status badge color
  const getStatusColor = (mode: string) => {
    switch (mode) {
      case 'PROGRAM':
        return 'success';
      case 'MANUAL':
        return 'warning';
      case 'OFF':
        return 'gray';
      default:
        return 'gray';
    }
  };

  // Parse last seen time
  const getLastSeenText = (lastSeen: string) => {
    const date = new Date(lastSeen);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffMinutes < 1) return t('thermostat.lastSeenNow');
    if (diffMinutes < 60) return t('thermostat.lastSeenMinutes', { count: diffMinutes });
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return t('thermostat.lastSeenHours', { count: diffHours });
    const diffDays = Math.floor(diffHours / 24);
    return t('thermostat.lastSeenDays', { count: diffDays });
  };

  // Get target temp from first program
  const targetTemp = thermostat.program?.[0]?.targetTemp || '—';

  return (
    <Box
      bg={bgColor}
      borderWidth={1}
      borderColor={borderColor}
      rounded="xl"
      p={4}
      mb={3}
      shadow={1}
      _dark={{ shadow: 'none', borderColor: 'gray.700' }}
    >
      <VStack space={3}>
        {/* Header: Name and Mode Badge */}
        <HStack justifyContent="space-between" alignItems="center">
          <HStack space={3} alignItems="center" flex={1}>
            <Box bg={accentColor} opacity={0.15} rounded="full" p={2}>
              <MaterialCommunityIcons name="thermometer" size={24} color={accentColor} />
            </Box>
            <VStack space={0.5} flex={1}>
              <Text fontSize="md" fontWeight="700" color={textColor}>
                {thermostat.alias}
              </Text>
              <Text fontSize="xs" fontWeight="600" color={mutedColor}>
                {thermostat.vendor}
              </Text>
            </VStack>
          </HStack>
          <Badge
            colorScheme={getStatusColor(thermostat.mode)}
            rounded="lg"
            px={3}
            py={1}
            _text={{ fontSize: 'xs', fontWeight: '700' }}
          >
            {t(`thermostat.mode.${thermostat.mode.toLowerCase()}`) || thermostat.mode}
          </Badge>
        </HStack>

        {/* Temperature Display */}
        <HStack space={3} justifyContent="space-between">
          <Box
            flex={1}
            bg={useColorModeValue('gray.100', 'gray.700')}
            rounded="xl"
            p={3}
            alignItems="center"
          >
            <Text fontSize="xs" fontWeight="700" color={mutedColor} mb={2}>
              {t('thermostat.current')}
            </Text>
            <HStack alignItems="baseline" space={0.5}>
              <Text fontSize="2xl" fontWeight="800" color={textColor}>
                {currentTemp?.toFixed(1) || '—'}
              </Text>
              <Text fontSize="sm" fontWeight="600" color={mutedColor}>
                °C
              </Text>
            </HStack>
          </Box>
          <Box
            flex={1}
            bg={useColorModeValue('brand.50', 'brand.900')}
            rounded="xl"
            p={3}
            alignItems="center"
            borderWidth={2}
            borderColor="brand.400"
          >
            <Text fontSize="xs" fontWeight="700" color={mutedColor} mb={2}>
              {t('thermostat.target')}
            </Text>
            <HStack alignItems="baseline" space={0.5}>
              <Text fontSize="2xl" fontWeight="800" color={accentColor}>
                {typeof targetTemp === 'number' ? targetTemp.toFixed(1) : targetTemp}
              </Text>
              <Text fontSize="sm" fontWeight="600" color={accentColor}>
                °C
              </Text>
            </HStack>
          </Box>
        </HStack>

        {/* Footer: Last Seen */}
        <Box bg={useColorModeValue('gray.100', 'gray.700')} rounded="lg" px={3} py={2}>
          <Text fontSize="xs" fontWeight="600" color={mutedColor}>
            {t('thermostat.lastSeen', { time: getLastSeenText(thermostat.lastSeen) })}
          </Text>
        </Box>
      </VStack>
    </Box>
  );
};
