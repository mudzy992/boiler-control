/**
 * Tanki omotač oko RN `Pressable` sa tri stvari koje su danas nedosljedne:
 *
 *  1. `accessibilityRole="button"` po defaultu (postojeći ekrani ga uglavnom ne postavljaju);
 *  2. `hitSlop` 8px sa svake strane (dodirna zona ≥ 44px i za male ikone);
 *  3. jedan `pressed` stil (opacity 0.6) umjesto tri različita u kodu.
 */

import React from 'react';
import {
  Pressable as RNPressable,
  type PressableProps as RNPressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { HIT_SLOP } from '../theme/tokens';

export type PressableProps = Omit<RNPressableProps, 'style'> & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Isključi podrazumijevani `hitSlop`. */
  noHitSlop?: boolean;
};

export const Pressable = React.forwardRef<React.ElementRef<typeof RNPressable>, PressableProps>(
  function Pressable(
    { children, style, hitSlop, noHitSlop, accessibilityRole = 'button', ...rest },
    ref,
  ) {
    return (
      <RNPressable
        ref={ref}
        accessibilityRole={accessibilityRole}
        hitSlop={noHitSlop ? undefined : (hitSlop ?? HIT_SLOP)}
        style={({ pressed }) => [style, pressed ? { opacity: 0.62 } : null]}
        {...rest}
      >
        {children}
      </RNPressable>
    );
  },
);
