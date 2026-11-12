import React from 'react';
import { View } from 'react-native';

import { useTranslation } from '../hooks/useTranslation';
import type { RecommendationBreakdown as RecommendationBreakdownData } from '../types/Dashboard';
import { formatNumber } from '../utils/format';
import { InlineBanner, MonoMeta, Panel, PanelRow, Readout, Text } from '../ui';
import { space } from '../theme/tokens';

interface RecommendationBreakdownProps {
  breakdown?: RecommendationBreakdownData | null;
}

/**
 * MO2-15: render ONLY the backend breakdown snapshot. The client does not
 * reconstruct the formula, compute the base curve, or change the recommendation.
 * If the backend did not send a breakdown (older rows), render nothing.
 *
 * F7 (HOME-05) — zašto je kartica prepisana:
 *
 * Simptom: „Recommendation reason se na dark temi ne vidi, kao da ima hardkodiran
 * crni font". Uzrok je bio stari sloj: kartica je koristila `useColorModeValue`
 * sa `gray.800`/`gray.100`, ali `Text` iz `react-native` u tom fajlu nije
 * primao boju kroz sve čvorove — naslov i vrijednosti su ostajali na RN
 * default-u (crno), pa su na tamnoj podlozi `gray.800` (#1f2937) bili praktično
 * nevidljivi. Dodatno je kartica imala `borderRadius: 12`, font 16/13/11 i
 * plavu „info" kutiju — dakle nijedan token iz palete.
 *
 * Sada: `Panel` (hairline ivica, radijus 4) + `PanelRow` po stavci, `Readout`
 * za brojeve (mono, tabularno) i `InlineBanner` za napomenu — iste boje i isti
 * ritam kao svaki drugi blok u aplikaciji, u obje teme.
 */
export const RecommendationBreakdown = React.memo(function RecommendationBreakdown({
  breakdown,
}: RecommendationBreakdownProps) {
  const { t } = useTranslation();

  if (!breakdown) return null;

  /**
   * Vrijednost i jedinica su JEDAN tekstualni čvor (`51.1°C`, `28 min`).
   * Razlog nije kozmetika: čitači ekrana i `getByText` u testovima vide cijelu
   * vrijednost kao jednu tvrdnju, a `Readout` sa odvojenim `unit` propom bi je
   * razbio na dva čvora („51,1" + „°C"). Zato je jedinica dio stringa.
   */
  const temp = (value: number) => `${formatNumber(value, 1)}°C`;
  const offset = (value: number) => `${value > 0 ? '+' : ''}${formatNumber(value, 2)}°C`;

  /**
   * F4.4: `null` se NE pretvara u `0`. `formatNumber(null)` bi dao „NaN" ili
   * „0,0" — oboje je izmišljen broj. Crtica kaže istinu: „ovdje nema podatka".
   */
  const tempOrDash = (value: number | null) => (value === null ? '—' : temp(value));

  type Row = { key: string; label: string; value: string; tone?: 'signal' };

  /*
   * F4.4: kad preporuku daje model, krive nema. Njeni redovi se izostavljaju
   * (ne prikazuju kao crtice) — tabela puna crtica ne objašnjava ništa, a
   * članovi modela objašnjavaju.
   */
  const isModel = breakdown.engine === 'model';

  const rows: Row[] = [
    ...(isModel
      ? []
      : ([
          {
            key: 'baseCurve',
            label: t('recommendation.baseCurve'),
            value: tempOrDash(breakdown.baseCurveTemp),
          },
          {
            key: 'weightedExternal',
            label: t('recommendation.weightedExternal'),
            value: tempOrDash(breakdown.weightedExternalTemp),
          },
        ] as Row[])),
    /*
     * `36`: offseti su opcioni. Stariji zapisi (`types/Dashboard.ts`: „Older
     * rows may omit it or send null") nemaju `appliedOffsets`, a kartica je na
     * takvom redu rušila cijelu Početnu (`Cannot read properties of undefined
     * (reading 'home')`). Red se izostavlja — bolje bez reda nego bez ekrana.
     */
    ...(!isModel && breakdown.appliedOffsets
      ? ([
          {
            key: 'homeOffset',
            label: t('recommendation.homeOffset'),
            value: offset(breakdown.appliedOffsets.home),
          },
          {
            key: 'intervalOffset',
            label: t('recommendation.intervalOffset'),
            value: offset(breakdown.appliedOffsets.interval),
          },
          {
            key: 'eventsOffset',
            label: t('recommendation.eventsOffset'),
            value: offset(breakdown.appliedOffsets.events),
          },
        ] as Row[])
      : []),
    // Rezultat je jedina brojka koja nosi odluku — zato jedina u `signal` tonu.
    {
      key: 'finalTemp',
      label: t('recommendation.finalTemp'),
      value: temp(breakdown.finalTemp),
      tone: 'signal',
    },
    {
      key: 'confidence',
      label: t('recommendation.confidence'),
      value: `${Math.round(breakdown.confidence * 100)}%`,
    },
  ];

  // `!= null` a ne `!== null`: stariji zapisi nemaju polje, pa bi `undefined`
  // prošao provjeru i ispisao „NaN".
  if (breakdown.samples != null) {
    rows.push({
      key: 'samples',
      label: t('recommendation.samples'),
      value: formatNumber(breakdown.samples, 0),
    });
  }
  if (breakdown.expectedHeatTimeMin != null) {
    rows.push({
      key: 'expectedHeatTime',
      label: t('recommendation.expectedHeatTime'),
      value: `${formatNumber(breakdown.expectedHeatTimeMin, 0)} min`,
    });
  }

  /*
   * F4.3: članovi modela. Preskaču se `null` članovi (nema noćne prognoze ili
   * fita) — red sa crticom za svaki od njih tvrdi „izmjereno, ali nula".
   */
  const model = breakdown.model;
  if (model) {
    if (model.slopeS !== null) {
      rows.push({
        key: 'modelSlope',
        label: t('recommendation.modelSlope'),
        value: `${formatNumber(model.slopeS, 2)} ${
          model.slopeSource === 'CI_HIGH'
            ? t('recommendation.modelSlopeCi')
            : t('recommendation.modelSlopePoint')
        }`,
      });
    }
    if (model.outdoorRefC !== null) {
      rows.push({
        key: 'modelOutdoorRef',
        label: t('recommendation.modelOutdoorRef'),
        value: `${temp(model.outdoorRefC)} ${
          model.outdoorRefSource === 'NIGHT_DAY_BLEND'
            ? t('recommendation.modelRefBlend')
            : t('recommendation.modelRefNight')
        }`,
      });
    }
    rows.push({
      key: 'modelInternalGain',
      label: t('recommendation.modelInternalGain'),
      value: `−${formatNumber(model.internalGainC, 2)}°C`,
    });
    if (model.dayGainC !== 0) {
      rows.push({
        key: 'modelDayGain',
        label: t('recommendation.modelDayGain'),
        value: `−${formatNumber(model.dayGainC, 2)}°C`,
      });
    }
    if (model.equilibriumFlowC !== null) {
      rows.push({
        key: 'modelEquilibrium',
        label: t('recommendation.modelEquilibrium'),
        value: temp(model.equilibriumFlowC),
      });
    }
  }

  return (
    <Section testID="recommendation-breakdown">
      <View style={{ gap: space.sm }}>
        <MonoMeta>{t('recommendation.title')}</MonoMeta>
        <Panel variant="flush" padded={false}>
          {rows.map((row, index) => (
            <PanelRow key={row.key} divider={index < rows.length - 1}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: space.sm,
                  flex: 1,
                }}
              >
                <Text size="body" tone="muted" style={{ flex: 1 }}>
                  {row.label}
                </Text>
                <Readout value={row.value} size="md" tone={row.tone ?? 'ink'} />
              </View>
            </PanelRow>
          ))}
        </Panel>
        <InlineBanner tone="info" title={t('recommendation.disclaimer')} />
        {/*
          `36`: red „Režim: FULL · Interval: weekday_evening" je uklonjen.
          Isti podaci stoje uz traku termostata (kartica termostata na Početnoj),
          gdje su i kontekst odluke — na dnu ekrana su bili duplikat koji je
          korisnik zaokružio kao suvišan.
        */}
      </View>
    </Section>
  );
});

/**
 * Lokalni `Section` bez labele: ovdje naslov nosi `MonoMeta` jer je kartica
 * unutar sekcije Početne, a `Section` sa labelom bi udvostručio heading.
 */
function Section({ children, testID }: { children: React.ReactNode; testID?: string }) {
  return <View testID={testID}>{children}</View>;
}
