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

interface NotificationPreference {
  id: number;
  userId: number;
  type: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

const labelMap: Record<string, string> = {
  DAILY_RECOMMENDATION: 'Dnevne preporuke',
  FLOW_TEMP_CHANGED: 'Promjena temperature polazne vode',
  HEATING_STARTED: 'Početak grijanja',
  HEATING_ENDED: 'Kraj grijanja',
  SYSTEM_ALERT: 'Sistemska upozorenja',
  GAS_READING_REMINDER: 'Podsjetnici za unos očitanja plina',
};

const descriptionMap: Record<string, string> = {
  DAILY_RECOMMENDATION: 'Preporuke za optimizaciju grijanja svaki dan.',
  FLOW_TEMP_CHANGED: 'Obavijesti kada se promijeni temperatura polazne vode.',
  HEATING_STARTED: 'Obavijest kada grijanje započne.',
  HEATING_ENDED: 'Obavijest kada grijanje završi.',
  SYSTEM_ALERT: 'Kritična upozorenja o radu sistema.',
  GAS_READING_REMINDER: 'Podsjetnik za unos očitanja plina.',
};

export const NotificationPreferencesScreen: React.FC = () => {
  const queryClient = useQueryClient();

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
          Loading preferences...
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
                Odaberite koje tipove notifikacija želite primati. Sve promjene se odmah
                primjenjuju.
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
                    {labelMap[pref.type] || pref.type}
                  </Text>
                  <Text fontSize="sm" color={subtextColor}>
                    {descriptionMap[pref.type] || 'Primaj notifikacije za ovaj tip događaja.'}
                  </Text>
                  {pref.updatedAt && (
                    <Text fontSize="xs" color={subtextColor}>
                      Posljednja izmjena: {dayjs(pref.updatedAt).format('DD.MM.YYYY HH:mm')}
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
