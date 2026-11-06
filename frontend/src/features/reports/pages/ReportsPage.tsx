import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { apiClient } from '../../../services/api';
import { queryKeys } from '../../../lib/queryKeys';
import { RecommendationBreakdown } from '../../heating/components/RecommendationBreakdown';
import type { components } from '../../../types/api';

type Recommendation = components['schemas']['RecommendationResponseDto'];

export const ReportsPage: React.FC = () => {
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // FE2-3: React Query instead of manual useEffect fetch.
  const { data: recommendations = [], isLoading: loading, error } = useQuery({
    queryKey: queryKeys.reports,
    queryFn: async (): Promise<Recommendation[]> => {
      const data = await apiClient.getReports();
      return Array.isArray(data) ? data : [];
    },
  });

  if (error) {
    console.error('Failed to load recommendations:', error);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-border rounded-full animate-spin border-t-brand"></div>
      </div>
    );
  }

  const toggleRow = (id: number) => {
    setExpandedId((current) => (current === id ? null : id));
  };

  return (
    <div className="space-y-6" id="content">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">
          {t('reports.title')}
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          {t('reports.subtitle')}
        </p>
      </div>

      <Card padding="md" elevated>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border dark:divide-dark-border">
            <thead className="bg-surface-muted text-xs text-text-secondary dark:bg-dark-surface-muted dark:text-dark-text-secondary">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Flow Temp</th>
                <th className="px-4 py-3 text-left">Expected Heat Time</th>
                <th className="px-4 py-3 text-left">Confidence</th>
                <th className="px-4 py-3 text-left">Details</th>
              </tr>
            </thead>
            <tbody className="text-sm text-text-primary divide-y divide-border dark:divide-dark-border">
              {recommendations.map((record) => {
                const expanded = expandedId === record.id;
                return (
                  <React.Fragment key={record.id}>
                    <tr className="hover:bg-surface-muted dark:hover:bg-dark-surface-muted transition-colors duration-150">
                      <td className="px-4 py-3">
                        {new Date(record.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        {record.recommendedFlowTemp.toFixed(1)}°C
                      </td>
                      <td className="px-4 py-3">
                        {record.expectedHeatTimeMin.toFixed(0)} min
                      </td>
                      <td className="px-4 py-3">
                        {Math.round(record.confidenceScore * 100)}%
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleRow(record.id)}
                          aria-expanded={expanded}
                        >
                          {expanded ? t('reports.hideDetails') : t('reports.showDetails')}
                        </Button>
                      </td>
                    </tr>
                    {expanded && record.breakdown && (
                      <tr>
                        <td colSpan={5} className="px-4 py-3">
                          <RecommendationBreakdown
                            breakdown={record.breakdown}
                            title={`${t('reports.title')} — ${new Date(record.date).toLocaleDateString()}`}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {recommendations.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-text-tertiary">
                    {t('reports.noData')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

ReportsPage.displayName = 'ReportsPage';
