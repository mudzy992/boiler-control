import React from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Switch,
  useColorModeValue,
  Icon,
  Divider,
  ScrollView,
} from '../../components/ui/nativewind';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Screen, ScreenHeader, SkeletonPanel, SkeletonRows } from '../../ui';
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

const NotificationPreferencesScreenContent: React.FC = () => {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const cardBg = useColorModeValue('white', 'dark.800');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const subtextColor = useColorModeValue('gray.600', 'gray.400');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
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

  const header = (
    <ScreenHeader
      title={t('notifications.preferences')}
      onBack={() => (navigation as any).goBack()}
      backLabel={t('common.back')}
      testID="notification-preferences-header"
    />
  );

  if (isLoading) {
    return (
      <Screen edges={['top']}>
        {header}
        {/* F4 (UX-07): skeleton u obliku liste prekidača. */}
        <Box px={4} pt={3} style={{ gap: 12 }}>
          <SkeletonPanel lines={1} height={64} />
          <SkeletonRows count={4} />
        </Box>
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      {header}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16 }}>
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
    </Screen>
  );
};

export const NotificationPreferencesScreen = NotificationPreferencesScreenContent;
