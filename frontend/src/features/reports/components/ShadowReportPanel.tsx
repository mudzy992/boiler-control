import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/services/api';
import { queryKeys } from '@/lib/queryKeys';
import { Card, CardContent } from '@/shared/components/ui/Card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { StatusBanner } from '@/shared/components/status-banner';
import {
  isReportEmpty,
  reasonBreakdown,
  reportHeadline,
  verdictTone,
} from '../lib/shadow-report';
import type { ShadowReportResponse } from '../types';

interface ShadowReportPanelProps {
  homeProfileId: number | null | undefined;
  from: string;
  to: string;
}

/**
 * Shadow izvještaj u UI-u (`24` §6.5).
 *
 * Do sada je jedini način da se vidi koliko bi odluka kontrolera odstupila od
 * formule bio ručni SQL — a od tog broja zavisi da li odluka smije postati ono
 * što korisnik vidi. Panel zato prikazuje **tri** stvari zajedno: koliko dana je
 * uporedivo, u kojem smjeru ide razlika, i je li svaka razlika objašnjiva.
 *
 * Namjerne odluke:
 *  - bez perioda ili bez doma panel ne pita server (upit je `enabled: false`),
 *    jer bi odgovor bio „nema podataka" za pitanje koje nije ni postavljeno;
 *  - prazan izvještaj **nije** „0 razlika": piše se da nema podataka;
 *  - razlozi se prikazuju sa udjelom u danima sa razlikom, ne u svim danima.
 */
export const ShadowReportPanel = ({
  homeProfileId,
  from,
  to,
}: ShadowReportPanelProps): JSX.Element | null => {
  const { t } = useTranslation();
  const enabled = Boolean(homeProfileId) && Boolean(from) && Boolean(to);

  const reportQuery = useQuery({
    queryKey: queryKeys.shadowReport(homeProfileId ?? 0, from, to),
    queryFn: () =>
      apiClient.getShadowReport({
        homeProfileId: homeProfileId as number,
        from,
        to,
      }),
    enabled,
    staleTime: 1000 * 60 * 5,
  });

  if (!enabled) return null;

  const report: ShadowReportResponse | undefined = reportQuery.data;
  const empty = isReportEmpty(report);

  return (
    <Card>
      <CardContent className="space-y-4 pt-4">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">
            {t('reports.shadowTitle')}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            {t('reports.shadowSubtitle')}
          </p>
        </div>

        {reportQuery.isLoading ? (
          <p className="text-sm text-text-secondary">{t('common.loading')}</p>
        ) : null}

        {reportQuery.isError ? (
          <StatusBanner variant="error" message={t('reports.shadowError')} />
        ) : null}

        {report ? (
          <>
            <StatusBanner
              variant={
                empty
                  ? 'info'
                  : verdictTone(report.verdict) === 'error'
                    ? 'error'
                    : verdictTone(report.verdict) === 'success'
                      ? 'success'
                      : 'warning'
              }
              message={reportHeadline(report)}
            />

            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label={t('reports.shadowDays')} value={String(report.days)} />
              <Stat
                label={t('reports.shadowEvaluated')}
                value={String(report.evaluated)}
              />
              <Stat
                label={t('reports.shadowDifferences')}
                value={`${report.differences} (${report.changeSharePct}%)`}
              />
              <Stat
                label={t('reports.shadowMeanDelta')}
                value={`${report.meanAbsDeltaC.toFixed(1)} °C`}
              />
            </dl>

            {report.pending > 0 ? (
              <p className="text-xs text-text-secondary">
                {t('reports.shadowPending', { count: report.pending })}
              </p>
            ) : null}

            {report.blockedByModel > 0 ? (
              <p className="text-xs text-text-secondary">
                {t('reports.shadowBlockedByModel', { count: report.blockedByModel })}
              </p>
            ) : null}

            {reasonBreakdown(report).length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('reports.shadowReason')}</TableHead>
                    <TableHead>{t('reports.shadowReasonDays')}</TableHead>
                    <TableHead>{t('reports.shadowReasonShare')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reasonBreakdown(report).map((entry) => (
                    <TableRow key={entry.reason}>
                      <TableCell className="font-mono text-xs">
                        {entry.reason}
                      </TableCell>
                      <TableCell>{entry.days}</TableCell>
                      <TableCell>{entry.sharePct}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}

            {report.unexplained.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-error">
                  {t('reports.shadowUnexplained')}
                </h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('reports.colDate')}</TableHead>
                      <TableHead>{t('reports.shadowFormula')}</TableHead>
                      <TableHead>{t('reports.shadowDecision')}</TableHead>
                      <TableHead>{t('reports.shadowDelta')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.unexplained.map((row) => (
                      <TableRow key={row.localDate}>
                        <TableCell>{row.localDate}</TableCell>
                        <TableCell>{row.formulaC.toFixed(1)} °C</TableCell>
                        <TableCell>{row.decisionC.toFixed(1)} °C</TableCell>
                        <TableCell>{row.deltaC.toFixed(1)} °C</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
};

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-text-secondary">
        {label}
      </dt>
      <dd className="mt-1 text-lg font-semibold text-text-primary">{value}</dd>
    </div>
  );
}

ShadowReportPanel.displayName = 'ShadowReportPanel';
