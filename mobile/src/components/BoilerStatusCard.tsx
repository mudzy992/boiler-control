import React from 'react';
import { Box, VStack, HStack, Text, Pressable, useColorModeValue } from 'native-base';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { BoilerData } from '../types/Dashboard';
import { useTranslation } from '../hooks/useTranslation';

interface BoilerStatusCardProps {
  boiler: BoilerData | null | undefined;
  onSetCurrentTempPress?: () => void;
  setCurrentTempLoading?: boolean;
}

export const BoilerStatusCard: React.FC<BoilerStatusCardProps> = ({
  boiler,
  onSetCurrentTempPress,
  setCurrentTempLoading = false,
}) => {
  const { t } = useTranslation();
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const mutedColor = useColorModeValue('gray.600', 'gray.400');
  const accentColor = useColorModeValue('brand.500', 'brand.400');
  const actionBtnBg = useColorModeValue('blue.50', 'blue.900');
  const actionBtnBorder = useColorModeValue('blue.300', 'blue.700');
  const actionBtnText = useColorModeValue('blue.700', 'blue.200');

  if (!boiler) {
    return (
      <Box bg={bgColor} borderWidth={1} borderColor={borderColor} rounded="lg" p={4} mb={3}>
        <VStack space={3}>
          <HStack space={2} alignItems="center">
            <MaterialCommunityIcons name="alert-circle" size={20} color={mutedColor} />
            <Text fontSize="sm" color={mutedColor}>
              {t('boiler.notAvailable')}
            </Text>
          </HStack>
          {onSetCurrentTempPress && (
            <Pressable
              onPress={onSetCurrentTempPress}
              disabled={setCurrentTempLoading}
              _pressed={{ opacity: 0.8 }}
            >
              <Box
                bg={actionBtnBg}
                borderWidth={1}
                borderColor={actionBtnBorder}
                rounded="lg"
                px={4}
                py={3}
                alignItems="center"
              >
                <Text fontSize="sm" fontWeight="700" color={actionBtnText}>
                  {setCurrentTempLoading
                    ? t('boiler.savingCurrentTemp')
                    : t('boiler.setCurrentTemp')}
                </Text>
              </Box>
            </Pressable>
          )}
        </VStack>
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

  const actualFlowTemp =
    typeof boiler.actualFlowTemp === 'number' ? boiler.actualFlowTemp : null;
  const suggestedFlowTemp =
    typeof boiler.suggestedFlowTemp === 'number' ? boiler.suggestedFlowTemp : null;
  const tempDiff =
    actualFlowTemp !== null && suggestedFlowTemp !== null
      ? Math.abs(actualFlowTemp - suggestedFlowTemp)
      : null;
  const isOptimal = tempDiff !== null && tempDiff <= 2;

  return (
    <Box
      bg={bgColor}
      borderWidth={1}
      borderColor={borderColor}
      rounded="xl"
      p={5}
      shadow={2}
      _dark={{ shadow: 'none', borderColor: 'gray.700' }}
    >
      <VStack space={4}>
        {/* Header */}
        <HStack justifyContent="space-between" alignItems="center">
          <VStack space={2}>
            <Text
              fontSize="xs"
              fontWeight="700"
              color={mutedColor}
              textTransform="uppercase"
              letterSpacing="0.5"
            >
              {t('boiler.status')}
            </Text>
            <HStack alignItems="center" space={3}>
              <Box bg={isHeating ? accentColor : mutedColor} opacity={0.15} rounded="full" p={2.5}>
                <MaterialCommunityIcons
                  name={isHeating ? 'fire' : 'fire-off'}
                  size={28}
                  color={isHeating ? accentColor : mutedColor}
                />
              </Box>
              <VStack space={0.5}>
                <Text fontSize="xl" fontWeight="800" color={isHeating ? accentColor : textColor}>
                  {isHeating ? t('boiler.heating') : t('boiler.idle')}
                </Text>
                {isHeating && (
                  <Text fontSize="xs" fontWeight="600" color={mutedColor}>
                    {t('boiler.duration', { value: getHeatingDuration() })}
                  </Text>
                )}
              </VStack>
            </HStack>
          </VStack>
        </HStack>

        {/* External Temperature */}
        <Box bg={useColorModeValue('gray.100', 'gray.700')} rounded="xl" p={4}>
          <Text
            fontSize="xs"
            fontWeight="700"
            color={mutedColor}
            textTransform="uppercase"
            letterSpacing="0.5"
            mb={2}
          >
            {t('boiler.externalTemp')}
          </Text>
          <HStack alignItems="baseline" space={1}>
            <Text fontSize="3xl" fontWeight="800" color={textColor}>
              {boiler?.externalTemp ? boiler.externalTemp.toFixed(1) : '—'}
            </Text>
            <Text fontSize="xl" fontWeight="600" color={mutedColor}>
              °C
            </Text>
          </HStack>
        </Box>

        {/* Flow Temperature Comparison */}
        <VStack space={3}>
          <Text
            fontSize="xs"
            fontWeight="700"
            color={mutedColor}
            textTransform="uppercase"
            letterSpacing="0.5"
          >
            {t('boiler.flowTemp')}
          </Text>
          <HStack space={3} justifyContent="space-between">
            {/* Suggested */}
            <Box flex={1}>
              <Box
                bg={useColorModeValue('blue.50', 'blue.900')}
                borderWidth={2}
                borderColor="blue.400"
                rounded="xl"
                p={4}
                alignItems="center"
              >
                <Text fontSize="xs" fontWeight="700" color={mutedColor} mb={2}>
                  {t('boiler.suggested')}
                </Text>
                <HStack alignItems="baseline" space={0.5}>
                  <Text fontSize="2xl" fontWeight="800" color="blue.600">
                    {typeof boiler?.suggestedFlowTemp === 'number'
                      ? boiler.suggestedFlowTemp.toFixed(1)
                      : '—'}
                  </Text>
                  <Text fontSize="sm" fontWeight="600" color="blue.500">
                    °C
                  </Text>
                </HStack>
              </Box>
            </Box>

            {/* Actual */}
            <Box flex={1}>
              <Box
                bg={
                  tempDiff === null
                    ? useColorModeValue('gray.100', 'gray.700')
                    : isOptimal
                    ? useColorModeValue('green.50', 'green.900')
                    : useColorModeValue('orange.50', 'orange.900')
                }
                borderWidth={2}
                borderColor={
                  tempDiff === null ? useColorModeValue('gray.300', 'gray.600') : isOptimal ? 'green.400' : 'orange.400'
                }
                rounded="xl"
                p={4}
                alignItems="center"
              >
                <Text fontSize="xs" fontWeight="700" color={mutedColor} mb={2}>
                  {t('boiler.actual')}
                </Text>
                <HStack alignItems="baseline" space={0.5}>
                  <Text
                    fontSize="2xl"
                    fontWeight="800"
                    color={
                      tempDiff === null
                        ? useColorModeValue('gray.700', 'gray.200')
                        : isOptimal
                          ? 'green.600'
                          : 'orange.600'
                    }
                  >
                    {typeof boiler?.actualFlowTemp === 'number'
                      ? boiler.actualFlowTemp.toFixed(1)
                      : '—'}
                  </Text>
                  <Text
                    fontSize="sm"
                    fontWeight="600"
                    color={
                      tempDiff === null
                        ? useColorModeValue('gray.600', 'gray.300')
                        : isOptimal
                          ? 'green.500'
                          : 'orange.500'
                    }
                  >
                    °C
                  </Text>
                </HStack>
              </Box>
            </Box>
          </HStack>

          {/* Status indicator */}
          <Box
            bg={
              tempDiff === null
                ? useColorModeValue('gray.100', 'gray.700')
                : isOptimal
                ? useColorModeValue('green.50', 'green.900')
                : useColorModeValue('orange.50', 'orange.900')
            }
            rounded="lg"
            px={4}
            py={3}
            borderLeftWidth={4}
            borderLeftColor={
              tempDiff === null ? useColorModeValue('gray.400', 'gray.500') : isOptimal ? 'green.500' : 'orange.500'
            }
          >
            <Text fontSize="sm" fontWeight="600" color={textColor}>
              {tempDiff === null
                ? t('boiler.actualNotSet')
                : isOptimal
                  ? t('boiler.optimal', { diff: tempDiff.toFixed(1) })
                  : t('boiler.deviation', { diff: tempDiff.toFixed(1) })}
            </Text>
          </Box>

          {onSetCurrentTempPress && (
            <Pressable
              onPress={onSetCurrentTempPress}
              disabled={setCurrentTempLoading}
              _pressed={{ opacity: 0.8 }}
            >
              <Box
                bg={actionBtnBg}
                borderWidth={1}
                borderColor={actionBtnBorder}
                rounded="lg"
                px={4}
                py={3}
                alignItems="center"
              >
                <Text fontSize="sm" fontWeight="700" color={actionBtnText}>
                  {setCurrentTempLoading
                    ? t('boiler.savingCurrentTemp')
                    : t('boiler.setCurrentTemp')}
                </Text>
              </Box>
            </Pressable>
          )}
        </VStack>
      </VStack>
    </Box>
  );
};
