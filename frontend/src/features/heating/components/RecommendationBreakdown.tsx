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
 * F4.4 — vrijednost koje **nema**.
 *
 * `null` u breakdown-u nije nula: modelski put nema krivu, pa nema ni „bazne
 * krivulje". Prikazati `0,0°C` značilo bi tvrditi da je kriva izračunata i da
 * iznosi nula — korisnik bi to čitao kao kvar. Crtica kaže „ovdje nema
 * podatka", što je istina.
 */
const NO_VALUE = '—';

const formatTempOrDash = (value: number | null): string =>
  value === null ? NO_VALUE : formatTemp(value);

type ModelBreakdown = NonNullable<
  RecommendationBreakdownData['model']
>;

/**
 * F4.3 — članovi ravnotežnog izraza kao redovi tabele.
 *
 * Prikazuje se **samo ono što postoji**. Modelski put je mlad: nekad nema
 * noćne prognoze (`outdoorRefC = null`), nekad nema fita krive (`slopeS =
 * null`). Red sa crticom za takav član tvrdi „izmjereno, ali nula" — a to nije
 * istina. Zato se `null` članovi preskaču, a `reasons` kaže zašto.
 */
const modelRows = (
  model: ModelBreakdown | null,
  t: (key: string) => string,
): Array<{ label: string; value: string }> => {
  if (!model) return [];

  const rows: Array<{ label: string; value: string }> = [];

  if (model.slopeS !== null) {
    rows.push({
      label: t('recommendation.modelSlope'),
      // Izvor je bitan: dok je model mlad, koristi se gornja granica intervala
      // pouzdanosti, pa nagib nije „tačka" nego namjerno konzervativan broj.
      value:
        model.slopeSource === 'CI_HIGH'
          ? `${model.slopeS.toFixed(2)} ${t('recommendation.modelSlopeCi')}`
          : `${model.slopeS.toFixed(2)} ${t('recommendation.modelSlopePoint')}`,
    });
  }
  if (model.outdoorRefC !== null) {
    rows.push({
      label: t('recommendation.modelOutdoorRef'),
      value: `${formatTemp(model.outdoorRefC)} ${
        model.outdoorRefSource === 'NIGHT_DAY_BLEND'
          ? t('recommendation.modelRefBlend')
          : t('recommendation.modelRefNight')
      }`,
    });
  }
  rows.push({
    label: t('recommendation.modelInternalGain'),
    value: `−${model.internalGainC.toFixed(2)}°C`,
  });
  if (model.dayGainC !== 0) {
    rows.push({
      label: t('recommendation.modelDayGain'),
      value: `−${model.dayGainC.toFixed(2)}°C`,
    });
  }
  if (model.equilibriumFlowC !== null) {
    rows.push({
      label: t('recommendation.modelEquilibrium'),
      value: formatTemp(model.equilibriumFlowC),
    });
  }
  return rows;
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

  // F4.4: dvije grane, a ne „ista tabela sa prazninama". Kad je motor `model`,
  // krive nema — pa se ne prikazuju njena tri reda sa crticama, nego članovi
  // izraza koji su broj zaista dali. Tabela sa šest crtica ne objašnjava ništa.
  const isModel = breakdown.engine === 'model';

  const offsets = breakdown.appliedOffsets;

  const rows: Array<{ label: string; value: string }> = [
    ...(isModel
      ? []
      : [
          {
            label: t('recommendation.baseCurve'),
            value: formatTempOrDash(breakdown.baseCurveTemp),
          },
          {
            label: t('recommendation.weightedExternalTemp'),
            value: formatTempOrDash(breakdown.weightedExternalTemp),
          },
          {
            label: t('recommendation.homeOffset'),
            value: offsets ? formatOffset(offsets.home) : NO_VALUE,
          },
          {
            label: t('recommendation.intervalOffset'),
            value: offsets ? formatOffset(offsets.interval) : NO_VALUE,
          },
          {
            label: t('recommendation.eventsOffset'),
            value: offsets ? formatOffset(offsets.events) : NO_VALUE,
          },
        ]),
    { label: t('recommendation.finalTemp'), value: formatTemp(breakdown.finalTemp) },
    {
      label: t('recommendation.confidence'),
      value: `${Math.round(breakdown.confidence * 100)}%`,
    },
    // F4.3: članovi izraza. `null` se preskače (npr. nema noćne prognoze) —
    // red sa crticom za svaki `null` član samo bi zatrpao tabelu.
    ...modelRows(breakdown.model, t),
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
          <table className="w-full text-sm">
            <caption className="sr-only">{t('recommendation.caption')}</caption>
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th scope="col" className="py-1 pr-3 text-left font-medium">
                  {t('recommendation.item')}
                </th>
                <th scope="col" className="py-1 pl-3 text-right font-medium">
                  {t('recommendation.value')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-t border-border">
                  <th
                    scope="row"
                    className="py-1.5 pr-3 text-left font-normal text-muted-foreground"
                  >
                    {row.label}
                  </th>
                  <td className="whitespace-nowrap py-1.5 pl-3 text-right font-mono tabular-nums text-foreground">
                    {row.value}
                  </td>
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
