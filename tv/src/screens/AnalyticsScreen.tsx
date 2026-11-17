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
  Text,
  View,
} from 'react-native';

import {
  buildTvMetrics,
  describeFreshness,
  limitForTv,
  type TvMetric,
} from '../lib/analytics';
import { colors, fonts, spacing } from '../theme';

export interface AnalyticsScreenProps {
  /** Odgovor `GET /api/gas/analysis`, ili `null` dok se učitava. */
  analysis: Record<string, unknown> | null;
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
  updateAvailable,
  loading,
  error,
  updatedAt,
  translate,
}: AnalyticsScreenProps) {
  if (loading && !analysis) {
    return (
      <Centered>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.muted}>Učitavam analitiku…</Text>
      </Centered>
    );
  }

  if (error && !analysis) {
    return (
      <Centered>
        <Text style={styles.fault}>Analitika nije dostupna</Text>
        <Text style={styles.muted}>{error}</Text>
      </Centered>
    );
  }

  const metrics = buildTvMetrics(analysis as never);
  const { shown, hiddenCount } = limitForTv(metrics);
  const freshness = describeFreshness(updatedAt);

  if (shown.length === 0) {
    /*
     * Prazno stanje mora objasniti **zašto** je prazno. „Nema podataka" bez
     * razloga izgleda kao kvar; korisnik tada zove servis.
     */
    return (
      <Centered>
        <Text style={styles.title}>Još nema podataka</Text>
        <Text style={styles.muted}>
          Analitika se pojavljuje kad kotao pošalje prva očitanja.
        </Text>
      </Centered>
    );
  }

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

      <View style={styles.grid}>
        {shown.map((metric, index) => (
          <MetricCard
            key={metric.key}
            metric={metric}
            translate={translate}
            preferredFocus={index === 0}
          />
        ))}
      </View>

      {hiddenCount > 0 && (
        // „+2" umjesto tišine: bez ovoga ekran izgleda kao da metrika nema.
        <Text style={styles.muted}>
          +{hiddenCount} više u aplikaciji na telefonu
        </Text>
      )}
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
  preferredFocus,
}: {
  metric: TvMetric;
  translate: (key: string) => string;
  preferredFocus: boolean;
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
        <Text style={styles.value}>{metric.value}</Text>
        <Text style={styles.unit}>{metric.unit}</Text>
      </View>
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
    padding: spacing.lg,
    paddingBottom: spacing.lg + spacing.md,
    gap: spacing.md,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { color: colors.text, fontSize: 30, fontFamily: fonts.sansSemiBold },
  badge: {
    color: colors.accent,
    fontFamily: fonts.mono,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  badgeStale: { color: colors.fault, borderColor: colors.fault },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 6,
    padding: spacing.md,
    minWidth: 240,
    flexGrow: 1,
    gap: spacing.sm,
  },
  cardFocused: { borderColor: colors.accent },
  label: {
    color: colors.textMuted,
    fontSize: 16,
    fontFamily: fonts.sansMedium,
  },
  valueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  value: {
    color: colors.text,
    fontSize: 40,
    fontFamily: fonts.sansBold,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    color: colors.textMuted,
    fontSize: 18,
    fontFamily: fonts.sansMedium,
    paddingBottom: 6,
  },
  muted: {
    color: colors.textMuted,
    fontSize: 18,
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
    fontSize: 18,
    fontFamily: fonts.sansMedium,
  },
  fault: {
    color: colors.fault,
    fontSize: 22,
    fontFamily: fonts.sansSemiBold,
    textAlign: 'center',
  },
});
