import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './global.css';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { Animated, AppState, BackHandler, Easing, View } from 'react-native';
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
  type DashboardRecord,
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
import { createSessionStore, type StoredSession } from './src/lib/session';
import * as Updates from 'expo-updates';
import { parseClaimResponse, type ClaimResponse } from './src/lib/pairing';
import { API_BASE_URL, setTvLocale } from './src/config';
import { colors } from './src/theme';
import { TvAmbientBackground } from './src/components/TvUI';

// Keep native splash visible until the font and secure session are ready.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

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
  updatedAt: null, loading: false, error: null,
};

function isRecord(value: unknown): value is AnyRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asRecord(value: unknown): AnyRecord | null {
  if (!isRecord(value)) return null;
  return isRecord(value.data) ? value.data : value;
}

function asDashboard(value: unknown): DashboardRecord | null {
  const record = asRecord(value);
  if (!record) return null;

  const rawSystem = asRecord(record.system);
  const homes = Array.isArray(record.homes)
    ? record.homes.filter(isRecord).map((home) => ({
        ...home,
        thermostats: asList(home.thermostats),
      }))
    : [];

  return {
    ...record,
    system: rawSystem ? {
      ...rawSystem,
      weather: asRecord(rawSystem.weather),
      boiler: asRecord(rawSystem.boiler),
      recommendation: asRecord(rawSystem.recommendation),
    } : null,
    homes,
  };
}

function asList(value: unknown): AnyRecord[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (!isRecord(value)) return [];
  for (const key of ['data', 'items', 'readings', 'devices', 'programs']) {
    if (Array.isArray(value[key])) return value[key].filter(isRecord);
  }
  return [];
}

function dataFrom(response: { data: unknown }): unknown {
  return response.data;
}

function TvPageTransition({ children, transitionKey }: { children: React.ReactNode; transitionKey: string }) {
  const progress = React.useRef(new Animated.Value(0)).current;
  useEffect(() => {
    progress.stopAnimation();
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, transitionKey]);
  return <Animated.View style={{ flex: 1, opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>{children}</Animated.View>;
}

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
  const [page, setPage] = useState<Page>('home');
  const [homeView, setHomeView] = useState<HomeView>('overview');
  const [gasView, setGasView] = useState<GasView>('readings');
  const [settingsView, setSettingsView] = useState<SettingsView>('profile');
  const [appActive, setAppActive] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const authFailureHandledRef = React.useRef(false);
  const activeRefreshControllerRef = React.useRef<AbortController | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      setAppActive(nextState === 'active');
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const stored = await sessionStore.load();
        if (mounted) setSession(stored);
      } catch {
        // SecureStore failure must not leave the native splash visible forever.
        if (mounted) setSession(null);
      } finally {
        if (mounted) setBooted(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!booted || !fontsLoaded) return;
    void SplashScreen.hideAsync().catch(() => undefined);
  }, [booted, fontsLoaded]);

  const onUnauthorized = useCallback(() => {
    if (authFailureHandledRef.current) return;
    authFailureHandledRef.current = true;
    activeRefreshControllerRef.current?.abort();
    activeRefreshControllerRef.current = null;
    void sessionStore.clear().catch(() => undefined);
    setSession(null);
    setData(emptyData);
  }, []);

  const client = useMemo(
    () => createTvClient({ baseUrl: API_BASE_URL, getToken: () => session?.token ?? null, onUnauthorized }),
    [session?.token, onUnauthorized],
  );

  const loadData = useCallback(async (signal: AbortSignal) => {
    setData((current) => ({ ...current, loading: true }));
    const now = Date.now();
    const from = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    const to = new Date(now).toISOString();

    // All authenticated routes remain GET-only. AbortSignal cancels the whole
    // refresh when the session ends or the app moves to the background.
    const requests = await Promise.allSettled([
      client.get<unknown>('/dashboard', { signal }),
      client.get<unknown>('/gas/analysis', { signal }),
      client.get<unknown>('/gas/readings?limit=20&offset=0', { signal }),
      client.get<unknown>('/dashboard/health', { signal }),
      client.get<unknown>('/dashboard/heating-status', { signal }),
      client.get<unknown>(`/dashboard/heating-summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&bucket=day`, { signal }),
      client.get<unknown>('/dashboard/heating-events', { signal }),
      client.get<unknown>('/devices', { signal }),
      client.get<unknown>('/user', { signal }),
      client.get<unknown>('/home-profile', { signal }),
    ]);
    if (signal.aborted) return;

    const payloads = requests.map((result) => result.status === 'fulfilled' ? dataFrom(result.value) : undefined);
    const hasResponse = (index: number) => requests[index]?.status === 'fulfilled';
    const errors = requests.slice(0, 3).flatMap((result) => result.status === 'rejected'
      ? [result.reason instanceof Error ? result.reason.message : 'Greška pri učitavanju osnovnih podataka']
      : []);
    const deviceList = hasResponse(7) ? asList(payloads[7]) : undefined;
    let programs: AnyRecord[] | undefined;

    if (deviceList) {
      const deviceId = deviceList[0]?.id;
      if (deviceId === undefined || deviceId === null) {
        programs = [];
      } else {
        try {
          const response = await client.get<unknown>(`/devices/${encodeURIComponent(String(deviceId))}/programs`, { signal });
          if (signal.aborted) return;
          programs = asList(dataFrom(response));
        } catch {
          // Keep the last known schedule on an optional endpoint failure.
          if (signal.aborted) return;
        }
      }
    }
    if (signal.aborted) return;

    const summaryRecord = asRecord(payloads[5]);
    const summary = asRecord(summaryRecord?.summary) ?? summaryRecord;
    setData((current) => ({
      ...current,
      dashboard: hasResponse(0) ? asDashboard(payloads[0]) : current.dashboard,
      analysis: hasResponse(1) ? asRecord(payloads[1]) : current.analysis,
      readings: hasResponse(2) ? asList(payloads[2]) : current.readings,
      health: hasResponse(3) ? asRecord(payloads[3]) : current.health,
      heatingStatus: hasResponse(4) ? asList(payloads[4]) : current.heatingStatus,
      heatingSummary: hasResponse(5) ? summary : current.heatingSummary,
      heatingEvents: hasResponse(6) ? asList(payloads[6]) : current.heatingEvents,
      devices: deviceList ?? current.devices,
      programs: programs ?? current.programs,
      profile: hasResponse(8) ? asRecord(payloads[8]) : current.profile,
      homeProfile: hasResponse(9) ? asRecord(payloads[9]) : current.homeProfile,
      // Preserve the previous successful timestamp on partial failures so the
      // UI can honestly show stale data rather than erasing its freshness.
      updatedAt: errors.length === 0 ? Date.now() : current.updatedAt,
      loading: false,
      error: errors.length ? errors.join(' · ') : null,
    }));
  }, [client]);

  useEffect(() => {
    const locale = data.profile?.locale ?? data.profile?.language ?? data.homeProfile?.locale;
    if (locale) setTvLocale(locale);
  }, [data.profile?.locale, data.profile?.language, data.homeProfile?.locale]);

  useEffect(() => {
    if (!session || !appActive) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;

    const refreshSerially = async () => {
      if (stopped) return;
      const currentController = new AbortController();
      controller = currentController;
      activeRefreshControllerRef.current = currentController;
      try {
        await loadData(currentController.signal);
      } catch {
        if (!currentController.signal.aborted) {
          setData((current) => ({ ...current, loading: false, error: 'Greška pri osvježavanju podataka.' }));
        }
      } finally {
        if (activeRefreshControllerRef.current === currentController) {
          activeRefreshControllerRef.current = null;
        }
        if (!stopped) timer = setTimeout(() => void refreshSerially(), POLL_INTERVAL_MS);
      }
    };

    void refreshSerially();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      controller?.abort();
      if (activeRefreshControllerRef.current === controller) {
        activeRefreshControllerRef.current = null;
      }
    };
  }, [session?.token, appActive, loadData]);

  useEffect(() => {
    if (!booted || !fontsLoaded || !appActive) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const checkAndApplySilently = async () => {
      try {
        if (Updates.isEnabled) {
          const update = await Updates.checkForUpdateAsync();
          if (!active) return;
          if (update.isAvailable) {
            await Updates.fetchUpdateAsync();
            if (!active) return;
            // OTA only changes this process; it never opens a browser or installer.
            await Updates.reloadAsync();
            return;
          }
        }
      } catch {
        // Offline, dev client, or an incompatible native runtime: keep running.
      }
      if (active) timer = setTimeout(() => void checkAndApplySilently(), UPDATE_CHECK_INTERVAL_MS);
    };

    void checkAndApplySilently();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [booted, fontsLoaded, appActive]);

  // Pairing is the only permitted write path, and it is isolated from the
  // read-only authenticated client. After pairing the application sends GETs only.
  const requestCode = useCallback(
    async () => requestPairingCode(API_BASE_URL, { deviceLabel: 'Android TV' }),
    [],
  );
  const pollCode = useCallback(async (code: string): Promise<ClaimResponse> => {
    const response = await client.get<unknown>(`${TV_ENDPOINTS.pairingSession}/${encodeURIComponent(code)}`);
    const claim = parseClaimResponse(response.data);
    if (!claim) throw new Error('Neispravan odgovor API-ja za uparivanje.');
    return claim;
  }, [client]);
  const onPaired = useCallback((paired: StoredSession) => {
    authFailureHandledRef.current = false;
    void sessionStore.save(paired).catch(() => undefined);
    setSession(paired);
  }, []);

  useEffect(() => {
    if (!session) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (page === 'settings' && settingsView !== 'profile') {
        setSettingsView('profile');
        return true;
      }
      if (page === 'gas' && gasView !== 'readings') {
        setGasView('readings');
        return true;
      }
      if (page === 'home' && homeView !== 'overview') {
        setHomeView('overview');
        return true;
      }
      if (page !== 'home') {
        setPage('home');
        setHomeView('overview');
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [session, page, settingsView, gasView, homeView]);

  if (!booted || !fontsLoaded) return null;
  return <SafeAreaProvider>
    <StatusBar style="light" hidden />
    {session ? <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TvAmbientBackground />
      <TvTopBar data={data} />
      <TvPageTransition transitionKey={`${page}:${page === 'home' ? homeView : page === 'gas' ? gasView : page === 'settings' ? settingsView : ''}`}>
        {page === 'home' ? <HomeScreen data={data} view={homeView} onView={setHomeView} /> : null}
        {page === 'heating' ? <HeatingScreen data={data} /> : null}
        {page === 'gas' ? <GasScreen data={data} view={gasView} onView={setGasView} /> : null}
        {page === 'settings' ? <SettingsScreen data={data} view={settingsView} onView={setSettingsView} /> : null}
      </TvPageTransition>
      <TvMainNavigation page={page} onChange={(nextPage) => { setPage(nextPage); if (nextPage === 'home') setHomeView('overview'); }} />
    </View> : <TvPairingScreen requestCode={requestCode} pollCode={pollCode} onPaired={onPaired} />}
  </SafeAreaProvider>;
}
