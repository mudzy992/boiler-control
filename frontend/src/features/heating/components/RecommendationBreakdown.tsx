import React from 'react';
import { Alert, Card } from 'antd';
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
> = ({ breakdown, title = 'Razlog preporuke' }) => {
  if (!breakdown) return null;

  const rows: Array<{ label: string; value: string }> = [
    { label: 'Bazna krivulja', value: formatTemp(breakdown.baseCurveTemp) },
    {
      label: 'Ponderisana vanjska temperatura',
      value: formatTemp(breakdown.weightedExternalTemp),
    },
    {
      label: 'Korekcija profila doma',
      value: formatOffset(breakdown.appliedOffsets.home),
    },
    {
      label: 'Korekcija intervala',
      value: formatOffset(breakdown.appliedOffsets.interval),
    },
    {
      label: 'Korekcija nedavnih događaja',
      value: formatOffset(breakdown.appliedOffsets.events),
    },
    { label: 'Konačna preporuka', value: formatTemp(breakdown.finalTemp) },
    {
      label: 'Pouzdanost',
      value: `${Math.round(breakdown.confidence * 100)}%`,
    },
  ];

  if (breakdown.samples !== null) {
    rows.push({ label: 'Broj uzoraka', value: String(breakdown.samples) });
  }
  if (breakdown.expectedHeatTimeMin !== null) {
    rows.push({
      label: 'Očekivano vrijeme zagrijavanja',
      value: `${breakdown.expectedHeatTimeMin.toFixed(0)} min`,
    });
  }

  return (
    <Card size="small" title={title} className="shadow-sm">
      <Alert
        type="info"
        showIcon
        message="Preporuka je savjetodavna i ne zamjenjuje stručni nadzor."
        style={{ marginBottom: 12 }}
      />
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <caption className="sr-only">Struktuirani razlog preporuke</caption>
          <thead>
            <tr className="text-left text-slate-600 dark:text-slate-300">
              <th scope="col" className="px-2 py-1">
                Stavka
              </th>
              <th scope="col" className="px-2 py-1">
                Vrijednost
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.label}
                className="border-t border-slate-100 dark:border-slate-700"
              >
                <th
                  scope="row"
                  className="px-2 py-1 font-normal text-slate-700 dark:text-slate-200"
                >
                  {row.label}
                </th>
                <td className="px-2 py-1 text-slate-900 dark:text-slate-100">
                  {row.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Režim: {breakdown.mode}
        {breakdown.intervalKey ? ` · interval: ${breakdown.intervalKey}` : ''}
      </p>
    </Card>
  );
};
