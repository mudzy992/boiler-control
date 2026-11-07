/**
 * `AsyncState` — učitavanje, greška i prazno stanje u istom obliku.
 *
 * Zašto: 7 ekrana danas radi `if (isLoading) return <centered Spinner + tekst>`,
 * pa cijela stranica nestane i vrati se (nalaz UX-07). Skeleton drži isti
 * footprint kao sadržaj, pa nema layout shifta i ekran izgleda brže.
 *
 * Pravilo upotrebe:
 *   <AsyncState loading={q.isLoading} error={q.error} empty={!data.length}
 *               skeleton={<SkeletonPanel />} onRetry={q.refetch}>
 *     { sadržaj }
 *   </AsyncState>
 */

import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { radius, space } from '../theme/tokens';
import { useTokens } from './theme';
import { Text } from './Text';
import { Button } from './Button';

/* ------------------------------------------------------------------ */
/* Skeleton                                                            */
/* ------------------------------------------------------------------ */

export type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  radiusValue?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Statički blok skeletona.
 *
 * Namjerno BEZ animacije pulsiranja: animacija preko cijelog ekrana odvlači
 * pažnju i troši bateriju, a `prefers-reduced-motion` na RN-u nije jednoobrazno
 * dostupan. Mirna siva ploha u istom footprintu daje isti efekat bez rizika.
 */
export function Skeleton({ width = '100%', height = 12, radiusValue = radius.tag, style }: SkeletonProps) {
  const { t } = useTokens();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: radiusValue, backgroundColor: t.raised }, style]}
    />
  );
}

/** Skelet u obliku panela: naslov + dvije linije + broj. */
export function SkeletonPanel({ lines = 2, height = 64 }: { lines?: number; height?: number }) {
  const { t } = useTokens();
  return (
    <View style={[styles.skeletonPanel, { borderColor: t.line, backgroundColor: t.panel, minHeight: height }]}>
      <Skeleton width="28%" height={8} />
      <Skeleton width="46%" height={18} style={{ marginTop: 10 }} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '62%' : '100%'} height={8} style={{ marginTop: 8 }} />
      ))}
    </View>
  );
}

/** Skelet liste redova (za FlatList ekrane). */
export function SkeletonRows({ count = 4 }: { count?: number }) {
  const { t } = useTokens();
  return (
    <View style={[styles.skeletonList, { borderColor: t.line, backgroundColor: t.panel }]}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.skeletonRow,
            i < count - 1 ? { borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: t.line } : null,
          ]}
        >
          <Skeleton width="38%" height={13} />
          <Skeleton width="22%" height={13} />
        </View>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Error state                                                        */
/* ------------------------------------------------------------------ */

export type ErrorStateProps = {
  title: string;
  message?: string;
  /** Tekst dugmeta; podrazumijevano „Pokušaj ponovo". */
  retryLabel?: string;
  onRetry?: () => void;
  /** `inline` = unutar panela (kad stari podaci ostaju vidljivi). */
  variant?: 'full' | 'inline';
  style?: StyleProp<ViewStyle>;
};

export function ErrorState({
  title,
  message,
  retryLabel = 'Pokušaj ponovo',
  onRetry,
  variant = 'full',
  style,
}: ErrorStateProps) {
  const { t, fonts } = useTokens();
  return (
    <View
      style={[
        variant === 'full' ? styles.stateFull : styles.stateInline,
        { borderColor: t.line, backgroundColor: variant === 'inline' ? t.raised : 'transparent' },
        style,
      ]}
    >
      {/*
        Poruka je jedan a11y element sa `role="alert"`; dugme je NAMJERNO izvan
        njega — da ga `accessible` na roditelju ne bi progutao čitaču ekrana.
      */}
      <View accessible accessibilityRole="alert" style={styles.alertBlock}>
        <Ionicons name="alert-circle-outline" size={variant === 'full' ? 26 : 16} color={t.inkDim} />
        <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: t.ink, marginTop: 6, textAlign: 'center' }}>
          {title}
        </Text>
        {message ? (
          <Text
            style={{
              fontFamily: fonts.mono,
              fontSize: 10,
              color: t.inkDim,
              marginTop: 4,
              textAlign: 'center',
              lineHeight: 15,
            }}
          >
            {message}
          </Text>
        ) : null}
      </View>
      {onRetry ? (
        <Button
          label={retryLabel}
          variant="secondary"
          onPress={onRetry}
          style={{ marginTop: space.md }}
        />
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Empty state                                                        */
/* ------------------------------------------------------------------ */

export type EmptyStateProps = {
  title: string;
  message?: string;
  /** Primarna akcija — „šta dalje" (danas nedostaje na 4 ekrana, nalaz UX-24). */
  action?: { label: string; onPress: () => void };
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
};

export function EmptyState({ title, message, action, icon = 'file-tray-outline', style }: EmptyStateProps) {
  const { t, fonts } = useTokens();
  return (
    <View style={[styles.stateFull, style]}>
      <Ionicons name={icon} size={26} color={t.lineStrong} />
      <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: t.ink, marginTop: 10, textAlign: 'center' }}>
        {title}
      </Text>
      {message ? (
        <Text
          style={{
            fontFamily: fonts.sans,
            fontSize: 12,
            color: t.inkMuted,
            marginTop: 4,
            textAlign: 'center',
            maxWidth: 260,
            lineHeight: 17,
          }}
        >
          {message}
        </Text>
      ) : null}
      {action ? <Button label={action.label} onPress={action.onPress} style={{ marginTop: space.lg }} /> : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* AsyncState                                                          */
/* ------------------------------------------------------------------ */

export type AsyncStateProps = {
  loading?: boolean;
  error?: unknown;
  /** `true` kad je upit uspio ali nema podataka. */
  empty?: boolean;
  skeleton?: React.ReactNode;
  errorTitle?: string;
  errorMessage?: string;
  retryLabel?: string;
  onRetry?: () => void;
  emptyState?: React.ReactNode;
  /** Kada je `true`, greška se prikazuje iznad postojećeg sadržaja (stale-while-error). */
  keepContentOnError?: boolean;
  children: React.ReactNode;
};

/**
 * Deklarativni wrapper. Redoslijed: loading → error → empty → sadržaj.
 * `keepContentOnError` je važan za dashboard: kad padne refresh, korisnik i dalje
 * vidi zadnje poznate brojeve (sivo), umjesto da ekran postane prazan.
 */
export function AsyncState({
  loading,
  error,
  empty,
  skeleton,
  errorTitle = 'Podaci nisu dostupni',
  errorMessage,
  retryLabel,
  onRetry,
  emptyState,
  keepContentOnError = false,
  children,
}: AsyncStateProps) {
  if (loading) return <>{skeleton ?? <SkeletonPanel lines={3} />}</>;

  if (error) {
    const errNode = (
      <ErrorState
        title={errorTitle}
        message={errorMessage ?? (error instanceof Error ? error.message : undefined)}
        retryLabel={retryLabel}
        onRetry={onRetry}
        variant={keepContentOnError ? 'inline' : 'full'}
      />
    );
    if (!keepContentOnError) return errNode;
    return (
      <>
        {errNode}
        {children}
      </>
    );
  }

  if (empty) return <>{emptyState ?? <EmptyState title="Nema podataka" />}</>;

  return <>{children}</>;
}

const styles = StyleSheet.create({
  skeletonPanel: {
    borderWidth: 1,
    borderRadius: radius.panel,
    padding: space.md,
    gap: 2,
  },
  skeletonList: {
    borderWidth: 1,
    borderRadius: radius.panel,
    overflow: 'hidden',
  },
  skeletonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingVertical: 12,
  },
  stateFull: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.xl,
    paddingHorizontal: space.lg,
    gap: 2,
  },
  alertBlock: {
    alignItems: 'center',
  },
  stateInline: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.control,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    gap: 2,
  },
});
