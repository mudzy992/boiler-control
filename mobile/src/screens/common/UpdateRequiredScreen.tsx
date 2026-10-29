import React from 'react';
import { Box, VStack, Heading, Text, Button, useColorModeValue } from 'native-base';
import { Linking } from 'react-native';
import Constants from 'expo-constants';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * MO2-2: blokador za zastarjele verzije.
 *
 * Prikazuje se UMJESTO cijele navigacije (ne kao overlay iznad nje), pa
 * korisnik ne može zaobići gate back dugmetom ni deep linkom.
 */

/**
 * Android-only distribucija (iOS build je ukinut), pa postoji samo Play Store
 * link. Namjerno nema iOS grane: mrtva grana bi sugerirala da iOS build
 * postoji, a `IOS_APP_STORE_ID` ionako nikad nije bio poznat iz repoa.
 */
function getStoreUrl(): string | null {
  const pkg = Constants.expoConfig?.android?.package;
  return pkg ? `market://details?id=${pkg}` : null;
}

type UpdateRequiredScreenProps = {
  currentVersion: string;
  minSupportedVersion: string | null;
};

export const UpdateRequiredScreen: React.FC<UpdateRequiredScreenProps> = ({
  currentVersion,
  minSupportedVersion,
}) => {
  const { t } = useTranslation();
  const bgColor = useColorModeValue('gray.50', 'dark.900');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const subtextColor = useColorModeValue('gray.600', 'gray.400');

  const storeUrl = getStoreUrl();

  const openStore = async () => {
    if (!storeUrl) return;
    try {
      await Linking.openURL(storeUrl);
    } catch {
      // Trgovina nije dostupna (npr. bez Play Storea) — korisnik već vidi
      // uputstvo, pa nema smisla dodatno ga uznemiravati.
    }
  };

  return (
    <Box flex={1} bg={bgColor} px={6} py={10} justifyContent="center">
      <VStack space={5} alignItems="center">
        <MaterialCommunityIcons name="update" size={56} color="#f59e0b" />

        <Heading size="md" color={textColor} textAlign="center">
          {t('update.title')}
        </Heading>

        <Text color={subtextColor} textAlign="center" fontSize="sm">
          {t('update.body')}
        </Text>

        <VStack
          space={1}
          bg={useColorModeValue('white', 'dark.800')}
          px={4}
          py={3}
          borderRadius="md"
          w="100%"
        >
          <Text fontSize="xs" color={subtextColor}>
            {t('update.currentVersion')}: {currentVersion}
          </Text>
          {minSupportedVersion ? (
            <Text fontSize="xs" color={subtextColor}>
              {t('update.requiredVersion')}: {minSupportedVersion}
            </Text>
          ) : null}
        </VStack>

        {storeUrl ? (
          <Button
            bg="brand.400"
            _pressed={{ bg: 'brand.500' }}
            onPress={() => void openStore()}
            accessibilityLabel={t('update.updateButton')}
          >
            {t('update.updateButton')}
          </Button>
        ) : (
          <Text color={subtextColor} textAlign="center" fontSize="xs" italic>
            {t('update.manualHint')}
          </Text>
        )}
      </VStack>
    </Box>
  );
};
