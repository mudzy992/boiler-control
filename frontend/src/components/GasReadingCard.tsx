import React from 'react';
import dayjs from 'dayjs';
import { Button } from 'antd';

interface GasReadingProps {
  reading: {
    id: number;
    counterValue: number;
    readingDate: string;
    createdAt: string;
    isInvoiceReference?: boolean;
    hasMeterImage?: boolean;
    hasInvoicePdf?: boolean;
    invoiceUploadedAt?: string | null;
  };
  previousReading?: {
    counterValue: number;
    readingDate: string;
  };
  onDelete: (id: number) => void;
  onToggleReference?: (id: number, isReference: boolean) => void;
  onUploadInvoice?: (id: number) => void;
  onDeleteInvoice?: (id: number) => void;
  onOpenMeterImage?: (id: number) => void;
  onOpenInvoice?: (id: number) => void;
  isLoading?: boolean;
}

export const GasReadingCard: React.FC<GasReadingProps> = ({
  reading,
  previousReading,
  onDelete,
  onToggleReference,
  onUploadInvoice,
  onDeleteInvoice,
  onOpenMeterImage,
  onOpenInvoice,
  isLoading = false,
}) => {
  let consumption = null;
  let daysDiff = 0;
  let dailyConsumption = 0;

  if (previousReading) {
    consumption = previousReading.counterValue - reading.counterValue;
    daysDiff = dayjs(previousReading.readingDate).diff(dayjs(reading.readingDate), 'day');
    if (daysDiff > 0) {
      dailyConsumption = Math.round((consumption / daysDiff) * 100) / 100;
    }
  }

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this reading?')) {
      onDelete(reading.id);
    }
  };

  return (
    <div className="p-4 transition-all duration-200 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {reading.counterValue} m³
          </h3>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            {dayjs(reading.readingDate).format('MMM DD, YYYY HH:mm')}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                reading.isInvoiceReference
                  ? 'bg-amber-500 text-white'
                  : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
              }`}
            >
              {reading.isInvoiceReference ? 'REFERENCE' : 'STANDARD'}
            </span>
            {reading.hasMeterImage && (
              <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                IMAGE
              </span>
            )}
            {reading.hasInvoicePdf && (
              <span className="rounded-full bg-green-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                INVOICE
              </span>
            )}
          </div>
        </div>
        <Button
          onClick={handleDelete}
          disabled={isLoading}
          danger
        >
          {isLoading ? 'Deleting...' : 'Delete'}
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {onToggleReference && (
          <button
            type="button"
            onClick={() => onToggleReference(reading.id, !reading.isInvoiceReference)}
            disabled={isLoading}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold text-white ${
              reading.isInvoiceReference ? 'bg-orange-600' : 'bg-blue-600'
            } disabled:opacity-50`}
          >
            {reading.isInvoiceReference ? 'Unset Reference' : 'Set Reference'}
          </button>
        )}
        {reading.hasMeterImage && onOpenMeterImage && (
          <button
            type="button"
            onClick={() => onOpenMeterImage(reading.id)}
            disabled={isLoading}
            className="rounded-md bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            Open Image
          </button>
        )}
        {reading.isInvoiceReference && onUploadInvoice && (
          <button
            type="button"
            onClick={() => onUploadInvoice(reading.id)}
            disabled={isLoading}
            className="rounded-md bg-green-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {reading.hasInvoicePdf ? 'Replace Invoice' : 'Upload Invoice'}
          </button>
        )}
        {reading.hasInvoicePdf && onOpenInvoice && (
          <button
            type="button"
            onClick={() => onOpenInvoice(reading.id)}
            disabled={isLoading}
            className="rounded-md bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            Open Invoice
          </button>
        )}
        {reading.hasInvoicePdf && onDeleteInvoice && (
          <button
            type="button"
            onClick={() => onDeleteInvoice(reading.id)}
            disabled={isLoading}
            className="rounded-md bg-red-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            Delete Invoice
          </button>
        )}
      </div>

      {/* Consumption Info */}
      {consumption !== null && daysDiff > 0 && (
        <div className="p-3 mt-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-slate-400">
                Consumption
              </p>
              <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                +{consumption.toFixed(2)} m³
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-slate-400">
                Daily Average
              </p>
              <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                {dailyConsumption.toFixed(2)} m³/day
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-600 dark:text-slate-400">
            Period: {daysDiff} day{daysDiff !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
};
