import React from 'react';
import {
  Box,
  VStack,
  Heading,
  Text,
  Button,
  useColorModeValue,
} from '../../components/ui/nativewind';
import { Linking } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from '../../hooks/useTranslation';
import { releaseDownloadUrl, type AppReleaseInfo } from '../../config/version.config';

/**
 * MO2-2 / `F15`: blokador i ponuda ažuriranja.
 *
 * Prikazuje se UMJESTO cijele navigacije (ne kao overlay iznad nje), pa
 * korisnik ne može zaobići gate back dugmetom ni deep linkom.
 *
 * `F15` mijenja **izvor** ažuriranja: nema Play Store-a. APK stoji na našem
 * serveru i skida se običnim linkom, pa poruka mora objasniti šta Android
 * traži od korisnika (dozvola za nepoznati izvor i potvrda instalacije).
 * Poruka se **ne zatvara sama** i nema „kasnije" dugme: to je namjerno, jer
 * blokirana verzija ne smije ostaviti korisnika bez puta dalje.
 */

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

type UpdateRequiredScreenProps = {
  currentVersion: string;
  minSupportedVersion: string | null;
  /** Release koji se nudi; `null` kad nema objavljenog APK-a. */
  release?: AppReleaseInfo | null;
  /**
   * `false` = blokada (verzija više nije podržana), `true` = samo ponuda
   * (novija verzija postoji, ali ova još radi).
   */
  optional?: boolean;
};

const UpdateRequiredScreenContent: React.FC<UpdateRequiredScreenProps> = ({
  currentVersion,
  minSupportedVersion,
  release = null,
  optional = false,
}) => {
  const { t } = useTranslation();
  const bgColor = useColorModeValue('gray.50', 'dark.900');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const subtextColor = useColorModeValue('gray.600', 'gray.400');
  const cardColor = useColorModeValue('white', 'dark.800');

  const openDownload = async () => {
    if (!release) return;
    try {
      // `Linking.openURL` predaje link browseru/Download Manageru. Samo
      // preuzimanje je interaktivno — Android traži potvrdu instalacije, i to
      // je jedino mjesto gdje korisnik može odustati.
      await Linking.openURL(releaseDownloadUrl(release));
    } catch {
      // Bez browsera nema šta dalje; uputstvo ispod ostaje vidljivo.
    }
  };

  return (
    <Box flex={1} bg={bgColor} px={6} py={10} justifyContent="center">
      <VStack space={5} alignItems="center">
        <MaterialCommunityIcons name="update" size={56} color="#f59e0b" />

        <Heading size="md" color={textColor} textAlign="center">
          {optional ? t('update.optionalTitle') : t('update.title')}
        </Heading>

        <Text color={subtextColor} textAlign="center" fontSize="sm">
          {optional ? t('update.optionalBody') : t('update.body')}
        </Text>

        <VStack space={1} bg={cardColor} px={4} py={3} borderRadius="md" w="100%">
          <Text fontSize="xs" color={subtextColor}>
            {t('update.currentVersion')}: {currentVersion}
          </Text>
          {minSupportedVersion ? (
            <Text fontSize="xs" color={subtextColor}>
              {t('update.requiredVersion')}: {minSupportedVersion}
            </Text>
          ) : null}
          {release ? (
            <Text fontSize="xs" color={subtextColor}>
              {t('update.availableVersion')}: {release.version}
              {formatSize(release.sizeBytes) ? ` · ${formatSize(release.sizeBytes)}` : ''}
            </Text>
          ) : null}
        </VStack>

        {release?.notes ? (
          <Text color={subtextColor} textAlign="center" fontSize="xs">
            {release.notes}
          </Text>
        ) : null}

        {release ? (
          <Button
            bg="brand.400"
            _pressed={{ bg: 'brand.500' }}
            onPress={() => void openDownload()}
            accessibilityLabel={t('update.downloadButton')}
          >
            {t('update.downloadButton')}
          </Button>
        ) : null}

        {/*
          Uputstvo je dio poruke, a ne tooltip: korisnik koji prvi put skida APK
          van trgovine mora znati da će Android tražiti dozvolu za nepoznati
          izvor i da preuzimanje traži njegovu potvrdu.
        */}
        <VStack space={2} w="100%" px={1}>
          <Text color={subtextColor} fontSize="xs">
            {t('update.instructionsTitle')}
          </Text>
          <Text color={subtextColor} fontSize="xs">
            1. {t('update.instructionsDownload')}
          </Text>
          <Text color={subtextColor} fontSize="xs">
            2. {t('update.instructionsUnknownSource')}
          </Text>
          <Text color={subtextColor} fontSize="xs">
            3. {t('update.instructionsInstall')}
          </Text>
        </VStack>

        {!release ? (
          <Text color={subtextColor} textAlign="center" fontSize="xs" italic>
            {t('update.manualHint')}
          </Text>
        ) : null}
      </VStack>
    </Box>
  );
};

export const UpdateRequiredScreen = UpdateRequiredScreenContent;
