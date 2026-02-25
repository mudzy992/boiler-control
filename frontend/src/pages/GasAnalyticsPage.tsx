import React, { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { StatCard } from '../components/StatCard';
import { Button } from 'antd';
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

  const { data: analysisData = {}, isLoading, error } = useQuery({
    queryKey: [
      'gas-analysis',
      useDefaultReferenceRange ? 'default-range' : `${dateRange.from}-${dateRange.to}`,
    ],
    queryFn: async () => {
      try {
        const result = useDefaultReferenceRange
          ? await apiClient.getGasAnalysis()
          : await apiClient.getGasAnalysis(dateRange.from, dateRange.to);
        console.log('Gas Analysis API Response:', result);
        return result;
      } catch (err) {
        console.error('Error fetching gas analysis:', err);
        return {};
      }
    },
    staleTime: 1000 * 60 * 5,
  });

  // Also fetch all readings for the "Recent Readings" section
  const { data: readings = [] } = useQuery({
    queryKey: ['gas-readings'],
    queryFn: async () => {
      const response = await apiClient.getGasReadings();
      return Array.isArray(response) ? response : [];
    },
    staleTime: 1000 * 60 * 5,
  });

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
      <div className="p-6 text-red-600 rounded-lg bg-red-50 dark:bg-red-900/20 dark:text-red-400">
        {t('gas.loadAnalyticsError')} {t('gas.loadAnalyticsErrorDesc')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          {t('gas.analyticsPageTitle')}
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
          {t('gas.analyticsPageSubtitle')}
        </p>
      </div>

      {/* Period Selector */}
      <div className="p-4 bg-white border border-gray-200 rounded-lg dark:border-slate-700 dark:bg-slate-800">
        <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300">
          {t('gas.analyzePeriod')}
        </label>
        <div className="flex flex-wrap gap-2 mt-3 sm:gap-3">
          <Button
            onClick={() => setUseDefaultReferenceRange(true)}
            type={useDefaultReferenceRange ? 'primary' : 'default'}
          >
            {t('gas.periodReferenceCurrent')}
          </Button>
          {[7, 14, 30, 90, 365].map((days) => (
            <Button
              key={days}
              onClick={() => {
                setUseDefaultReferenceRange(false);
                setPeriodDays(days);
              }}
              type={!useDefaultReferenceRange && periodDays === days ? 'primary' : 'default'}
            >
              {days === 7 ? '7d' : days === 14 ? '14d' : days === 30 ? '30d' : days === 90 ? '90d' : '1y'}
            </Button>
          ))}
        </div>
      </div>

      <div className="p-4 border border-blue-200 rounded-lg bg-blue-50 dark:border-blue-900/50 dark:bg-blue-900/10">
        <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase dark:text-blue-300">
          {t('gas.analysisWindowTitle')}
        </p>
        <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">{periodModeLabel}</p>
        <p className="text-xs text-blue-600 dark:text-blue-400">
          {(periodStart && dayjs(periodStart).format('DD.MM.YYYY')) || '—'} -{' '}
          {(periodEnd && dayjs(periodEnd).format('DD.MM.YYYY')) || '—'}
        </p>
        {analysisData?.referenceReading && (
          <p className="text-xs text-blue-600 dark:text-blue-400">
            {t('gas.analysisReferenceReading')}: {dayjs(analysisData.referenceReading.readingDate).format('DD.MM.YYYY')} (
            {Number(analysisData.referenceReading.counterValue ?? 0).toFixed(2)} m³)
          </p>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-gray-300 rounded-full animate-spin border-t-blue-600 dark:border-slate-700 dark:border-t-blue-500"></div>
        </div>
      )}

      {!isLoading && readings.length === 0 && (
        <div className="px-6 py-12 text-center border-2 border-gray-300 border-dashed rounded-lg bg-gray-50 dark:border-slate-700 dark:bg-slate-800/30">
          <svg className="w-12 h-12 mx-auto mb-4 text-gray-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-gray-600 dark:text-slate-400">{t('gas.noReadingsYet')}</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-500">
            {t('gas.noReadingsAddFirst')}
          </p>
        </div>
      )}

      {!isLoading && readings.length > 0 && (
        <>
          {/* Primary Metrics Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard title={t('gas.metricCostExVat')} value={analysisData.costExVat ?? 0} suffix="" />
            <StatCard title={t('gas.metricVat')} value={analysisData.vatAmount ?? 0} suffix="" />
            <StatCard title={t('gas.metricCostIncVat')} value={analysisData.costIncVat ?? 0} suffix="" />
          </div>

          {!!analysisData.priceBreakdown?.length && (
            <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <p className="text-xs font-semibold tracking-wide text-gray-700 uppercase dark:text-slate-300">
                {t('gas.priceWindows')}
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 dark:text-slate-400">
                      <th className="px-2 py-2">{t('gas.priceExVat')}</th>
                      <th className="px-2 py-2">{t('gas.source')}</th>
                      <th className="px-2 py-2">{t('gas.effective')}</th>
                      <th className="px-2 py-2">{t('gas.consumption')}</th>
                      <th className="px-2 py-2">{t('gas.costExVat')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysisData.priceBreakdown.map((row: any, idx: number) => (
                      <tr key={`${row.priceExVat}-${idx}`} className="border-t border-gray-100 dark:border-slate-700">
                        <td className="px-2 py-2 font-medium text-gray-900 dark:text-gray-100">
                          {Number(row.priceExVat ?? 0).toFixed(4)}
                        </td>
                        <td className="px-2 py-2 text-gray-600 dark:text-slate-300">
                          {(row.source || 'MANUAL').toUpperCase()}
                        </td>
                        <td className="px-2 py-2 text-gray-600 dark:text-slate-300">
                          {row.effectiveFrom ? dayjs(row.effectiveFrom).format('DD.MM.YYYY') : '—'} -{' '}
                          {row.effectiveTo ? dayjs(row.effectiveTo).format('DD.MM.YYYY') : t('gas.priceCurrent')}
                        </td>
                        <td className="px-2 py-2 text-gray-600 dark:text-slate-300">
                          {Number(row.consumptionM3 ?? 0).toFixed(2)} m³
                        </td>
                        <td className="px-2 py-2 text-gray-600 dark:text-slate-300">
                          {Number(row.costExVat ?? 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Efficiency Card */}
          <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <p className="text-xs font-semibold tracking-wide text-gray-700 uppercase dark:text-slate-300">
              {t('gas.heatingEfficiency')}
            </p>
            <div className="flex items-center gap-3 mt-4">
              <span className="text-3xl">{analysisData.efficiency?.label ? '✓' : '?'}</span>
              <div>
                <p className="font-bold text-blue-600 dark:text-blue-400">
                  {analysisData.efficiency?.label || t('gas.noData')}
                </p>
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  {typeof analysisData.efficiency?.m3PerHour === 'number' ? analysisData.efficiency.m3PerHour.toFixed(3) : '0.000'} m³/hour
                </p>
              </div>
            </div>
          </div>

          {/* Recent Readings Section */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="px-4 py-4 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('gas.recentReadingsTitle')}
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
                {t('gas.recentReadingsSubtitle')}
              </p>
            </div>
            {readings.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-gray-600 dark:text-slate-400">{t('gas.noReadingsAvailable')}</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-slate-700">
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
                      <div key={reading.id} className="flex items-center justify-between px-4 py-4 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {reading.counterValue} m³
                          </p>
                          <p className="mt-0.5 text-sm text-gray-600 dark:text-slate-400">
                            {dayjs(reading.readingDate).format('MMM DD, YYYY HH:mm')}
                          </p>
                        </div>
                        {consumption !== null && (
                          <div className="text-right">
                            <p className="font-semibold text-blue-600 dark:text-blue-400">
                              +{consumption.toFixed(2)} m³
                            </p>
                            <p className="text-xs text-gray-500 dark:text-slate-500">
                              {t('gas.sinceLastReading')}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
