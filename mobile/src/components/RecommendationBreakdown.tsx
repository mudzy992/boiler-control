import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColorModeValue } from 'native-base';
import { useTranslation } from '../hooks/useTranslation';
import type { RecommendationBreakdown as RecommendationBreakdownData } from '../types/Dashboard';

interface RecommendationBreakdownProps {
  breakdown?: RecommendationBreakdownData | null;
}

function formatTemp(value: number): string {
  return `${value.toFixed(1)}°C`;
}

function formatOffset(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}°C`;
}

/**
 * MO2-15: render ONLY the backend breakdown snapshot. The client does not
 * reconstruct the formula, compute the base curve, or change the recommendation.
 * If the backend did not send a breakdown (older rows), render nothing.
 */
export const RecommendationBreakdown = React.memo(function RecommendationBreakdown({
  breakdown,
}: RecommendationBreakdownProps) {
  const { t } = useTranslation();
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const mutedColor = useColorModeValue('gray.600', 'gray.400');
  const infoBg = useColorModeValue('blue.50', 'blue.900');
  const infoText = useColorModeValue('blue.700', 'blue.200');

  if (!breakdown) {
    return null;
  }

  const rows: { label: string; value: string }[] = [
    { label: t('recommendation.baseCurve'), value: formatTemp(breakdown.baseCurveTemp) },
    {
      label: t('recommendation.weightedExternal'),
      value: formatTemp(breakdown.weightedExternalTemp),
    },
    {
      label: t('recommendation.homeOffset'),
      value: formatOffset(breakdown.appliedOffsets.home),
    },
    {
      label: t('recommendation.intervalOffset'),
      value: formatOffset(breakdown.appliedOffsets.interval),
    },
    {
      label: t('recommendation.eventsOffset'),
      value: formatOffset(breakdown.appliedOffsets.events),
    },
    { label: t('recommendation.finalTemp'), value: formatTemp(breakdown.finalTemp) },
    {
      label: t('recommendation.confidence'),
      value: `${Math.round(breakdown.confidence * 100)}%`,
    },
  ];

  if (breakdown.samples !== null) {
    rows.push({ label: t('recommendation.samples'), value: String(breakdown.samples) });
  }
  if (breakdown.expectedHeatTimeMin !== null) {
    rows.push({
      label: t('recommendation.expectedHeatTime'),
      value: `${breakdown.expectedHeatTimeMin.toFixed(0)} min`,
    });
  }

  return (
    <View
      testID="recommendation-breakdown"
      style={[styles.card, { backgroundColor: cardBg, borderColor }]}
    >
      <Text style={[styles.title, { color: textColor }]}>{t('recommendation.title')}</Text>
      <View style={[styles.disclaimer, { backgroundColor: infoBg }]}>
        <Text style={[styles.disclaimerText, { color: infoText }]}>
          {t('recommendation.disclaimer')}
        </Text>
      </View>
      {rows.map((row) => (
        <View key={row.label} style={styles.row}>
          <Text style={[styles.label, { color: mutedColor }]}>{row.label}</Text>
          <Text style={[styles.value, { color: textColor }]}>{row.value}</Text>
        </View>
      ))}
      <Text style={[styles.meta, { color: mutedColor }]}>
        {t('recommendation.mode')}: {breakdown.mode}
        {breakdown.intervalKey
          ? ` · ${t('recommendation.interval')}: ${breakdown.intervalKey}`
          : ''}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  disclaimer: {
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
  },
  disclaimerText: {
    fontSize: 12,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  label: {
    fontSize: 13,
    flex: 1,
    paddingRight: 8,
  },
  value: {
    fontSize: 13,
    fontWeight: '600',
  },
  meta: {
    fontSize: 11,
    marginTop: 8,
  },
});
