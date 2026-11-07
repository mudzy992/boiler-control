/**
 * `GaugeBar` — progres sa opcionim markerom cilja.
 *
 * Zašto: trenutni ekrani nemaju nijedan vizuelni pokazatelj „koliko smo blizu
 * cilja" — samo dva broja jedan pored drugog (`52.4` i `54.0`), pa korisnik
 * mora sam računati. Gauge nosi tu informaciju bez teksta i bez trećeg broja.
 *
 * Pristupačnost: `accessibilityRole="progressbar"` + `accessibilityValue`,
 * pa TalkBack izgovori „52 posto" umjesto da preskoči traku.
 */

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius } from '../theme/tokens';
import { useTokens } from './theme';

export type GaugeTone = 'signal' | 'ok' | 'warn' | 'fault' | 'muted';

export type GaugeBarProps = {
  /** Napunjenost 0–1. Vrijednosti van raspona se klampuju. */
  value: number;
  /** Opcioni marker cilja, 0–1 (npr. ciljna temperatura u rasponu min–max). */
  target?: number;
  tone?: GaugeTone;
  /** Visina trake; 4 za redove, 6 za hero. */
  height?: number;
  /** Labela za čitač ekrana; bez nje se bar preskače. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

export function GaugeBar({
  value,
  target,
  tone = 'signal',
  height = 4,
  accessibilityLabel,
  style,
  testID,
}: GaugeBarProps) {
  const { t } = useTokens();
  const pct = clamp01(value);
  const targetPct = target === undefined ? undefined : clamp01(target);

  const fill = {
    signal: t.signal,
    ok: t.ok,
    warn: t.warn,
    fault: t.fault,
    muted: t.lineStrong,
  }[tone];

  return (
    <View
      testID={testID}
      // `accessible` je obavezan: bez njega RN ne izlaže `progressbar` u a11y
      // stablo, pa TalkBack preskoči traku i korisnik ne dobije vrijednost.
      accessible={Boolean(accessibilityLabel)}
      accessibilityRole={accessibilityLabel ? 'progressbar' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={
        accessibilityLabel
          ? { min: 0, max: 100, now: Math.round(pct * 100) }
          : undefined
      }
      style={[
        styles.track,
        { height, backgroundColor: t.raised, borderColor: t.line },
        style,
      ]}
    >
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: `${pct * 100}%`,
          backgroundColor: fill,
          borderRadius: radius.tag,
        }}
      />
      {targetPct !== undefined ? (
        <View
          style={{
            position: 'absolute',
            left: `${targetPct * 100}%`,
            top: -1,
            bottom: -1,
            width: 2,
            marginLeft: -1,
            backgroundColor: t.ink,
            opacity: 0.55,
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    borderRadius: radius.tag,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
