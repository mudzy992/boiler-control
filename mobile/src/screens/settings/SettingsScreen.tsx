import React, { useState, useEffect } from 'react';
import { Linking, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import * as Sharing from 'expo-sharing';

import { getAppVersion } from '../../config/version.config';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
// MO2-16 (MO-020): stvarno čišćenje keša umjesto console.log.
import { purgeDownloadsDirectory } from '../../services/storage/downloadCache';
import { createAccountExportFile } from '../../services/storage/accountExport';
import { AppStorage } from '../../services/storage/AppStorage';
import { apiClient } from '../../services/api/client';
import { FormInput } from '../../components/FormInput';
import { useColorMode, Switch, useToast } from '../../components/ui/nativewind';
import {
  Button,
  MonoLabel,
  Panel,
  PanelRow,
  Pressable,
  Screen,
  ScreenBody,
  ScreenHeader,
  Section,
  Sheet,
  Text,
} from '../../ui';
import { space } from '../../theme/tokens';

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

/**
 * Postavke — jedna lista sekcija (prototip §06, nalaz UX-16).
 *
 * Prije: šest kartica, svaka sa `shadow={2}` i svojom uppercase trakom, plus
 * `SettingItem` koji je pozivao `useColorModeValue` UNUTAR JSX izraza
 * (`onPress ? useColorModeValue(...) : 'transparent'`). To je kršenje pravila
 * hookova: broj hookova po renderu mijenjao se sa propsima.
 *
 * Sada: `Section` labela + `Panel variant="flush"` sa `PanelRow` redovima, bez
 * ijedne sjene i bez ijednog hooka u uslovnom izrazu.
 */
const SettingsScreenContent = () => {
  const { user, logout } = useAuth();
  const { colorMode, toggleColorMode } = useColorMode();
  const navigation = useNavigation();
  const { t, i18n } = useTranslation();
  const toast = useToast();

  const [permissionStatus, setPermissionStatus] = useState<string | null>(null);
  const [dailyGasReminder, setDailyGasReminder] = useState(false);
  const [isLoadingGasReminder, setIsLoadingGasReminder] = useState(true);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isExportingAccount, setIsExportingAccount] = useState(false);

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
      toast.show({ description: t('settings.preferenceSaved'), placement: 'top' });
    } catch {
      setDailyGasReminder(previous);
      toast.show({ description: t('settings.preferenceSaveFailed'), placement: 'top' });
    }
  };

  const handleOpenNotificationSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      toast.show({ description: t('settings.openSystemSettingsFailed'), placement: 'top' });
    }
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // Stvarno stanje dozvole iz sistema.
      try {
        const permission = await Notifications.getPermissionsAsync();
        if (!cancelled) setPermissionStatus(permission.status);
      } catch {
        if (!cancelled) setPermissionStatus(null);
      }

      // Stvarno stanje preferencije s backenda — ne pretpostavljamo `true`.
      try {
        const preferences = await apiClient.getNotificationPreferences();
        if (cancelled) return;
        const gas = Array.isArray(preferences)
          ? preferences.find(
              (p: { type?: string; enabled?: boolean }) => p?.type === GAS_READING_REMINDER_TYPE,
            )
          : undefined;
        setDailyGasReminder(Boolean(gas?.enabled));
      } catch {
        // Bez backenda ostajemo na `false`: prikazati „uključeno" kad nije
        // bilo bi isto laganje koje je ovaj nalaz i opisao.
      } finally {
        if (!cancelled) setIsLoadingGasReminder(false);
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
   */
  const handleClearCache = async () => {
    try {
      const { deletedFiles } = await purgeDownloadsDirectory();
      toast.show({
        description:
          deletedFiles > 0 ? t('settings.clearCacheSuccess') : t('settings.clearCacheEmpty'),
        placement: 'top',
      });
    } catch {
      toast.show({ description: t('settings.clearCacheError'), placement: 'top' });
    }
  };

  /** PRIV-1B: preuzmi vlasnički JSON i podijeli ga bez logovanja sadržaja. */
  const exportInFlight = React.useRef(false);
  const handleExportData = () => {
    if (exportInFlight.current) return;
    exportInFlight.current = true;
    setIsExportingAccount(true);
    void (async () => {
      try {
        const fileUri = await createAccountExportFile();
        try {
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, {
              mimeType: 'application/json',
              dialogTitle: t('settings.exportData'),
              UTI: 'public.json',
            });
          } else {
            toast.show({ description: t('settings.exportSaved'), placement: 'top' });
            return;
          }
        } catch {
          // Datoteka je već potpuno zapisana; share greška ne mijenja taj ishod.
          toast.show({ description: t('settings.exportSaved'), placement: 'top' });
          return;
        }
        toast.show({ description: t('settings.exportReady'), placement: 'top' });
      } catch (error) {
        const status =
          typeof error === 'object' && error !== null && 'response' in error
            ? (error as { response?: { status?: unknown } }).response?.status
            : undefined;
        toast.show({
          description:
            status === 404
              ? t('settings.exportUnavailable')
              : status === 413
                ? t('settings.exportTooLarge')
                : t('settings.exportError'),
          placement: 'top',
        });
      } finally {
        exportInFlight.current = false;
        setIsExportingAccount(false);
      }
    })();
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.show({ description: t('settings.changePasswordRequired'), placement: 'top' });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.show({ description: t('auth.passwordsDontMatch'), placement: 'top' });
      return;
    }

    if (newPassword.length < 6) {
      toast.show({ description: t('auth.passwordTooShort'), placement: 'top' });
      return;
    }

    try {
      setIsChangingPassword(true);
      await apiClient.changePassword(currentPassword, newPassword);
      toast.show({ description: t('settings.changePasswordSuccess'), placement: 'top' });
      resetPasswordFields();
      setShowPasswordModal(false);
    } catch (error) {
      toast.show({
        description:
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          t('settings.changePasswordError'),
        placement: 'top',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  type RowProps = {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    title: string;
    subtitle?: string;
    onPress?: () => void;
    rightElement?: React.ReactNode;
    testID?: string;
  };

  const SettingRow = ({ icon, title, subtitle, onPress, rightElement, testID }: RowProps) => {
    const content = (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          flex: 1,
          minHeight: 44,
        }}
      >
        <Ionicons name={icon} size={17} color="#8a93a3" />
        <View style={{ flex: 1 }}>
          <Text size="bodyLg" weight="medium">
            {title}
          </Text>
          {subtitle ? (
            <Text size="meta" tone="muted" style={{ marginTop: 1 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {rightElement}
        {onPress ? <Ionicons name="chevron-forward" size={14} color="#6b7788" /> : null}
      </View>
    );

    return (
      <PanelRow
        divider
        testID={testID}
        accessibilityLabel={onPress ? `${title}${subtitle ? `. ${subtitle}` : ''}` : undefined}
        style={onPress ? undefined : { opacity: 0.85 }}
      >
        {onPress ? (
          <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>
            {content}
          </Pressable>
        ) : (
          content
        )}
      </PanelRow>
    );
  };

  return (
    <Screen edges={['top']} testID="settings-screen">
      <ScreenHeader title={t('settings.title')} testID="settings-header" />
      <ScreenBody>
        <Section label={t('settings.accountSection')}>
          <Panel variant="flush" padded={false}>
            <SettingRow
              icon="person-outline"
              title={user?.name || t('settings.profile')}
              subtitle={user?.email}
              onPress={() => (navigation as any).navigate('Profile')}
              testID="settings-profile"
            />
            <SettingRow
              icon="key-outline"
              title={t('settings.changePassword')}
              onPress={() => setShowPasswordModal(true)}
              testID="settings-change-password"
            />
          </Panel>
        </Section>

        <Section label={t('settings.appearanceSection')}>
          <Panel variant="flush" padded={false}>
            <SettingRow
              icon={colorMode === 'dark' ? 'moon' : 'sunny'}
              title={t('settings.darkMode')}
              subtitle={colorMode === 'dark' ? t('common.enabled') : t('common.disabled')}
              rightElement={
                <Switch
                  isChecked={colorMode === 'dark'}
                  onToggle={toggleColorMode}
                  size="sm"
                  accessibilityLabel={t('settings.darkMode')}
                />
              }
              testID="settings-dark-mode"
            />
            <SettingRow
              icon="language-outline"
              title={t('settings.language')}
              subtitle={languageLabel}
              onPress={() => setShowLanguageModal(true)}
              testID="settings-language"
            />
          </Panel>
        </Section>

        <Section label={t('settings.notificationsSection')}>
          <Panel variant="flush" padded={false}>
            {/**
             * MO2-6 (MO-008): ovdje su prije bila DVA prekidača
             * (`notificationsEnabled` i `pushEnabled`) koja su bila čisti
             * `useState(true)` — nisu zvala backend, nisu perzistirala i nisu se
             * mogla vratiti u isto stanje nakon izlaska iz ekrana. Sada se
             * prikazuje STVARNO stanje dozvole i nudi put do sistemskih postavki.
             */}
            <SettingRow
              icon="notifications-outline"
              title={t('settings.notificationsEnabled')}
              subtitle={
                permissionStatus === 'granted'
                  ? t('settings.notificationPermissionGranted')
                  : t('settings.notificationPermissionDenied')
              }
              onPress={handleOpenNotificationSettings}
            />
            <SettingRow
              icon="list-outline"
              title={t('settings.notifications')}
              subtitle={t('settings.notificationsDesc')}
              onPress={() => (navigation as any).navigate('Notifications')}
            />
            <SettingRow
              icon="settings-outline"
              title={t('settings.notificationPreferences')}
              subtitle={t('settings.notificationPreferencesDesc')}
              onPress={() => (navigation as any).navigate('NotificationPreferences')}
            />
            <SettingRow
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
                  accessibilityLabel={t('settings.dailyGasReminder')}
                />
              }
            />
          </Panel>
        </Section>

        <Section label={t('settings.homesSection')}>
          <Panel variant="flush" padded={false}>
            <SettingRow
              icon="home-outline"
              title={t('settings.manageHomes')}
              subtitle={t('settings.manageHomesDesc')}
              onPress={() => (navigation as any).navigate('HomeManagement')}
            />
            <SettingRow
              icon="calendar-outline"
              title={t('settings.heatingSchedules')}
              subtitle={t('settings.heatingSchedulesDesc')}
              onPress={() => (navigation as any).navigate('ScheduleManagement')}
            />
          </Panel>
        </Section>

        <Section label={t('settings.dataPrivacySection')}>
          <Panel variant="flush" padded={false}>
            <SettingRow
              icon="download-outline"
              title={t('settings.exportData')}
              subtitle={
                isExportingAccount ? t('settings.exportPreparing') : t('settings.exportDataDesc')
              }
              onPress={isExportingAccount ? undefined : handleExportData}
            />
            <SettingRow
              icon="trash-outline"
              title={t('settings.clearCache')}
              subtitle={t('settings.clearCacheDesc')}
              onPress={handleClearCache}
            />
          </Panel>
        </Section>

        <Section label={t('settings.aboutSection')}>
          <Panel variant="flush" padded={false}>
            <SettingRow
              icon="information-circle-outline"
              title={t('settings.version')}
              subtitle={getAppVersion()}
            />
            <SettingRow icon="help-circle-outline" title={t('settings.helpSupport')} />
            <SettingRow icon="document-text-outline" title={t('settings.termsPrivacy')} />
          </Panel>
        </Section>

        <Button label={t('common.logout')} variant="danger" block onPress={handleLogout} />
      </ScreenBody>

      <Sheet
        isOpen={showLanguageModal}
        onClose={() => setShowLanguageModal(false)}
        title={t('settings.language')}
        snapPoints={['45%', '60%']}
      >
        <View style={{ gap: space.sm }}>
          {(
            [
              { value: 'en-US', label: t('settings.languageEnglish') },
              { value: 'bs-BS', label: t('settings.languageBosnian') },
            ] as const
          ).map((option) => {
            const active = i18n.language === option.value;
            return (
              <Button
                key={option.value}
                label={option.label}
                variant={active ? 'primary' : 'secondary'}
                block
                onPress={() => void handleLanguageChange(option.value)}
                testID={`language-${option.value}`}
              />
            );
          })}
        </View>
      </Sheet>

      <Sheet
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          resetPasswordFields();
        }}
        title={t('settings.changePassword')}
        snapPoints={['55%', '85%']}
        scrollable
      >
        <View style={{ gap: space.md }}>
          {[
            { label: t('settings.currentPassword'), value: currentPassword, set: setCurrentPassword },
            { label: t('settings.newPassword'), value: newPassword, set: setNewPassword },
            {
              label: t('settings.confirmNewPassword'),
              value: confirmPassword,
              set: setConfirmPassword,
            },
          ].map((field) => (
            <View key={field.label} style={{ gap: 4 }}>
              <MonoLabel>{field.label}</MonoLabel>
              <FormInput
                value={field.value}
                onChangeText={field.set}
                secureTextEntry
                autoCapitalize="none"
                accessibilityLabel={field.label}
              />
            </View>
          ))}

          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
            <Button
              label={t('common.cancel')}
              variant="ghost"
              style={{ flex: 1 }}
              onPress={() => {
                setShowPasswordModal(false);
                resetPasswordFields();
              }}
            />
            <Button
              label={t('common.save')}
              style={{ flex: 1 }}
              loading={isChangingPassword}
              onPress={handleChangePassword}
            />
          </View>
        </View>
      </Sheet>
    </Screen>
  );
};

export const SettingsScreen = SettingsScreenContent;
