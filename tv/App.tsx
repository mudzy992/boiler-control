import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { useFonts } from 'expo-font';

import { TvPairingScreen } from './src/screens/TvPairingScreen';
import {
  GasScreen,
  HeatingScreen,
  HomeScreen,
  SettingsScreen,
  TvMainNavigation,
  TvTopBar,
  type AnyRecord,
  type GasView,
  type HomeView,
  type Page,
  type SettingsView,
  type TvDashboardData,
} from './src/screens/TvDashboardScreens';
import {
  createTvClient,
  requestPairingCode,
  TV_ENDPOINTS,
} from './src/services/api/client';
import {
  configureNotificationHandling,
  getTvPushToken,
  prepareNotifications,
} from './src/services/notifications';
import { createSessionStore, type StoredSession } from './src/lib/session';
import { newVersionAvailable, type TvLatestRelease } from './src/lib/update';
import type { ClaimResponse } from './src/lib/pairing';
import { API_BASE_URL, APP_VERSION } from './src/config';
import { colors } from './src/theme';

const sessionStore = createSessionStore({
  read: () => SecureStore.getItemAsync('tv.session.v1'),
  write: (value) => SecureStore.setItemAsync('tv.session.v1', value),
  clear: () => SecureStore.deleteItemAsync('tv.session.v1'),
});

const POLL_INTERVAL_MS = 60_000;
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const emptyData: TvDashboardData = {
  dashboard: null, analysis: null, readings: [], health: null, heatingStatus: [],
  heatingSummary: null, heatingEvents: [], devices: [], programs: [], profile: null, homeProfile: null,
  notifications: [], updatedAt: null, loading: false, error: null, release: null,
};

function asRecord(value: unknown): AnyRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as AnyRecord;
  if (record.data && typeof record.data === 'object' && !Array.isArray(record.data)) return record.data;
  return record;
}
function asList(value: unknown): AnyRecord[] {
  if (Array.isArray(value)) return value as AnyRecord[];
  if (value && typeof value === 'object') {
    const record = value as AnyRecord;
    for (const key of ['data', 'items', 'readings', 'notifications', 'devices', 'programs']) {
      if (Array.isArray(record[key])) return record[key] as AnyRecord[];
    }
  }
  return [];
}
function dataFrom(response: any) { return response?.data; }

export default function App() {
  const [fontsLoaded] = useFonts({
    IBMPlexSans_400Regular: require('./assets/IBMPlexSans_400Regular.ttf'),
    IBMPlexSans_500Medium: require('./assets/IBMPlexSans_500Medium.ttf'),
    IBMPlexSans_600SemiBold: require('./assets/IBMPlexSans_600SemiBold.ttf'),
    IBMPlexSans_700Bold: require('./assets/IBMPlexSans_700Bold.ttf'),
    IBMPlexMono_400Regular: require('./assets/IBMPlexMono_400Regular.ttf'),
    IBMPlexMono_600SemiBold: require('./assets/IBMPlexMono_600SemiBold.ttf'),
  });
  const [session, setSession] = useState<StoredSession | null>(null);
  const [booted, setBooted] = useState(false);
  const [data, setData] = useState<TvDashboardData>(emptyData);
  const [release, setRelease] = useState<TvLatestRelease | null>(null);
  const [page, setPage] = useState<Page>('home');
  const [homeView, setHomeView] = useState<HomeView>('overview');
  const [gasView, setGasView] = useState<GasView>('readings');
  const [settingsView, setSettingsView] = useState<SettingsView>('profile');

  useEffect(() => {
    configureNotificationHandling();
    void prepareNotifications();
  }, []);

  useEffect(() => {
    void (async () => {
      const stored = await sessionStore.load();
      setSession(stored);
      setBooted(true);
    })();
  }, []);

  const onUnauthorized = useCallback(() => {
    void sessionStore.clear();
    setSession(null);
    setData(emptyData);
  }, []);

  const client = useMemo(
    () => createTvClient({ baseUrl: API_BASE_URL, getToken: () => session?.token ?? null, onUnauthorized }),
    [session?.token, onUnauthorized],
  );

  const loadData = useCallback(async () => {
    if (!session) return;
    setData((current) => ({ ...current, loading: true }));
    // Screen data is deliberately fetched only through GET. Every endpoint
    // fails independently, so an optional endpoint cannot hide the dashboard.
    const requests = await Promise.allSettled([
      client.get('/dashboard'),
      client.get('/gas/analysis'),
      client.get('/gas/readings?limit=20&offset=0'),
      client.get('/dashboard/health'),
      client.get('/dashboard/heating-status'),
      client.get(`/dashboard/heating-summary?from=${encodeURIComponent(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())}&to=${encodeURIComponent(new Date().toISOString())}&bucket=day`),
      client.get('/dashboard/heating-events'),
      client.get('/devices'),
      client.get('/user'),
      client.get('/home-profile'),
      client.get('/notifications'),
    ]);
    const payloads = requests.map((result) => result.status === 'fulfilled' ? dataFrom(result.value) : undefined);
    const [dashboard, analysis, readings, health, heatingStatus, heatingSummary, heatingEvents, devices, profile, homeProfile, notifications] = payloads;
    const errors = requests.flatMap((result, index) => result.status === 'rejected' && [0, 1, 2].includes(index)
      ? [result.reason instanceof Error ? result.reason.message : 'Greška pri učitavanju osnovnih podataka'] : []);
    let programs: AnyRecord[] = [];
    const deviceList = asList(devices);
    if (deviceList[0]?.id !== undefined) {
      try {
        programs = asList(dataFrom(await client.get(`/devices/${encodeURIComponent(String(deviceList[0].id))}/programs`)));
      } catch {
        // A missing optional schedule should not mark primary dashboard data stale.
      }
    }
    setData({
      dashboard: asRecord(dashboard),
      analysis: asRecord(analysis),
      readings: asList(readings),
      health: asRecord(health),
      heatingStatus: asList(heatingStatus),
      heatingSummary: asRecord(asRecord(heatingSummary)?.summary) ?? asRecord(heatingSummary),
      heatingEvents: asList(heatingEvents),
      devices: deviceList,
      programs,
      profile: asRecord(profile),
      homeProfile: asRecord(homeProfile),
      notifications: asList(notifications),
      updatedAt: errors.length === 0 ? Date.now() : null,
      loading: false,
      error: errors.length ? errors.join(' · ') : null,
      release,
    });
  }, [client, session, release]);

  useEffect(() => {
    if (!session) return;
    void loadData();
    const timer = setInterval(() => void loadData(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [session, loadData]);

  useEffect(() => {
    if (!session) return;
    const check = async () => {
      try {
        if (!APP_VERSION) return;
        const response = await client.get(`${TV_ENDPOINTS.releaseLatest}?platform=TV`);
        const update = newVersionAvailable(APP_VERSION, response.data);
        setRelease(update);
      } catch {
        // Update check is optional; it never blocks read-only screens.
      }
    };
    void check();
    const timer = setInterval(() => void check(), UPDATE_CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [client, session]);

  // Pairing is the only permitted write path, and it is isolated from the
  // read-only authenticated client. After pairing the application sends GETs only.
  const requestCode = useCallback(async (tvPushToken: string | null) => requestPairingCode(API_BASE_URL, {
    deviceLabel: 'Android TV', tvPushToken: tvPushToken ?? undefined,
  }), []);
  const pollCode = useCallback(async (code: string): Promise<ClaimResponse> => {
    const response = await client.get(`${TV_ENDPOINTS.pairingSession}/${encodeURIComponent(code)}`);
    return response.data;
  }, [client]);
  const onPaired = useCallback((paired: StoredSession) => {
    void sessionStore.save(paired);
    setSession(paired);
  }, []);

  if (!booted || !fontsLoaded) return null;
  const dataWithRelease = { ...data, release };
  return <SafeAreaProvider>
    <StatusBar style="light" hidden />
    {session ? <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TvTopBar data={dataWithRelease} />
      {page === 'home' ? <HomeScreen data={dataWithRelease} view={homeView} onView={setHomeView} /> : null}
      {page === 'heating' ? <HeatingScreen data={dataWithRelease} /> : null}
      {page === 'gas' ? <GasScreen data={dataWithRelease} view={gasView} onView={setGasView} /> : null}
      {page === 'settings' ? <SettingsScreen data={dataWithRelease} view={settingsView} onView={setSettingsView} /> : null}
      <TvMainNavigation page={page} onChange={setPage} />
    </View> : <TvPairingScreen requestCode={requestCode} pollCode={pollCode} getPushToken={getTvPushToken} onPaired={onPaired} />}
  </SafeAreaProvider>;
}
