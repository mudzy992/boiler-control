import React, { useState, useMemo } from 'react';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiClient } from '../services/api';
import { GasReadingCard } from '../components/GasReadingCard';
import { GasForm } from '../components/GasForm';
import { Button } from 'antd';

export const GasReadingsPage: React.FC = () => {
  const [showAddModal, setShowAddModal] = useState(false);
  const queryClient = useQueryClient();
  const gasApi = apiClient as ApiClient & {
    addGasReadingPayload: (data: { counterValue: number; readingDate: string }) => Promise<unknown>;
    deleteGasReading: (id: number) => Promise<unknown>;
  };

  // Fetch readings
  const { data: readings = [], isLoading, error } = useQuery({
    queryKey: ['gas-readings'],
    queryFn: async () => {
      const response = await apiClient.getGasReadings();
      return Array.isArray(response) ? response : [];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Add reading mutation
  const addMutation = useMutation({
    mutationFn: async (data: { counterValue: number; readingDate: string }) => {
      return gasApi.addGasReadingPayload(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gas-readings'] });
      queryClient.invalidateQueries({ queryKey: ['gas-analysis'] });
      setShowAddModal(false);
    },
  });

  // Delete reading mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return gasApi.deleteGasReading(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gas-readings'] });
      queryClient.invalidateQueries({ queryKey: ['gas-analysis'] });
    },
  });

  // Sort readings (newest first)
  const sortedReadings = useMemo(() => {
    return [...readings].sort((a, b) =>
      dayjs(b.readingDate).diff(dayjs(a.readingDate))
    );
  }, [readings]);

  const handleExportCSV = () => {
    const headers = ['Counter Value (m³)', 'Reading Date', 'Created At'];
    const rows = readings.map((r) => [
      r.counterValue,
      dayjs(r.readingDate).format('YYYY-MM-DD HH:mm'),
      dayjs(r.createdAt).format('YYYY-MM-DD HH:mm'),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gas-readings-${dayjs().format('YYYY-MM-DD')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  if (error) {
    return (
      <div className="p-6 text-red-600 rounded-lg bg-red-50 dark:bg-red-900/20 dark:text-red-400">
        Failed to load readings. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="mb-6 text-3xl font-bold text-gray-900 dark:text-white">
        Gas Readings
      </h1>
      <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
        Track your gas consumption. {readings.length} reading{readings.length !== 1 ? 's' : ''} recorded.
      </p>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 mt-6 sm:flex-row sm:items-center sm:justify-end">
        {readings.length > 0 && (
          <Button
            onClick={handleExportCSV}
            type='primary'
            size='large'
          >
            📥 Export CSV
          </Button>
        )}
        <Button
          onClick={() => setShowAddModal(true)}
          type='primary'
          size='large'
        >
          + Add Reading
        </Button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center mt-12">
          <div className="w-8 h-8 border-4 border-gray-300 rounded-full animate-spin border-t-blue-600 dark:border-slate-700 dark:border-t-blue-500"></div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && readings.length === 0 && (
        <div className="px-6 py-12 mt-12 text-center border-2 border-gray-300 border-dashed rounded-lg bg-gray-50 dark:border-slate-700 dark:bg-slate-800/30">
          <svg className="w-12 h-12 mx-auto mb-4 text-gray-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-600 dark:text-slate-400">
            No gas readings recorded yet.
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-500">
            Click "Add Reading" to create your first entry.
          </p>
        </div>
      )}

      {/* Readings list */}
      {!isLoading && readings.length > 0 && (
        <div className="mt-8 space-y-3">
          {sortedReadings.map((reading, index) => (
            <GasReadingCard
              key={reading.id}
              reading={reading}
              previousReading={index > 0 ? sortedReadings[index - 1] : undefined}
              onDelete={(id) => deleteMutation.mutateAsync(id)}
              isLoading={deleteMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* Add modal */}
      <GasForm
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={(data) => addMutation.mutateAsync(data)}
        isLoading={addMutation.isPending}
      />
    </div>
  );
};
