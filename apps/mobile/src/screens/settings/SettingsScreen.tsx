import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  useColorModeValue,
  Switch,
  Button,
  Divider,
  useColorMode,
  Pressable,
  ScrollView,
  Icon,
} from 'native-base';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useNavigation } from '@react-navigation/native';
import {
  scheduleDailyGasReadingReminder,
  cancelDailyGasReadingReminder,
} from '../../services/notifications/notificationService';

export const SettingsScreen = () => {
  const { user, logout } = useAuth();
  const { colorMode, toggleColorMode } = useColorMode();
  const navigation = useNavigation();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [dailyGasReminder, setDailyGasReminder] = useState(true);

  const handleDailyGasReminderToggle = async (enabled: boolean) => {
    setDailyGasReminder(enabled);
    if (enabled) {
      await scheduleDailyGasReadingReminder(19, 0);
    } else {
      await cancelDailyGasReadingReminder();
    }
  };

  useEffect(() => {
    // On mount, schedule the reminder if enabled
    if (dailyGasReminder) {
      scheduleDailyGasReadingReminder(19, 0);
    }
  }, []);

  const bgColor = useColorModeValue('gray.50', 'dark.900');
  const cardBg = useColorModeValue('white', 'dark.800');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const subtextColor = useColorModeValue('gray.600', 'gray.400');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const SettingItem = ({
    icon,
    title,
    subtitle,
    onPress,
    rightElement,
  }: {
    icon: string;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    rightElement?: React.ReactNode;
  }) => (
    <Pressable onPress={onPress} disabled={!onPress} _pressed={{ opacity: 0.7 }}>
      <HStack
        py={3}
        px={4}
        alignItems="center"
        justifyContent="space-between"
        bg={onPress ? useColorModeValue('gray.50', 'gray.900') : 'transparent'}
        rounded="md"
      >
        <HStack space={3} alignItems="center" flex={1}>
          <Icon
            as={Ionicons}
            name={icon as any}
            size={6}
            color={useColorModeValue('brand.500', 'brand.400')}
          />
          <VStack flex={1}>
            <Text fontSize="md" fontWeight="500" color={textColor}>
              {title}
            </Text>
            {subtitle && (
              <Text fontSize="sm" color={subtextColor}>
                {subtitle}
              </Text>
            )}
          </VStack>
        </HStack>
        {rightElement}
        {onPress && (
          <Icon as={Ionicons} name="chevron-forward" size={5} color={subtextColor} ml={2} />
        )}
      </HStack>
    </Pressable>
  );

  return (
    <Box flex={1} bg={bgColor} safeArea>
      <ScrollView>
        <VStack px={4} py={6} space={4} pb={8}>
          <Heading size="xl" color={textColor}>
            Settings
          </Heading>

          {/* Account Section */}
          <Box bg={cardBg} rounded="xl" shadow={2} overflow="hidden">
            <VStack space={0}>
              <Box px={4} py={3} borderBottomWidth={1} borderBottomColor={borderColor}>
                <Text fontSize="xs" fontWeight="600" color={subtextColor} textTransform="uppercase">
                  Account
                </Text>
              </Box>
              <SettingItem
                icon="person-outline"
                title={user?.name || 'User'}
                subtitle={user?.email}
              />
              <Divider />
              <SettingItem
                icon="key-outline"
                title="Change Password"
                onPress={() => console.log('Change password')}
              />
            </VStack>
          </Box>

          {/* Appearance Section */}
          <Box bg={cardBg} rounded="xl" shadow={2} overflow="hidden">
            <VStack space={0}>
              <Box px={4} py={3} borderBottomWidth={1} borderBottomColor={borderColor}>
                <Text fontSize="xs" fontWeight="600" color={subtextColor} textTransform="uppercase">
                  Appearance
                </Text>
              </Box>
              <SettingItem
                icon={colorMode === 'dark' ? 'moon' : 'sunny'}
                title="Dark Mode"
                subtitle={colorMode === 'dark' ? 'Enabled' : 'Disabled'}
                rightElement={
                  <Switch isChecked={colorMode === 'dark'} onToggle={toggleColorMode} size="sm" />
                }
              />
            </VStack>
          </Box>

          {/* Notifications Section */}
          <Box bg={cardBg} rounded="xl" shadow={2} overflow="hidden">
            <VStack space={0}>
              <Box px={4} py={3} borderBottomWidth={1} borderBottomColor={borderColor}>
                <Text fontSize="xs" fontWeight="600" color={subtextColor} textTransform="uppercase">
                  Notifications
                </Text>
              </Box>
              <SettingItem
                icon="notifications-outline"
                title="Enable Notifications"
                subtitle="Receive alerts and updates"
                rightElement={
                  <Switch
                    isChecked={notificationsEnabled}
                    onToggle={() => setNotificationsEnabled(!notificationsEnabled)}
                    size="sm"
                  />
                }
              />
              <Divider />
              <SettingItem
                icon="phone-portrait-outline"
                title="Push Notifications"
                subtitle="Get push notifications on this device"
                rightElement={
                  <Switch
                    isChecked={pushEnabled}
                    onToggle={() => setPushEnabled(!pushEnabled)}
                    size="sm"
                    isDisabled={!notificationsEnabled}
                  />
                }
              />
              <Divider />
              <SettingItem
                icon="list-outline"
                title="Notifications"
                subtitle="View notification history"
                onPress={() => (navigation as any).navigate('Notifications')}
              />
              <Divider />
              <SettingItem
                icon="settings-outline"
                title="Notification Preferences"
                subtitle="Customize alert types"
                onPress={() => (navigation as any).navigate('NotificationPreferences')}
              />
              <Divider />
              <SettingItem
                icon="time-outline"
                title="Daily Gas Reminder"
                subtitle="7:00 PM reminder for gas readings"
                rightElement={
                  <Switch
                    isChecked={dailyGasReminder}
                    onToggle={handleDailyGasReminderToggle}
                    size="sm"
                    isDisabled={!notificationsEnabled}
                  />
                }
              />
            </VStack>
          </Box>

          {/* Homes Section */}
          <Box bg={cardBg} rounded="xl" shadow={2} overflow="hidden">
            <VStack space={0}>
              <Box px={4} py={3} borderBottomWidth={1} borderBottomColor={borderColor}>
                <Text fontSize="xs" fontWeight="600" color={subtextColor} textTransform="uppercase">
                  Homes
                </Text>
              </Box>
              <SettingItem
                icon="home-outline"
                title="Manage Homes"
                subtitle="Add or edit home profiles"
                onPress={() => (navigation as any).navigate('HomeManagement')}
              />
              <Divider />
              <SettingItem
                icon="calendar-outline"
                title="Heating Schedules"
                subtitle="Configure heating programs"
                onPress={() => (navigation as any).navigate('ScheduleManagement')}
              />
            </VStack>
          </Box>

          {/* Data & Privacy Section */}
          <Box bg={cardBg} rounded="xl" shadow={2} overflow="hidden">
            <VStack space={0}>
              <Box px={4} py={3} borderBottomWidth={1} borderBottomColor={borderColor}>
                <Text fontSize="xs" fontWeight="600" color={subtextColor} textTransform="uppercase">
                  Data & Privacy
                </Text>
              </Box>
              <SettingItem
                icon="download-outline"
                title="Export Data"
                subtitle="Download your heating data"
                onPress={() => console.log('Export data')}
              />
              <Divider />
              <SettingItem
                icon="trash-outline"
                title="Clear Cache"
                subtitle="Free up storage space"
                onPress={() => console.log('Clear cache')}
              />
            </VStack>
          </Box>

          {/* About Section */}
          <Box bg={cardBg} rounded="xl" shadow={2} overflow="hidden">
            <VStack space={0}>
              <Box px={4} py={3} borderBottomWidth={1} borderBottomColor={borderColor}>
                <Text fontSize="xs" fontWeight="600" color={subtextColor} textTransform="uppercase">
                  About
                </Text>
              </Box>
              <SettingItem icon="information-circle-outline" title="Version" subtitle="2.0.0" />
              <Divider />
              <SettingItem
                icon="help-circle-outline"
                title="Help & Support"
                onPress={() => console.log('Help')}
              />
              <Divider />
              <SettingItem
                icon="document-text-outline"
                title="Terms & Privacy"
                onPress={() => console.log('Terms')}
              />
            </VStack>
          </Box>

          {/* Logout Button */}
          <Button
            onPress={handleLogout}
            colorScheme="danger"
            variant="outline"
            size="lg"
            leftIcon={<Icon as={Ionicons} name="log-out-outline" />}
            mt={4}
          >
            Sign Out
          </Button>
        </VStack>
      </ScrollView>
    </Box>
  );
};
