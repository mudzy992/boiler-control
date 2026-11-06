import React from 'react';
import dayjs from 'dayjs';
import { Button } from 'antd';
import { useTranslation } from 'react-i18next';

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
  onUploadMeterImage?: (id: number) => void;
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
  onUploadMeterImage,
  onUploadInvoice,
  onDeleteInvoice,
  onOpenMeterImage,
  onOpenInvoice,
  isLoading = false,
}) => {
  const { t } = useTranslation();

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
    if (window.confirm(t('gas.deleteConfirm'))) {
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
              {reading.isInvoiceReference ? t('gas.badgeReference') : t('gas.badgeStandard')}
            </span>
            {reading.hasMeterImage && (
              <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                {t('gas.badgeImage')}
              </span>
            )}
            {reading.hasInvoicePdf && (
              <span className="rounded-full bg-green-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                {t('gas.badgeInvoice')}
              </span>
            )}
          </div>
        </div>
        <Button
          onClick={handleDelete}
          disabled={isLoading}
          danger
        >
          {isLoading ? t('gas.deleting') : t('common.delete')}
        </Button>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex flex-wrap gap-2">
          {onToggleReference && (
            <Button
              size="small"
              type={reading.isInvoiceReference ? 'default' : 'primary'}
              onClick={() => onToggleReference(reading.id, !reading.isInvoiceReference)}
              disabled={isLoading}
            >
              {reading.isInvoiceReference ? t('gas.actionUnsetReference') : t('gas.actionSetReference')}
            </Button>
          )}
          {onUploadMeterImage && (
            <Button
              size="small"
              type="primary"
              ghost
              onClick={() => onUploadMeterImage(reading.id)}
              disabled={isLoading}
            >
              {reading.hasMeterImage ? t('gas.actionReplaceImage') : t('gas.actionAddImage')}
            </Button>
          )}
          {reading.hasMeterImage && onOpenMeterImage && (
            <Button
              size="small"
              onClick={() => onOpenMeterImage(reading.id)}
              disabled={isLoading}
            >
              {t('gas.actionOpenImage')}
            </Button>
          )}
        </div>

        {reading.isInvoiceReference ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-600 dark:text-slate-400">
              {t('gas.invoiceActionsTitle')}
            </p>
            <div className="flex flex-wrap gap-2">
              {onUploadInvoice && (
                <Button
                  size="small"
                  type="primary"
                  onClick={() => onUploadInvoice(reading.id)}
                  disabled={isLoading}
                >
                  {reading.hasInvoicePdf ? t('gas.actionReplaceInvoice') : t('gas.actionAddInvoice')}
                </Button>
              )}
              {reading.hasInvoicePdf && onOpenInvoice && (
                <Button
                  size="small"
                  type="default"
                  onClick={() => onOpenInvoice(reading.id)}
                  disabled={isLoading}
                >
                  {t('gas.actionOpenInvoice')}
                </Button>
              )}
              {reading.hasInvoicePdf && onDeleteInvoice && (
                <Button
                  size="small"
                  danger
                  onClick={() => onDeleteInvoice(reading.id)}
                  disabled={isLoading}
                >
                  {t('gas.actionDeleteInvoice')}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-500 dark:text-slate-400">
            {t('gas.invoiceReferenceHint')}
          </p>
        )}
      </div>

      {/* Consumption Info */}
      {consumption !== null && daysDiff > 0 && (
        <div className="p-3 mt-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-slate-400">
                {t('gas.consumption')}
              </p>
              <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                +{consumption.toFixed(2)} m³
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-slate-400">
                {t('gas.dailyAverage')}
              </p>
              <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                {dailyConsumption.toFixed(2)} m³/day
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-600 dark:text-slate-400">
            {t('gas.period')}: {daysDiff}
          </p>
        </div>
      )}
    </div>
  );
};
