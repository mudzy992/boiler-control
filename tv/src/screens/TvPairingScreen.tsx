import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as NativeText,
  View,
  type TextProps,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import {
  PAIRING_LOCAL_TIMEOUT_MS,
  PAIRING_POLL_INTERVAL_MS,
  formatCodeForTv,
  isLocallyExpired,
  pairingDeepLink,
  reduceClaim,
  type ClaimResponse,
  type PairingState,
} from '../lib/pairing';
import { colors, fonts, scaleContent, spacing, typeScale, tvLayout } from '../theme';
import { translateText } from '../config';

function Text({ children, ...props }: TextProps) {
  return <NativeText {...props}>{typeof children === 'string' ? translateText(children) : children}</NativeText>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Ekran za uparivanje — prvo što korisnik vidi na TV-u.
 *
 * **Zašto QR i kod istovremeno.** QR je brz kad telefon radi; kod od 8 znakova
 * je jedini put kad kamera ne radi, kad je odsjaj na ekranu, ili kad
 * aplikacija na telefonu nema skener. Prikazati samo QR značilo bi da TV bez
 * kamere na telefonu nema izlaz.
 *
 * **Zašto stanje dolazi iz `reduceClaim`, a ne iz lokalnih `useState` flegova.**
 * TV koji „zna" da čeka, a kod je istekao, izgleda identično kao TV koji radi.
 * Redukcija je čista funkcija i testirana bez ekrana (`lib/__tests__/pairing`).
 */
export interface TvPairingScreenProps {
  /** Traži novi kod za uparivanje. */
  requestCode: () => Promise<{
    code: string;
    expiresAt: string;
  }>;
  /** Pita je li kod odobren. */
  pollCode: (code: string) => Promise<ClaimResponse>;
  /** Poziva se tačno jednom kad su tokeni preuzeti. */
  onPaired: (session: {
    token: string;
    refreshToken: string;
    userId: number;
  }) => void;
}

export function TvPairingScreen({
  requestCode,
  pollCode,
  onPaired,
}: TvPairingScreenProps) {
  const [state, setState] = useState<PairingState>({ phase: 'idle' });
  const [busy, setBusy] = useState(false);
  const mountedRef = useRef(false);
  const pairingRequestRef = useRef(false);
  const pairedHandledRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /*
   * `onPaired` ide kroz `ref`: ako je u zavisnostima efekta, svaki render
   * roditelja poništi i ponovo pokrene anketiranje — TV bi prestao pitati
   * tačno kad treba da pita.
   */
  const onPairedRef = useRef(onPaired);
  onPairedRef.current = onPaired;

  const startPairing = useCallback(async () => {
    if (pairingRequestRef.current) return;
    pairingRequestRef.current = true;
    pairedHandledRef.current = false;
    setBusy(true);
    try {
      const created = await requestCode();
      if (!mountedRef.current) return;
      const expiresAt = new Date(created.expiresAt).getTime();
      if (!Number.isFinite(expiresAt)) {
        throw new Error('API je vratio neispravan rok za pairing kod.');
      }
      setState({ phase: 'waiting', code: created.code, expiresAt });
    } catch (error) {
      if (!mountedRef.current) return;
      const status = isRecord(error) && isRecord(error.response) ? error.response.status : undefined;
      const message =
        typeof status === 'number'
          ? status === 404
            ? 'API nije pronašao rutu za uparivanje (HTTP 404). Ažuriraj TV aplikaciju i pokušaj ponovo.'
            : `API je odgovorio greškom HTTP ${status}. Provjeri konfiguraciju i pokušaj ponovo.`
          : error instanceof Error && error.message.includes('neispravan')
            ? error.message
            : 'TV se nije mogao povezati s API-jem. Provjeri Wi-Fi i pokušaj ponovo.';
      setState({ phase: 'error', message });
    } finally {
      pairingRequestRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  }, [requestCode]);

  /*
   * Anketiranje. Jedan interval, jedna funkcija: `setInterval` sa `async`
   * tijelom bi dozvolio preklapanje zahtjeva ako je mreža spora (2 s interval,
   * 5 s odziv) — TV bi trošio dozvoljene upite dvostruko brzo i istekao kod
   * prije vremena.
   */
  useEffect(() => {
    if (state.phase !== 'waiting') return;

    let cancelled = false;
    let inFlight = false;

    const tick = async () => {
      if (inFlight || cancelled) return;
      inFlight = true;

      try {
        if (isLocallyExpired(state.expiresAt)) {
          setState({ phase: 'expired', code: state.code });
          return;
        }

        const response = await pollCode(state.code);
        if (cancelled) return;

        const next = reduceClaim(state, response);
        if (next.phase === 'paired' && !pairedHandledRef.current) {
          pairedHandledRef.current = true;
          onPairedRef.current({
            token: next.token,
            refreshToken: next.refreshToken,
            userId: next.userId,
          });
        }
        setState(next);
      } catch {
        // Mreža je pala: ne mijenjamo stanje. TV nastavlja pitati — jedan
        // promašaj ne znači da je kod nevažeći.
      } finally {
        inFlight = false;
      }
    };

    const timer = setInterval(tick, PAIRING_POLL_INTERVAL_MS);
    void tick();

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [state, pollCode]);

  if (state.phase === 'paired') {
    return (
      <Centered preferredFocus>
        <Text style={styles.title}>TV je uparen</Text>
        <Text style={styles.hint}>Učitavam analitiku…</Text>
        <ActivityIndicator color={colors.accent} accessibilityLabel="Učitavanje" />
      </Centered>
    );
  }

  if (state.phase === 'expired') {
    return (
      <Centered>
        <Text style={styles.title}>Kod je istekao</Text>
        <Text style={styles.hint}>
          Kod vrijedi 5 minuta. Zatraži novi i upari TV ponovo.
        </Text>
        <Action onPress={startPairing} label="Novi kod" />
      </Centered>
    );
  }

  if (state.phase === 'error') {
    return (
      <Centered>
        <Text style={styles.title}>Greška</Text>
        <Text style={styles.hint}>{state.message}</Text>
        <Action onPress={startPairing} label="Pokušaj ponovo" />
      </Centered>
    );
  }

  if (state.phase === 'waiting') {
    return (
      <Centered preferredFocus>
        <Text style={styles.title}>Upari TV sa telefonom</Text>
        <View style={styles.qrBox}>
          <QRCode value={pairingDeepLink(state.code)} size={220} />
        </View>
        <Text style={styles.code}>{formatCodeForTv(state.code)}</Text>
        <Text style={styles.hint}>
          Na telefonu otvori Postavke → Uređaji → Poveži TV. Skeniraj QR kod
          kamerom ili ručno unesi kod iznad. Kod vrijedi 5 minuta.
        </Text>
        <Countdown expiresAt={state.expiresAt} />
      </Centered>
    );
  }

  return (
    <Centered>
      <Text style={styles.title}>Dobro došli</Text>
      <Text style={styles.hint}>
        Za prikaz analitike potrebno je upariti ovaj TV sa telefonom.
      </Text>
      {busy ? (
        <ActivityIndicator color={colors.accent} accessibilityLabel="Učitavanje" />
      ) : (
        <Action onPress={startPairing} label="Upari TV" />
      )}
    </Centered>
  );
}

/** Odbrojavanje — korisnik mora vidjeti da kod nije vječan. */
function Countdown({ expiresAt }: { expiresAt: number }) {
  const [left, setLeft] = useState(() => Math.max(0, expiresAt - Date.now()));

  useEffect(() => {
    const timer = setInterval(() => {
      setLeft(Math.max(0, expiresAt - Date.now()));
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const minutes = Math.floor(left / 60000);
  const seconds = Math.floor((left % 60000) / 1000);

  return (
    <Text style={styles.countdown}>
      {minutes}:{String(seconds).padStart(2, '0')}
    </Text>
  );
}

function Centered({ children, preferredFocus = false }: { children: React.ReactNode; preferredFocus?: boolean }) {
  return (
    <ScrollView
      contentContainerStyle={styles.root}
      scrollEnabled
      showsVerticalScrollIndicator={false}
      focusable
      hasTVPreferredFocus={preferredFocus}
      testID="tv-pairing-scroll-container"
    >
      {children}
    </ScrollView>
  );
}

function Action({ onPress, label }: { onPress: () => void; label: string }) {
  const [focused, setFocused] = useState(false);
  /*
   * `Pressable` sa `hasTVPreferredFocus`, NE `Text`: na TV-u se do dugmeta
   * dolazi daljinskim (D-pad), pa element mora primati fokus. `Text` sa
   * `onPress` radi mišem/kamerom, ali ne prima fokus — dugme bi bilo
   * nevidljivo za daljinski.
   */
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hasTVPreferredFocus
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.action, focused && styles.actionFocused]}
    >
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

/** TV se gleda sa 3 m — sve mjere su veće nego na telefonu. */
const styles = StyleSheet.create({
  root: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: tvLayout.safeX,
    paddingTop: tvLayout.safeY,
    // Overscan differs between TV models; keep content away from the lower
    // edge, and let the screen scroll on smaller display modes rather than clip.
    paddingBottom: tvLayout.safeY,
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: typeScale.title,
    fontFamily: fonts.sansSemiBold,
    textAlign: 'center',
  },
  hint: {
    color: colors.textMuted,
    fontSize: typeScale.body,
    fontFamily: fonts.sans,
    textAlign: 'center',
    maxWidth: scaleContent(760),
    lineHeight: scaleContent(26),
  },
  code: {
    color: colors.accent,
    fontSize: typeScale.hero,
    fontFamily: fonts.monoSemiBold,
    letterSpacing: scaleContent(6),
    fontVariant: ['tabular-nums'],
  },
  countdown: {
    color: colors.textMuted,
    fontSize: typeScale.section,
    fontFamily: fonts.mono,
    fontVariant: ['tabular-nums'],
  },
  qrBox: {
    backgroundColor: '#ffffff',
    padding: spacing.md,
    borderRadius: scaleContent(12),
  },
  action: {
    minHeight: tvLayout.minFocusTarget,
    borderRadius: scaleContent(12),
    borderWidth: tvLayout.focusBorder,
    borderColor: colors.accent,
    backgroundColor: colors.accent,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  actionFocused: { borderColor: '#ffffff', borderWidth: tvLayout.focusBorder },
  actionLabel: {
    color: colors.onAccent,
    fontSize: typeScale.section,
    fontFamily: fonts.sansSemiBold,
  },
});

export { PAIRING_LOCAL_TIMEOUT_MS };
