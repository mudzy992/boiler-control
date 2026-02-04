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
  const shadowColor = useColorModeValue('gray.400', 'transparent');

  // Determine color based on score
  const getScoreColor = (value: number) => {
    if (value >= 80) return 'success.500';
    if (value >= 60) return 'warning.500';
    if (value >= 40) return 'orange.500';
    return 'danger.500';
  };

  const scoreColor = getScoreColor(score);

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
          <VStack space={1} flex={1}>
            <Text
              fontSize="xs"
              fontWeight="700"
              color={mutedColor}
              textTransform="uppercase"
              letterSpacing="0.5"
            >
              System Health
            </Text>
            <HStack alignItems="baseline" space={2} mt={1}>
              <Text fontSize="4xl" fontWeight="800" color={textColor}>
                {Math.round(score)}
              </Text>
              <Text fontSize="md" fontWeight="600" color={mutedColor}>
                / 100
              </Text>
            </HStack>
          </VStack>
          <Box position="relative">
            <Circle
              size="80px"
              bg={scoreColor}
              opacity={0.15}
              position="absolute"
              justifyContent="center"
              alignItems="center"
            />
            <Circle
              size="80px"
              justifyContent="center"
              alignItems="center"
              borderWidth={3}
              borderColor={scoreColor}
            >
              <Text fontSize="xl" fontWeight="800" color={scoreColor}>
                {Math.round(score)}%
              </Text>
            </Circle>
          </Box>
        </HStack>

        {/* Progress bar */}
        <VStack space={2}>
          <Progress
            value={score}
            mx="0"
            size="lg"
            rounded="full"
            colorScheme={
              score >= 80 ? 'success' : score >= 60 ? 'warning' : score >= 40 ? 'orange' : 'danger'
            }
          />
          <HStack justifyContent="space-between">
            <Text fontSize="xs" fontWeight="600" color={mutedColor}>
              Confidence: {Math.round(confidence)}%
            </Text>
            <Text fontSize="xs" fontWeight="600" color={scoreColor}>
              {score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Poor'}
            </Text>
          </HStack>
        </VStack>

        {/* Status message */}
        <Box
          bg={useColorModeValue(
            score >= 80 ? 'success.50' : score >= 60 ? 'warning.50' : 'orange.50',
            'gray.700'
          )}
          rounded="lg"
          px={4}
          py={3}
          borderLeftWidth={4}
          borderLeftColor={scoreColor}
        >
          <Text fontSize="sm" fontWeight="600" color={textColor}>
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
