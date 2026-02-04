import React from 'react';
import { Box, VStack, HStack, Text, useColorModeValue, Badge } from 'native-base';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ThermostatDevice } from '../types/Dashboard';

interface ThermostatCardProps {
  thermostat: ThermostatDevice;
  currentTemp?: number;
}

export const ThermostatCard: React.FC<ThermostatCardProps> = ({ thermostat, currentTemp }) => {
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

    if (diffMinutes < 1) return 'Now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  // Get target temp from first program
  const targetTemp = thermostat.program?.[0]?.targetTemp || '—';

  return (
    <Box bg={bgColor} borderWidth={1} borderColor={borderColor} rounded="lg" p={3} mb={2}>
      <VStack space={2}>
        {/* Header: Name and Mode Badge */}
        <HStack justifyContent="space-between" alignItems="center">
          <HStack space={2} alignItems="center" flex={1}>
            <MaterialCommunityIcons name="thermometer" size={20} color={accentColor} />
            <VStack space={0} flex={1}>
              <Text fontSize="sm" fontWeight="600" color={textColor}>
                {thermostat.alias}
              </Text>
              <Text fontSize="xs" color={mutedColor}>
                {thermostat.vendor}
              </Text>
            </VStack>
          </HStack>
          <Badge colorScheme={getStatusColor(thermostat.mode)}>{thermostat.mode}</Badge>
        </HStack>

        {/* Temperature Display */}
        <HStack space={3} justifyContent="space-around">
          <Box alignItems="center">
            <Text fontSize="xs" color={mutedColor} mb={1}>
              Current
            </Text>
            <Text fontSize="lg" fontWeight="bold" color={textColor}>
              {currentTemp?.toFixed(1) || '—'}°C
            </Text>
          </Box>
          <Box alignItems="center">
            <Text fontSize="xs" color={mutedColor} mb={1}>
              Target
            </Text>
            <Text fontSize="lg" fontWeight="bold" color={accentColor}>
              {typeof targetTemp === 'number' ? targetTemp.toFixed(1) : targetTemp}°C
            </Text>
          </Box>
        </HStack>

        {/* Footer: Last Seen */}
        <Box bg={useColorModeValue('gray.50', 'gray.900')} rounded="md" px={2} py={1}>
          <Text fontSize="xs" color={mutedColor}>
            Last seen: {getLastSeenText(thermostat.lastSeen)}
          </Text>
        </Box>
      </VStack>
    </Box>
  );
};
