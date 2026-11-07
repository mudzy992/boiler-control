import { useEffect, useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  useColorModeValue,
  Switch,
  Button,
  Divider,
  useColorMode,
  useToast,
  ScrollView,
} from '../../components/ui/nativewind';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { FormInput } from '../../components/FormInput';
import { apiClient } from '../../services/api/client';
import { Screen, ScreenHeader, SkeletonPanel } from '../../ui';

const VAT_RATE = 0.17;

const ProfileScreenContent = () => {
  const { user, logout, setUser } = useAuth();
  const { colorMode, toggleColorMode } = useColorMode();
  const toast = useToast();
  const { t } = useTranslation();
  const navigation = useNavigation();

  const [name, setName] = useState(user?.name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [homeLocation, setHomeLocation] = useState('');
  const [gasPriceExVat, setGasPriceExVat] = useState('');
  const [gasPriceSource, setGasPriceSource] = useState<string | null>(null);
  const [gasPriceLastUpdatedAt, setGasPriceLastUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const cardBg = useColorModeValue('white', 'dark.800');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const subtextColor = useColorModeValue('gray.600', 'gray.400');

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profile = await apiClient.getUserProfile();
        setName(profile?.name || '');
        setUsername(profile?.username || '');
        setHomeLocation(profile?.homeLocation || '');
        setGasPriceExVat(
          profile?.gasPriceExVat !== null &&
            profile?.gasPriceExVat !== undefined
            ? String(profile.gasPriceExVat)
            : '',
        );
        setGasPriceSource(profile?.gasPriceSource ?? null);
        setGasPriceLastUpdatedAt(profile?.gasPriceLastUpdatedAt ?? null);
      } catch {
        // F1: prije je ovdje bila engleska string konstanta.
        toast.show({
          description: t('profile.loadError'),
          placement: 'top',
        });
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
    // Namjerno bez `t` u zavisnostima: `useTranslation` vraća novu funkciju na
    // svaki render tokom promjene jezika, pa bi `t` ovdje vrtio efekat u
    // beskonačno (i ponavljao `getUserProfile`). Postoji test koji to čuva
    // ("saves once without retriggering the toast-dependent profile effect").
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const parsedGasPrice =
        gasPriceExVat.trim().length > 0 ? Number(gasPriceExVat) : undefined;

      await apiClient.updateUserProfile({
        name: name || undefined,
        username: username || undefined,
        homeLocation: homeLocation || undefined,
        gasPriceExVat:
          parsedGasPrice !== undefined && !Number.isNaN(parsedGasPrice)
            ? parsedGasPrice
            : undefined,
      });

      const updatedProfile = await apiClient.getUserProfile();
      setGasPriceSource(updatedProfile?.gasPriceSource ?? null);
      setGasPriceLastUpdatedAt(updatedProfile?.gasPriceLastUpdatedAt ?? null);
      setUser({
        ...user,
        ...updatedProfile,
      });

      toast.show({
        description: t('profile.updateSuccess'),
        placement: 'top',
      });
    } catch (error: any) {
      toast.show({
        description: error?.response?.data?.message || t('profile.updateError'),
        placement: 'top',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // F4: odjava je lokalna operacija; greška se ne prikazuje korisniku jer
      // nema radnje koju može preduzeti, a `console.error` je bio mrtav kod.

    }
  };

  const gasPriceIncVat =
    gasPriceExVat && !Number.isNaN(Number(gasPriceExVat))
      ? Number(gasPriceExVat) * (1 + VAT_RATE)
      : null;

  if (loading) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader
          title={t('profile.title')}
          onBack={() => (navigation as any).goBack()}
          backLabel={t('common.back')}
          testID="profile-header"
        />
        {/* F4 (UX-07): skeleton u obliku formi, umjesto praznog ekrana sa spinnerom. */}
        <Box px={4} pt={3} style={{ gap: 12 }}>
          <SkeletonPanel lines={3} height={120} />
          <SkeletonPanel lines={2} height={110} />
        </Box>
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title={t('profile.title')}
        subtitle={user?.email ?? undefined}
        onBack={() => (navigation as any).goBack()}
        backLabel={t('common.back')}
        testID="profile-header"
      />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <VStack flex={1} px={4} py={4} space={4}>
          <Box bg={cardBg} rounded="xl" p={4}>
            <VStack space={3}>
              <Text fontSize="md" fontWeight="semibold" color={textColor}>
                {t('profile.accountSection')}
              </Text>
              <Divider />
              <VStack space={3}>
                <Box>
                  <Text fontSize="xs" color={subtextColor} mb={1}>
                    {t('profile.email')}
                  </Text>
                  <FormInput
                    value={user?.email || ''}
                    isDisabled
                    accessibilityLabel={t('profile.email')}
                    accessibilityHint={t('profile.emailReadOnly')}
                  />
                </Box>
                <Box>
                  <Text fontSize="xs" color={subtextColor} mb={1}>
                    {t('profile.name')}
                  </Text>
                  <FormInput
                    value={name}
                    onChangeText={setName}
                    accessibilityLabel={t('profile.name')}
                  />
                </Box>
                <Box>
                  <Text fontSize="xs" color={subtextColor} mb={1}>
                    {t('profile.username')}
                  </Text>
                  <FormInput
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                    accessibilityLabel={t('profile.username')}
                  />
                </Box>
                <Box>
                  <Text fontSize="xs" color={subtextColor} mb={1}>
                    {t('profile.homeLocation')}
                  </Text>
                  <FormInput
                    value={homeLocation}
                    onChangeText={setHomeLocation}
                    accessibilityLabel={t('profile.homeLocation')}
                  />
                </Box>
              </VStack>
            </VStack>
          </Box>

          <Box bg={cardBg} rounded="xl" p={4}>
            <VStack space={3}>
              <Text fontSize="md" fontWeight="semibold" color={textColor}>
                {t('profile.gasPriceSection')}
              </Text>
              <Divider />
              <Box>
                <Text fontSize="xs" color={subtextColor} mb={1}>
                  {t('profile.priceExVat')}
                </Text>
                <FormInput
                  value={gasPriceExVat}
                  onChangeText={setGasPriceExVat}
                  keyboardType="decimal-pad"
                  accessibilityLabel={t('profile.priceExVat')}
                />
              </Box>
              <HStack justifyContent="space-between">
                <Text fontSize="sm" color={subtextColor}>
                  {t('profile.vatRate')}
                </Text>
                <Text fontSize="sm" color={textColor}>
                  17%
                </Text>
              </HStack>
              <HStack justifyContent="space-between">
                <Text fontSize="sm" color={subtextColor}>
                  {t('profile.priceIncVat')}
                </Text>
                <Text fontSize="sm" color={textColor} fontWeight="600">
                  {gasPriceIncVat !== null ? gasPriceIncVat.toFixed(4) : '—'}
                </Text>
              </HStack>
              <HStack justifyContent="space-between">
                <Text fontSize="sm" color={subtextColor}>
                  {t('profile.lastUpdate')}
                </Text>
                <Text fontSize="sm" color={textColor}>
                  {gasPriceLastUpdatedAt
                    ? new Date(gasPriceLastUpdatedAt).toLocaleDateString()
                    : '—'}
                </Text>
              </HStack>
              <HStack justifyContent="space-between">
                <Text fontSize="sm" color={subtextColor}>
                  {t('profile.source')}
                </Text>
                <Text fontSize="sm" color={textColor}>
                  {gasPriceSource || '—'}
                </Text>
              </HStack>
            </VStack>
          </Box>

          <Box bg={cardBg} rounded="xl" p={4}>
            <VStack space={3}>
              <Text fontSize="md" fontWeight="semibold" color={textColor}>
                {t('profile.appearanceSection')}
              </Text>
              <Divider />
              <HStack alignItems="center" justifyContent="space-between">
                <Text fontSize="md" color={textColor}>
                  {t('profile.darkMode')}
                </Text>
                <Switch
                  isChecked={colorMode === 'dark'}
                  onToggle={toggleColorMode}
                  colorScheme="brand"
                  accessibilityLabel={t('profile.darkMode')}
                />
              </HStack>
            </VStack>
          </Box>

          <Button onPress={handleSave} isLoading={saving}>
            {t('profile.saveProfile')}
          </Button>

          <Button onPress={handleLogout} colorScheme="red" variant="outline">
            {t('profile.signOut')}
          </Button>
        </VStack>
      </ScrollView>
    </Screen>
  );
};

export const ProfileScreen = ProfileScreenContent;
