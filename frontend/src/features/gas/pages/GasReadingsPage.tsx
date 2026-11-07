import { useMemo, useState, type JSX } from 'react';
import dayjs from 'dayjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/shared/components/page-header';
import { QueryState } from '@/shared/components/query-state';
import { StatusBanner } from '@/shared/components/status-banner';
import { Button } from '@/shared/components/ui/Button';
import { queryKeys } from '@/lib/queryKeys';
import { apiClient } from '@/services/api';
import { GasForm } from '../components/GasForm';
import { GasReadingCard } from '../components/GasReadingCard';
import { useGasReadingsQuery } from '../hooks/useGasQueries';

export const GasReadingsPage = (): JSX.Element => {
  const { t } = useTranslation();
  const [showAddModal, setShowAddModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { data: readings = [], isLoading, error, refetch } = useGasReadingsQuery();

  const showError = (key: string) => {
    setErrorMessage(t(key));
  };

  const addMutation = useMutation({
    mutationFn: async (data: {
      counterValue: number;
      readingDate: string;
      meterImage?: File;
    }) => apiClient.addGasReadingWithUpload(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.gasReadings });
      void queryClient.invalidateQueries({ queryKey: queryKeys.gasAnalysisRoot });
      setShowAddModal(false);
    },
    onError: () => showError('gas.addReadingError'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiClient.deleteGasReading(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.gasReadings });
      void queryClient.invalidateQueries({ queryKey: queryKeys.gasAnalysisRoot });
    },
    onError: () => showError('gas.deleteError'),
  });

  const referenceMutation = useMutation({
    mutationFn: async (payload: { id: number; isReference: boolean }) =>
      apiClient.updateGasReference(payload.id, payload.isReference),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.gasReadings });
      void queryClient.invalidateQueries({ queryKey: queryKeys.gasAnalysisRoot });
    },
    onError: () => showError('gas.referenceError'),
  });

  const meterImageUploadMutation = useMutation({
    mutationFn: async (payload: { id: number; meterImage: File }) =>
      apiClient.uploadGasMeterImage(payload.id, payload.meterImage),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.gasReadings });
    },
    onError: () => showError('gas.meterImageUploadError'),
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.gasReadings });
      void queryClient.invalidateQueries({ queryKey: queryKeys.gasAnalysisRoot });
    },
    onError: () => showError('gas.invoiceUploadError'),
  });

  const invoiceDeleteMutation = useMutation({
    mutationFn: async (id: number) => apiClient.deleteGasInvoice(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.gasReadings });
      void queryClient.invalidateQueries({ queryKey: queryKeys.gasAnalysisRoot });
    },
    onError: () => showError('gas.invoiceDeleteError'),
  });

  const openProtectedFile = async (url: string, fileName: string) => {
    const blob = await apiClient.downloadProtectedFile(url);
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    link.click();
    window.URL.revokeObjectURL(blobUrl);
  };

  const handleUploadInvoice = (readingId: number) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      void invoiceUploadMutation
        .mutateAsync({ id: readingId, invoicePdf: file })
        .catch(() => showError('gas.invoiceUploadError'));
    };
    input.click();
  };

  const handleUploadMeterImage = (readingId: number) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      void meterImageUploadMutation
        .mutateAsync({ id: readingId, meterImage: file })
        .catch(() => showError('gas.meterImageUploadError'));
    };
    input.click();
  };

  const sortedReadings = useMemo(
    () =>
      [...readings].sort((a, b) => dayjs(b.readingDate).diff(dayjs(a.readingDate))),
    [readings],
  );

  const handleExportCSV = () => {
    const headers = ['Counter Value (m³)', 'Reading Date', 'Created At'];
    const rows = readings.map((r) => [
      r.counterValue,
      dayjs(r.readingDate).format('YYYY-MM-DD HH:mm'),
      dayjs(r.createdAt).format('YYYY-MM-DD HH:mm'),
    ]);
    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
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

  const allPending =
    deleteMutation.isPending ||
    referenceMutation.isPending ||
    meterImageUploadMutation.isPending ||
    invoiceUploadMutation.isPending ||
    invoiceDeleteMutation.isPending;

  const status = isLoading
    ? 'loading'
    : error
      ? 'error'
      : readings.length === 0
        ? 'empty'
        : 'success';

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('gas.title')}
        description={`${t('gas.subtitle')} ${readings.length} ${t('gas.readingsRecorded')}.`}
        action={
          <>
            {readings.length > 0 ? (
              <Button type="button" size="sm" onClick={handleExportCSV}>
                {t('gas.exportCsv')}
              </Button>
            ) : null}
            <Button type="button" onClick={() => setShowAddModal(true)}>
              {t('gas.addReadingCta')}
            </Button>
          </>
        }
      />
      {errorMessage ? (
        <StatusBanner
          variant="error"
          message={errorMessage}
          onDismiss={() => setErrorMessage(null)}
          dismissLabel={t('common.dismiss')}
        />
      ) : null}
      <QueryState
        status={status}
        emptyMessage={t('gas.noReadingsYet')}
        onRetry={() => void refetch()}
      >
        <div className="space-y-3">
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
                void openProtectedFile(
                  apiClient.getGasMeterImageUrl(id),
                  `meter-${id}.jpg`,
                ).catch(() => showError('gas.meterImageOpenError'))
              }
              onOpenInvoice={(id) =>
                void openProtectedFile(
                  apiClient.getGasInvoiceUrl(id),
                  `invoice-${id}.pdf`,
                ).catch(() => showError('gas.invoiceOpenError'))
              }
              isLoading={allPending}
            />
          ))}
        </div>
      </QueryState>
      <GasForm
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={(data) => addMutation.mutateAsync(data)}
        isLoading={addMutation.isPending}
      />
    </div>
  );
};
