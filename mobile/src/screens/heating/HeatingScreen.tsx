import React from 'react';
import { RefreshControl, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';

import { apiClient } from '../../services/api/client';
import { useErrorHandler } from '../../services/api/error.handler';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppState } from '../../hooks/useAppState';
import { dashboardRefetchInterval } from '../../services/query/polling';
import { DASHBOARD_QUERY_KEY } from '../../services/query/keys';
import {
  EmptyState,
  GaugeBar,
  InlineBanner,
  Led,
  MonoLabel,
  DeviceName,
  MonoMeta,
  Panel,
  PanelRow,
  Readout,
  Screen,
  ScreenBody,
  ScreenHeader,
  Section,
  SkeletonRows,
  Text,
  useTokens,
} from '../../ui';
import { useToast } from '../../components/ui/nativewind';
import { SETTINGS_STACK_SCREENS } from '../../constants/routes';
import { space } from '../../theme/tokens';

/**
 * Grijanje — red po uređaju (prototip §03).
 *
 * Prije: kartica po termostatu sa četiri velika broja (trenutna, ciljna, razlika,
 * status) i puna obojena „ZAGRIJAVA" značka — tri termostata su trošila ~630px, a
 * najjači element na ekranu je bila riječ, ne broj.
 *
 * Sada: jedan red = jedan uređaj. „21.4 → 22.5" u mono brojevima (mjerena je
 * velika, izvedena mala), gauge ka cilju, a boja se troši samo kad uređaj
 * stvarno grije.
 */

interface Thermostat {
  id: number;
  alias?: string;
  name?: string;
  /** Soba, trenutno (`32`) — s dashboarda, ne s `/thermostat-device`. */
  roomCurrentTemp?: number | null;
  roomTargetTemp?: number | null;
  isHeatingNow?: boolean;
}

interface DashboardData {
  homes: {
    id: number;
    name: string;
    thermostats?: Thermostat[];
  }[];
}

interface HeatingEvent {
  id: number;
  deviceId?: number;
  timestampStart: string;
  timestampEnd: string | null;
  roomCurrentTemp: number;
  roomTargetTemp: number;
  hvacAction: string;
  source: string;
  isAnomaly: boolean;
}

const startOfDay = (iso: string) => {
  const date = new Date(iso);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const isToday = (iso: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return startOfDay(iso) === today.getTime();
};

/** „1h 42m" — trajanje između dva ISO vremena (otvoren događaj traje do sada). */
function formatDuration(startIso: string, endIso: string | null): string {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return '—';
  const minutes = Math.max(0, Math.floor((end - start) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
}

const formatTime = (iso: string, locale: string) =>
  new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

/**
 * Status kao pilula: tekst + ivica, a ne samo boja. Boja sama ne smije nositi
 * značenje (WCAG 1.4.1), pa pilula uvijek ima natpis.
 */
function StatusPill({ active, label }: { active: boolean; label: string }) {
  const { t: tokens } = useTokens();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 2,
        borderWidth: 1,
        borderColor: active ? tokens.signal : tokens.line,
      }}
    >
      <MonoMeta tone={active ? 'signal' : 'dim'}>{label}</MonoMeta>
    </View>
  );
}

/**
 * F7 (HEAT-01): kartica statusa grijanja, „možda malo ljepše".
 *
 * Korisnik je rekao da nije blokada, ali je problem bio stvaran: red je imao
 * tri različita signala u istoj liniji — `Led`, `GaugeBar` i dva `MonoMeta`
 * natpisa („Grije"/„Miruje" i „Δ +1.2") — bez ijednog okvira koji ih drži na
 * okupu, pa se uz više termostata nije vidjelo gdje jedan red prestaje.
 *
 * Sada: ime uređaja i status su u prvom redu (status je pilula sa ivicom u boji
 * stanja — tako se čita i bez boje, po tekstu), a temperatura i traka su u
 * drugom. Delta je pomjerena uz traku jer opisuje ISTO poređenje.
 */
function DeviceRow({
  thermostat,
  isHeating,
}: {
  thermostat: Thermostat;
  isHeating: boolean;
}) {
  const { t } = useTranslation();

  /*
   * `null` je „nema mjerenja", a ne 0 °C. Do sada je `Number(undefined ?? 0)`
   * pisalo „0.0 °C", pa je termostat koji nije javio temperaturu izgledao kao
   * da je u sobi nula stepeni — a razlika Δ je bila izmišljena iz te nule.
   * Sada se sve troje (current, target, Δ) prikazuju kao „—" kad nema podatka.
   */
  const current = thermostat.roomCurrentTemp ?? null;
  const target = thermostat.roomTargetTemp ?? null;
  const gap = current !== null && target !== null ? target - current : null;
  const formatTemp = (value: number | null) =>
    value !== null && Number.isFinite(value) ? value.toFixed(1) : '—';

  return (
    <PanelRow
      accessibilityLabel={`${thermostat.alias ?? thermostat.name ?? ''}: ${formatTemp(current)} → ${formatTemp(target)} °C`}
    >
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Led state={isHeating ? 'on' : 'off'} />
          <DeviceName
            name={thermostat.alias || thermostat.name}
            fallback={`#${thermostat.id}`}
            style={{ flex: 1 }}
          />
          <StatusPill active={isHeating} label={isHeating ? t('heating.heating') : t('heating.standbyShort')} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Readout
            value={`${formatTemp(current)} → ${formatTemp(target)}`}
            unit="°C"
            size="md"
            tone={isHeating ? 'signal' : 'ink'}
            testID={`thermostat-readout-${thermostat.id}`}
          />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <GaugeBar
              value={current !== null ? current / 30 : 0}
              target={target !== null ? target / 30 : undefined}
              tone={isHeating ? 'signal' : 'muted'}
              height={3}
              accessibilityLabel={`${t('heating.current')} ${formatTemp(
                current,
              )}, ${t('heating.target')} ${formatTemp(target)}`}
            />
          </View>
          <MonoMeta tone={gap !== null && Math.abs(gap) < 0.05 ? 'ok' : 'dim'}>
            {gap === null
              ? 'Δ —'
              : `Δ ${gap >= 0 ? '+' : ''}${gap.toFixed(1)}`}
          </MonoMeta>
        </View>
      </View>
    </PanelRow>
  );
}

export const HeatingScreen = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const toast = useToast();
  const { showError } = useErrorHandler();
  const [refreshing, setRefreshing] = React.useState(false);
  const appState = useAppState();

  const {
    data: dashboardData,
    isLoading,
    isRefetching,
    refetch,
    error: queryError,
  } = useQuery({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: () => apiClient.getDashboard() as Promise<DashboardData>,
    staleTime: 1000 * 60 * 2,
    // MO2-13: one dashboard cache entry; no polling while backgrounded.
    refetchInterval: dashboardRefetchInterval(appState),
  });

  const {
    data: heatingEventsData,
    isLoading: eventsLoading,
    refetch: refetchEvents,
  } = useQuery({
    queryKey: ['heating-events'],
    queryFn: () => apiClient.getHeatingEvents({ limit: 20 }),
    staleTime: 1000 * 60 * 5,
  });

  React.useEffect(() => {
    if (queryError) showError(queryError, t('heating.loadError'));
  }, [queryError, showError, t]);

  const homes = dashboardData?.homes ?? [];
  const currentHome = homes[0];
  const thermostats = currentHome?.thermostats ?? [];
  const allEvents: HeatingEvent[] = Array.isArray(heatingEventsData)
    ? (heatingEventsData as HeatingEvent[])
    : ((heatingEventsData as { events?: HeatingEvent[] })?.events ?? []);

  /**
   * Status grijanja dolazi iz NAJNOVIJEG događaja po uređaju: otvoren događaj sa
   * `HEATING_ON` znači da uređaj grije. `isHeatingNow` s backenda, kad postoji,
   * ima prednost.
   */
  const heatingByDevice = React.useMemo(() => {
    const map = new Map<number, boolean>();
    allEvents.forEach((event) => {
      if (event.deviceId == null) return;
      const previous = allEvents
        .filter((candidate) => candidate.deviceId === event.deviceId)
        .sort(
          (a, b) => new Date(b.timestampStart).getTime() - new Date(a.timestampStart).getTime(),
        )[0];
      if (previous?.id !== event.id) return;
      map.set(event.deviceId, !previous.timestampEnd && previous.hvacAction === 'HEATING_ON');
    });
    return map;
  }, [allEvents]);

  const todayEvents = React.useMemo(
    () => allEvents.filter((event) => isToday(event.timestampStart)),
    [allEvents],
  );

  const totalHeatingMinutes = React.useMemo(
    () =>
      todayEvents.reduce((sum, event) => {
        const start = new Date(event.timestampStart).getTime();
        const end = event.timestampEnd ? new Date(event.timestampEnd).getTime() : Date.now();
        return sum + Math.max(0, (end - start) / 60000);
      }, 0),
    [todayEvents],
  );

  const handleRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetch(), refetchEvents()]);
      toast.show({ description: t('heating.updated'), placement: 'top' });
    } catch (refreshError) {
      console.error('Refresh error:', refreshError);
    } finally {
      setRefreshing(false);
    }
  }, [refetch, refetchEvents, t, toast]);

  const header = <ScreenHeader title={t('heating.title')} testID="heating-header" />;

  if (isLoading) {
    return (
      <Screen edges={['top']}>
        {header}
        <ScreenBody>
          <SkeletonRows count={3} />
          <SkeletonRows count={2} />
        </ScreenBody>
      </Screen>
    );
  }

  if (homes.length === 0) {
    return (
      <Screen edges={['top']}>
        {header}
        <ScreenBody>
          <EmptyState
            title={t('heating.noHomes')}
            message={t('heating.noHomesHint')}
            action={{
              label: t('settings.manageHomes'),
              onPress: () => (navigation as any).navigate('Settings', {
                screen: 'HomeManagement',
              }),
            }}
          />
        </ScreenBody>
      </Screen>
    );
  }

  const activeDevices = thermostats.filter((thermostat) =>
    thermostat.isHeatingNow === true
      ? true
      : heatingByDevice.get(thermostat.id) === true,
  ).length;

  return (
    <Screen edges={['top']} testID="heating-screen">
      {header}
      <ScreenBody
        refreshControl={
          <RefreshControl refreshing={refreshing || isRefetching} onRefresh={handleRefresh} />
        }
      >
        <Section
          label={currentHome?.name ?? t('heating.title')}
          meta={
            thermostats.length > 0
              ? t('heating.heatingCount', {
                  active: activeDevices,
                  total: thermostats.length,
                })
              : undefined
          }
        >
          <Panel variant="flush" padded={false} testID="heating-devices">
            {thermostats.length === 0 ? (
              /* F4 (UX-24): prazno stanje nosi „šta dalje" — ruta ka upravljanju
                 termostatima, a ne samo rečenicu bez izlaza. */
              <EmptyState
                icon="thermometer-outline"
                title={t('heating.noThermostats')}
                message={t('heating.noThermostatsBody')}
                action={{
                  label: t('heating.noThermostatsAction'),
                  // Jedina ruta koja danas prikazuje termostate i rasporede je
                  // Postavke → Rasporedi; nema izmišljenog novog ekrana.
                  onPress: () =>
                    (navigation as any).navigate(SETTINGS_STACK_SCREENS.ScheduleManagement),
                }}
              />
            ) : (
              thermostats.map((thermostat) => (
                <DeviceRow
                  key={thermostat.id}
                  thermostat={thermostat}
                  isHeating={
                    thermostat.isHeatingNow === true
                      ? true
                      : heatingByDevice.get(thermostat.id) === true
                  }
                />
              ))
            )}
          </Panel>
          {/*
            `36`: traka u redu termostata izgleda kao „napredak grijanja", a
            mjeri samo gdje je sobna temperatura na fiksnoj skali 0–30 °C.
            Objašnjenje stoji jednom, uz listu — ponavljanje u svakom redu bi
            zatrpalo karticu.
          */}
          {thermostats.length > 0 ? (
            <Text size="meta" tone="muted">
              {t('heating.gaugeHint')}
            </Text>
          ) : null}
        </Section>

        {todayEvents.length > 0 ? (
          <Section
            label={t('heating.today')}
            meta={
              totalHeatingMinutes > 0
                ? t('heating.sessionsToday', {
                    count: todayEvents.length,
                    duration: formatDuration(new Date(Date.now() - totalHeatingMinutes * 60000).toISOString(), null),
                  })
                : undefined
            }
          >
            <Panel variant="flush" padded={false} testID="heating-events">
              {todayEvents.map((event, index) => {
                const heating = event.hvacAction.includes('HEATING_ON');
                return (
                  <PanelRow
                    key={event.id}
                    divider={index < todayEvents.length - 1}
                    accessibilityLabel={t('heatingEvents.source', {
                      source: t('heatingEvents.system'),
                    })}
                  >
                    <View style={{ gap: 6 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                        <Led state={event.isAnomaly ? 'warn' : heating ? 'on' : 'off'} />
                        <Text size="body" weight="medium" style={{ flex: 1 }} numberOfLines={1}>
                          {`${formatTime(event.timestampStart, i18n.language)} → ${
                            event.timestampEnd
                              ? formatTime(event.timestampEnd, i18n.language)
                              : t('heatingEvents.active')
                          }`}
                        </Text>
                        <MonoMeta>
                          {`${event.roomCurrentTemp.toFixed(1)} → ${event.roomTargetTemp.toFixed(1)}`}
                        </MonoMeta>
                        <MonoLabel tone={heating ? 'signal' : 'dim'}>
                          {formatDuration(event.timestampStart, event.timestampEnd)}
                        </MonoLabel>
                      </View>
                      <MonoMeta>
                        {t('heatingEvents.source', {
                          source: event.source || t('heatingEvents.system'),
                        })}
                      </MonoMeta>
                    </View>
                  </PanelRow>
                );
              })}
            </Panel>
          </Section>
        ) : (
          <InlineBanner tone="info" title={t('heating.autoRefreshInfo')} />
        )}

        {eventsLoading ? <SkeletonRows count={2} /> : null}
      </ScreenBody>
    </Screen>
  );
};
