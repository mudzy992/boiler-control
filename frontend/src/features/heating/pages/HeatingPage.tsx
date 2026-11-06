import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../services/api';
import { queryKeys } from '../../../lib/queryKeys';

interface HeatingEvent {
  id: number;
  timestampStart: string;
  timestampEnd: string | null;
  roomCurrentTemp: number;
  roomTargetTemp: number;
  hvacAction: string;
  source: string;
  isAnomaly: boolean;
}

function AnomalyBadge({ isAnomaly }: { isAnomaly: boolean }) {
  return (
    <span className={`px-2.5 py-0.5 rounded text-xs font-medium ${
      isAnomaly
        ? 'bg-error-50 text-error-700 dark:bg-error-900/20 dark:text-error-100'
        : 'bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-100'
    }`}>
      {isAnomaly ? 'YES' : 'NO'}
    </span>
  );
}

export const HeatingPage: React.FC = () => {
  const { data: events = [], isLoading: loading, error } = useQuery({
    queryKey: queryKeys.heatingEvents,
    queryFn: async (): Promise<HeatingEvent[]> => {
      const data = await apiClient.getHeatingEvents();
      return Array.isArray(data) ? data : data?.events ?? [];
    },
  });

  if (error) {
    console.error('Failed to load heating events:', error);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-border rounded-full animate-spin border-t-brand"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="content">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">
          Heating Events
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Track heating sessions, targets, and anomaly detection.
        </p>
      </div>

      <Card padding="md" elevated>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border dark:divide-dark-border">
            <thead className="bg-surface-muted text-xs text-text-secondary dark:bg-dark-surface-muted dark:text-dark-text-secondary">
              <tr>
                <th className="px-4 py-3 text-left">Start</th>
                <th className="px-4 py-3 text-left">End</th>
                <th className="px-4 py-3 text-left">Room Temp</th>
                <th className="px-4 py-3 text-left">Target</th>
                <th className="px-4 py-3 text-left">Action</th>
                <th className="px-4 py-3 text-left">Source</th>
                <th className="px-4 py-3 text-left">Anomaly</th>
              </tr>
            </thead>
            <tbody className="text-sm text-text-primary divide-y divide-border dark:divide-dark-border">
              {events.map((record) => (
                <tr
                  key={record.id}
                  className="hover:bg-surface-muted dark:hover:bg-dark-surface-muted transition-colors duration-150"
                >
                  <td className="px-4 py-3">
                    {new Date(record.timestampStart).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {record.timestampEnd
                      ? new Date(record.timestampEnd).toLocaleString()
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {record.roomCurrentTemp.toFixed(1)}°C
                  </td>
                  <td className="px-4 py-3">
                    {record.roomTargetTemp.toFixed(1)}°C
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-100 text-xs font-medium">
                      {record.hvacAction}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {record.source}
                  </td>
                  <td className="px-4 py-3">
                    <AnomalyBadge isAnomaly={record.isAnomaly} />
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-text-tertiary">
                    No heating events recorded yet.
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

HeatingPage.displayName = 'HeatingPage';
