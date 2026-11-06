import React, { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../services/api';
import { queryKeys } from '../../../lib/queryKeys';
// FE2-14 (FE-010): granice su ranije bile kopirane ovdje i u DashboardPage.tsx.
// Sada dolaze iz jednog mjesta, usklađenog s backend `SetCurrentTempDto`.
import {
  MIN_CURRENT_FLOW_TEMP,
  MAX_CURRENT_FLOW_TEMP,
} from '../../../constants/boilerLimits';

interface BoilerEvent {
  id: number;
  userId: number;
  externalTemp: number;
  suggestedFlowTemp: number;
  actualFlowTemp: number | null;
  heatingStart: string | null;
  heatingEnd: string | null;
  createdAt: string;
}

interface DeltaChipProps {
  delta: number;
}

function DeltaChip({ delta }: DeltaChipProps) {
  const abs = Math.abs(delta);
  const config =
    abs <= 2
      ? { label: 'OK', className: 'bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-100' }
      : delta > 0
        ? { label: 'HIGH', className: 'bg-warning-50 text-warning-700 dark:bg-warning-900/20 dark:text-warning-100' }
        : { label: 'LOW', className: 'bg-error-50 text-error-700 dark:bg-error-900/20 dark:text-error-100' };

  return (
    <span className={`px-2.5 py-0.5 rounded text-xs font-medium ${config.className}`}>
      {config.label} {delta >= 0 ? '+' : ''}{delta.toFixed(1)}°C
    </span>
  );
}

export const BoilerPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [setTempModalOpen, setSetTempModalOpen] = useState(false);
  const [setTempValue, setSetTempValue] = useState<number | null>(null);
  const [setTempSubmitting, setSetTempSubmitting] = useState(false);

  const { data: events = [], isLoading: loading, error } = useQuery({
    queryKey: queryKeys.boilerEvents,
    queryFn: async (): Promise<BoilerEvent[]> => {
      const data = await apiClient.getBoilerEvents();
      return Array.isArray(data) ? data : data?.events ?? [];
    },
  });

  if (error) {
    console.error('Error loading boiler events:', error);
  }

  const openSetTempModal = useCallback(() => {
    const latest = events[0];
    const fallback =
      typeof latest?.actualFlowTemp === 'number'
        ? latest.actualFlowTemp
        : latest?.suggestedFlowTemp ?? 52;
    setSetTempValue(Number(fallback.toFixed(1)));
    setSetTempModalOpen(true);
  }, [events]);

  const submitSetTemp = useCallback(async () => {
    if (typeof setTempValue !== 'number' || Number.isNaN(setTempValue)) {
      return;
    }

    if (
      setTempValue < MIN_CURRENT_FLOW_TEMP ||
      setTempValue > MAX_CURRENT_FLOW_TEMP
    ) {
      return;
    }

    try {
      setSetTempSubmitting(true);
      await apiClient.setBoilerCurrentTemp(Number(setTempValue.toFixed(1)));
      setSetTempModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.boilerEvents });
    } catch (error) {
      console.error('Failed to set boiler current temp:', error);
    } finally {
      setSetTempSubmitting(false);
    }
  }, [queryClient, setTempValue]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-border rounded-full animate-spin border-t-brand"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="content">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">
            Boiler Control
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Review boiler performance, flow temperature accuracy, and runtime history.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <Button onClick={openSetTempModal} variant="primary">
            Set current temp
          </Button>
        </div>
      </div>

      <Card padding="md" elevated>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text-primary">
            Recent Boiler Events ({events.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border dark:divide-dark-border">
            <thead className="bg-surface-muted text-xs text-text-secondary dark:bg-dark-surface-muted dark:text-dark-text-secondary">
              <tr>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-left">Heating Start</th>
                <th className="px-4 py-3 text-left">Heating End</th>
                <th className="px-4 py-3 text-left">Outside Temp</th>
                <th className="px-4 py-3 text-left">Suggested Flow</th>
                <th className="px-4 py-3 text-left">Actual Flow</th>
                <th className="px-4 py-3 text-left">Delta</th>
              </tr>
            </thead>
            <tbody className="text-sm text-text-primary divide-y divide-border dark:divide-dark-border">
              {events.map((record) => (
                <tr
                  key={record.id}
                  className="hover:bg-surface-muted dark:hover:bg-dark-surface-muted transition-colors duration-150"
                >
                  <td className="px-4 py-3">
                    {new Date(record.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {record.heatingStart
                      ? new Date(record.heatingStart).toLocaleString()
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {record.heatingEnd
                      ? new Date(record.heatingEnd).toLocaleString()
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {record.externalTemp.toFixed(1)}°C
                  </td>
                  <td className="px-4 py-3">
                    {record.suggestedFlowTemp.toFixed(1)}°C
                  </td>
                  <td className="px-4 py-3">
                    {typeof record.actualFlowTemp === 'number'
                      ? `${record.actualFlowTemp.toFixed(1)}°C`
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {typeof record.actualFlowTemp === 'number' ? (
                      <DeltaChip
                        delta={
                          record.actualFlowTemp - record.suggestedFlowTemp
                        }
                      />
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-text-tertiary">
                    No boiler events recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Set temp modal backdrop */}
      <div
        className={`fixed inset-0 z-modal-backdrop bg-black/40 ${
          setTempModalOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        } transition-opacity duration-200`}
        onClick={() => setSetTempModalOpen(false)}
      />
      <div
        className={`fixed inset-y-0 left-1/2 top-1/2 z-modal -translate-x-1/2 -translate-y-1/2 w-full max-w-md transform transition-transform duration-300 ${
          setTempModalOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        } bg-surface rounded-xl shadow-xl p-6 dark:bg-dark-surface`}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text-primary">
            Set Current Flow Temperature
          </h3>
          <Button variant="ghost" size="sm" onClick={() => setSetTempModalOpen(false)}>
            <span className="sr-only">Close</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </Button>
        </div>
        <p className="text-sm text-text-secondary mb-6">
          Allowed range: {MIN_CURRENT_FLOW_TEMP}°C - {MAX_CURRENT_FLOW_TEMP}°C
        </p>
        <InputNumber
          value={setTempValue ?? undefined}
          onChange={(value) =>
            setSetTempValue(typeof value === 'number' ? value : null)
          }
          min={MIN_CURRENT_FLOW_TEMP}
          max={MAX_CURRENT_FLOW_TEMP}
          step={0.1}
          precision={1}
          className="w-full mb-4"
          addonAfter="°C"
        />
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setSetTempModalOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={submitSetTemp}
            isLoading={setTempSubmitting}
            disabled={typeof setTempValue !== 'number'}
          >
            {setTempSubmitting ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
};

BoilerPage.displayName = 'BoilerPage';
