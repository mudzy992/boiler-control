import React, { useCallback, useMemo, useState } from 'react';
import { SectionList } from 'react-native';
import {
  Box,
  VStack,
  HStack,
  Text,
  useColorModeValue,
  Pressable,
  Spinner,
  Icon,
  Badge,
  Divider,
} from 'native-base';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { apiClient } from '../../services/api/client';

interface NotificationItem {
  id: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  data?: any;
  sentAt: string;
  isRead: boolean;
  sourceRef?: string;
  createdAt: string;
}

interface NotificationSection {
  title: string;
  data: NotificationItem[];
}

const getSectionTitle = (date: dayjs.Dayjs) => {
  if (date.isSame(dayjs(), 'day')) return 'Today';
  if (date.isSame(dayjs().subtract(1, 'day'), 'day')) return 'Yesterday';
  return date.format('MMM D, YYYY');
};

const getTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    DAILY_RECOMMENDATION: 'Daily Recommendation',
    FLOW_TEMP_CHANGED: 'Flow Temperature Changed',
    HEATING_STARTED: 'Heating Started',
    HEATING_ENDED: 'Heating Ended',
    SYSTEM_ALERT: 'System Alert',
    GAS_READING_REMINDER: 'Gas Reading Reminder',
  };

  return labels[type] || type;
};

const getTypeIcon = (type: string) => {
  const icons: Record<string, string> = {
    DAILY_RECOMMENDATION: 'calendar-outline',
    FLOW_TEMP_CHANGED: 'thermometer-outline',
    HEATING_STARTED: 'flame-outline',
    HEATING_ENDED: 'snow-outline',
    SYSTEM_ALERT: 'warning-outline',
    GAS_READING_REMINDER: 'time-outline',
  };

  return icons[type] || 'notifications-outline';
};

export const NotificationsScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const [showAll, setShowAll] = useState(false);

  const bgColor = useColorModeValue('gray.50', 'dark.900');
  const cardBg = useColorModeValue('white', 'dark.800');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const subtextColor = useColorModeValue('gray.600', 'gray.400');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const brandColor = useColorModeValue('brand.500', 'brand.400');

  const {
    data: notifications,
    isLoading,
    isRefetching,
  } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiClient.getNotifications() as Promise<NotificationItem[]>,
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id: number) => apiClient.markNotificationAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiClient.markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  const unreadCount = useMemo(() => {
    return (notifications || []).filter((n) => !n.isRead).length;
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    if (!notifications) return [];
    return showAll ? notifications : notifications.filter((n) => !n.isRead);
  }, [notifications, showAll]);

  const sections = useMemo<NotificationSection[]>(() => {
    if (!filteredNotifications.length) return [];

    const grouped = new Map<string, NotificationItem[]>();
    filteredNotifications.forEach((notif) => {
      const dateKey = dayjs(notif.sentAt || notif.createdAt)
        .startOf('day')
        .toISOString();
      if (!grouped.has(dateKey)) grouped.set(dateKey, []);
      grouped.get(dateKey)!.push(notif);
    });

    return Array.from(grouped.entries())
      .sort(([a], [b]) => (dayjs(a).isBefore(dayjs(b)) ? 1 : -1))
      .map(([dateKey, data]) => ({
        title: getSectionTitle(dayjs(dateKey)),
        data,
      }));
  }, [filteredNotifications]);

  const handlePress = useCallback(
    (notification: NotificationItem) => {
      if (notification.isRead) return;
      markAsReadMutation.mutate(notification.id);
    },
    [markAsReadMutation]
  );

  if (isLoading) {
    return (
      <Box flex={1} bg={bgColor} safeArea alignItems="center" justifyContent="center">
        <Spinner size="lg" color={brandColor} />
        <Text mt={3} color={subtextColor}>
          Loading notifications...
        </Text>
      </Box>
    );
  }

  return (
    <Box flex={1} bg={bgColor} safeArea>
      <HStack space={3} px={4} pt={4} pb={2} alignItems="center" justifyContent="space-between">
        <HStack space={2} alignItems="center">
          <Pressable onPress={() => setShowAll(false)}>
            <Box
              px={4}
              py={2}
              rounded="full"
              bg={showAll ? cardBg : brandColor}
              borderWidth={showAll ? 1 : 0}
              borderColor={borderColor}
            >
              <Text color={showAll ? textColor : 'white'} fontWeight="600">
                Unread {unreadCount > 0 ? `(${unreadCount})` : ''}
              </Text>
            </Box>
          </Pressable>
          <Pressable onPress={() => setShowAll(true)}>
            <Box
              px={4}
              py={2}
              rounded="full"
              bg={showAll ? brandColor : cardBg}
              borderWidth={showAll ? 0 : 1}
              borderColor={borderColor}
            >
              <Text color={showAll ? 'white' : textColor} fontWeight="600">
                All ({notifications?.length || 0})
              </Text>
            </Box>
          </Pressable>
        </HStack>
        <Pressable
          onPress={() => markAllReadMutation.mutate()}
          disabled={unreadCount === 0 || markAllReadMutation.isPending}
        >
          <Box
            px={3}
            py={2}
            rounded="full"
            borderWidth={1}
            borderColor={borderColor}
            opacity={unreadCount === 0 || markAllReadMutation.isPending ? 0.5 : 1}
          >
            <Text color={textColor} fontWeight="600">
              {markAllReadMutation.isPending ? 'Marking...' : 'Mark All Read'}
            </Text>
          </Box>
        </Pressable>
      </HStack>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        refreshing={isRefetching}
        renderSectionHeader={({ section }) => (
          <Text fontSize="sm" fontWeight="700" color={subtextColor} mb={2}>
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => (
          <Pressable onPress={() => handlePress(item)}>
            <Box bg={cardBg} rounded="lg" borderWidth={1} borderColor={borderColor} p={4} mb={3}>
              <HStack space={3} alignItems="flex-start">
                <Box mt={1}>
                  <Icon
                    as={Ionicons}
                    name={getTypeIcon(item.type) as any}
                    size={6}
                    color={brandColor}
                  />
                </Box>
                <VStack flex={1} space={1}>
                  <HStack alignItems="center" justifyContent="space-between">
                    <Text fontSize="md" fontWeight="600" color={textColor}>
                      {item.title}
                    </Text>
                    {!item.isRead && (
                      <Badge colorScheme="danger" variant="solid" rounded="full" px={2}>
                        NEW
                      </Badge>
                    )}
                  </HStack>
                  <Text fontSize="sm" color={subtextColor}>
                    {item.message}
                  </Text>
                  <Divider mt={2} mb={1} bg={borderColor} />
                  <HStack justifyContent="space-between" alignItems="center">
                    <Text fontSize="xs" color={subtextColor}>
                      {getTypeLabel(item.type)}
                    </Text>
                    <Text fontSize="xs" color={subtextColor}>
                      {dayjs(item.sentAt || item.createdAt).format('HH:mm')}
                    </Text>
                  </HStack>
                </VStack>
              </HStack>
            </Box>
          </Pressable>
        )}
        ListEmptyComponent={() => (
          <Box alignItems="center" mt={10}>
            <Icon as={Ionicons} name="notifications-off-outline" size={12} color={subtextColor} />
            <Text mt={3} color={subtextColor}>
              {showAll ? 'No notifications yet' : 'No unread notifications'}
            </Text>
          </Box>
        )}
      />
    </Box>
  );
};
