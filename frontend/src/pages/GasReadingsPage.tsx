import React, { useState, useMemo } from 'react';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { GasReadingCard } from '../components/GasReadingCard';
import { GasForm } from '../components/GasForm';
import { Button, message } from 'antd';
import { useTranslation } from 'react-i18next';

export const GasReadingsPage: React.FC = () => {
  const { t } = useTranslation();
  const [showAddModal, setShowAddModal] = useState(false);
  const queryClient = useQueryClient();
  const token = localStorage.getItem('token');

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
    mutationFn: async (data: {
      counterValue: number;
      readingDate: string;
      meterImage?: File;
    }) => {
      return apiClient.addGasReadingWithUpload(data);
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
      return apiClient.deleteGasReading(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gas-readings'] });
      queryClient.invalidateQueries({ queryKey: ['gas-analysis'] });
    },
  });

  const referenceMutation = useMutation({
    mutationFn: async (payload: { id: number; isReference: boolean }) =>
      apiClient.updateGasReference(payload.id, payload.isReference),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gas-readings'] });
      queryClient.invalidateQueries({ queryKey: ['gas-analysis'] });
    },
  });

  const meterImageUploadMutation = useMutation({
    mutationFn: async (payload: { id: number; meterImage: File }) =>
      apiClient.uploadGasMeterImage(payload.id, payload.meterImage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gas-readings'] });
    },
  });

  const invoiceUploadMutation = useMutation({
    mutationFn: async (payload: {
      id: number;
      invoicePdf: File;
      invoiceGasPriceExVat?: number;
    }) =>
      apiClient.uploadGasInvoice(
        payload.id,
        payload.invoicePdf,
        payload.invoiceGasPriceExVat,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gas-readings'] });
      queryClient.invalidateQueries({ queryKey: ['gas-analysis'] });
    },
  });

  const invoiceDeleteMutation = useMutation({
    mutationFn: async (id: number) => apiClient.deleteGasInvoice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gas-readings'] });
      queryClient.invalidateQueries({ queryKey: ['gas-analysis'] });
    },
  });

  const openProtectedFile = async (url: string, fileName: string) => {
    if (!token) {
      message.error(t('gas.authMissing'));
      return;
    }
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error(t('gas.loadError'));
    }
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    link.click();
    window.URL.revokeObjectURL(blobUrl);
  };

  const handleUploadInvoice = async (readingId: number) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        await invoiceUploadMutation.mutateAsync({ id: readingId, invoicePdf: file });
      } catch {
        message.error(t('gas.invoiceUploadError'));
      }
    };
    input.click();
  };

  const handleUploadMeterImage = async (readingId: number) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        await meterImageUploadMutation.mutateAsync({ id: readingId, meterImage: file });
      } catch {
        message.error(t('gas.meterImageUploadError'));
      }
    };
    input.click();
  };

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
        {t('gas.loadError')} {t('gas.loadErrorDesc')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="mb-6 text-3xl font-bold text-gray-900 dark:text-white">
        {t('gas.title')}
      </h1>
      <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
        {t('gas.subtitle')} {readings.length} {t('gas.readingsRecorded')}.
      </p>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 mt-6 sm:flex-row sm:items-center sm:justify-end">
        {readings.length > 0 && (
          <Button
            onClick={handleExportCSV}
            type='primary'
            size='large'
          >
            {t('gas.exportCsv')}
          </Button>
        )}
        <Button
          onClick={() => setShowAddModal(true)}
          type='primary'
          size='large'
        >
          {t('gas.addReadingCta')}
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
            {t('gas.noReadingsYet')}
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-500">
            {t('gas.noReadingsAddFirst')}
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
                onToggleReference={(id, isReference) =>
                  referenceMutation.mutate({ id, isReference })
                }
                onUploadMeterImage={handleUploadMeterImage}
                onUploadInvoice={handleUploadInvoice}
                onDeleteInvoice={(id) => invoiceDeleteMutation.mutate(id)}
                onOpenMeterImage={(id) =>
                  void openProtectedFile(apiClient.getGasMeterImageUrl(id), `meter-${id}.jpg`).catch(
                    () => message.error(t('gas.meterImageOpenError')),
                  )
                }
                onOpenInvoice={(id) =>
                  void openProtectedFile(apiClient.getGasInvoiceUrl(id), `invoice-${id}.pdf`).catch(
                    () => message.error(t('gas.invoiceOpenError')),
                  )
                }
                isLoading={
                  deleteMutation.isPending ||
                  referenceMutation.isPending ||
                  meterImageUploadMutation.isPending ||
                  invoiceUploadMutation.isPending ||
                  invoiceDeleteMutation.isPending
                }
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
