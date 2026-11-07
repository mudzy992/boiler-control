/**
 * `Led` i `StatusDot` — živo stanje kao točka + tekst, ne kao puna obojena pločica.
 *
 * Zašto: trenutni ekrani koriste `<Badge variant="solid">ZAGRIJAVA</Badge>` u punoj
 * crvenoj boji, pa je najjači element na ekranu riječ, a ne broj (nalaz UX-09).
 * LED nosi boju, tekst nosi značenje — i boja se troši samo kad je stanje živo.
 */

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { space } from '../theme/tokens';
import { useTokens } from './theme';
import { Text } from './Text';

export type LedState = 'on' | 'ok' | 'warn' | 'fault' | 'off';

export type LedProps = {
  state: LedState;
  /** Prečnik točke; 7 za liste, 5 za redove. */
  size?: number;
  style?: StyleProp<ViewStyle>;
};

/** Sama točka, bez teksta — koristi se unutar redova liste. */
export function Led({ state, size = 7, style }: LedProps) {
  const { t } = useTokens();

  const color = {
    on: t.signal,
    ok: t.ok,
    warn: t.warn,
    fault: t.fault,
    off: t.lineStrong,
  }[state];

  const halo = {
    on: t.signalSoft,
    ok: t.okSoft,
    warn: t.warnSoft,
    fault: t.faultSoft,
    off: 'transparent',
  }[state];

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: 999,
          backgroundColor: color,
        },
        halo !== 'transparent'
          ? { shadowColor: color, shadowOpacity: 0.9, shadowRadius: 4, shadowOffset: { width: 0, height: 0 }, elevation: 0 }
          : null,
        style,
      ]}
    />
  );
}

export type StatusDotProps = {
  state: LedState;
  /** Tekst stanja, uppercase mono (npr. „Grije", „Miruje"). */
  label: string;
  /** Dodatna meta poslije labela, npr. „· 01:12". */
  meta?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * LED + tekst stanja. Čitač ekrana dobija jednu rečenicu, a ne dvije odvojene
 * informacije („točka" + „grije").
 */
export function StatusDot({ state, label, meta, style }: StatusDotProps) {
  const { t, fonts } = useTokens();
  const color = {
    on: t.signalInk,
    ok: t.ok,
    warn: t.warn,
    fault: t.fault,
    off: t.inkMuted,
  }[state];

  return (
    <View
      accessible
      accessibilityLabel={`${label}${meta ? `, ${meta}` : ''}`}
      style={[styles.statusRow, style]}
    >
      <Led state={state} />
      <Text
        style={{
          fontFamily: fonts.mono,
          fontSize: 10,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          color,
        }}
      >
        {label}
      </Text>
      {meta ? (
        <Text
          style={{
            fontFamily: fonts.mono,
            fontSize: 10,
            letterSpacing: 0.6,
            color: t.inkDim,
          }}
        >
          {meta}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
  },
});
