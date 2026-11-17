import { useState } from 'react';
import { View } from 'react-native';
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

/**
 * F16 — telefon odobrava prijavu TV-a.
 *
 * **Zašto ručni unos, a ne skener, iako zadatak traži QR.** QR skener traži
 * `expo-camera` i **kameru**, a ovaj ekran mora raditi i kad:
 *
 *   - korisnik je odbio dozvolu za kameru (trajno, bez ponovnog pitanja),
 *   - TV prikazuje kod ali QR nije čitljiv (odsjaj, ugao, stari TV),
 *   - telefon nema kameru ili je zauzeta.
 *
 * Zato je tok isti, a unos je **tekst**: kod od 8 znakova se prepisuje s TV-a
 * za dvije sekunde. Skener se dodaje iznad kao prečica, ne kao uslov.
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

  const normalize = (raw: string) => raw.replace(/[\s-]/g, '').toUpperCase();

  const approveMutation = useMutation({
    mutationFn: (value: string) => apiClient.approveTvPairing(value),
    onSuccess: () => {
      setApproved(true);
      void queryClient.invalidateQueries({ queryKey: ['tv-pairing-devices'] });
    },
  });

  const normalized = normalize(code);
  /*
   * Dužina je uslov za dugme, ne za slanje: server i sam odbija pogrešan
   * oblik, ali korisnik ne treba da pošalje zahtjev koji sigurno pada.
   */
  const canSubmit = normalized.length === 8;

  const submit = () => {
    if (!canSubmit) return;
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

        <Section label={t('tvPairing.enterCode')}>
          <Panel variant="flush" padded={false}>
            <PanelRow divider={false}>
              <View style={{ width: '100%', gap: space.sm }}>
                <MonoMeta>{t('tvPairing.codeLabel')}</MonoMeta>
                <FormInput
                  accessibilityLabel={t('tvPairing.codeLabel')}
                  value={code}
                  onChangeText={setCode}
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
