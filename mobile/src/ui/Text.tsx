/**
 * Tekstualni primitivi: `Text`, `MonoLabel`, `MonoMeta`, `Heading`.
 *
 * Zašto: danas se u svakom ekranu ručno bira `useColorModeValue` za boju i
 * `fontSize="xs"|"sm"|"md"`, pa ista uloga teksta ima pet izgleda. Ovdje uloga
 * bira stil — `MonoLabel` je uvijek mono 9px uppercase, `MonoMeta` uvijek
 * mono 10px `inkDim`.
 */

import React from 'react';
import { StyleSheet, Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { fontSize as fs } from '../theme/tokens';
import { useTokens } from './theme';

export type TextProps = RNTextProps & {
  /** Semantička boja; podrazumijevano `ink`. */
  tone?: 'ink' | 'muted' | 'dim' | 'signal' | 'ok' | 'warn' | 'fault' | 'info';
  /** Veličina iz skale; podrazumijevano tijelo 13. */
  size?: 'label' | 'meta' | 'body' | 'bodyLg' | 'section' | 'title';
  weight?: 'regular' | 'medium' | 'semibold' | 'bold' | 'mono' | 'monoMedium' | 'monoSemiBold';
  align?: 'left' | 'center' | 'right';
  children?: React.ReactNode;
};

export function Text({
  tone = 'ink',
  size = 'bodyLg',
  weight = 'regular',
  align,
  style,
  children,
  ...rest
}: TextProps) {
  const { t, fonts } = useTokens();

  const color = {
    ink: t.ink,
    muted: t.inkMuted,
    dim: t.inkDim,
    signal: t.signalInk,
    ok: t.ok,
    warn: t.warn,
    fault: t.fault,
    info: t.info,
  }[tone];

  const family = {
    regular: fonts.sans,
    medium: fonts.sansMedium,
    semibold: fonts.sansSemiBold,
    bold: fonts.sansBold,
    mono: fonts.mono,
    monoMedium: fonts.monoMedium,
    monoSemiBold: fonts.monoSemiBold,
  }[weight];

  return (
    <RNText
      style={[
        { fontFamily: family, fontSize: fs[size], color },
        align ? { textAlign: align } : null,
        style,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
}

/** Mono mikro-labela iznad blokova: 9px, uppercase, tracking 1.4. */
export function MonoLabel({
  children,
  tone = 'dim',
  style,
}: {
  children: React.ReactNode;
  tone?: TextProps['tone'];
  style?: TextProps['style'];
}) {
  return (
    <Text weight="mono" size="label" tone={tone} style={[styles.label, style]}>
      {children}
    </Text>
  );
}

/** Mono meta ispod broja: 10px, bez uppercase-a. */
export function MonoMeta({
  children,
  tone = 'dim',
  style,
}: {
  children: React.ReactNode;
  tone?: TextProps['tone'];
  style?: TextProps['style'];
}) {
  return (
    <Text weight="mono" size="meta" tone={tone} style={style}>
      {children}
    </Text>
  );
}

/** Naslov ekrana/sekcije. `accessibilityRole="header"` da čitač ekrana preskače. */
export function Heading({
  children,
  level = 'screen',
  style,
}: {
  children: React.ReactNode;
  level?: 'screen' | 'section';
  style?: TextProps['style'];
}) {
  return (
    <Text
      accessibilityRole="header"
      weight={level === 'screen' ? 'semibold' : 'medium'}
      size={level === 'screen' ? 'title' : 'section'}
      style={style}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: {
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
});
