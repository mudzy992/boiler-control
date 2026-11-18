import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type ScrollViewProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors, fonts, spacing } from '../theme';

export type TvIconName =
  | 'home'
  | 'flame'
  | 'chart'
  | 'settings'
  | 'thermometer'
  | 'weather'
  | 'water'
  | 'cost'
  | 'bell'
  | 'profile'
  | 'calendar'
  | 'clock'
  | 'check'
  | 'chevron'
  | 'trend'
  | 'gas'
  | 'shield'
  | 'dots'
  | 'cloud'
  | 'alert';

const ICON_PATHS: Record<TvIconName, string> = {
  home: 'M3 10.5 12 3l9 7.5V21h-6v-7H9v7H3z',
  flame: 'M13.2 2.8c.7 3.1-1.1 4.4-2.5 6.1-1.2 1.5-1.6 3.3-.6 4.8-.1-2 1.2-3.2 2.5-4.1 2.6 2 4 4.1 3.6 6.5-.3 2.3-2.1 4-4.5 4-3.3 0-5.6-2.5-5.2-5.8.2-2.1 1.3-3.4 2.2-4.3C8.2 13.7 4.5 15.3 4.5 18c0 2.2 2.3 3.7 6.8 3.7 5.6 0 8.3-3.2 8.3-7.3 0-4-2.5-7.5-6.4-11.6Z',
  chart: 'M3 20V4m0 16h18M7 15l3.5-4 3 2 5.5-7',
  settings: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8.2 3.5a8.4 8.4 0 0 0-.1-1.4l1.5-1.2-1.5-2.6-1.8.6a8.3 8.3 0 0 0-2.4-1.4L15.6 3h-3.1l-.4 2.1a8.3 8.3 0 0 0-2.4 1.4l-1.8-.6-1.5 2.6 1.5 1.2a8.4 8.4 0 0 0 0 2.8l-1.5 1.2 1.5 2.6 1.8-.6a8.3 8.3 0 0 0 2.4 1.4l.4 2.1h3.1l.4-2.1a8.3 8.3 0 0 0 2.4-1.4l1.8.6 1.5-2.6-1.5-1.2c.1-.5.1-.9.1-1.4Z',
  thermometer: 'M14 14.8V5a3 3 0 0 0-6 0v9.8a5 5 0 1 0 6 0ZM11 11v7',
  weather: 'M6.5 18.5h10.8a3.7 3.7 0 0 0 .4-7.4A5.6 5.6 0 0 0 7 9.4a4.6 4.6 0 0 0-.5 9.1Z',
  water: 'M12 3s6.5 7 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 10 12 3 12 3Z',
  cost: 'M12 2v20m5-16H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  bell: 'M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4',
  profile: 'M20 21a8 8 0 0 0-16 0M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  calendar: 'M4 5h16v16H4zM8 3v4m8-4v4M4 10h16',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-16v6l4 2',
  check: 'm5 12 4 4L19 6',
  chevron: 'm9 18 6-6-6-6',
  trend: 'M3 17l6-6 4 3 8-9m-7 0h7v7',
  gas: 'M7 3v7m4-7v7M5 10h8v3a4 4 0 0 1-4 4v4m8-18v18m0-18c3 2 4 5 4 9h-4',
  shield: 'M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Zm-3-11 2 2 4-4',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
  cloud: 'M6.5 18.5h10.8a3.7 3.7 0 0 0 .4-7.4A5.6 5.6 0 0 0 7 9.4a4.6 4.6 0 0 0-.5 9.1Z',
  alert: 'M12 3 2.8 20h18.4L12 3Zm0 6v5m0 3h.01',
};

export function TvIcon({
  name,
  size = 20,
  color = colors.textMuted,
  strokeWidth = 1.8,
}: {
  name: TvIconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {name === 'flame' ? (
        <Path d={ICON_PATHS[name]} fill={color} stroke={color} strokeWidth={1} strokeLinejoin="round" />
      ) : (
        <Path
          d={ICON_PATHS[name]}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {name === 'thermometer' ? <Circle cx="11" cy="16" r="1.3" fill={color} /> : null}
    </Svg>
  );
}

export function TvText({
  children,
  style,
  tone = 'primary',
  size = 'body',
  numberOfLines,
}: {
  children: React.ReactNode;
  style?: TextStyle | TextStyle[];
  tone?: 'primary' | 'muted' | 'dim' | 'signal' | 'ok' | 'warn' | 'fault';
  size?: 'hero' | 'title' | 'section' | 'body' | 'small' | 'micro';
  numberOfLines?: number;
}) {
  const color = {
    primary: colors.text,
    muted: colors.textMuted,
    dim: colors.textDim,
    signal: colors.accent,
    ok: colors.success,
    warn: colors.warning,
    fault: colors.fault,
  }[tone];
  const fontSize = { hero: 37, title: 29, section: 17, body: 14, small: 12, micro: 10 }[size];
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[{ color, fontFamily: size === 'hero' ? fonts.sansBold : fonts.sans, fontSize }, style]}
    >
      {children}
    </Text>
  );
}

export function TvPageHeading({
  eyebrow,
  title,
  subtitle,
  right,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.pageHeading}>
      <View style={styles.headingText}>
        <TvText size="micro" tone="signal" style={styles.eyebrow}>{eyebrow}</TvText>
        <TvText size="hero" style={styles.pageTitle}>{title}</TvText>
        {subtitle ? <TvText size="small" tone="muted" style={styles.headingSubtitle}>{subtitle}</TvText> : null}
      </View>
      {right ? <View style={styles.headingRight}>{right}</View> : null}
    </View>
  );
}

export function TvCard({
  children,
  style,
  onPress,
  focused,
  testID,
  accessibilityLabel,
  containerStyle,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  containerStyle?: ViewStyle | ViewStyle[];
  onPress?: () => void;
  focused?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const [focus, setFocus] = React.useState(false);
  const content = (
    <View style={[styles.card, focus && styles.cardFocused, focused && styles.cardFocused, style]} testID={testID}>
      {children}
    </View>
  );
  if (!onPress) {
    return (
      <View
        style={containerStyle}
        focusable
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        accessibilityLabel={accessibilityLabel}
      >
        {content}
      </View>
    );
  }
  return (
    <Pressable
      focusable
      onPress={onPress}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.pressableCard, containerStyle]}
      testID={testID}
    >
      <View style={[styles.card, focus && styles.cardFocused, style]}>{children}</View>
    </Pressable>
  );
}

export function TvCardTitle({
  title,
  subtitle,
  icon,
  iconColor = colors.accent,
  right,
}: {
  title: string;
  subtitle?: string;
  icon?: TvIconName;
  iconColor?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.cardTitleRow}>
      {icon ? (
        <View style={[styles.cardIcon, { backgroundColor: `${iconColor}1c` }]}>
          <TvIcon name={icon} size={22} color={iconColor} />
        </View>
      ) : null}
      <View style={styles.cardTitleCopy}>
        <TvText size="section" style={styles.cardTitle}>{title}</TvText>
        {subtitle ? <TvText size="micro" tone="dim" style={styles.cardSubtitle}>{subtitle}</TvText> : null}
      </View>
      {right ? <View style={styles.cardTitleRight}>{right}</View> : null}
    </View>
  );
}

export function TvMetricCard({
  label,
  value,
  unit,
  meta,
  icon,
  tone = 'primary',
  onPress,
  testID,
}: {
  label: string;
  value: string;
  unit?: string;
  meta?: string;
  icon: TvIconName;
  tone?: 'primary' | 'signal' | 'ok' | 'warn';
  onPress?: () => void;
  testID?: string;
}) {
  const tint = tone === 'signal' ? colors.accent : tone === 'ok' ? colors.success : tone === 'warn' ? colors.warning : colors.text;
  return (
    <TvCard onPress={onPress} testID={testID} containerStyle={{ flex: 1 }}>
      <View style={styles.metricHead}>
        <TvText size="small" tone="muted" style={styles.metricLabel}>{label}</TvText>
        <View style={[styles.metricIcon, { backgroundColor: `${tint}1c` }]}>
          <TvIcon name={icon} size={23} color={tint} />
        </View>
      </View>
      <View style={styles.metricValueRow}>
        <TvText size="hero" style={styles.metricValue}>{value}</TvText>
        {unit ? <TvText size="small" tone="muted" style={styles.metricUnit}>{unit}</TvText> : null}
      </View>
      {meta ? <TvText size="micro" tone="dim" style={styles.metricMeta}>{meta}</TvText> : null}
    </TvCard>
  );
}

export function TvStatusPill({
  label,
  tone = 'ok',
  icon,
}: {
  label: string;
  tone?: 'ok' | 'signal' | 'warn' | 'fault' | 'neutral';
  icon?: TvIconName;
}) {
  const tint = tone === 'signal' ? colors.accent : tone === 'warn' ? colors.warning : tone === 'fault' ? colors.fault : tone === 'neutral' ? colors.textDim : colors.success;
  return (
    <View style={[styles.statusPill, { borderColor: `${tint}44`, backgroundColor: `${tint}15` }]}>
      {icon ? <TvIcon name={icon} size={13} color={tint} /> : <View style={[styles.statusDot, { backgroundColor: tint }]} />}
      <TvText size="micro" style={{ color: tint, fontFamily: fonts.sansSemiBold, letterSpacing: 0.8 }}>{label}</TvText>
    </View>
  );
}

export function TvChip({
  label,
  active,
  onPress,
  testID,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      focusable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      testID={testID}
    >
      <TvText size="micro" style={{ fontFamily: fonts.sansSemiBold, letterSpacing: 0.6, color: active ? colors.accent : colors.textDim }}>{label}</TvText>
    </Pressable>
  );
}

export function TvSectionTitle({
  title,
  meta,
  action,
}: {
  title: string;
  meta?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionTitle}>
      <View>
        <TvText size="section" style={styles.sectionHeading}>{title}</TvText>
        {meta ? <TvText size="micro" tone="dim" style={styles.sectionMeta}>{meta}</TvText> : null}
      </View>
      {action ? <View>{action}</View> : null}
    </View>
  );
}

export function TvDataRow({
  label,
  value,
  detail,
  icon,
  tone = 'muted',
}: {
  label: string;
  value: string;
  detail?: string;
  icon?: TvIconName;
  tone?: 'primary' | 'muted' | 'dim' | 'ok' | 'warn' | 'fault';
}) {
  return (
    <View style={styles.dataRow}>
      <View style={styles.dataRowLeft}>
        {icon ? <TvIcon name={icon} size={17} color={colors.textDim} /> : null}
        <View style={styles.dataRowCopy}>
          <TvText size="small" tone="muted" style={styles.dataRowLabel}>{label}</TvText>
          {detail ? <TvText size="micro" tone="dim" style={styles.dataRowDetail}>{detail}</TvText> : null}
        </View>
      </View>
      <TvText size="small" tone={tone} style={styles.dataRowValue}>{value}</TvText>
    </View>
  );
}

export function TvScrollView({
  children,
  contentContainerStyle,
  style,
  ...props
}: ScrollViewProps) {
  return (
    <ScrollView
      style={[styles.scroll, style]}
      contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
      showsVerticalScrollIndicator
      scrollEnabled
      {...props}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: 42, gap: spacing.md },
  pageHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, marginBottom: 4 },
  headingText: { flexShrink: 1 },
  eyebrow: { letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 5, fontFamily: fonts.mono },
  pageTitle: { fontSize: 33, letterSpacing: -0.8, fontFamily: fonts.sansSemiBold },
  headingSubtitle: { marginTop: 7 },
  headingRight: { alignItems: 'flex-end', justifyContent: 'flex-end' },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: spacing.lg, gap: spacing.sm },
  cardFocused: { borderColor: colors.accent, shadowColor: colors.accent, shadowOpacity: 0.19, shadowRadius: 12, elevation: 5 },
  pressableCard: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 3 },
  cardIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitleCopy: { flex: 1, minWidth: 0 },
  cardTitle: { fontFamily: fonts.sansSemiBold, fontSize: 15 },
  cardSubtitle: { marginTop: 3 },
  cardTitleRight: { marginLeft: 'auto' },
  metricHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  metricLabel: { fontFamily: fonts.sansMedium, fontSize: 11 },
  metricIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  metricValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 7, marginTop: 6 },
  metricValue: { fontSize: 35, lineHeight: 41, letterSpacing: -1.2, fontFamily: fonts.monoSemiBold },
  metricUnit: { fontFamily: fonts.sansMedium },
  metricMeta: { marginTop: 1 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 99, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 5 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  chipActive: { borderColor: `${colors.accent}55`, backgroundColor: `${colors.accent}1c` },
  chipText: { fontFamily: fonts.sansSemiBold, letterSpacing: 0.6, color: colors.textDim },
  chipTextActive: { color: colors.accent },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sectionHeading: { fontFamily: fonts.sansSemiBold },
  sectionMeta: { marginTop: 4 },
  dataRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomColor: `${colors.text}0d`, borderBottomWidth: StyleSheet.hairlineWidth },
  dataRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  dataRowCopy: { flex: 1 },
  dataRowLabel: { fontFamily: fonts.sansMedium },
  dataRowDetail: { marginTop: 3 },
  dataRowValue: { fontFamily: fonts.mono, textAlign: 'right' },
});
