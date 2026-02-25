import React, { useEffect, useState } from 'react';
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
  useToast,
  Spinner,
} from 'native-base';
import { useAuth } from '../../hooks/useAuth';
import { FormInput } from '../../components/FormInput';
import { apiClient } from '../../services/api/client';

const VAT_RATE = 0.17;

export const ProfileScreen = () => {
  const { user, logout, setUser } = useAuth();
  const { colorMode, toggleColorMode } = useColorMode();
  const toast = useToast();

  const [name, setName] = useState(user?.name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [homeLocation, setHomeLocation] = useState('');
  const [gasPriceExVat, setGasPriceExVat] = useState('');
  const [gasPriceSource, setGasPriceSource] = useState<string | null>(null);
  const [gasPriceLastUpdatedAt, setGasPriceLastUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const bgColor = useColorModeValue('gray.50', 'dark.900');
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
      } catch (error) {
        toast.show({
          description: 'Failed to load profile',
          placement: 'top',
        });
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
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
        description: 'Profile updated',
        placement: 'top',
      });
    } catch (error: any) {
      toast.show({
        description: error?.response?.data?.message || 'Failed to update profile',
        placement: 'top',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const gasPriceIncVat =
    gasPriceExVat && !Number.isNaN(Number(gasPriceExVat))
      ? Number(gasPriceExVat) * (1 + VAT_RATE)
      : null;

  if (loading) {
    return (
      <Box flex={1} bg={bgColor} safeArea alignItems="center" justifyContent="center">
        <Spinner />
      </Box>
    );
  }

  return (
    <Box flex={1} bg={bgColor} safeArea>
      <VStack flex={1} px={4} py={6} space={4}>
        <Heading size="xl" color={textColor}>
          Profile
        </Heading>

        <Box bg={cardBg} rounded="xl" shadow={2} p={4}>
          <VStack space={3}>
            <Text fontSize="md" fontWeight="semibold" color={textColor}>
              Account
            </Text>
            <Divider />
            <VStack space={3}>
              <Box>
                <Text fontSize="xs" color={subtextColor} mb={1}>
                  Email
                </Text>
                <FormInput value={user?.email || ''} isDisabled />
              </Box>
              <Box>
                <Text fontSize="xs" color={subtextColor} mb={1}>
                  Name
                </Text>
                <FormInput value={name} onChangeText={setName} />
              </Box>
              <Box>
                <Text fontSize="xs" color={subtextColor} mb={1}>
                  Username
                </Text>
                <FormInput
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </Box>
              <Box>
                <Text fontSize="xs" color={subtextColor} mb={1}>
                  Home Location
                </Text>
                <FormInput value={homeLocation} onChangeText={setHomeLocation} />
              </Box>
            </VStack>
          </VStack>
        </Box>

        <Box bg={cardBg} rounded="xl" shadow={2} p={4}>
          <VStack space={3}>
            <Text fontSize="md" fontWeight="semibold" color={textColor}>
              Gas Price
            </Text>
            <Divider />
            <Box>
              <Text fontSize="xs" color={subtextColor} mb={1}>
                Price per m³ (ex VAT)
              </Text>
              <FormInput
                value={gasPriceExVat}
                onChangeText={setGasPriceExVat}
                keyboardType="decimal-pad"
              />
            </Box>
            <HStack justifyContent="space-between">
              <Text fontSize="sm" color={subtextColor}>
                VAT rate
              </Text>
              <Text fontSize="sm" color={textColor}>
                17%
              </Text>
            </HStack>
            <HStack justifyContent="space-between">
              <Text fontSize="sm" color={subtextColor}>
                Price per m³ (inc VAT)
              </Text>
              <Text fontSize="sm" color={textColor} fontWeight="600">
                {gasPriceIncVat !== null ? gasPriceIncVat.toFixed(4) : '—'}
              </Text>
            </HStack>
            <HStack justifyContent="space-between">
              <Text fontSize="sm" color={subtextColor}>
                Last update
              </Text>
              <Text fontSize="sm" color={textColor}>
                {gasPriceLastUpdatedAt
                  ? new Date(gasPriceLastUpdatedAt).toLocaleDateString()
                  : '—'}
              </Text>
            </HStack>
            <HStack justifyContent="space-between">
              <Text fontSize="sm" color={subtextColor}>
                Source
              </Text>
              <Text fontSize="sm" color={textColor}>
                {gasPriceSource || '—'}
              </Text>
            </HStack>
          </VStack>
        </Box>

        <Box bg={cardBg} rounded="xl" shadow={2} p={4}>
          <VStack space={3}>
            <Text fontSize="md" fontWeight="semibold" color={textColor}>
              Appearance
            </Text>
            <Divider />
            <HStack alignItems="center" justifyContent="space-between">
              <Text fontSize="md" color={textColor}>
                Dark Mode
              </Text>
              <Switch
                isChecked={colorMode === 'dark'}
                onToggle={toggleColorMode}
                colorScheme="brand"
              />
            </HStack>
          </VStack>
        </Box>

        <Button onPress={handleSave} isLoading={saving}>
          Save Profile
        </Button>

        <Button onPress={handleLogout} colorScheme="red" variant="outline">
          Sign Out
        </Button>
      </VStack>
    </Box>
  );
};
