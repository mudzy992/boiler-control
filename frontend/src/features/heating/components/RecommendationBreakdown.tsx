import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { StatusBanner } from '@/shared/components/status-banner';
import { Card, CardContent } from '@/shared/components/ui/Card';
import type { components } from '../../../types/api';

export type RecommendationBreakdownData =
  components['schemas']['RecommendationBreakdownDto'];

interface RecommendationBreakdownProps {
  breakdown?: RecommendationBreakdownData | null;
  title?: string;
}

const formatTemp = (value: number): string => `${value.toFixed(1)}°C`;

const formatOffset = (value: number): string => {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}°C`;
};

/**
 * FE2-10: prikaz ISKLJUČIVO iz backend breakdown snapshot-a.
 */
export const RecommendationBreakdown = ({
  breakdown,
  title,
}: RecommendationBreakdownProps): JSX.Element | null => {
  const { t } = useTranslation();

  if (!breakdown) return null;

  const rows: Array<{ label: string; value: string }> = [
    { label: t('recommendation.baseCurve'), value: formatTemp(breakdown.baseCurveTemp) },
    {
      label: t('recommendation.weightedExternalTemp'),
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
      label: t('recommendation.heatTime'),
      value: `${breakdown.expectedHeatTimeMin.toFixed(0)} min`,
    });
  }

  return (
    <Card variant="elevated">
      <CardContent className="space-y-3 pt-4 sm:pt-5">
        <h3 className="text-sm font-semibold text-foreground">
          {title ?? t('recommendation.title')}
        </h3>
        <StatusBanner variant="info" message={t('recommendation.advisory')} />
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <caption className="sr-only">{t('recommendation.caption')}</caption>
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th scope="col" className="px-2 py-1">
                  {t('recommendation.item')}
                </th>
                <th scope="col" className="px-2 py-1">
                  {t('recommendation.value')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-t border-border">
                  <th
                    scope="row"
                    className="px-2 py-1 font-normal text-muted-foreground"
                  >
                    {row.label}
                  </th>
                  <td className="px-2 py-1 text-foreground">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('recommendation.mode')}: {breakdown.mode}
          {breakdown.intervalKey
            ? ` · ${t('recommendation.interval')}: ${breakdown.intervalKey}`
            : ''}
        </p>
      </CardContent>
    </Card>
  );
};
