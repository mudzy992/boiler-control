import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { apiClient } from '../../services/api/client';
import { useTranslation } from '../../hooks/useTranslation';
import { InlineBanner, MonoLabel, MonoMeta, Panel, Section, Skeleton, Text } from '../../ui';
import { space } from '../../theme/tokens';
import type { DailyHistoryResponse } from '../../types/Dashboard';

interface DailyHistoryCardProps {
  homeProfileId: number | undefined;
  from: string;
  to: string;
  limit?: number;
}

/**
 * Historija dnevnih zapisa (`31`).
 *
 * Postoji zato što je 301 rekonstruisan dan bio u bazi i nigdje vidljiv: jedini
 * endpoint nad `DailyRecord`-om čitao je `shadow*` kolone, a one su u backfill
 * redu prazne po definiciji.
 *
 * Pravilo prikaza: **rekonstruisan red se označava.** Ako se to izgubi, korisnik
 * čita izvedene brojeve kao izmjerene — a to je jedina stvarna opasnost ovog
 * ekrana. Zato je broj rekonstruisanih dana u podnaslovu, a ne u fusnoti.
 */
export const DailyHistoryCard = ({
  homeProfileId,
  from,
  to,
  limit = 14,
}: DailyHistoryCardProps) => {
  const { t } = useTranslation();
  const enabled = Boolean(homeProfileId);

  const historyQuery = useQuery({
    queryKey: ['daily-history', homeProfileId, from, to, limit],
    queryFn: () =>
      apiClient.getDailyHistory({
        homeProfileId: homeProfileId as number,
        from,
        to,
        limit,
      }),
    enabled,
    staleTime: 1000 * 60 * 5,
  });

  if (!enabled) return null;

  const report: DailyHistoryResponse | undefined = historyQuery.data;
  const rows = report?.rows ?? [];
  // Najnoviji dan prvi: na telefonu se traži „šta je bilo juče", ne početak.
  const newestFirst = [...rows].reverse();

  return (
    <Section label={t('analytics.dailyHistoryTitle')}>
      {historyQuery.isLoading ? <Skeleton height={72} /> : null}

      {historyQuery.isError ? (
        <InlineBanner
          tone="warn"
          title={t('analytics.dailyHistoryError')}
          message={t('common.retry')}
        />
      ) : null}

      {historyQuery.isSuccess && rows.length === 0 ? (
        <InlineBanner
          tone="info"
          title={t('analytics.dailyHistoryEmpty')}
          message={t('analytics.dailyHistoryEmptyHint')}
        />
      ) : null}

      {rows.length > 0 ? (
        <Panel>
          <View style={{ gap: space.xs, paddingBottom: space.sm }}>
            <MonoLabel>
              {t('analytics.dailyHistorySummary', { count: report?.summary.days ?? 0 })}
            </MonoLabel>
            {report && report.summary.backfill > 0 ? (
              <MonoMeta tone="muted">
                {t('analytics.dailyHistoryBackfill', {
                  count: report.summary.backfill,
                })}
              </MonoMeta>
            ) : null}
          </View>

          {newestFirst.map((row) => {
            const parts = [
              row.cycles != null ? `${row.cycles} ${t('analytics.dailyHistoryCycles')}` : null,
              row.gasM3 != null ? `${row.gasM3.toFixed(2)} m³` : null,
              row.degreeDays != null ? `${row.degreeDays.toFixed(1)} K·dan` : null,
            ].filter((part): part is string => part !== null);

            return (
              <View
                key={row.localDate}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  gap: space.sm,
                  paddingVertical: 6,
                }}
                testID={`daily-history-${row.localDate}`}
              >
                <MonoMeta tone="muted">{row.localDate}</MonoMeta>
                <Text size="body" style={{ flexShrink: 1, textAlign: 'right' }}>
                  {/* `null` grupe se ne prikazuju kao 0 — nema mjerenja. */}
                  {parts.length > 0 ? parts.join(' · ') : t('analytics.dailyHistoryNoMeasure')}
                </Text>
                <MonoMeta tone={row.origin === 'BACKFILL' ? 'warn' : 'ok'}>
                  {row.origin === 'BACKFILL'
                    ? t('analytics.dailyHistoryReconstructed')
                    : t('analytics.dailyHistoryMeasured')}
                </MonoMeta>
              </View>
            );
          })}
        </Panel>
      ) : null}
    </Section>
  );
};
