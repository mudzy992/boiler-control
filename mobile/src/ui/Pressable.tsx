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

/**
 * F9 (PRESS-01) — `cssInterop={false}` nije kozmetika, nego popravka kvara.
 *
 * Na uređaju su svi elementi izgrađeni na ovom primitivu izgledali RAZLOŽENO:
 * u sheetu „Dodaj očitanje" dugmad „Izaberi sliku" i „Uslikaj" nisu imala ni
 * pozadinu ni visinu, a redovi akcija očitanja složili su se u kolonu (ikona,
 * pa tekst, pa strelica — svaki u svom redu). Isto se vidi na dugmetu „Sada".
 *
 * Uzrok: `style` je funkcija (`({ pressed }) => [...]`). NativeWind 4 preslikava
 * `style` kroz `cssInterop`, a funkcijski stil se ne može izračunati pri
 * preslikavanju — na Androidu tada propadne dio stila, uključujući
 * `flexDirection: 'row'`, pa roditelj postane kolona.
 *
 * `cssInterop={false}` isključuje taj omotač za OVAJ element (zvanični izlaz iz
 * NativeWind-a), pa `style` ide direktno u RN `Pressable`. Zadržavamo
 * funkcijski stil jer nam treba `pressed` stanje; klase (`className`) ovaj
 * primitiv ne koristi, pa ništa ne gubimo.
 */
export const Pressable = React.forwardRef<React.ElementRef<typeof RNPressable>, PressableProps>(
  function Pressable(
    { children, style, hitSlop, noHitSlop, accessibilityRole = 'button', ...rest },
    ref,
  ) {
    return (
      <RNPressable
        ref={ref}
        cssInterop={false}
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
