import React from 'react';
import { Box, VStack, HStack, Text, Progress, useColorModeValue, Circle } from 'native-base';

interface HealthScoreCardProps {
  score: number; // 0-100
  confidence: number; // 0-100
}

export const HealthScoreCard: React.FC<HealthScoreCardProps> = ({ score, confidence }) => {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const mutedColor = useColorModeValue('gray.600', 'gray.400');

  // Determine color based on score
  const getScoreColor = (value: number) => {
    if (value >= 80) return 'success.500';
    if (value >= 60) return 'warning.500';
    if (value >= 40) return 'orange.500';
    return 'danger.500';
  };

  const scoreColor = getScoreColor(score);

  return (
    <Box bg={bgColor} borderWidth={1} borderColor={borderColor} rounded="lg" p={4} mb={3}>
      <VStack space={3}>
        {/* Header */}
        <HStack justifyContent="space-between" alignItems="flex-start">
          <VStack space={1} flex={1}>
            <Text fontSize="sm" fontWeight="600" color={mutedColor}>
              System Health
            </Text>
            <HStack alignItems="baseline" space={2}>
              <Text fontSize="3xl" fontWeight="bold" color={textColor}>
                {Math.round(score)}
              </Text>
              <Text fontSize="sm" color={mutedColor}>
                / 100
              </Text>
            </HStack>
          </VStack>
          <Circle
            size="70px"
            bg={scoreColor}
            opacity={0.2}
            justifyContent="center"
            alignItems="center"
          >
            <Text fontSize="lg" fontWeight="bold" color={scoreColor}>
              {Math.round(score)}%
            </Text>
          </Circle>
        </HStack>

        {/* Progress bar */}
        <VStack space={1}>
          <Progress
            value={score}
            mx="0"
            size="md"
            colorScheme={
              score >= 80 ? 'success' : score >= 60 ? 'warning' : score >= 40 ? 'orange' : 'danger'
            }
          />
          <HStack justifyContent="space-between">
            <Text fontSize="xs" color={mutedColor}>
              Model Confidence: {Math.round(confidence)}%
            </Text>
          </HStack>
        </VStack>

        {/* Status message */}
        <Box bg={scoreColor} opacity={0.1} rounded="md" px={3} py={2}>
          <Text
            fontSize="xs"
            fontWeight="500"
            color={useColorModeValue(
              score >= 80 ? 'gray.700' : score >= 60 ? 'gray.800' : 'red.700',
              scoreColor
            )}
          >
            {score >= 80
              ? '✓ System performing optimally'
              : score >= 60
                ? '⚠ Minor adjustments recommended'
                : '! System needs attention'}
          </Text>
        </Box>
      </VStack>
    </Box>
  );
};
