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
  useToast,
} from 'native-base';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { useNavigation } from '@react-navigation/native';
import { BottomSheetModal } from '../../components/BottomSheetModal';
import { FormInput } from '../../components/FormInput';
import {
  scheduleDailyGasReadingReminder,
  cancelDailyGasReadingReminder,
} from '../../services/notifications/notificationService';
import { AppStorage } from '../../services/storage/AppStorage';
import { apiClient } from '../../services/api/client';

export const SettingsScreen = () => {
  const { user, logout } = useAuth();
  const { colorMode, toggleColorMode } = useColorMode();
  const navigation = useNavigation();
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [dailyGasReminder, setDailyGasReminder] = useState(true);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const languageLabel =
    i18n.language === 'bs-BS' ? t('settings.languageBosnian') : t('settings.languageEnglish');

  const handleLanguageChange = async (language: 'en-US' | 'bs-BS') => {
    await AppStorage.set('app.language', language);
    await i18n.changeLanguage(language);
    setShowLanguageModal(false);
  };

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

  const resetPasswordFields = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.show({
        description: t('settings.changePasswordRequired'),
        placement: 'top',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.show({
        description: t('auth.passwordsDontMatch'),
        placement: 'top',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast.show({
        description: t('auth.passwordTooShort'),
        placement: 'top',
      });
      return;
    }

    try {
      setIsChangingPassword(true);
      await apiClient.changePassword(currentPassword, newPassword);

      toast.show({
        description: t('settings.changePasswordSuccess'),
        placement: 'top',
      });
      resetPasswordFields();
      setShowPasswordModal(false);
    } catch (error: any) {
      toast.show({
        description:
          error?.response?.data?.message || t('settings.changePasswordError'),
        placement: 'top',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const bgColor = useColorModeValue('gray.50', 'dark.900');
  const cardBg = useColorModeValue('white', 'dark.800');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const subtextColor = useColorModeValue('gray.600', 'gray.400');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const selectedBg = useColorModeValue('gray.100', 'gray.800');

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
            {t('settings.title')}
          </Heading>

          {/* Account Section */}
          <Box bg={cardBg} rounded="xl" shadow={2} overflow="hidden">
            <VStack space={0}>
              <Box px={4} py={3} borderBottomWidth={1} borderBottomColor={borderColor}>
                <Text fontSize="xs" fontWeight="600" color={subtextColor} textTransform="uppercase">
                  {t('settings.accountSection')}
                </Text>
              </Box>
              <SettingItem
                icon="person-outline"
                title={user?.name || t('settings.profile')}
                subtitle={user?.email}
                onPress={() => (navigation as any).navigate('Profile')}
              />
              <Divider />
              <SettingItem
                icon="key-outline"
                title={t('settings.changePassword')}
                onPress={() => setShowPasswordModal(true)}
              />
            </VStack>
          </Box>

          {/* Appearance Section */}
          <Box bg={cardBg} rounded="xl" shadow={2} overflow="hidden">
            <VStack space={0}>
              <Box px={4} py={3} borderBottomWidth={1} borderBottomColor={borderColor}>
                <Text fontSize="xs" fontWeight="600" color={subtextColor} textTransform="uppercase">
                  {t('settings.appearanceSection')}
                </Text>
              </Box>
              <SettingItem
                icon={colorMode === 'dark' ? 'moon' : 'sunny'}
                title={t('settings.darkMode')}
                subtitle={colorMode === 'dark' ? t('common.enabled') : t('common.disabled')}
                rightElement={
                  <Switch isChecked={colorMode === 'dark'} onToggle={toggleColorMode} size="sm" />
                }
              />
              <Divider />
              <SettingItem
                icon="language-outline"
                title={t('settings.language')}
                subtitle={languageLabel}
                onPress={() => setShowLanguageModal(true)}
              />
            </VStack>
          </Box>

          {/* Notifications Section */}
          <Box bg={cardBg} rounded="xl" shadow={2} overflow="hidden">
            <VStack space={0}>
              <Box px={4} py={3} borderBottomWidth={1} borderBottomColor={borderColor}>
                <Text fontSize="xs" fontWeight="600" color={subtextColor} textTransform="uppercase">
                  {t('settings.notificationsSection')}
                </Text>
              </Box>
              <SettingItem
                icon="notifications-outline"
                title={t('settings.notificationsEnabled')}
                subtitle={t('settings.notificationsEnabledDesc')}
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
                title={t('settings.pushNotifications')}
                subtitle={t('settings.pushNotificationsDesc')}
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
                title={t('settings.notifications')}
                subtitle={t('settings.notificationsDesc')}
                onPress={() => (navigation as any).navigate('Notifications')}
              />
              <Divider />
              <SettingItem
                icon="settings-outline"
                title={t('settings.notificationPreferences')}
                subtitle={t('settings.notificationPreferencesDesc')}
                onPress={() => (navigation as any).navigate('NotificationPreferences')}
              />
              <Divider />
              <SettingItem
                icon="time-outline"
                title={t('settings.dailyGasReminder')}
                subtitle={t('settings.dailyGasReminderTime')}
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
                  {t('settings.homesSection')}
                </Text>
              </Box>
              <SettingItem
                icon="home-outline"
                title={t('settings.manageHomes')}
                subtitle={t('settings.manageHomesDesc')}
                onPress={() => (navigation as any).navigate('HomeManagement')}
              />
              <Divider />
              <SettingItem
                icon="calendar-outline"
                title={t('settings.heatingSchedules')}
                subtitle={t('settings.heatingSchedulesDesc')}
                onPress={() => (navigation as any).navigate('ScheduleManagement')}
              />
            </VStack>
          </Box>

          {/* Data & Privacy Section */}
          <Box bg={cardBg} rounded="xl" shadow={2} overflow="hidden">
            <VStack space={0}>
              <Box px={4} py={3} borderBottomWidth={1} borderBottomColor={borderColor}>
                <Text fontSize="xs" fontWeight="600" color={subtextColor} textTransform="uppercase">
                  {t('settings.dataPrivacySection')}
                </Text>
              </Box>
              <SettingItem
                icon="download-outline"
                title={t('settings.exportData')}
                subtitle={t('settings.exportDataDesc')}
                onPress={() => console.log('Export data')}
              />
              <Divider />
              <SettingItem
                icon="trash-outline"
                title={t('settings.clearCache')}
                subtitle={t('settings.clearCacheDesc')}
                onPress={() => console.log('Clear cache')}
              />
            </VStack>
          </Box>

          {/* About Section */}
          <Box bg={cardBg} rounded="xl" shadow={2} overflow="hidden">
            <VStack space={0}>
              <Box px={4} py={3} borderBottomWidth={1} borderBottomColor={borderColor}>
                <Text fontSize="xs" fontWeight="600" color={subtextColor} textTransform="uppercase">
                  {t('settings.aboutSection')}
                </Text>
              </Box>
              <SettingItem
                icon="information-circle-outline"
                title={t('settings.version')}
                subtitle="2.0.0"
              />
              <Divider />
              <SettingItem
                icon="help-circle-outline"
                title={t('settings.helpSupport')}
                onPress={() => console.log('Help')}
              />
              <Divider />
              <SettingItem
                icon="document-text-outline"
                title={t('settings.termsPrivacy')}
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
            {t('common.logout')}
          </Button>
        </VStack>
      </ScrollView>

      <BottomSheetModal
        isOpen={showLanguageModal}
        onClose={() => setShowLanguageModal(false)}
        snapPoints={['45%', '60%']}
      >
        <VStack space={3}>
          <Text fontSize="lg" fontWeight="bold" color={textColor}>
            {t('settings.language')}
          </Text>
          <VStack space={2}>
            <Pressable
              onPress={() => handleLanguageChange('en-US')}
              bg={i18n.language === 'en-US' ? selectedBg : 'transparent'}
              px={4}
              py={3}
              rounded="md"
            >
              <Text fontSize="sm" fontWeight="600" color={textColor}>
                {t('settings.languageEnglish')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleLanguageChange('bs-BS')}
              bg={i18n.language === 'bs-BS' ? selectedBg : 'transparent'}
              px={4}
              py={3}
              rounded="md"
            >
              <Text fontSize="sm" fontWeight="600" color={textColor}>
                {t('settings.languageBosnian')}
              </Text>
            </Pressable>
          </VStack>
        </VStack>
      </BottomSheetModal>

      <BottomSheetModal
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          resetPasswordFields();
        }}
        snapPoints={['55%', '80%']}
      >
        <VStack space={4}>
          <Text fontSize="lg" fontWeight="bold" color={textColor}>
            {t('settings.changePassword')}
          </Text>

          <VStack space={3}>
            <VStack space={1}>
              <Text fontSize="xs" color={subtextColor}>
                {t('settings.currentPassword')}
              </Text>
              <FormInput
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </VStack>

            <VStack space={1}>
              <Text fontSize="xs" color={subtextColor}>
                {t('settings.newPassword')}
              </Text>
              <FormInput
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </VStack>

            <VStack space={1}>
              <Text fontSize="xs" color={subtextColor}>
                {t('settings.confirmNewPassword')}
              </Text>
              <FormInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </VStack>
          </VStack>

          <HStack space={2}>
            <Button
              flex={1}
              variant="outline"
              onPress={() => {
                setShowPasswordModal(false);
                resetPasswordFields();
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              flex={1}
              onPress={handleChangePassword}
              isLoading={isChangingPassword}
            >
              {t('common.save')}
            </Button>
          </HStack>
        </VStack>
      </BottomSheetModal>
    </Box>
  );
};
