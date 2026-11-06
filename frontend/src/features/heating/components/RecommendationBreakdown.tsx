import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'antd';
import { Card } from '../../../components/Card';
import type { components } from '../../../types/api';

export type RecommendationBreakdownData =
  components['schemas']['RecommendationBreakdownDto'];

interface RecommendationBreakdownProps {
  breakdown?: RecommendationBreakdownData | null;
  title?: string;
}

function formatTemp(value: number): string {
  return `${value.toFixed(1)}°C`;
}

function formatOffset(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}°C`;
}

/**
 * FE2-10: prikaz ISKLJUČIVO iz backend breakdown snapshot-a.
 *
 * Komponenta ne rekonstruiše formulu, ne računa base curve i ne mijenja
 * preporuku. Ako backend nije poslao breakdown (stariji redovi), ne prikazuje
 * ništa umjesto da pogađa razlog.
 */
export const RecommendationBreakdown: React.FC<
  RecommendationBreakdownProps
> = ({ breakdown, title }) => {
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
    <Card padding="md" elevated>
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-primary dark:text-dark-text-primary">
          {title ?? t('recommendation.title')}
        </h3>
      </div>
      <Alert
        type="info"
        showIcon
        message={t('recommendation.advisory')}
        className="rounded-lg mb-3"
      />
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <caption className="sr-only">{t('recommendation.caption')}</caption>
          <thead>
            <tr className="text-left text-xs text-text-secondary dark:text-dark-text-secondary">
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
              <tr
                key={row.label}
                className="border-t border-border dark:border-dark-border"
              >
                <th
                  scope="row"
                  className="px-2 py-1 font-normal text-text-secondary dark:text-dark-text-secondary"
                >
                  {row.label}
                </th>
                <td className="px-2 py-1 text-text-primary dark:text-dark-text-primary">
                  {row.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-text-secondary dark:text-dark-text-secondary">
        {t('recommendation.mode')}: {breakdown.mode}
        {breakdown.intervalKey ? ` · ${t('recommendation.interval')}: ${breakdown.intervalKey}` : ''}
      </p>
    </Card>
  );
};

RecommendationBreakdown.displayName = 'RecommendationBreakdown';
