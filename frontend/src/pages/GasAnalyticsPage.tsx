import React, { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { useGasAnalysisQuery, useGasReadingsQuery } from '../hooks/useGasQueries';
import { StatCard } from '../components/StatCard';
import { Card, Button } from '../components/index';
import { useTranslation } from 'react-i18next';

export const GasAnalyticsPage: React.FC = () => {
  const { t } = useTranslation();
  const [periodDays, setPeriodDays] = useState(30);
  const [useDefaultReferenceRange, setUseDefaultReferenceRange] = useState(true);

  // Calculate date range for the selected period
  const dateRange = useMemo(() => {
    const endDate = dayjs();
    const startDate = endDate.subtract(periodDays, 'days');
    return {
      from: startDate.format('YYYY-MM-DD'),
      to: endDate.format('YYYY-MM-DD'),
    };
  }, [periodDays]);

  // FE2-3: shared gas queries; readings are deduplicated with GasReadingsPage.
  const { data: analysisData = {}, isLoading, error } = useGasAnalysisQuery({
    useDefaultReferenceRange,
    from: dateRange.from,
    to: dateRange.to,
  });
  const { data: readings = [] } = useGasReadingsQuery();

  const periodStart = analysisData?.period?.startDate ?? analysisData?.period?.from;
  const periodEnd = analysisData?.period?.endDate ?? analysisData?.period?.to;
  const periodModeLabel =
    analysisData?.period?.mode === 'reference_to_current'
      ? t('gas.analysisModeReference')
      : analysisData?.period?.mode === 'last_30_days'
        ? t('gas.analysisModeLast30')
        : t('gas.analysisModeExplicit');

  if (error) {
    return (
      <Card padding="md" elevated className="border border-error bg-error-50 text-error-700 dark:border-error dark:bg-error-900/20 dark:text-error-100">
        {t('gas.loadAnalyticsError')} {t('gas.loadAnalyticsErrorDesc')}
      </Card>
    );
  }

  const periodOptions = [
    { label: t('gas.periodReferenceCurrent'), days: null, active: useDefaultReferenceRange },
    { label: '7d', days: 7, active: !useDefaultReferenceRange && periodDays === 7 },
    { label: '14d', days: 14, active: !useDefaultReferenceRange && periodDays === 14 },
    { label: '30d', days: 30, active: !useDefaultReferenceRange && periodDays === 30 },
    { label: '90d', days: 90, active: !useDefaultReferenceRange && periodDays === 90 },
    { label: '1y', days: 365, active: !useDefaultReferenceRange && periodDays === 365 },
  ];

  return (
    <div className="space-y-6" id="content">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">
          {t('gas.analyticsPageTitle')}
        </h1>
        <p className="mt-1 text-sm text-text-secondary dark:text-dark-text-secondary">
          {t('gas.analyticsPageSubtitle')}
        </p>
      </div>

      {/* Period Selector */}
      <Card padding="md" elevated>
        <label className="block text-sm font-semibold text-text-secondary dark:text-dark-text-secondary">
          {t('gas.analyzePeriod')}
        </label>
        <div className="flex flex-wrap gap-2 mt-3 sm:gap-3">
          {periodOptions.map((option) => (
            <Button
              key={String(option.days)}
              variant={option.active ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => {
                setUseDefaultReferenceRange(option.days === null);
                if (option.days !== null) setPeriodDays(option.days);
              }}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </Card>

      {/* Analysis info box */}
      <Card padding="md" elevated className="border border-info bg-info-50 text-info-700 dark:border-info dark:bg-info-900/20 dark:text-info-100">
        <p className="text-xs font-semibold tracking-wide text-info-700 uppercase dark:text-info-100">
          {t('gas.analysisWindowTitle')}
        </p>
        <p className="mt-1 text-sm text-text-primary">
          {periodModeLabel}
        </p>
        <p className="text-xs text-text-secondary dark:text-dark-text-secondary">
          {(periodStart && dayjs(periodStart).format('DD.MM.YYYY')) || '—'}{' - '}
          {(periodEnd && dayjs(periodEnd).format('DD.MM.YYYY')) || '—'}
        </p>
        {analysisData?.referenceReading && (
          <p className="text-xs text-text-secondary dark:text-dark-text-secondary">
            {t('gas.analysisReferenceReading')}:{' '}
            {dayjs(analysisData.referenceReading.readingDate).format('DD.MM.YYYY')} (
            {Number(analysisData.referenceReading.counterValue ?? 0).toFixed(2)} m³)
          </p>
        )}
      </Card>

      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-border rounded-full animate-spin border-t-brand"></div>
        </div>
      )}

      {!isLoading && readings.length === 0 && (
        <Card padding="lg" elevated className="text-center">
          <div className="flex flex-col items-center justify-center h-64">
            <svg className="w-12 h-12 mb-3 text-text-tertiary dark:text-dark-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            <p className="text-sm text-text-secondary dark:text-dark-text-secondary">
              {t('gas.noReadingsYet')}
            </p>
            <p className="text-xs text-text-tertiary dark:text-dark-text-tertiary mt-1">
              {t('gas.noReadingsAddFirst')}
            </p>
          </div>
        </Card>
      )}

      {!isLoading && readings.length > 0 && (
        <>
          {/* Primary Metrics Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title={t('gas.metricTotalConsumption')}
              value={analysisData.consumptionFromReferenceM3 ?? analysisData.totalGas ?? 0}
              suffix="m³"
            />
            <StatCard
              title={t('gas.metricHeatingHours')}
              value={analysisData.totalHeatingHours ?? 0}
              suffix="hours"
            />
            <StatCard
              title={t('gas.metricAvgFlowTemp')}
              value={analysisData.avgFlowTemp ?? 0}
              suffix="°C"
            />
            <StatCard
              title={t('gas.metricUsagePerHour')}
              value={analysisData.efficiency?.m3PerHour ?? 0}
              suffix="m³/h"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard title={t('gas.metricCostExVat')} value={analysisData.costExVat ?? 0} suffix="" />
            <StatCard title={t('gas.metricVat')} value={analysisData.vatAmount ?? 0} suffix="" />
            <StatCard title={t('gas.metricCostIncVat')} value={analysisData.costIncVat ?? 0} suffix="" />
          </div>

          {!!analysisData.priceBreakdown?.length && (
            <Card padding="md" elevated>
              <p className="text-xs font-semibold tracking-wide text-text-secondary dark:text-dark-text-secondary uppercase mb-3">
                {t('gas.priceWindows')}
              </p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm divide-y divide-border dark:divide-dark-border">
                  <thead>
                    <tr className="bg-surface-muted text-xs text-text-secondary dark:bg-dark-surface-muted dark:text-dark-text-secondary">
                      <th className="px-4 py-3 text-left">{t('gas.priceExVat')}</th>
                      <th className="px-4 py-3 text-left">{t('gas.source')}</th>
                      <th className="px-4 py-3 text-left">{t('gas.effective')}</th>
                      <th className="px-4 py-3 text-left">{t('gas.consumption')}</th>
                      <th className="px-4 py-3 text-left">{t('gas.costExVat')}</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-text-primary dark:text-dark-text-primary">
                    {analysisData.priceBreakdown.map((row: any, idx: number) => (
                      <tr key={`${row.priceExVat}-${idx}`}>
                        <td className="px-4 py-3 font-medium">{Number(row.priceExVat ?? 0).toFixed(4)}</td>
                        <td className="px-4 py-3 text-text-secondary dark:text-dark-text-secondary">
                          {(row.source || 'MANUAL').toUpperCase()}
                        </td>
                        <td className="px-4 py-3 text-text-secondary dark:text-dark-text-secondary">
                          {row.effectiveFrom ? dayjs(row.effectiveFrom).format('DD.MM.YYYY') : '—'}{' - '}
                          {row.effectiveTo ? dayjs(row.effectiveTo).format('DD.MM.YYYY') : t('gas.priceCurrent')}
                        </td>
                        <td className="px-4 py-3 text-text-secondary dark:text-dark-text-secondary">
                          {Number(row.consumptionM3 ?? 0).toFixed(2)} m³
                        </td>
                        <td className="px-4 py-3 text-text-secondary dark:text-dark-text-secondary">
                          {Number(row.costExVat ?? 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Efficiency Card */}
          <Card padding="md" elevated>
            <p className="text-xs font-semibold tracking-wide text-text-secondary dark:text-dark-text-secondary uppercase mb-3">
              {t('gas.heatingEfficiency')}
            </p>
            <div className="flex items-center gap-3 mt-4">
              <span className="text-3xl text-text-tertiary dark:text-dark-text-tertiary">
                {analysisData.efficiency?.label ? '✓' : '?'}
              </span>
              <div>
                <p className="font-bold text-brand-700 dark:text-brand-100">
                  {analysisData.efficiency?.label || t('gas.noData')}
                </p>
                <p className="text-sm text-text-secondary dark:text-dark-text-secondary">
                  {typeof analysisData.efficiency?.m3PerHour === 'number' ? analysisData.efficiency.m3PerHour.toFixed(3) : '0.000'} m³/hour
                </p>
              </div>
            </div>
          </Card>

          {/* Recent Readings Section */}
          <Card padding="md" elevated>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">
                  {t('gas.recentReadingsTitle')}
                </h2>
                <p className="mt-1 text-sm text-text-secondary dark:text-dark-text-secondary">
                  {t('gas.recentReadingsSubtitle')}
                </p>
              </div>
            </div>
            {readings.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-text-secondary dark:text-dark-text-secondary">
                  {t('gas.noReadingsAvailable')}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border dark:divide-dark-border">
                {([...readings]
                  .sort((a, b) => dayjs(b.readingDate).diff(dayjs(a.readingDate)))
                  .slice(0, 5))
                  .map((reading, index, list) => {
                    const previousReading = index > 0 ? list[index - 1] : undefined;

                    let consumption = null;
                    if (previousReading) {
                      consumption = previousReading.counterValue - reading.counterValue;
                    }

                    return (
                      <div
                        key={reading.id}
                        className="flex items-center justify-between px-4 py-4 hover:bg-surface-muted dark:hover:bg-dark-surface-muted transition-colors"
                      >
                        <div className="flex-1">
                          <p className="font-semibold text-text-primary dark:text-dark-text-primary">
                            {reading.counterValue} m³
                          </p>
                          <p className="mt-0.5 text-sm text-text-secondary dark:text-dark-text-secondary">
                            {dayjs(reading.readingDate).format('MMM DD, YYYY HH:mm')}
                          </p>
                        </div>
                        {consumption !== null && (
                          <div className="text-right">
                            <p className="font-semibold text-brand-700 dark:text-brand-100">
                              +{consumption.toFixed(2)} m³
                            </p>
                            <p className="text-xs text-text-tertiary dark:text-dark-text-tertiary">
                              {t('gas.sinceLastReading')}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
};

GasAnalyticsPage.displayName = 'GasAnalyticsPage';
