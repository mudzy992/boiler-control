/**
 * Analitika — jedini ekran TV aplikacije.
 *
 * **Zašto samo jedan ekran.** TV se gleda sa 3 m i upravlja daljinskim sa 5
 * dugmadi. Svaki dodatni ekran traži navigaciju koju korisnik ne može da
 * savlada bez uputstva. Korisnik pali TV da vidi **koliko troši**, ne da
 * upravlja kotlom — upravljanje ostaje na telefonu.
 *
 * **Zašto TV ne može ništa promijeniti.** Vidi `services/api/client.ts`:
 * interceptor odbija svaki zahtjev koji nije GET. Ovo nije ekran bez dugmadi
 * iz nedostatka vremena, nego ekran koji **ne može** poslati izmjenu.
 */
import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text as NativeText,
  View,
  type TextProps,
} from 'react-native';

import {
  buildTvOverview,
  describeFreshness,
  type GasAnalyticsLike,
  type TvDashboardLike,
  type TvOverviewCard,
} from '../lib/analytics';
import { colors, fonts, spacing, typeScale, tvLayout } from '../theme';
import { translateText } from '../config';

function Text({ children, ...props }: TextProps) {
  return <NativeText {...props}>{typeof children === 'string' ? translateText(children) : children}</NativeText>;
}

export interface AnalyticsScreenProps {
  /** Odgovor `GET /api/gas/analysis`, ili `null` dok se učitava. */
  analysis: GasAnalyticsLike | null;
  /** Temperatura vani, polazna voda i termostat iz `GET /api/dashboard`. */
  dashboard: TvDashboardLike | null;
  /**
   * Nova verzija TV aplikacije, ili `null`.
   *
   * **Samo obavijest, bez dugmeta za instalaciju.** Android traži
   * `REQUEST_INSTALL_PACKAGES` i sistemsku potvrdu za svaku instalaciju van
   * prodavnice; na TV-u ta potvrda prekrije cijeli ekran i traži daljinski.
   * Zato TV kaže da nova verzija postoji i pokaže broj — instalaciju pokreće
   * onaj ko zna šta radi.
   */
  updateAvailable?: { version: string } | null;
  loading: boolean;
  error: string | null;
  /** Vrijeme zadnjeg uspješnog osvježavanja; `null` = nikad. */
  updatedAt: number | null;
  /** Prevodi ključ metrike (`gas.metricTotalConsumption`). */
  translate: (key: string) => string;
}

export function AnalyticsScreen({
  analysis,
  dashboard,
  updateAvailable,
  loading,
  error,
  updatedAt,
  translate,
}: AnalyticsScreenProps) {
  if (loading && !analysis && !dashboard) {
    return (
      <Centered>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.muted}>Učitavam analitiku…</Text>
      </Centered>
    );
  }

  if (error && !analysis && !dashboard) {
    return (
      <Centered>
        <Text style={styles.fault}>Analitika nije dostupna</Text>
        <Text style={styles.muted}>{error}</Text>
      </Centered>
    );
  }

  const cards = buildTvOverview(analysis, dashboard);
  const freshness = describeFreshness(updatedAt);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.root}
      scrollEnabled
      showsVerticalScrollIndicator
      testID="tv-analytics-scroll"
    >
      <View style={styles.header}>
        <Text style={styles.title}>Analitika</Text>
        <FreshnessBadge freshness={freshness} />
      </View>

      {updateAvailable ? (
        /*
         * Traka je iznad metrika i ostaje dok je nova verzija objavljena.
         * Namjerno NIJE modalni dijalog: TV nema način da ga zatvori bez
         * daljinskog, a poruka nije hitna.
         */
        <View style={styles.updateBar} testID="tv-update-banner">
          <Text style={styles.updateText}>
            Dostupna je nova verzija TV aplikacije: v{updateAvailable.version}
          </Text>
        </View>
      ) : null}

      {error ? (
        <Text style={styles.partialFault}>
          Neki podaci nisu osvježeni: {error}
        </Text>
      ) : null}

      <View style={styles.cardRow}>
        <MetricCard metric={cards[0]} translate={translate} preferredFocus />
        <MetricCard metric={cards[1]} translate={translate} />
      </View>
      <View style={styles.cardRow}>
        <MetricCard metric={cards[2]} translate={translate} />
        <MetricCard metric={cards[3]} translate={translate} />
      </View>
    </ScrollView>
  );
}

/**
 * Svježina podatka je dio ekrana, ne ukras.
 *
 * TV koji je izgubio mrežu prikazuje **iste** brojeve kao TV koji radi. Bez
 * oznake korisnik gleda zastarjele podatke i vjeruje im.
 */
function FreshnessBadge({
  freshness,
}: {
  freshness: 'fresh' | 'stale' | 'unknown';
}) {
  const text = {
    fresh: 'ažurno',
    stale: 'podaci nisu osvježeni',
    unknown: 'vrijeme nepoznato',
  }[freshness];

  return (
    <Text style={[styles.badge, freshness === 'stale' && styles.badgeStale]}>
      {text}
    </Text>
  );
}

function MetricCard({
  metric,
  translate,
  preferredFocus = false,
}: {
  metric: TvOverviewCard;
  translate: (key: string) => string;
  preferredFocus?: boolean;
}) {
  const [focused, setFocused] = React.useState(false);

  return (
    <View
      focusable
      hasTVPreferredFocus={preferredFocus}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.card, focused && styles.cardFocused]}
      testID={`tv-metric-${metric.key}`}
    >
      <Text style={styles.label}>{translate(metric.label)}</Text>
      <View style={styles.valueRow}>
        <Text style={styles.value}>
          {metric.value === null
            ? '—'
            : metric.key === 'cost'
              ? metric.value.toFixed(2)
              : metric.value.toFixed(1)}
        </Text>
        <Text style={styles.unit}>{metric.unit}</Text>
      </View>
      {metric.key === 'thermostat' ? (
        <Text style={styles.subtitle}>
          Cilj:{' '}
          {typeof metric.targetValue === 'number'
            ? metric.targetValue.toFixed(1)
            : '—'}{' '}
          °C
        </Text>
      ) : null}
      {metric.key === 'cost' ? (
        <Text style={styles.subtitle}>Za analizirani period</Text>
      ) : null}
    </View>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

/** Sve mjere su za gledanje sa 3 m, ne za čitanje iz ruke. */
const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  root: {
    flexGrow: 1,
    backgroundColor: colors.background,
    paddingHorizontal: tvLayout.safeX,
    paddingTop: tvLayout.safeY,
    paddingBottom: tvLayout.safeY,
    gap: spacing.md,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: tvLayout.safeX,
    paddingVertical: tvLayout.safeY,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { color: colors.text, fontSize: typeScale.hero, fontFamily: fonts.sansSemiBold },
  badge: {
    color: colors.accent,
    fontFamily: fonts.mono,
    fontSize: typeScale.small,
    borderWidth: tvLayout.focusBorder,
    borderColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  badgeStale: { color: colors.fault, borderColor: colors.fault },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: tvLayout.focusBorder,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 20,
    minHeight: 144,
    minWidth: 0,
    flex: 1,
    gap: spacing.sm,
  },
  cardFocused: { borderColor: colors.accent, shadowColor: colors.accent, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8, transform: [{ scale: tvLayout.focusScale }] },
  label: {
    color: colors.textMuted,
    fontSize: typeScale.body,
    fontFamily: fonts.sansMedium,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typeScale.small,
    fontFamily: fonts.sans,
  },
  valueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  value: {
    color: colors.text,
    fontSize: typeScale.hero,
    fontFamily: fonts.monoSemiBold,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    color: colors.textMuted,
    fontSize: typeScale.section,
    fontFamily: fonts.sansMedium,
    paddingBottom: 6,
  },
  muted: {
    color: colors.textMuted,
    fontSize: typeScale.body,
    fontFamily: fonts.sans,
    textAlign: 'center',
  },
  updateBar: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  updateText: {
    color: colors.text,
    fontSize: typeScale.section,
    fontFamily: fonts.sansMedium,
  },
  partialFault: {
    color: colors.warning,
    fontSize: typeScale.small,
    fontFamily: fonts.sans,
  },
  fault: {
    color: colors.fault,
    fontSize: typeScale.title,
    fontFamily: fonts.sansSemiBold,
    textAlign: 'center',
  },
});
