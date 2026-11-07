/**
 * `Readout` i `Kpi` — brojevi kao instrument, ne kao tekst.
 *
 * Zašto: u trenutnom kodu tri ekrana ispisuju temperaturu sa `<Text fontSize="4xl">`,
 * `<Text fontSize="3xl">` i `<Text fontSize="2xl">` u tri različite težine, a
 * brojevi nisu tabularni — pa se vrijednost koja se osvježava svakih 60 s
 * horizontalno pomjera. IBM Plex Mono je tabularan po dizajnu i rješava to.
 */

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { fontSize as fs } from '../theme/tokens';
import { useTokens } from './theme';
import { Pressable } from './Pressable';
import { MonoLabel, Text } from './Text';

export type ReadoutSize = 'md' | 'lg' | 'xl';

const sizeMap: Record<ReadoutSize, number> = {
  md: 16,
  lg: fs.readoutLg,
  xl: fs.readoutXl,
};

export type ReadoutProps = {
  /** Vrijednost; već formatirana (npr. „52.4", „12 480.5"). */
  value: string | number;
  /** Jedinica, ispisuje se manjim mono fontom. */
  unit?: string;
  size?: ReadoutSize;
  /** Boja broja; podrazumijevano `ink`, `signal` za živo stanje. */
  tone?: 'ink' | 'muted' | 'dim' | 'signal' | 'ok' | 'warn' | 'fault';
  /** Precrtava vrijednost kad su podaci stari (npr. veza pala). */
  stale?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
};

/** Broj + jedinica u jednom redu, poravnato po baznoj liniji. */
export function Readout({
  value,
  unit,
  size = 'lg',
  tone = 'ink',
  stale = false,
  style,
  accessibilityLabel,
  testID,
}: ReadoutProps) {
  const { t, fonts } = useTokens();
  const color = {
    ink: t.ink,
    muted: t.inkMuted,
    dim: t.inkDim,
    signal: t.signalInk,
    ok: t.ok,
    warn: t.warn,
    fault: t.fault,
  }[tone];

  return (
    <View
      accessible={Boolean(accessibilityLabel)}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={[styles.readoutRow, stale ? { opacity: 0.35 } : null, style]}
    >
      <Text
        style={{
          fontFamily: fonts.monoSemiBold,
          fontSize: sizeMap[size],
          lineHeight: sizeMap[size] * 1.05,
          letterSpacing: -0.5,
          color,
          fontVariant: ['tabular-nums'],
        }}
      >
        {String(value)}
      </Text>
      {unit ? (
        <Text
          style={{
            fontFamily: fonts.mono,
            fontSize: size === 'xl' ? 13 : 11,
            marginLeft: 3,
            marginBottom: size === 'xl' ? 4 : 2,
            color: t.inkMuted,
          }}
        >
          {unit}
        </Text>
      ) : null}
    </View>
  );
}

export type KpiProps = {
  /** Mono labela iznad broja. */
  label: string;
  value: string | number;
  unit?: string;
  /** Mala meta ispod broja (npr. „osjećaj −5" ili „online"). */
  meta?: string;
  /** Statusna točka lijevo od mete. */
  tone?: 'neutral' | 'ok' | 'warn' | 'fault' | 'signal';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * KPI pločica: labela, broj, meta. Ista visina za sve tri u redu, pa Početna
 * može staviti tri KPI-ja u jedan red bez kartica (nalaz UX-09 / prototip §02).
 */
export function Kpi({ label, value, unit, meta, tone = 'neutral', onPress, style, testID }: KpiProps) {
  const { t, fonts } = useTokens();
  const dotColor = {
    neutral: t.lineStrong,
    ok: t.ok,
    warn: t.warn,
    fault: t.fault,
    signal: t.signal,
  }[tone];

  const content = (
    <View
      testID={testID}
      style={[
        styles.kpi,
        { backgroundColor: t.raised, borderColor: t.line },
        style,
      ]}
    >
      <MonoLabel style={{ letterSpacing: 1.2 }}>{label}</MonoLabel>
      <Readout value={value} unit={unit} size="lg" style={{ marginTop: 4 }} />
      {meta ? (
        <View style={styles.metaRow}>
          {tone !== 'neutral' ? (
            <View style={[styles.dot, { backgroundColor: dotColor }]} />
          ) : null}
          <Text
            style={{
              fontFamily: fonts.mono,
              fontSize: 9,
              letterSpacing: 0.4,
              color: tone === 'neutral' ? t.inkDim : dotColor,
            }}
          >
            {meta}
          </Text>
        </View>
      ) : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ''}`}
      style={{ flex: 1 }}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  readoutRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  kpi: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 999,
  },
});
