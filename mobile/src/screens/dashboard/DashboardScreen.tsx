import React from 'react';
import { RefreshControl, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';

import { getDashboard } from '../../api/dashboard.api';
import { apiClient } from '../../services/api/client';
import { useErrorHandler } from '../../services/api/error.handler';
import { useTranslation } from '../../hooks/useTranslation';
import {
  Button,
  GaugeBar,
  InlineBanner,
  Kpi,
  Led,
  MonoLabel,
  MonoMeta,
  Panel,
  PanelRow,
  Readout,
  Screen,
  ScreenBody,
  ScreenHeader,
  Section,
  Sheet,
  Skeleton,
  StatusDot,
  Text,
} from '../../ui';
import { useToast } from '../../components/ui/nativewind';
import { space } from '../../theme/tokens';
import { DASHBOARD_QUERY_KEY, DASHBOARD_HEALTH_QUERY_KEY } from '../../services/query/keys';
import {
  MIN_CURRENT_FLOW_TEMP,
  MAX_CURRENT_FLOW_TEMP,
  isWithinCurrentFlowTempRange,
} from '../../constants/boilerLimits';
import { AlertsCard } from '../../components/AlertsCard';
import { RecommendationBreakdown } from '../../components/RecommendationBreakdown';
import { WeatherV2Card } from '../../components/weather/WeatherV2Card';
import { TemperatureField, WeatherRow } from '../../components/WeatherRow';
import { WEATHER_UI_V2 } from '../../config/weather.config';

/**
 * Početna — instrument panel (prototip §02).
 *
 * Prije: osam kartica jedna pod drugom, svaka sa sjenom i svojim akcentom
 * (narandžasta akcija + plava „preporučeno" + zelena „stvarno"), pa korisnik ne
 * zna koji je broj glavni; zdravlje sistema i status kotla bili su dvije velike
 * kartice sa dva velika broja koja se takmiče za pažnju.
 *
 * Sada: jedan hero (polazna voda) + tri KPI pločice + liste redova. Nema sjena —
 * dubinu nosi hairline ivica, a akcent se troši samo na akciju i živo stanje.
 */

/** „1h 12m" iz ISO početka grijanja. */
function formatDuration(startIso: string): string {
  const start = new Date(startIso).getTime();
  if (!Number.isFinite(start)) return '—';
  const minutes = Math.max(0, Math.floor((Date.now() - start) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${String(minutes % 60).padStart(2, '0')}m`;
}

const scale = (value: number) =>
  (value - MIN_CURRENT_FLOW_TEMP) / (MAX_CURRENT_FLOW_TEMP - MIN_CURRENT_FLOW_TEMP);

export const DashboardScreen = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const { showError } = useErrorHandler();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [showSetTempSheet, setShowSetTempSheet] = React.useState(false);
  const [currentTempInput, setCurrentTempInput] = React.useState('');
  const [tempError, setTempError] = React.useState<string | null>(null);

  const {
    data: dashboardData,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: getDashboard,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
  });

  // MO2-12: health score and alerts are computed by the backend, not here.
  const healthQuery = useQuery({
    queryKey: DASHBOARD_HEALTH_QUERY_KEY,
    queryFn: () => apiClient.getDashboardHealth(),
    staleTime: 1000 * 60,
  });

  React.useEffect(() => {
    if (error) showError(error, t('dashboard.loadError'));
  }, [error, showError, t]);

  React.useEffect(() => {
    if (healthQuery.error) showError(healthQuery.error, t('dashboard.loadError'));
  }, [healthQuery.error, showError, t]);

  const setCurrentTempMutation = useMutation({
    mutationFn: async (temp: number) => apiClient.setBoilerCurrentTemp(temp),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: DASHBOARD_HEALTH_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ['gas-analysis'] }),
      ]);
      setShowSetTempSheet(false);
      // UX-15: jedna forma potvrde kroz aplikaciju — `toast.show`, ne ručno
      // sastavljena zelena kutija po ekranu.
      toast.show({ description: t('boiler.currentTempUpdated'), placement: 'top' });
    },
    onError: (mutationError) => {
      showError(mutationError, t('boiler.currentTempUpdateError'));
    },
  });

  const refreshAll = React.useCallback(() => {
    void refetch();
    void healthQuery.refetch();
    void queryClient.invalidateQueries({ queryKey: ['weather-v2'] });
  }, [healthQuery, queryClient, refetch]);

  const openSetCurrentTempSheet = React.useCallback(() => {
    const boiler = dashboardData?.system?.boiler;
    const suggested =
      typeof boiler?.actualFlowTemp === 'number'
        ? boiler.actualFlowTemp
        : typeof boiler?.suggestedFlowTemp === 'number'
          ? boiler.suggestedFlowTemp
          : 52;
    setCurrentTempInput(suggested.toFixed(1));
    setTempError(null);
    setShowSetTempSheet(true);
  }, [dashboardData?.system?.boiler]);

  const submitCurrentTemp = React.useCallback(() => {
    const parsed = Number(currentTempInput.replace(',', '.').trim());

    if (!Number.isFinite(parsed)) {
      // Validacija ostaje UNUTAR sheeta: toast sa naslovom „nije uspjelo
      // ažuriranje" bi za pogrešan unos bio netačan i odveo pažnju sa polja.
      setTempError(t('boiler.currentTempValidation'));
      return;
    }

    const rounded = Math.round(parsed * 10) / 10;
    if (!isWithinCurrentFlowTempRange(rounded)) {
      setTempError(
        t('boiler.currentTempRangeError', {
          min: MIN_CURRENT_FLOW_TEMP,
          max: MAX_CURRENT_FLOW_TEMP,
        }),
      );
      return;
    }

    setTempError(null);
    setCurrentTempMutation.mutate(rounded);
  }, [currentTempInput, setCurrentTempMutation, t]);

  const header = (
    <ScreenHeader
      title={t('dashboard.title')}
      subtitle={new Date().toLocaleDateString(i18n.language, {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
      })}
      action={{
        icon: 'refresh',
        label: t('common.retry'),
        onPress: refreshAll,
        disabled: isFetching,
      }}
      testID="dashboard-header"
    />
  );

  if (isLoading) {
    // Nalaz UX-07: skeleton u istom footprintu umjesto punog ekranskog spinnera.
    return (
      <Screen edges={['top']}>
        {header}
        <ScreenBody>
          <Panel variant="hero">
            <View style={{ gap: space.sm }}>
              <Skeleton width="32%" height={8} />
              <Skeleton width="52%" height={40} />
              <Skeleton width="100%" height={6} />
            </View>
          </Panel>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Skeleton width="30%" height={68} />
            <Skeleton width="30%" height={68} />
            <Skeleton width="30%" height={68} />
          </View>
          <Skeleton width="100%" height={120} />
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
            title={t('dashboard.unableToLoad')}
            message={error instanceof Error ? error.message : t('dashboard.loadErrorGeneric')}
            action={{ label: t('common.retry'), onPress: () => void refetch() }}
          />
        </ScreenBody>
      </Screen>
    );
  }

  const primaryHome = dashboardData?.homes?.[0];
  const boiler = dashboardData?.system?.boiler;
  const weather = dashboardData?.system?.weather;
  const thermostats = primaryHome?.thermostats ?? [];
  const health = healthQuery.data;

  const isHeating = Boolean(boiler?.heatingStart && !boiler?.heatingEnd);
  const actualFlow = typeof boiler?.actualFlowTemp === 'number' ? boiler.actualFlowTemp : null;
  const targetFlow =
    typeof boiler?.suggestedFlowTemp === 'number' ? boiler.suggestedFlowTemp : null;
  const flowGap = actualFlow !== null && targetFlow !== null ? actualFlow - targetFlow : null;
  const withinTolerance = flowGap !== null && Math.abs(flowGap) <= 2;

  const onlineThermostats = thermostats.filter((thermostat) => {
    const seen = new Date(thermostat.lastSeen).getTime();
    return Number.isFinite(seen) ? Date.now() - seen < 1000 * 60 * 15 : false;
  }).length;

  const healthTone = !health ? 'neutral' : health.score >= 80 ? 'ok' : health.score >= 60 ? 'warn' : 'fault';

  return (
    <Screen edges={['top']} testID="dashboard-screen">
      {header}

      <ScreenBody
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            // RN 0.88: `onRefresh` je `() => void`; React Query `refetch()`
            // vraća Promise, pa se rezultat namjerno odbacuje.
            onRefresh={refreshAll}
            tintColor={undefined}
          />
        }
        testID="dashboard-body"
      >
        {/* HERO — jedan broj koji je stvarno glavni. */}
        <Section label={t('boiler.status')}>
          <Panel variant="hero" testID="dashboard-hero">
            <View style={{ gap: 10 }}>
              <StatusDot
                state={isHeating ? 'on' : 'off'}
                label={isHeating ? t('boiler.heating') : t('boiler.idle')}
                meta={
                  isHeating && boiler?.heatingStart
                    ? `· ${formatDuration(boiler.heatingStart)}`
                    : undefined
                }
              />

              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.md }}>
                <Readout
                  value={actualFlow !== null ? actualFlow.toFixed(1) : '—'}
                  unit="°C"
                  size="xl"
                  tone={actualFlow === null ? 'dim' : 'ink'}
                  accessibilityLabel={t('boiler.flowLine')}
                  testID="dashboard-flow-actual"
                />
                <View style={{ paddingBottom: 6, gap: 2 }}>
                  <MonoLabel>{t('dashboard.flowTarget')}</MonoLabel>
                  <Readout
                    value={targetFlow !== null ? targetFlow.toFixed(1) : '—'}
                    unit="°C"
                    size="md"
                    tone="muted"
                  />
                </View>
              </View>

              <GaugeBar
                value={actualFlow !== null ? scale(actualFlow) : 0}
                target={targetFlow !== null ? scale(targetFlow) : undefined}
                tone={actualFlow === null ? 'muted' : withinTolerance ? 'ok' : 'warn'}
                height={6}
                accessibilityLabel={t('boiler.flowTemp')}
              />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
                <MonoMeta tone={flowGap === null ? 'dim' : withinTolerance ? 'ok' : 'warn'}>
                  {flowGap === null
                    ? t('boiler.actualNotSet')
                    : `${t('dashboard.flowGap', {
                        value: flowGap.toFixed(1),
                      })} · ${
                        withinTolerance
                          ? t('dashboard.flowWithinTolerance')
                          : t('dashboard.flowOutsideTolerance')
                      }`}
                </MonoMeta>
                <MonoMeta>
                  {t('dashboard.flowScale', {
                    min: MIN_CURRENT_FLOW_TEMP,
                    max: MAX_CURRENT_FLOW_TEMP,
                  })}
                </MonoMeta>
              </View>

              <Button
                label={t('boiler.setCurrentTemp')}
                variant="secondary"
                block
                loading={setCurrentTempMutation.isPending}
                onPress={openSetCurrentTempSheet}
                testID="open-set-temp"
              />
            </View>
          </Panel>
        </Section>

        {/* F6 (DASH-01): vrijeme je prije stajalo NA DNU ekrana, ispod preporuke i
            KPI pločica, iako je „trenutno vrijeme" kontekst za broj iz hero bloka.
            Sada je prvi blok poslije statusa kotla — tačno tamo gdje korisnik
            traži objašnjenje za vanjsku temperaturu. */}
        {WEATHER_UI_V2 && primaryHome?.profile?.id ? (
          <WeatherV2Card homeProfileId={primaryHome.profile.id} />
        ) : (
          <WeatherRow weather={weather} isFetching={isFetching} />
        )}

        {/* Tri KPI pločice u jednom redu — bez kartica i bez trećeg akcenta. */}
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Kpi
            label={t('dashboard.outdoor')}
            value={boiler?.externalTemp != null ? boiler.externalTemp.toFixed(1) : '—'}
            unit="°C"
            meta={
              weather?.feelsLike != null
                ? t('dashboard.outdoorFeels', { value: Number(weather.feelsLike).toFixed(0) })
                : undefined
            }
            testID="kpi-outdoor"
          />
          <Kpi
            label={t('dashboard.health')}
            value={health ? Math.round(health.score) : '—'}
            unit={health ? '/100' : undefined}
            tone={healthTone}
            meta={
              health
                ? t('dashboard.healthMeta', {
                    value: Math.round(health.learningConfidence ?? 0),
                  })
                : undefined
            }
            onPress={() => (navigation as any).navigate('Analytics')}
            testID="kpi-health"
          />
          <Kpi
            label={t('dashboard.thermostatsKpi')}
            value={thermostats.length === 0 ? '—' : `${onlineThermostats}/${thermostats.length}`}
            meta={
              thermostats.length === 0
                ? t('heating.noThermostats')
                : t('dashboard.thermostatsOnline', {
                    online: onlineThermostats,
                    total: thermostats.length,
                  })
            }
            tone={
              thermostats.length === 0
                ? 'neutral'
                : onlineThermostats === thermostats.length
                  ? 'ok'
                  : 'warn'
            }
            testID="kpi-thermostats"
          />
        </View>

        {health?.warnings?.length ? (
          <Section label={t('dashboard.activeAlerts')} meta={String(health.warnings.length)}>
            <AlertsCard warnings={health.warnings} />
          </Section>
        ) : null}

        <Section
          label={t('thermostat.title')}
          meta={
            thermostats.length > 0
              ? t('dashboard.thermostatsOnline', {
                  online: onlineThermostats,
                  total: thermostats.length,
                })
              : undefined
          }
        >
          <Panel variant="flush" padded={false} testID="thermostat-panel">
            {thermostats.length === 0 ? (
              <PanelRow divider={false}>
                <Text tone="muted" size="body">
                  {t('heating.noThermostats')}
                </Text>
              </PanelRow>
            ) : (
              thermostats.map((thermostat, index) => {
                const recentEvent = primaryHome?.recentHeatingEvents?.find(
                  (event) => event.deviceId === thermostat.id,
                );
                const current = recentEvent?.currentTemp ?? thermostat.currentTemp ?? null;
                const target = thermostat.targetTemp ?? null;
                const heating = thermostat.isHeatingNow === true;

                return (
                  <PanelRow
                    key={thermostat.id}
                    divider={index < thermostats.length - 1}
                    accessibilityLabel={`${thermostat.alias}: ${
                      current !== null ? current.toFixed(1) : '—'
                    } → ${target !== null ? target.toFixed(1) : '—'} °C`}
                  >
                    <View style={{ gap: 6 }}>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: space.sm,
                        }}
                      >
                        <View
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}
                        >
                          <Led state={heating ? 'on' : 'off'} />
                          <Text size="body" weight="medium" numberOfLines={1}>
                            {thermostat.alias}
                          </Text>
                        </View>
                        <Readout
                          value={`${current !== null ? current.toFixed(1) : '—'} → ${
                            target !== null ? target.toFixed(1) : '—'
                          }`}
                          unit="°C"
                          size="md"
                          tone={heating ? 'signal' : 'ink'}
                        />
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                        <View style={{ flex: 1 }}>
                          <GaugeBar
                            value={(current ?? 0) / 30}
                            target={target !== null ? target / 30 : undefined}
                            tone={heating ? 'signal' : 'muted'}
                            height={3}
                            accessibilityLabel={`${thermostat.alias}: ${t(
                              'thermostat.current',
                            )} ${current ?? '—'}, ${t('thermostat.target')} ${target ?? '—'}`}
                          />
                        </View>
                        <MonoMeta>
                          {t(`thermostat.mode.${thermostat.mode.toLowerCase()}`, {
                            defaultValue: thermostat.mode,
                          })}
                        </MonoMeta>
                      </View>
                    </View>
                  </PanelRow>
                );
              })
            )}
          </Panel>
        </Section>

        {/* MO2-15: samo backend snapshot; klijent ne rekonstruiše formulu. */}
        <RecommendationBreakdown breakdown={dashboardData?.system?.recommendation?.breakdown} />

        {dashboardData?.homes && dashboardData.homes.length > 1 && (
          <MonoMeta>
            {t('dashboard.moreHomes', { count: dashboardData.homes.length - 1 })}
          </MonoMeta>
        )}
      </ScreenBody>

      <Sheet
        isOpen={showSetTempSheet}
        onClose={() => setShowSetTempSheet(false)}
        title={t('boiler.setCurrentTemp')}
        snapPoints={['45%', '65%']}
        testID="set-temp-sheet"
      >
        <View style={{ gap: space.md }}>
          <Text tone="muted" size="body">
            {t('boiler.currentTempRangeHint', {
              min: MIN_CURRENT_FLOW_TEMP,
              max: MAX_CURRENT_FLOW_TEMP,
            })}
          </Text>
          <TemperatureField
            value={currentTempInput}
            onChangeText={setCurrentTempInput}
            placeholder={`${MIN_CURRENT_FLOW_TEMP} - ${MAX_CURRENT_FLOW_TEMP}`}
            editable={!setCurrentTempMutation.isPending}
            accessibilityLabel={t('boiler.setCurrentTemp')}
          />
          {tempError ? <InlineBanner tone="fault" title={tempError} /> : null}
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button
              label={t('common.cancel')}
              variant="ghost"
              style={{ flex: 1 }}
              onPress={() => setShowSetTempSheet(false)}
              disabled={setCurrentTempMutation.isPending}
            />
            <Button
              label={
                setCurrentTempMutation.isPending
                  ? t('boiler.savingCurrentTemp')
                  : t('boiler.saveCurrentTemp')
              }
              style={{ flex: 1 }}
              loading={setCurrentTempMutation.isPending}
              onPress={submitCurrentTemp}
            />
          </View>
        </View>
      </Sheet>
    </Screen>
  );
};
