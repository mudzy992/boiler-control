/**
 * `Panel` i `HeroPanel` — površina bez sjene: hairline ivica + radijus 4.
 *
 * Zašto bez sjene: u trenutnom kodu ima 35 upotreba `shadow` (do `shadow={9}`),
 * pa je svaka kartica podignuta i ništa nije važnije od ničega (nalaz UX-08).
 * Dubinu ovdje nosi ivica, a hijerarhiju `HeroPanel` (1px signalna ivica).
 */

import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, space } from '../theme/tokens';
import { useTokens } from './theme';

export type PanelProps = {
  children: React.ReactNode;
  /** `plain` = panel; `hero` = istaknuti blok sa signalnom ivicom. */
  variant?: 'plain' | 'hero' | 'flush';
  /** Bez unutrašnjeg paddinga (kad sadržaj sam nosi redove). */
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
};

export function Panel({
  children,
  variant = 'plain',
  padded = true,
  style,
  accessibilityLabel,
  testID,
}: PanelProps) {
  const { t } = useTokens();

  const base: ViewStyle =
    variant === 'hero'
      ? {
          backgroundColor: t.panel,
          borderColor: t.lineStrong,
          borderLeftColor: t.signal,
          borderLeftWidth: 2,
        }
      : {
          backgroundColor: t.panel,
          borderColor: t.line,
        };

  return (
    <View
      accessible={Boolean(accessibilityLabel)}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={[
        styles.panel,
        base,
        padded && variant !== 'flush' ? { padding: space.md } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Istaknuti blok: signalna ivica lijevo, ista površina kao panel. */
export function HeroPanel({
  children,
  style,
  testID,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <Panel variant="hero" style={style} testID={testID}>
      {children}
    </Panel>
  );
}

/** Horizontalni razdjelnik unutar panela. */
export function PanelDivider({ style }: { style?: StyleProp<ViewStyle> }) {
  const { t } = useTokens();
  return <View style={[{ height: StyleSheet.hairlineWidth * 2, backgroundColor: t.line }, style]} />;
}

/** Red unutar `flush` panela: fiksni padding + razdjelnik prema sljedećem. */
export function PanelRow({
  children,
  divider = true,
  style,
  accessibilityLabel,
  testID,
}: {
  children: React.ReactNode;
  divider?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const { t } = useTokens();
  return (
    <View
      accessible={Boolean(accessibilityLabel)}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={[
        styles.row,
        divider ? { borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: t.line } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: radius.panel,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    paddingHorizontal: space.md,
    paddingVertical: 10,
  },
});
