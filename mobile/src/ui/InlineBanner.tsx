/**
 * `InlineBanner` — jedna traka za info / ok / warn / fault.
 *
 * Zašto: u kodu postoji 9 ručno sastavljenih `<Box bg="green.500">` toastova i
 * desetine obojenih kutija (`blue.50`, `red.50`, `green.50`) — svaka s drugim
 * paddingom i drugom nijansom. Banner je jedan obrazac: hairline okvir, 2px
 * lijeva ivica u boji, naslov + poruka, opciona akcija.
 *
 * Mijenja i ponašanje: banner se **ne renderuje kad nema sadržaja** (danas se
 * prazna obojena kutija zna pojaviti kad nema upozorenja).
 */

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { fontSize as fs, radius, space } from '../theme/tokens';
import { useTokens } from './theme';
import { Pressable } from './Pressable';
import { Text } from './Text';

export type BannerTone = 'info' | 'ok' | 'warn' | 'fault';

export type InlineBannerProps = {
  tone: BannerTone;
  title: string;
  /** Dodatna rečenica; opciona. */
  message?: string;
  /** Akcija desno: npr. „Pokušaj". */
  action?: { label: string; onPress: () => void; loading?: boolean };
  /** Meta ispod (npr. „prije 4 min"). */
  meta?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function InlineBanner({
  tone,
  title,
  message,
  action,
  meta,
  style,
  testID,
}: InlineBannerProps) {
  const { t, fonts } = useTokens();

  const accent = {
    info: t.info,
    ok: t.ok,
    warn: t.warn,
    fault: t.fault,
  }[tone];

  const icon = {
    info: 'information-circle-outline',
    ok: 'checkmark-circle-outline',
    warn: 'warning-outline',
    fault: 'alert-circle-outline',
  }[tone] as keyof typeof Ionicons.glyphMap;

  return (
    <View
      accessible={!action}
      accessibilityRole="alert"
      accessibilityLabel={`${title}${message ? `. ${message}` : ''}${meta ? `. ${meta}` : ''}`}
      testID={testID}
      style={[
        styles.banner,
        { backgroundColor: t.raised, borderColor: t.line, borderLeftColor: accent },
        style,
      ]}
    >
      <Ionicons name={icon} size={14} color={accent} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fonts.sansMedium, fontSize: fs.bodyLg, color: t.ink }}>{title}</Text>
        {message ? (
          <Text style={{ fontFamily: fonts.sans, fontSize: fs.body, color: t.inkMuted, lineHeight: fs.body * 1.35 }}>
            {message}
          </Text>
        ) : null}
        {meta ? (
          <Text
            style={{
              fontFamily: fonts.mono,
              fontSize: fs.label,
              letterSpacing: 0.5,
              color: t.inkDim,
              marginTop: 1,
            }}
          >
            {meta}
          </Text>
        ) : null}
      </View>
      {action ? (
        <Pressable
          onPress={action.onPress}
          disabled={action.loading}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          style={[styles.action, { borderColor: t.lineStrong }]}
        >
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: fs.body, color: t.ink }}>
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    borderWidth: 1,
    borderLeftWidth: 2,
    borderRadius: radius.control,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  action: {
    borderWidth: 1,
    borderRadius: radius.tag,
    paddingHorizontal: 9,
    paddingVertical: 5,
    alignSelf: 'center',
  },
});
