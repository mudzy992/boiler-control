import React from 'react';
import { Box, VStack, HStack, Text, useColorModeValue } from 'native-base';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { BoilerData } from '../types/Dashboard';

interface BoilerStatusCardProps {
  boiler: BoilerData | null | undefined;
}

export const BoilerStatusCard: React.FC<BoilerStatusCardProps> = ({ boiler }) => {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const mutedColor = useColorModeValue('gray.600', 'gray.400');
  const accentColor = useColorModeValue('brand.500', 'brand.400');

  if (!boiler) {
    return (
      <Box bg={bgColor} borderWidth={1} borderColor={borderColor} rounded="lg" p={4} mb={3}>
        <HStack space={2} alignItems="center">
          <MaterialCommunityIcons name="alert-circle" size={20} color={mutedColor} />
          <Text fontSize="sm" color={mutedColor}>
            Boiler data not available
          </Text>
        </HStack>
      </Box>
    );
  }

  // Determine if heating is active
  const isHeating = boiler.heatingStart && !boiler.heatingEnd;

  // Calculate heating duration
  const getHeatingDuration = () => {
    if (!boiler.heatingStart) return '—';
    const start = new Date(boiler.heatingStart);
    const end = boiler.heatingEnd ? new Date(boiler.heatingEnd) : new Date();
    const minutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  const tempDiff = Math.abs(boiler.actualFlowTemp - boiler.suggestedFlowTemp);
  const isOptimal = tempDiff <= 2;

  return (
    <Box bg={bgColor} borderWidth={1} borderColor={borderColor} rounded="lg" p={4} mb={3}>
      <VStack space={3}>
        {/* Header */}
        <HStack justifyContent="space-between" alignItems="center">
          <VStack space={1}>
            <Text fontSize="sm" fontWeight="600" color={mutedColor}>
              Boiler Status
            </Text>
            <HStack alignItems="center" space={2}>
              <MaterialCommunityIcons
                name={isHeating ? 'fire' : 'fire-off'}
                size={24}
                color={isHeating ? accentColor : mutedColor}
              />
              <Text fontSize="lg" fontWeight="bold" color={isHeating ? accentColor : mutedColor}>
                {isHeating ? 'Heating' : 'Idle'}
              </Text>
            </HStack>
          </VStack>

          {isHeating && (
            <Box bg={accentColor} opacity={0.2} rounded="md" px={3} py={1}>
              <Text fontSize="xs" fontWeight="600" color={accentColor}>
                {getHeatingDuration()}
              </Text>
            </Box>
          )}
        </HStack>

        {/* External Temperature */}
        <Box bg={useColorModeValue('gray.50', 'gray.900')} rounded="md" p={2}>
          <Text fontSize="xs" color={mutedColor} mb={1}>
            External Temperature
          </Text>
          <Text fontSize="lg" fontWeight="bold" color={textColor}>
            {boiler?.externalTemp ? boiler.externalTemp.toFixed(1) : '—'}°C
          </Text>
        </Box>

        {/* Flow Temperature Comparison */}
        <VStack space={2}>
          <Text fontSize="xs" fontWeight="600" color={mutedColor}>
            Flow Temperature
          </Text>
          <HStack space={3} justifyContent="space-around">
            {/* Suggested */}
            <Box flex={1} alignItems="center">
              <Box
                bg={useColorModeValue('blue.100', 'blue.900')}
                rounded="md"
                p={2}
                w="100%"
                alignItems="center"
              >
                <Text fontSize="xs" color={mutedColor} mb={1}>
                  Suggested
                </Text>
                <Text fontSize="md" fontWeight="bold" color="blue.600">
                  {boiler?.suggestedFlowTemp ? boiler.suggestedFlowTemp.toFixed(1) : '—'}°C
                </Text>
              </Box>
            </Box>

            {/* Actual */}
            <Box flex={1} alignItems="center">
              <Box
                bg={
                  isOptimal
                    ? useColorModeValue('green.100', 'green.900')
                    : useColorModeValue('orange.100', 'orange.900')
                }
                rounded="md"
                p={2}
                w="100%"
                alignItems="center"
              >
                <Text fontSize="xs" color={mutedColor} mb={1}>
                  Actual
                </Text>
                <Text
                  fontSize="md"
                  fontWeight="bold"
                  color={isOptimal ? 'green.600' : 'orange.600'}
                >
                  {boiler?.actualFlowTemp ? boiler.actualFlowTemp.toFixed(1) : '—'}°C
                </Text>
              </Box>
            </Box>
          </HStack>

          {/* Status indicator */}
          {isOptimal ? (
            <Box bg="green.100" _dark={{ bg: 'green.900' }} rounded="md" px={3} py={2}>
              <Text fontSize="xs" fontWeight="500" color="green.700" _dark={{ color: 'green.400' }}>
                ✓ Flow temperature is optimal (diff: {tempDiff ? tempDiff.toFixed(1) : '—'}°C)
              </Text>
            </Box>
          ) : (
            <Box bg="orange.100" _dark={{ bg: 'orange.900' }} rounded="md" px={3} py={2}>
              <Text
                fontSize="xs"
                fontWeight="500"
                color="orange.700"
                _dark={{ color: 'orange.400' }}
              >
                ⚠ Flow temperature deviation: {tempDiff ? tempDiff.toFixed(1) : '—'}°C
              </Text>
            </Box>
          )}
        </VStack>
      </VStack>
    </Box>
  );
};
