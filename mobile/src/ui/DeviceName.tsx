/**
 * `DeviceName` — naziv uređaja/doma, obavezno velikim slovima.
 *
 * Zašto komponenta, a ne `style` na svakom mjestu: korisnik je tražio da naziv
 * uređaja bude velikim slovima **svuda**, i to je sada jedno pravilo na jednom
 * mjestu. Ekrani ne mogu „zaboraviti" transformaciju, a izgled je isti na
 * Početnoj, Grijanju, Analitici, Rasporedu i u Plinu.
 *
 * `textTransform` je stil, ne `toUpperCase()`: podatak ostaje netaknut, pa
 * čitač ekrana izgovara prirodan naziv („Boiler Living Room"), pretraga radi
 * bez obzira na veličinu slova, a kopiranje teksta daje ono što piše u bazi.
 *
 * `numberOfLines={1}` + `flexShrink` su dio pravila: duga naziv uređaja ne
 * smije razbiti red u kartici (to se dešavalo na 360 px ekranima).
 */

import type { StyleProp, TextStyle } from 'react-native';

import { Text } from './Text';

export type DeviceNameProps = {
  /** Naziv uređaja doma ili termostata. */
  name?: string | null;
  /** Rezerva kad naziva nema (`#12`, „Termostat"). */
  fallback?: string;
  size?: 'meta' | 'body' | 'bodyLg' | 'section' | 'title';
  weight?: 'regular' | 'medium' | 'semibold';
  tone?: 'ink' | 'muted' | 'dim' | 'signal';
  style?: StyleProp<TextStyle>;
  testID?: string;
};

export function DeviceName({
  name,
  fallback = '—',
  size = 'body',
  weight = 'medium',
  tone = 'ink',
  style,
  testID,
}: DeviceNameProps) {
  const label = name && name.trim().length > 0 ? name : fallback;
  return (
    <Text
      size={size}
      weight={weight}
      tone={tone}
      numberOfLines={1}
      testID={testID}
      style={[{ textTransform: 'uppercase', letterSpacing: 0.3, flexShrink: 1 }, style]}
    >
      {label}
    </Text>
  );
}
