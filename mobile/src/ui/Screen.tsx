/**
 * `Screen` + `ScreenHeader` + `Section` — okvir svakog ekrana.
 *
 * Zašto postoji: danas svaki ekran sam radi `<Box flex={1} bg={bgColor} safeArea>`
 * i svoj header, pa se naslovi, nazad strelica i safe-area ponašaju različito
 * na 15 ekrana (Analitika uopšte nema nazad — nalaz UX-02).
 *
 * `ScreenHeader` je jedini dozvoljeni header na push ekranima: nazad, naslov,
 * opciona akcija desno. Naslov dolazi iz `t()` na nivou ekrana, nikad iz
 * navigatora.
 */

import React from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { HIT_SLOP, MIN_TOUCH, radius, space } from '../theme/tokens';
import { useTokens } from './theme';
import { Pressable } from './Pressable';
import { Text } from './Text';

type ScreenProps = {
  children: React.ReactNode;
  /**
   * Rubovi koje safe-area pokriva. Ekran unutar tab navigatora obično traži
   * `['top']` (donji rub rješava tab bar), a modalni `['top', 'bottom']`.
   */
  edges?: readonly Edge[];
  /** Pozadina; podrazumijevano `canvas` iz teme. */
  background?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Podloga ekrana sa safe-area. */
export function Screen({ children, edges = ['top'], background, style, testID }: ScreenProps) {
  const { t } = useTokens();
  return (
    <SafeAreaView
      edges={edges as Edge[]}
      style={[{ flex: 1, backgroundColor: background ?? t.canvas }, style]}
      testID={testID}
    >
      {children}
    </SafeAreaView>
  );
}

type ScreenBodyProps = {
  children: React.ReactNode;
  /** Vertikalni razmak između sekcija; `space.lg` po defaultu. */
  gap?: number;
  /** Donji padding da sadržaj ne stane pod tab bar. */
  bottomInset?: number;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  /** Kad je `false`, dijete samo skrola (npr. FlatList unutra). */
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Tijelo ekrana: standardni horizontalni padding (16) i vertikalni ritam.
 * Ekrani ne postavljaju `px` ručno — to je razlog zašto danas postoje
 * `px={4}`, `px={5}` i `px={3}` na istoj dubini hijerarhije.
 */
export function ScreenBody({
  children,
  gap = space.lg,
  bottomInset = space.xl,
  refreshControl,
  scroll = true,
  contentStyle,
  testID,
}: ScreenBodyProps) {
  const body = (
    <View style={[{ paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: bottomInset, gap }, contentStyle]}>
      {children}
    </View>
  );

  if (!scroll) return <View style={{ flex: 1 }} testID={testID}>{body}</View>;

  return (
    <ScrollView
      testID={testID}
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1 }}
      refreshControl={refreshControl}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {body}
    </ScrollView>
  );
}

type ScreenHeaderProps = {
  title: string;
  /** Podnaslov u mono fontu (npr. „3 termostata · 2 griju"). */
  subtitle?: string;
  /** Prikazuje nazad strelicu. Bez ovoga header nema lijevu zonu. */
  onBack?: () => void;
  /** Labela za čitač ekrana na nazad dugmetu. */
  backLabel?: string;
  /** Akcija desno: ikona ili kratak tekst. */
  action?: {
    icon?: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void;
    disabled?: boolean;
  };
  testID?: string;
};

/**
 * Jedini header na push ekranima. Visina je fiksna da se sadržaj ne pomjera
 * između ekrana, a dodirne zone su ≥ 44px.
 */
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  backLabel = 'Nazad',
  action,
  testID,
}: ScreenHeaderProps) {
  const { t, fonts } = useTokens();

  return (
    <View style={styles.header} testID={testID}>
      <View style={styles.headerLeft}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={backLabel}
            hitSlop={HIT_SLOP}
            style={[styles.iconButton, { borderColor: t.line, backgroundColor: t.panel }]}
            testID={testID ? `${testID}-back` : undefined}
          >
            <Ionicons name="chevron-back" size={18} color={t.ink} />
          </Pressable>
        ) : null}
        <View style={{ flexShrink: 1 }}>
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            style={{
              fontFamily: fonts.sansSemiBold,
              fontSize: 18,
              color: t.ink,
              letterSpacing: -0.2,
            }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              numberOfLines={1}
              style={{
                marginTop: 2,
                fontFamily: fonts.mono,
                fontSize: 9.5,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                color: t.inkDim,
              }}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      {action ? (
        <Pressable
          onPress={action.onPress}
          disabled={action.disabled}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          accessibilityState={{ disabled: Boolean(action.disabled) }}
          hitSlop={HIT_SLOP}
          style={[
            styles.iconButton,
            {
              borderColor: t.line,
              backgroundColor: t.panel,
              opacity: action.disabled ? 0.45 : 1,
            },
          ]}
          testID={testID ? `${testID}-action` : undefined}
        >
          {action.icon ? (
            <Ionicons name={action.icon} size={17} color={t.signal} />
          ) : (
            <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12, color: t.signal }}>
              {action.label}
            </Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

type SectionProps = {
  /** Mono labela iznad sadržaja, npr. „TERMOSTATI". */
  label?: string;
  /** Desna meta u istom redu, npr. „2 griju". */
  meta?: string;
  children: React.ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
};

/** Sekcija: mono labela + meta desno, pa sadržaj. Nema kartice, nema sjene. */
export function Section({ label, meta, children, gap = space.sm, style }: SectionProps) {
  const { t, fonts } = useTokens();
  return (
    <View style={[{ gap }, style]}>
      {label || meta ? (
        <View style={styles.sectionHead}>
          <Text
            style={{
              fontFamily: fonts.mono,
              fontSize: 9,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              color: t.inkDim,
            }}
          >
            {label ?? ''}
          </Text>
          {meta ? (
            <Text
              style={{
                fontFamily: fonts.mono,
                fontSize: 9,
                letterSpacing: 1.1,
                textTransform: 'uppercase',
                color: t.inkMuted,
              }}
            >
              {meta}
            </Text>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.md,
    gap: space.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    flex: 1,
  },
  iconButton: {
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    borderRadius: radius.control,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
