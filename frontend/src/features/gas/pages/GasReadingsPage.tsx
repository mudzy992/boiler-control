import { useMemo, useState, type JSX } from "react";
import dayjs from "dayjs";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/shared/components/page-header";
import { QueryState } from "@/shared/components/query-state";
import { StatusBanner } from "@/shared/components/status-banner";
import { Button } from "@/shared/components/ui/Button";
import { Card, CardContent } from "@/shared/components/ui/Card";
import { queryKeys } from "@/lib/queryKeys";
import { apiClient } from "@/services/api";
import {
  DateRangeFilter,
  TablePager,
  type DateRange,
} from "@/shared/components/table-controls";
import { GasForm } from "../components/GasForm";
import { GasReadingCard } from "../components/GasReadingCard";
import { useGasReadingsQuery } from "../hooks/useGasQueries";

const PAGE_SIZE = 20;

export const GasReadingsPage = (): JSX.Element => {
  const { t } = useTranslation();
  const [showAddModal, setShowAddModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [range, setRange] = useState<DateRange>({ from: "", to: "" });
  const [offset, setOffset] = useState(0);
  const queryClient = useQueryClient();
  /*
   * Traži se `PAGE_SIZE + 1` red, počevši od jednog reda prije strane. Taj
   * dodatni red nije za prikaz — on je „prethodno očitanje" prve kartice, bez
   * kojeg bi prva kartica na strani 2 pokazala potrošnju od nule. Bez njega bi
   * straničenje tiho lagalo o potrošnji.
   */
  const fetchOffset = Math.max(0, offset - 1);
  const {
    data: readingsData,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGasReadingsQuery({
    limit: PAGE_SIZE + 1,
    offset: fetchOffset,
    from: range.from,
    to: range.to,
  });
  const fetched = readingsData?.rows ?? [];
  const hasPrevious = offset > 0 && fetched.length > 0;
  const readings = hasPrevious ? fetched.slice(1) : fetched;
  /** Ukupno na serveru; ako je veće od `readings.length`, ekran to kaže (`33`). */
  const totalReadings = readingsData?.total ?? 0;

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
      void queryClient.invalidateQueries({
        queryKey: queryKeys.gasAnalysisRoot,
      });
      setShowAddModal(false);
    },
    onError: () => showError("gas.addReadingError"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiClient.deleteGasReading(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.gasReadings });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.gasAnalysisRoot,
      });
    },
    onError: () => showError("gas.deleteError"),
  });

  const referenceMutation = useMutation({
    mutationFn: async (payload: { id: number; isReference: boolean }) =>
      apiClient.updateGasReference(payload.id, payload.isReference),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.gasReadings });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.gasAnalysisRoot,
      });
    },
    onError: () => showError("gas.referenceError"),
  });

  const meterImageUploadMutation = useMutation({
    mutationFn: async (payload: { id: number; meterImage: File }) =>
      apiClient.uploadGasMeterImage(payload.id, payload.meterImage),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.gasReadings });
    },
    onError: () => showError("gas.meterImageUploadError"),
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
      void queryClient.invalidateQueries({
        queryKey: queryKeys.gasAnalysisRoot,
      });
    },
    onError: () => showError("gas.invoiceUploadError"),
  });

  const invoiceDeleteMutation = useMutation({
    mutationFn: async (id: number) => apiClient.deleteGasInvoice(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.gasReadings });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.gasAnalysisRoot,
      });
    },
    onError: () => showError("gas.invoiceDeleteError"),
  });

  const openProtectedFile = async (url: string, fileName: string) => {
    const blob = await apiClient.downloadProtectedFile(url);
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = fileName;
    link.click();
    window.URL.revokeObjectURL(blobUrl);
  };

  const handleUploadInvoice = (readingId: number) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      void invoiceUploadMutation
        .mutateAsync({ id: readingId, invoicePdf: file })
        .catch(() => showError("gas.invoiceUploadError"));
    };
    input.click();
  };

  const handleUploadMeterImage = (readingId: number) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      void meterImageUploadMutation
        .mutateAsync({ id: readingId, meterImage: file })
        .catch(() => showError("gas.meterImageUploadError"));
    };
    input.click();
  };

  const sortedReadings = useMemo(
    () =>
      [...readings].sort((a, b) =>
        dayjs(b.readingDate).diff(dayjs(a.readingDate)),
      ),
    [readings],
  );

  const handleExportCSV = () => {
    const headers = ["Counter Value (m³)", "Reading Date", "Created At"];
    const rows = readings.map((r) => [
      r.counterValue,
      dayjs(r.readingDate).format("YYYY-MM-DD HH:mm"),
      dayjs(r.createdAt).format("YYYY-MM-DD HH:mm"),
    ]);
    const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join(
      "\n",
    );
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gas-readings-${dayjs().format("YYYY-MM-DD")}.csv`;
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
    ? "loading"
    : error
      ? "error"
      : readings.length === 0
        ? "empty"
        : "success";

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("gas.title")}
        description={`${t("gas.subtitle")} ${totalReadings} ${t("gas.readingsRecorded")}.${
          // Straničeno (`36`): broj u podnaslovu je ukupan, a koja je strana
          // prikazana piše podnožje liste.
          totalReadings > PAGE_SIZE
            ? ` ${t("common.showingOf", {
                shown: readings.length,
                total: totalReadings,
              })}`
            : ""
        }`}
        action={
          <>
            {readings.length > 0 ? (
              <Button type="button" size="sm" onClick={handleExportCSV}>
                {t("gas.exportCsv")}
              </Button>
            ) : null}
            <Button type="button" onClick={() => setShowAddModal(true)}>
              {t("gas.addReadingCta")}
            </Button>
          </>
        }
      />
      {errorMessage ? (
        <StatusBanner
          variant="error"
          message={errorMessage}
          onDismiss={() => setErrorMessage(null)}
          dismissLabel={t("common.dismiss")}
        />
      ) : null}
      <DateRangeFilter
        idPrefix="gas-readings-range"
        value={range}
        onChange={(next) => {
          setRange(next);
          setOffset(0);
        }}
        disabled={isFetching}
      />
      <QueryState
        status={status}
        emptyMessage={t("gas.noReadingsYet")}
        onRetry={() => void refetch()}
      >
        <div className="space-y-3">
          {sortedReadings.map((reading, index) => (
            <GasReadingCard
              key={reading.id}
              reading={reading}
              previousReading={
                index > 0 ? sortedReadings[index - 1] : undefined
              }
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
                ).catch(() => showError("gas.meterImageOpenError"))
              }
              onOpenInvoice={(id) =>
                void openProtectedFile(
                  apiClient.getGasInvoiceUrl(id),
                  `invoice-${id}.pdf`,
                ).catch(() => showError("gas.invoiceOpenError"))
              }
              isLoading={allPending}
            />
          ))}
          <Card>
            <CardContent className="p-0 pt-0">
              <TablePager
                total={totalReadings}
                offset={offset}
                limit={PAGE_SIZE}
                onChange={setOffset}
                isFetching={isFetching}
              />
            </CardContent>
          </Card>
        </div>
      </QueryState>
      <GasForm
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        // `F15`: upload vraća tijelo odgovora, a forma traži `Promise<void>` —
        // zato se rezultat ne propagira. Ranije je `response.data` bio `any`, pa
        // se ova razlika nije vidjela.
        onSubmit={async (data) => {
          await addMutation.mutateAsync(data);
        }}
        isLoading={addMutation.isPending}
      />
    </div>
  );
};
