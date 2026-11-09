/**
 * `HeatingProgressBar` — traka ciklusa grijanja (`36`).
 *
 * Čita model iz `lib/heating-progress`; sama ne računa pragove, da bi se
 * granice mogle testirati bez renderovanja.
 *
 * Tri zone su nacrtane kao slabe podloge u punoj širini, a napunjenost je
 * solidna boja *trenutne* zone. Tako se u jednom pogledu vidi i gdje je ciklus
 * sada i gdje su granice — da je samo napunjenost obojena, korisnik ne bi znao
 * gdje počinje crvena dok ne uđe u nju.
 */

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius } from '../theme/tokens';
import { useTokens } from './theme';
import type { HeatingProgressModel, HeatingZone } from '../lib/heating-progress';

export type HeatingProgressBarProps = {
  model: HeatingProgressModel;
  /** Labela za čitač ekrana; bez nje se traka preskače. */
  accessibilityLabel?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const pct = (ratio: number) => `${Math.min(1, Math.max(0, ratio)) * 100}%`;

export function HeatingProgressBar({
  model,
  accessibilityLabel,
  height = 8,
  style,
  testID,
}: HeatingProgressBarProps) {
  const { t } = useTokens();

  const zoneColor: Record<HeatingZone, string> = {
    within: t.ok,
    over: t.warn,
    beyond: t.fault,
    unknown: t.signal,
  };

  const predictedEnd = model.predictedRatio ?? model.idealRatio;

  return (
    <View
      testID={testID}
      accessible={Boolean(accessibilityLabel)}
      accessibilityRole={accessibilityLabel ? 'progressbar' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={
        accessibilityLabel
          ? {
              min: 0,
              max: Math.round(model.scaleMax),
              now: Math.round(model.elapsedMin ?? 0),
            }
          : undefined
      }
      style={[styles.track, { height, backgroundColor: t.raised, borderColor: t.line }, style]}
    >
      {/* Zone: zelena do procjene, žuta do idealnog, crvena preko. */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: pct(predictedEnd),
          backgroundColor: t.ok,
          opacity: 0.18,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: pct(predictedEnd),
          top: 0,
          bottom: 0,
          width: pct(Math.max(0, model.idealRatio - predictedEnd)),
          backgroundColor: t.warn,
          opacity: 0.18,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: pct(model.idealRatio),
          top: 0,
          bottom: 0,
          right: 0,
          backgroundColor: t.fault,
          opacity: 0.18,
        }}
      />

      {/* Napunjenost: ciklus do sada, boja trenutne zone. */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: pct(model.elapsedRatio),
          backgroundColor: zoneColor[model.zone],
          borderRadius: radius.tag,
        }}
      />

      {/* Marker proračunatog vremena dogrijavanja. */}
      {model.predictedRatio !== null ? (
        <View
          testID="heating-progress-predicted"
          style={{
            position: 'absolute',
            left: pct(model.predictedRatio),
            top: -2,
            bottom: -2,
            width: 2,
            marginLeft: -1,
            backgroundColor: t.ink,
            opacity: 0.6,
          }}
        />
      ) : null}

      {/* Granica idealnog je vidljiva samo kad skala poraste preko nje. */}
      {model.scaleMax > model.idealMin ? (
        <View
          testID="heating-progress-ideal"
          style={{
            position: 'absolute',
            left: pct(model.idealRatio),
            top: 0,
            bottom: 0,
            width: 1,
            backgroundColor: t.ink,
            opacity: 0.35,
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
