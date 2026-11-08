import React from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { apiClient } from '../services/api/client';
import { useTranslation } from '../hooks/useTranslation';
import { formatNumber } from '../utils/format';
import { Panel, PanelRow, Readout, Text } from '../ui';

/**
 * F7 (HOME-03): kartica potrošnje plina na Početnoj.
 *
 * Zahtjev: „implementirati još jednu karticu koja će prikazivati ukupno
 * potrošeni gas i cijenu (subtitle)".
 *
 * Zašto poseban upit: `GET /gas/analysis` je već izvor za Analizu plina
 * (`['gas-analysis']`), pa ova kartica koristi ISTI query key. React Query tada
 * dijeli keš — Početna ne pravi dodatni mrežni poziv ako je korisnik već bio na
 * Plinu, a `invalidateQueries(['gas-analysis'])` poslije novog očitanja
 * osvježava oba ekrana.
 *
 * Ponašanje kad nema podataka: kartica NIJE sakrivena (tada korisnik ne bi
 * znao da potrošnja uopšte postoji), ali ne izmišlja nulu — piše „još nema
 * očitanja" i ne prikazuje cijenu. Nula bi bila tvrdnja da je potrošnja nula.
 */

interface GasAnalysisShape {
  consumptionFromReferenceM3?: number;
  totalConsumption?: number;
  totalGas?: number;
  costIncVat?: number;
}

export function GasConsumptionCard() {
  const { t } = useTranslation();

  const { data, isLoading } = useQuery({
    queryKey: ['gas-analysis'],
    queryFn: () => apiClient.getGasAnalysis() as Promise<GasAnalysisShape | null>,
    staleTime: 1000 * 60 * 5,
  });

  const consumption =
    data?.consumptionFromReferenceM3 ?? data?.totalConsumption ?? data?.totalGas ?? null;
  const cost = typeof data?.costIncVat === 'number' ? data.costIncVat : null;
  const hasData = consumption !== null && Number.isFinite(consumption);
  const currency = t('gas.currencyKM');

  return (
    <Panel variant="flush" padded={false} testID="gas-consumption-card">
      <PanelRow divider={hasData && cost !== null}>
        <View
          style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 16, flex: 1 }}
          accessible
          accessibilityLabel={
            hasData
              ? t('gasSummary.subtitle', {
                  consumption: formatNumber(consumption),
                  cost: cost !== null ? `${formatNumber(cost)} ${currency}` : '—',
                })
              : t('gasSummary.noData')
          }
        >
          <View style={{ flex: 1, gap: 2 }}>
            <MonoLabelText>{t('gasSummary.title')}</MonoLabelText>
            {hasData ? (
              <Readout
                value={formatNumber(consumption)}
                unit="m³"
                size="lg"
                tone="ink"
                testID="gas-consumption-value"
              />
            ) : (
              <Text size="body" tone="muted">
                {isLoading ? t('common.loading') : t('gasSummary.noData')}
              </Text>
            )}
          </View>
          {hasData && cost !== null ? (
            <View style={{ alignItems: 'flex-end', gap: 2 }}>
              <Readout value={formatNumber(cost)} unit={currency} size="md" tone="signal" />
            </View>
          ) : null}
        </View>
      </PanelRow>
      {hasData && cost !== null ? (
        <PanelRow divider={false}>
          <Text size="body" tone="muted">
            {t('gasSummary.subtitle', {
              consumption: formatNumber(consumption),
              cost: `${formatNumber(cost)} ${currency}`,
            })}
          </Text>
        </PanelRow>
      ) : null}
    </Panel>
  );
}

/** Mono labela preko `Text`-a da izbjegnemo `MonoLabel` sa dodatnim propom. */
function MonoLabelText({ children }: { children: React.ReactNode }) {
  return (
    <Text weight="mono" size="label" tone="dim" style={{ letterSpacing: 1.4, textTransform: 'uppercase' }}>
      {children}
    </Text>
  );
}
