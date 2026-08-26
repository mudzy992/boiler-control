import React from 'react';
import { Box, VStack, HStack, Text, useColorModeValue } from 'native-base';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from '../hooks/useTranslation';
import type { RecentHeatingEvent } from '../types/Dashboard';

interface RecentHeatingEventsProps {
  events: RecentHeatingEvent[];
}

export const RecentHeatingEvents: React.FC<RecentHeatingEventsProps> = ({ events }) => {
  const { t } = useTranslation();
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const mutedColor = useColorModeValue('gray.600', 'gray.400');
  const accentColor = useColorModeValue('red.600', 'red.200');

  // Calculate event duration
  const getDuration = (startedAt: string, endedAt: string | null) => {
    const start = new Date(startedAt);
    const end = endedAt ? new Date(endedAt) : new Date();
    const minutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  // Format time for display
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get status icon and color
  const getStatusDisplay = (hvacAction: string) => {
    const isHeating = hvacAction === 'HEATING_ON';
    return {
      icon: isHeating ? 'fire' : 'fire-off',
      color: isHeating ? accentColor : mutedColor,
      label: isHeating ? t('heatingEvents.heating') : t('heatingEvents.idle'),
    };
  };

  const renderEventItem = ({ item, index }: { item: RecentHeatingEvent; index: number }) => {
    const status = getStatusDisplay(item.hvacAction);
    const tempDiff = Math.abs(item.currentTemp - item.targetTemp);
    const duration = getDuration(item.startedAt, item.endedAt);
    const isRecent = index === 0;

    return (
      <Box
        bg={useColorModeValue('gray.50', 'gray.900')}
        rounded="lg"
        p={3}
        mb={2}
        borderLeftWidth={isRecent ? 3 : 1}
        borderLeftColor={isRecent ? accentColor : borderColor}
      >
        <VStack space={2}>
          {/* Header: Time and Duration */}
          <HStack justifyContent="space-between" alignItems="center">
            <HStack space={2} alignItems="center" flex={1}>
              <MaterialCommunityIcons name={status.icon as any} size={18} color={status.color} />
              <VStack space={0}>
                <Text fontSize="sm" fontWeight="600" color={textColor}>
                  {status.label}
                </Text>
                <Text fontSize="xs" color={mutedColor}>
                  {formatTime(item.startedAt)}
                </Text>
              </VStack>
            </HStack>

            <Box bg={accentColor} opacity={0.6} rounded="md" px={2} py={1}>
              <Text fontSize="xs" fontWeight="600" color={'black'}>
                {duration}
              </Text>
            </Box>
          </HStack>

          {/* Temperatures */}
          <HStack space={3} justifyContent="space-between">
            <Box flex={1}>
              <Text fontSize="xs" color={mutedColor}>
                {t('heatingEvents.current')}
              </Text>
              <Text fontSize="sm" fontWeight="bold" color={textColor}>
                {item?.currentTemp ? item.currentTemp.toFixed(1) : '—'}°C
              </Text>
            </Box>
            <Box flex={1}>
              <Text fontSize="xs" color={mutedColor}>
                {t('heatingEvents.target')}
              </Text>
              <Text fontSize="sm" fontWeight="bold" color={textColor}>
                {item?.targetTemp ? item.targetTemp.toFixed(1) : '—'}°C
              </Text>
            </Box>
            <Box flex={1}>
              <Text fontSize="xs" color={mutedColor}>
                {t('heatingEvents.diff')}
              </Text>
              <Text
                fontSize="sm"
                fontWeight="bold"
                color={tempDiff <= 2 ? 'green.600' : 'orange.600'}
              >
                {tempDiff ? tempDiff.toFixed(1) : '—'}°C
              </Text>
            </Box>
          </HStack>
        </VStack>
      </Box>
    );
  };

  if (events.length === 0) {
    return (
      <Box bg={bgColor} borderWidth={1} borderColor={borderColor} rounded="lg" p={4} mb={3}>
        <VStack space={2} alignItems="center">
          <MaterialCommunityIcons name="history" size={24} color={mutedColor} />
          <Text fontSize="sm" color={mutedColor}>
            {t('heatingEvents.noEvents')}
          </Text>
        </VStack>
      </Box>
    );
  }

  return (
    <Box bg={bgColor} borderWidth={1} borderColor={borderColor} rounded="lg" p={4} mb={3}>
      <VStack space={2}>
        <Text fontSize="sm" fontWeight="600" color={mutedColor}>
          {t('heatingEvents.title')}
        </Text>

        {events.slice(0, 5).map((item, index) => renderEventItem({ item, index }))}

        {events.length > 5 && (
          <Text fontSize="xs" color={mutedColor} textAlign="center" mt={2}>
            {t('heatingEvents.moreEvents', { count: events.length - 5 })}
          </Text>
        )}
      </VStack>
    </Box>
  );
};
