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
import { getAppVersion } from '../../config/version.config';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
// MO2-16 (MO-020): stvarno čišćenje keša umjesto console.log.
import { purgeDownloadsDirectory } from '../../services/storage/downloadCache';
import {
  DASHBOARD_STACK_SCREENS,
  MAIN_TAB_SCREENS,
  ROOT_SCREENS,
} from '../../constants/routes';
import { useNavigation } from '@react-navigation/native';
import { BottomSheetModal } from '../../components/BottomSheetModal';
import { FormInput } from '../../components/FormInput';
// MO2-6 (MO-008): umjesto deprecated no-op funkcija koristi se stvarni API.
// `scheduleDailyGasReadingReminder` / `cancelDailyGasReadingReminder` su samo
// logovali poruku i ništa nisu radili, pa su obrisani iz notificationService.
import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';
import { AppStorage } from '../../services/storage/AppStorage';
import { apiClient } from '../../services/api/client';

/**
 * MO2-6 (MO-008): tip preferencije za dnevni podsjetnik o plinu.
 *
 * Vrijednost NIJE izmišljena — kopija je člana Prisma enuma `NotificationType`
 * (`backend/prisma/schema.prisma:319`) i iste liste kojom backend puni zadane
 * preferencije (`notifications.controller.ts:106-113`).
 *
 * Zašto je ovo bitno: `PATCH /api/notifications/preferences` prima običan TS tip
 * bez DTO-a i bez `class-validator` dekoratora, pa globalni `ValidationPipe`
 * preskače validaciju (B-010). Jedina zaštita je Prisma enum na nivou baze —
 * izmišljeni tip bi prošao HTTP sloj i tek tamo pao. Zato se tip drži kao
 * imenovana konstanta, a ne kao string literal rasut po ekranu.
 */
const GAS_READING_REMINDER_TYPE = 'GAS_READING_REMINDER';

export const SettingsScreen = () => {
  const { user, logout } = useAuth();
  const { colorMode, toggleColorMode } = useColorMode();
  const navigation = useNavigation();
  const { t, i18n } = useTranslation();
  const toast = useToast();
  /**
   * MO2-6 (MO-008): ova tri stanja su prije bila `useState(true)` — prekidači su
   * izgledali kao da rade, ali nisu perzistirali ništa i nisu zvali backend.
   *
   * Sada:
   *  - `dailyGasReminder` je vezan na stvarnu preferencu `GAS_READING_REMINDER`
   *    (postoji u Prisma enumu `NotificationType`, `schema.prisma:319`).
   *  - stanje dozvole za obavijesti čita se iz OS-a (`getPermissionsAsync`), jer
   *    aplikacija ne može sama sebi dodijeliti dozvolu — jedino iskreno stanje
   *    je ono koje kaže sistem.
   */
  const [permissionStatus, setPermissionStatus] = useState<string | null>(null);
  const [dailyGasReminder, setDailyGasReminder] = useState(false);
  const [isLoadingGasReminder, setIsLoadingGasReminder] = useState(true);
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

  /**
   * MO2-6 (MO-008): prije je ovo zvalo `scheduleDailyGasReadingReminder`,
   * deprecated no-op koji je samo ispisao `console.log`. Prekidač je izgledao
   * funkcionalno, a nije radio ništa i ništa nije perzistirao.
   *
   * Sada ide na stvarni `PATCH /api/notifications/preferences`. Optimistično
   * postavimo stanje, a pri grešci ga vratimo — inače bi prekidač lagao da je
   * promjena prošla.
   */
  const handleDailyGasReminderToggle = async (enabled: boolean) => {
    const previous = dailyGasReminder;
    setDailyGasReminder(enabled);
    try {
      await apiClient.updateNotificationPreference(GAS_READING_REMINDER_TYPE, enabled);
      toast.show({
        description: t('settings.preferenceSaved'),
        placement: 'top',
      });
    } catch {
      setDailyGasReminder(previous);
      toast.show({
        description: t('settings.preferenceSaveFailed'),
        placement: 'top',
      });
    }
  };

  /**
   * MO2-6 (MO-008): dozvolu čitamo iz OS-a, a ne držimo izmišljeno `true`.
   * `Linking.openSettings()` je jedini način da korisnik promijeni dozvolu —
   * aplikacija to ne može uraditi umjesto njega.
   */
  const handleOpenNotificationSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      toast.show({
        description: t('settings.openSystemSettingsFailed'),
        placement: 'top',
      });
    }
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // Stvarno stanje dozvole iz sistema.
      try {
        const permission = await Notifications.getPermissionsAsync();
        if (!cancelled) {
          setPermissionStatus(permission.status);
        }
      } catch {
        if (!cancelled) {
          setPermissionStatus(null);
        }
      }

      // Stvarno stanje preferencije s backenda — ne pretpostavljamo `true`.
      try {
        const preferences = await apiClient.getNotificationPreferences();
        if (cancelled) {
          return;
        }
        const gas = Array.isArray(preferences)
          ? preferences.find(
              (p: { type?: string; enabled?: boolean }) =>
                p?.type === GAS_READING_REMINDER_TYPE
            )
          : undefined;
        setDailyGasReminder(Boolean(gas?.enabled));
      } catch {
        // Bez backenda ostajemo na `false`: prikazati „uključeno" kad nije
        // bilo bi isto laganje koje je ovaj nalaz i opisao.
      } finally {
        if (!cancelled) {
          setIsLoadingGasReminder(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const resetPasswordFields = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  /**
   * MO2-16 (MO-020): stvarno čišćenje keša.
   *
   * Prije ove izmjene `onPress` je bio `console.log('Clear cache')` — dugme je
   * bilo potpuno inertno, pa korisnik nije mogao ni osloboditi prostor ni
   * ukloniti preuzete fakture i slike brojila iz nešifriranog cachea.
   *
   * Briše se ISTI direktorij koji puni `GasReadingsScreen`, jer putanju daje
   * dijeljeni servis `downloadCache`. Da svako mjesto gradi putanju samo,
   * postavke bi brisale nešto drugo nego što ekran puni.
   */
  const handleClearCache = async () => {
    try {
      const { deletedFiles } = await purgeDownloadsDirectory();
      toast.show({
        description:
          deletedFiles > 0
            ? t('settings.clearCacheSuccess')
            : t('settings.clearCacheEmpty'),
        placement: 'top',
      });
    } catch {
      toast.show({
        description: t('settings.clearCacheError'),
        placement: 'top',
      });
    }
  };

  /**
   * MO2-16 (MO-019): „Export data" je bio `console.log('Export data')` — inertno
   * dugme koje nije radilo ništa.
   *
   * PRIV-1 (backend izvoz/brisanje podataka naloga) NE postoji: provjereno
   * 2026-10-30, `backend/src/modules/Auth/auth.controller.ts` nema nijednu rutu
   * za izvoz ili brisanje naloga. Zato se ovdje NE izmišlja endpoint.
   *
   * Umjesto toga korisnik se vodi na postojeći, već implementiran izvoz u
   * Analitici (`analyticsApi.exportAnalytics` → `GET /api/dashboard/export`,
   * vraća CSV — `AnalyticsScreen.tsx` `handleExport`). Kad PRIV-1 bude
   * implementiran, ovaj handler se preusmjerava na njega.
   */
  const handleExportData = () => {
    toast.show({
      description: t('settings.exportRedirect'),
      placement: 'top',
    });
    // `useNavigation()` bez generika vraća prazan `ReactNavigation.RootParamList`,
    // pa TypeScript ne može razriješiti overload za UGNIJEŽĐENU navigaciju
    // (tab → stack → ekran) i prijavljuje TS2345. To je isti razlog zašto
    // `notificationService.ts:25` drži `NavigationContainerRef<any>`.
    //
    // Cast je namjerno uzak i lokaliziran na ovaj poziv — potpis ispod opisuje
    // stvarni oblik ugniježdenog navigate-a, a ne `any`.
    const navigateNested = navigation.navigate as (
      name: string,
      params?: Record<string, unknown>
    ) => void;
    navigateNested(ROOT_SCREENS.Main, {
      screen: MAIN_TAB_SCREENS.Dashboard,
      params: { screen: DASHBOARD_STACK_SCREENS.Analytics },
    });
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
                {/**
                  * MO2-6 (MO-008): ovdje su prije bila DVA prekidača
                  * (`notificationsEnabled` i `pushEnabled`) koja su bila čisti
                  * `useState(true)` — nisu zvala backend, nisu perzistirala i
                  * nisu se mogla vratiti u isto stanje nakon izlaska iz ekrana.
                  *
                  * Nijedan od njih nema parnjaka na backendu: `NotificationType`
                  * enum nema „master" prekidač, a dozvolu za obavijesti dodjeljuje
                  * OS, ne aplikacija. Zato se umjesto lažnog prekidača prikazuje
                  * STVARNO stanje dozvole i nudi put do sistemskih postavki.
                  */}
                <SettingItem
                  icon="notifications-outline"
                  title={t('settings.notificationsEnabled')}
                  subtitle={
                    permissionStatus === 'granted'
                      ? t('settings.notificationPermissionGranted')
                      : t('settings.notificationPermissionDenied')
                  }
                  onPress={handleOpenNotificationSettings}
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
                      // Dok se stanje s backenda ne učita, prekidač je onemogućen:
                      // prikazati bilo koju vrijednost prije toga bilo bi pogađanje.
                      isDisabled={isLoadingGasReminder}
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
                onPress={handleExportData}
              />
              <Divider />
              <SettingItem
                icon="trash-outline"
                title={t('settings.clearCache')}
                subtitle={t('settings.clearCacheDesc')}
                onPress={handleClearCache}
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
                subtitle={getAppVersion()}
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
