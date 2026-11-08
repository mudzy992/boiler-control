import React from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Switch, useToast } from '../../components/ui/nativewind';
import { apiClient } from '../../services/api/client';
import { formatDateRange } from '../../utils/format';
import { useTranslation } from '../../hooks/useTranslation';
import {
  InlineBanner,
  MonoLabel,
  MonoMeta,
  Panel,
  PanelRow,
  Screen,
  ScreenBody,
  ScreenHeader,
  SkeletonPanel,
  SkeletonRows,
  Text,
} from '../../ui';

interface NotificationPreference {
  id: number;
  userId: number;
  type: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Detaljni prolaz kroz Postavke obavijesti (F6, SET-08…SET-11).
 *
 * Šta je bilo pogrešno:
 *
 *  SET-08 · Ekran je koristio **12** `useColorModeValue` poziva i šest nijansi
 *    (`blue.50`, `dark.800`, `gray.600`…) — boje koje ne postoje u semantičkoj
 *    paleti i koje ne prate AA kontrast koji je uveden u F6. Sada `Panel`,
 *    `InlineBanner`, `MonoLabel`.
 *  SET-09 · Prekidač NIJE imao `accessibilityLabel`, pa je čitač ekrana
 *    izgovarao samo „uključeno/isključeno" bez ijedne riječi o tome šta se
 *    uključuje — šest identičnih prekidača u listi.
 *  SET-10 · Greška upita i greška spremanja nisu bile prikazane nikako: kad
 *    `PATCH` padne, prekidač se vrati na staro stanje i korisnik ne zna je li
 *    dodir promašio ili server odbio. Sada oba slučaja imaju poruku.
 *  SET-11 · `dayjs(updatedAt).format('DD.MM.YYYY HH:mm')` — hardkodiran format,
 *    isti razlog kao GAS-02; sada `utils/format`.
 *
 * Uz to: svaki red je dobio `PanelRow` okvir umjesto obojene kartice sa
 * `Divider`-om, pa lista ima isti ritam kao Postavke i Plin.
 */
const NotificationPreferencesScreenContent: React.FC = () => {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const toast = useToast();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => apiClient.getNotificationPreferences() as Promise<NotificationPreference[]>,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { type: string; enabled: boolean }) =>
      apiClient.updateNotificationPreference(payload.type, payload.enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
    },
    /*
     * SET-10: greška se prijavljuje. Bez ovoga `useMutation` tiho proguta
     * odbijanje, prekidač se vrati na staro stanje, a korisnik pomisli da je
     * pogrešno dodirnuo.
     */
    onError: () => {
      toast.show({ description: t('settings.preferenceSaveFailed'), placement: 'top' });
    },
  });

  const header = (
    <ScreenHeader
      title={t('notifications.preferences')}
      onBack={() => (navigation as any).goBack()}
      backLabel={t('common.back')}
      testID="notification-preferences-header"
    />
  );

  if (isLoading) {
    return (
      <Screen edges={['top']}>
        {header}
        {/* F4 (UX-07): skeleton u obliku liste prekidača. */}
        <ScreenBody>
          <SkeletonPanel lines={1} height={64} />
          <SkeletonRows count={4} />
        </ScreenBody>
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen edges={['top']}>
        {header}
        <ScreenBody>
          <InlineBanner
            tone="fault"
            title={t('notifications.preferencesLoadError')}
            message={t('notifications.preferencesLoadErrorBody')}
            action={{ label: t('common.retry'), onPress: () => void refetch() }}
            testID="notification-preferences-error"
          />
        </ScreenBody>
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} testID="notification-preferences-screen">
      {header}
      <ScreenBody testID="notification-preferences-body">
        <InlineBanner
          tone="info"
          title={t('notifications.preferencesInfo')}
          testID="notification-preferences-info"
        />

        <Panel variant="flush" padded={false}>
          {(data ?? []).map((pref, index) => (
            <PanelRow key={pref.id} divider={index < (data?.length ?? 0) - 1}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text size="bodyLg" weight="medium">
                    {t(`notifications.types.${pref.type}`, { defaultValue: pref.type })}
                  </Text>
                  <Text size="body" tone="muted">
                    {t(`notifications.typeDescriptions.${pref.type}`, {
                      defaultValue: t('notifications.preferencesDefaultDesc'),
                    })}
                  </Text>
                  {pref.updatedAt ? (
                    <MonoMeta>
                      {t('notifications.lastUpdated', {
                        date: formatDateRange(pref.updatedAt, pref.updatedAt).split(' – ')[0],
                      })}
                    </MonoMeta>
                  ) : null}
                </View>
                <Switch
                  isChecked={pref.enabled}
                  onToggle={() =>
                    updateMutation.mutate({ type: pref.type, enabled: !pref.enabled })
                  }
                  accessibilityLabel={`${t(`notifications.types.${pref.type}`, {
                    defaultValue: pref.type,
                  })}`}
                  testID={`notification-preference-${pref.type}`}
                />
              </View>
            </PanelRow>
          ))}
        </Panel>

        {!data?.length ? (
          <Panel variant="flush" padded={false}>
            <PanelRow divider={false}>
              <MonoLabel>{t('notifications.preferencesEmpty')}</MonoLabel>
            </PanelRow>
          </Panel>
        ) : null}
      </ScreenBody>
    </Screen>
  );
};

export const NotificationPreferencesScreen = NotificationPreferencesScreenContent;
