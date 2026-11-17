import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';

import { AnalyticsScreen } from './src/screens/AnalyticsScreen';
import { TvPairingScreen } from './src/screens/TvPairingScreen';
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
import type { ClaimResponse } from './src/lib/pairing';
import { API_BASE_URL, translate } from './src/config';

/**
 * Ulazna tačka TV aplikacije.
 *
 * **Dva stanja, ne rutovanje.** Dok TV nije uparen prikazuje se uparivanje; kad
 * jeste, analitika. Nema navigacije jer nema gdje da se ide — jedan ekran je
 * dovoljan (v. `AnalyticsScreen`). Navigacioni stack bi dodao dugmad koja
 * korisnik sa daljinskim ne može da prati.
 *
 * **Sve mrežne pozive kroz `createTvClient`.** Klijent odbija svaki zahtjev
 * koji nije GET, pa se pravilo „TV samo čita" ne oslanja na disciplinu
 * programera (v. `services/api/client.ts`).
 */
const sessionStore = createSessionStore({
  read: () => SecureStore.getItemAsync('tv.session.v1'),
  write: (value) => SecureStore.setItemAsync('tv.session.v1', value),
  clear: () => SecureStore.deleteItemAsync('tv.session.v1'),
});

const POLL_INTERVAL_MS = 60_000;

export default function App() {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [booted, setBooted] = useState(false);
  const [analysis, setAnalysis] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  /*
   * Notifikacije se pripremaju **prije** uparivanja: push token se šalje uz
   * zahtjev za kod, jer TV poslije toga ne smije nijedan upis. Ako se kanal
   * kreira tek poslije uparivanja, token bi otišao bez kanala i prva
   * notifikacija bi bila tiha.
   */
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
    // Sesija je opozvana (TV odjavljen sa telefona): brišemo je i tražimo novo
    // uparivanje. TV koji bi tiho ostao na starim podacima izgledao bi ispravan.
    void sessionStore.clear();
    setSession(null);
    setAnalysis(null);
  }, []);

  const client = useMemo(
    () =>
      createTvClient({
        baseUrl: API_BASE_URL,
        getToken: () => session?.token ?? null,
        onUnauthorized,
      }),
    [session?.token, onUnauthorized],
  );

  const loadAnalytics = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const response = await client.get(TV_ENDPOINTS.gasAnalysis);
      setAnalysis(response.data ?? null);
      setUpdatedAt(Date.now());
      setError(null);
    } catch (caught) {
      /*
       * Greška NE briše zadnje poznate podatke: TV koji izgubi vezu zadržava
       * brojeve uz oznaku „podaci nisu osvježeni", što je korisnije od
       * praznog ekrana.
       */
      setError(
        caught instanceof Error ? caught.message : 'Nepoznata greška',
      );
    } finally {
      setLoading(false);
    }
  }, [client, session]);

  useEffect(() => {
    if (!session) return;
    void loadAnalytics();
    const timer = setInterval(() => void loadAnalytics(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [session, loadAnalytics]);

  /*
   * Uparivanje ide kroz `requestPairingCode`, ne kroz `client`: to je JEDINI
   * POST koji TV smije poslati, i zato je odvojen u posebnu funkciju umjesto
   * izuzetka u interceptoru klijenta.
   */
  const requestCode = useCallback(async (tvPushToken: string | null) => {
    return requestPairingCode(API_BASE_URL, {
      deviceLabel: 'Android TV',
      tvPushToken: tvPushToken ?? undefined,
    });
  }, []);

  const pollCode = useCallback(
    async (code: string): Promise<ClaimResponse> => {
      const response = await client.get(
        `${TV_ENDPOINTS.pairingSession}/${encodeURIComponent(code)}`,
      );
      return response.data;
    },
    [client],
  );

  const onPaired = useCallback((paired: StoredSession) => {
    void sessionStore.save(paired);
    setSession(paired);
  }, []);

  if (!booted) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" hidden />
      {session ? (
        <AnalyticsScreen
          analysis={analysis}
          loading={loading}
          error={error}
          updatedAt={updatedAt}
          translate={translate}
        />
      ) : (
        <TvPairingScreen
          requestCode={requestCode}
          pollCode={pollCode}
          getPushToken={getTvPushToken}
          onPaired={onPaired}
        />
      )}
    </SafeAreaProvider>
  );
}
