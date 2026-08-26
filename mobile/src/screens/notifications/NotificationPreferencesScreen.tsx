import React from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Switch,
  useColorModeValue,
  Spinner,
  Icon,
  Divider,
  ScrollView,
} from 'native-base';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../services/api/client';
import dayjs from 'dayjs';
import { useTranslation } from '../../hooks/useTranslation';

interface NotificationPreference {
  id: number;
  userId: number;
  type: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

const getTypeLabel = (type: string, t: (key: string) => string) =>
  t(`notifications.types.${type}`) || type;

const getTypeDescription = (type: string, t: (key: string) => string) =>
  t(`notifications.typeDescriptions.${type}`) || t('notifications.preferencesDefaultDesc');

export const NotificationPreferencesScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const bgColor = useColorModeValue('gray.50', 'dark.900');
  const cardBg = useColorModeValue('white', 'dark.800');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const subtextColor = useColorModeValue('gray.600', 'gray.400');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const loadingSpinnerColor = useColorModeValue('brand.500', 'brand.400');
  const infoBg = useColorModeValue('blue.50', 'blue.900');
  const infoBorder = useColorModeValue('blue.200', 'blue.700');
  const infoIconColor = useColorModeValue('blue.600', 'blue.300');
  const infoTextColor = useColorModeValue('blue.700', 'blue.200');

  const { data, isLoading } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => apiClient.getNotificationPreferences() as Promise<NotificationPreference[]>,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { type: string; enabled: boolean }) =>
      apiClient.updateNotificationPreference(payload.type, payload.enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
    },
  });

  if (isLoading) {
    return (
      <Box flex={1} bg={bgColor} safeArea alignItems="center" justifyContent="center">
        <Spinner size="lg" color={loadingSpinnerColor} />
        <Text mt={3} color={subtextColor}>
          {t('notifications.preferencesLoading')}
        </Text>
      </Box>
    );
  }

  return (
    <Box flex={1} bg={bgColor} safeArea>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 24 }}>
        <VStack space={4} pb={6}>
          <Box bg={infoBg} rounded="lg" p={4} borderWidth={1} borderColor={infoBorder}>
            <HStack space={2} alignItems="center">
              <Icon
                as={Ionicons}
                name="information-circle-outline"
                size={5}
                color={infoIconColor}
              />
              <Text fontSize="sm" color={infoTextColor}>
                {t('notifications.preferencesInfo')}
              </Text>
            </HStack>
          </Box>

          {data?.map((pref) => (
            <Box
              key={pref.id}
              bg={cardBg}
              rounded="lg"
              borderWidth={1}
              borderColor={borderColor}
              p={4}
            >
              <HStack space={3} alignItems="center" justifyContent="space-between">
                <VStack flex={1} space={1}>
                  <Text fontSize="md" fontWeight="600" color={textColor}>
                    {getTypeLabel(pref.type, t)}
                  </Text>
                  <Text fontSize="sm" color={subtextColor}>
                    {getTypeDescription(pref.type, t)}
                  </Text>
                  {pref.updatedAt && (
                    <Text fontSize="xs" color={subtextColor}>
                      {t('notifications.lastUpdated', {
                        date: dayjs(pref.updatedAt).format('DD.MM.YYYY HH:mm'),
                      })}
                    </Text>
                  )}
                </VStack>
                <Switch
                  isChecked={pref.enabled}
                  onToggle={() =>
                    updateMutation.mutate({ type: pref.type, enabled: !pref.enabled })
                  }
                  size="sm"
                />
              </HStack>
              <Divider mt={3} bg={borderColor} />
            </Box>
          ))}
        </VStack>
      </ScrollView>
    </Box>
  );
};
