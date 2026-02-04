import React from 'react';
import { Box, VStack, HStack, Text, Icon, Pressable, useColorModeValue } from 'native-base';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';

interface GasReading {
  id: number;
  userId: number;
  counterValue: number;
  readingDate: string;
  createdAt: string;
}

interface GasReadingCardProps {
  reading: GasReading;
  nextReading?: GasReading; // Next reading in the list (older reading)
  onDelete?: (id: number) => void;
  isDeleting?: boolean;
}

export const GasReadingCard: React.FC<GasReadingCardProps> = ({
  reading,
  nextReading,
  onDelete,
  isDeleting,
}) => {
  const cardBg = useColorModeValue('white', 'dark.800');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const subtextColor = useColorModeValue('gray.600', 'gray.400');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const deleteColor = useColorModeValue('red.500', 'red.400');
  const consumptionBg = useColorModeValue('blue.50', 'blue.900');
  const consumptionBorder = useColorModeValue('blue.200', 'blue.700');
  const consumptionText = useColorModeValue('blue.700', 'blue.200');

  const formattedDate = dayjs(reading.readingDate).format('DD.MM.YYYY');
  const formattedTime = dayjs(reading.readingDate).format('HH:mm');

  // Calculate consumption difference: current - next (older reading)
  const consumption =
    nextReading && reading.counterValue >= nextReading.counterValue
      ? reading.counterValue - nextReading.counterValue
      : null;

  const daysDiff =
    nextReading && dayjs(reading.readingDate).isAfter(nextReading.readingDate)
      ? dayjs(reading.readingDate).diff(dayjs(nextReading.readingDate), 'day')
      : null;

  const dailyConsumption = consumption && daysDiff && daysDiff > 0 ? consumption / daysDiff : null;

  return (
    <Box bg={cardBg} rounded="lg" borderWidth={1} borderColor={borderColor} p={4} mb={3}>
      <VStack space={3}>
        <HStack justifyContent="space-between" alignItems="flex-start">
          <VStack flex={1} space={2}>
            <HStack alignItems="center" space={2}>
              <Icon as={Ionicons} name="flame-outline" size={5} color="orange.500" />
              <Text fontSize="lg" fontWeight="600" color={textColor}>
                {reading.counterValue.toFixed(2)} m³
              </Text>
            </HStack>
            <HStack space={4}>
              <VStack>
                <Text fontSize="xs" color={subtextColor}>
                  Date
                </Text>
                <Text fontSize="sm" fontWeight="500" color={textColor}>
                  {formattedDate}
                </Text>
              </VStack>
              <VStack>
                <Text fontSize="xs" color={subtextColor}>
                  Time
                </Text>
                <Text fontSize="sm" fontWeight="500" color={textColor}>
                  {formattedTime}
                </Text>
              </VStack>
            </HStack>
          </VStack>

          {onDelete && (
            <Pressable
              onPress={() => onDelete(reading.id)}
              disabled={isDeleting}
              _pressed={{ opacity: 0.7 }}
              ml={3}
            >
              <Icon
                as={Ionicons}
                name="trash-outline"
                size={6}
                color={deleteColor}
                opacity={isDeleting ? 0.5 : 1}
              />
            </Pressable>
          )}
        </HStack>

        {/* Consumption difference */}
        {consumption !== null && (
          <Box
            bg={consumptionBg}
            borderWidth={1}
            borderColor={consumptionBorder}
            rounded="md"
            p={3}
          >
            <HStack justifyContent="space-between" alignItems="center">
              <VStack>
                <Text fontSize="xs" color={consumptionText} fontWeight="600">
                  Consumption
                </Text>
                <Text fontSize="sm" fontWeight="bold" color={consumptionText}>
                  {consumption.toFixed(2)} m³
                </Text>
              </VStack>
              {dailyConsumption !== null && (
                <VStack alignItems="flex-end">
                  <Text fontSize="xs" color={consumptionText} fontWeight="600">
                    Daily
                  </Text>
                  <Text fontSize="sm" fontWeight="bold" color={consumptionText}>
                    {dailyConsumption.toFixed(2)} m³/day
                  </Text>
                </VStack>
              )}
            </HStack>
          </Box>
        )}
      </VStack>
    </Box>
  );
};
