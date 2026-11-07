/**
 * `Button` i `IconButton` — akcija sa jasnom hijerarhijom.
 *
 * Zašto: danas primarna akcija ima tri različita izgleda (`bg="brand.500"` sa
 * `rounded="md"`, `bg="brand.500"` sa `rounded="lg"`, i `Button` iz `controls.tsx`),
 * a `isLoading` stanje ne mijenja širinu pa dugme „skače".
 *
 * Pravilo: na jednom ekranu smije biti **jedno** `primary` dugme. Sve ostalo je
 * `secondary` ili `ghost`.
 */

import React from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { HIT_SLOP, MIN_TOUCH, radius, space } from '../theme/tokens';
import { useTokens } from './theme';
import { Pressable } from './Pressable';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /** Puna širina; koristi se u bottom sheetovima i formama. */
  block?: boolean;
  loading?: boolean;
  disabled?: boolean;
  /** Ikonica lijevo (npr. „＋"). */
  leftIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  testID?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  block = false,
  loading = false,
  disabled = false,
  leftIcon,
  style,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const { t, fonts } = useTokens();
  const isDisabled = disabled || loading;

  const palette = {
    primary: { bg: t.signal, border: t.signal, fg: t.onSignal },
    secondary: { bg: t.raised, border: t.lineStrong, fg: t.ink },
    ghost: { bg: 'transparent', border: t.line, fg: t.inkMuted },
    danger: { bg: 'transparent', border: t.lineStrong, fg: t.fault },
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      hitSlop={HIT_SLOP}
      testID={testID}
      style={[
        styles.button,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: isDisabled ? 0.5 : 1,
        },
        block ? { alignSelf: 'stretch' } : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.fg} />
      ) : (
        <View style={styles.content}>
          {leftIcon}
          <Text style={{ fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: palette.fg }}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export type IconButtonProps = {
  icon: React.ReactNode;
  /** Obavezna labela — ikone bez teksta su nedostupne čitaču ekrana (nalaz UX-06). */
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function IconButton({ icon, accessibilityLabel, onPress, disabled, style, testID }: IconButtonProps) {
  const { t } = useTokens();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      hitSlop={HIT_SLOP}
      testID={testID}
      style={[
        styles.iconButton,
        { backgroundColor: t.panel, borderColor: t.line, opacity: disabled ? 0.45 : 1 },
        style,
      ]}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: space.lg,
    borderRadius: radius.control,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconButton: {
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    borderRadius: radius.control,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
