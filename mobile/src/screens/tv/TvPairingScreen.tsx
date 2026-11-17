import { useState } from 'react';
import { View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';

import { apiClient } from '../../services/api/client';
import { useTranslation } from '../../hooks/useTranslation';
import { FormInput } from '../../components/FormInput';
import {
  Button,
  InlineBanner,
  MonoMeta,
  Panel,
  PanelRow,
  Screen,
  ScreenBody,
  ScreenHeader,
  Section,
  Text,
} from '../../ui';
import { space } from '../../theme/tokens';
import { parseTvPairingCode } from './pairingCode';

/**
 * F16 — telefon odobrava prijavu TV-a.
 *
 * **Dva načina unosa, isti sigurni tok.** Telefon može skenirati QR kod sa
 * TV-a ili ručno unijeti osam znakova. Ručni unos ostaje dostupan kad korisnik
 * odbije dozvolu za kameru, kamera je zauzeta ili QR nije čitljiv iz ugla.
 *
 * **Zašto odobrava telefon, a ne TV.** TV nema tastaturu za lozinku, a i da ima
 * — lozinka bi se kucala na uređaju koji vidi svako u sobi. Ovako TV dobije
 * jednokratni kod, a sesija se veže za korisnika **sa telefona**.
 */
export const TvPairingScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [approved, setApproved] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const openScanner = async () => {
    setScanError(null);
    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission();
      if (!permission.granted) {
        setScanError('tvPairing.cameraPermissionDenied');
        return;
      }
    }
    setScannerOpen(true);
  };

  const handleQrScanned = ({ data }: { data: string }) => {
    const scannedCode = parseTvPairingCode(data);
    if (!scannedCode) {
      setScanError('tvPairing.invalidQr');
      setScannerOpen(false);
      return;
    }
    setCode(scannedCode);
    setScanError(null);
    setScannerOpen(false);
  };

  const approveMutation = useMutation({
    mutationFn: (value: string) => apiClient.approveTvPairing(value),
    onSuccess: () => {
      setApproved(true);
      void queryClient.invalidateQueries({ queryKey: ['tv-pairing-devices'] });
    },
  });

  const normalized = parseTvPairingCode(code);
  /*
   * Dužina i abeceda su uslov za dugme: ne šaljemo kod koji backend sigurno
   * odbija. Isti parser validira ručni unos i skenirani QR.
   */
  const canSubmit = normalized !== null;

  const submit = () => {
    if (!normalized) return;
    approveMutation.mutate(normalized);
  };

  return (
    <Screen edges={['top']} testID="tv-pairing-screen">
      <ScreenHeader
        title={t('tvPairing.title')}
        subtitle={t('tvPairing.subtitle')}
        onBack={() => (navigation as any).goBack()}
        backLabel={t('common.back')}
        testID="tv-pairing-header"
      />

      <ScreenBody>
        {approved ? (
          <InlineBanner
            tone="ok"
            title={t('tvPairing.approvedTitle')}
            message={t('tvPairing.approvedBody')}
          />
        ) : null}

        {approveMutation.isError ? (
          <InlineBanner
            tone="fault"
            title={t('tvPairing.errorTitle')}
            message={t('tvPairing.errorBody')}
          />
        ) : null}

        {scanError ? (
          <InlineBanner
            tone="fault"
            title={t('tvPairing.errorTitle')}
            message={t(scanError)}
          />
        ) : null}

        <Section label={t('tvPairing.enterCode')}>
          <Panel variant="flush" padded={false}>
            <PanelRow divider={false}>
              <View style={{ width: '100%', gap: space.sm }}>
                <MonoMeta>{t('tvPairing.codeLabel')}</MonoMeta>
                <FormInput
                  accessibilityLabel={t('tvPairing.codeLabel')}
                  value={code}
                  onChangeText={(value) => {
                    setCode(value);
                    setScanError(null);
                    if (approveMutation.isError) approveMutation.reset();
                  }}
                  placeholder="ABCD-2345"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={9}
                  testID="tv-pairing-code"
                  /*
                   * `oneTimeCode` sprječava da iOS/Android ponude autofill
                   * lozinke iz keša — kod nije lozinka i ne smije u keš.
                   */
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                />
                <MonoMeta>{t('tvPairing.hint')}</MonoMeta>
              </View>
            </PanelRow>
          </Panel>
          <Text size="meta" tone="dim" style={{ marginTop: space.sm, marginBottom: space.sm }}>
            {t('tvPairing.orScan')}
          </Text>
          {scannerOpen ? (
            <View style={{ overflow: 'hidden', borderRadius: 4 }}>
              <CameraView
                testID="tv-pairing-camera"
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={handleQrScanned}
                style={{ width: '100%', height: 260 }}
              />
              <Button
                label={t('tvPairing.closeScanner')}
                variant="secondary"
                block
                onPress={() => setScannerOpen(false)}
                testID="tv-pairing-close-scanner"
              />
            </View>
          ) : (
            <Button
              label={t('tvPairing.scanQr')}
              variant="secondary"
              block
              onPress={() => void openScanner()}
              testID="tv-pairing-scan"
            />
          )}
        </Section>

        <Button
          label={t('tvPairing.approve')}
          onPress={submit}
          block
          disabled={!canSubmit || approveMutation.isPending}
          loading={approveMutation.isPending}
          testID="tv-pairing-approve"
        />

        {/*
         * Odbijanje je namjerno **odvojeno** dugme, ne „nazad": odbijanje
         * prekida TV koji čeka, pa mora biti svjesna radnja, a ne posljedica
         * slučajnog povratka.
         */}
        {!approved ? (
          <Button
            label={t('tvPairing.clear')}
            variant="ghost"
            block
            onPress={() => approveMutation.reset()}
            testID="tv-pairing-clear"
          />
        ) : null}

        <Text size="meta" tone="dim">
          {t('tvPairing.securityNote')}
        </Text>
      </ScreenBody>
    </Screen>
  );
};
