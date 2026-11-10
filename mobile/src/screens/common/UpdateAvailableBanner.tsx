import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Button, Text } from '../../ui';
import { useTranslation } from '../../hooks/useTranslation';
import { useTokens } from '../../ui/theme';
import { space } from '../../theme/tokens';
import { releaseDownloadUrl, type AppReleaseInfo } from '../../config/version.config';

/**
 * `F15`: trajna traka „dostupna je nova verzija" kad aplikacija još smije raditi.
 *
 * Za razliku od `UpdateRequiredScreen`, ovo **ne** blokira aplikaciju — verzija
 * je još podržana. Ali se i ne zatvara sama i nema „×": korisnik koji je jednom
 * odložio mora i dalje vidjeti da postoji novija verzija. Traka je niska i
 * odvojena od sadržaja, pa ne prekriva ekran.
 */
export const UpdateAvailableBanner: React.FC<{ release: AppReleaseInfo }> = ({ release }) => {
  const { t } = useTranslation();
  const { t: tokens } = useTokens();

  const openDownload = async () => {
    try {
      await Linking.openURL(releaseDownloadUrl(release));
    } catch {
      // Bez browsera nema šta dalje; traka ostaje da podsjeća.
    }
  };

  return (
    <View
      style={[styles.wrap, { backgroundColor: tokens.panel, borderColor: tokens.lineStrong }]}
      testID="update-available-banner"
    >
      <View style={styles.text}>
        <Text size="meta" tone="muted">
          {t('update.optionalTitle')}
        </Text>
        <Text size="meta" tone="muted">
          {t('update.availableVersion')}: {release.version}
        </Text>
      </View>
      <Button
        label={t('update.downloadButton')}
        variant="secondary"
        onPress={() => void openDownload()}
        testID="update-available-download"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    // Apsolutno pri dnu: ne mijenja layout navigacije, pa nijedan ekran ne
    // iskače iz svog rasporeda zbog trake.
    position: 'absolute',
    left: space.sm,
    right: space.sm,
    bottom: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: { flexShrink: 1, gap: 2 },
});
