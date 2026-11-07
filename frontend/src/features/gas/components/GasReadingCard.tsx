import React, { useState } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/Button';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';

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

function badge(kind: 'reference' | 'standard' | 'image' | 'invoice') {
  const variants: Record<string, string> = {
    reference:
      'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-100',
    standard:
      'bg-surface-muted text-text-tertiary dark:bg-dark-surface-muted dark:text-dark-text-tertiary',
    image:
      'bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-100',
    invoice:
      'bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-100',
  };
  return `inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${variants[kind]}`;
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
  const [confirmOpen, setConfirmOpen] = useState(false);

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

  return (
    <div className="p-5 transition-shadow duration-200 rounded-xl border border-border bg-surface shadow-sm hover:shadow-md dark:border-dark-border dark:bg-dark-surface-elevated">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-text-primary dark:text-dark-text-primary">
            {reading.counterValue} m³
          </h3>
          <p className="text-sm text-text-secondary dark:text-dark-text-secondary">
            {dayjs(reading.readingDate).format('MMM DD, YYYY HH:mm')}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className={badge(reading.isInvoiceReference ? 'reference' : 'standard')}>
              {reading.isInvoiceReference ? t('gas.badgeReference') : t('gas.badgeStandard')}
            </span>
            {reading.hasMeterImage && (
              <span className={badge('image')}>{t('gas.badgeImage')}</span>
            )}
            {reading.hasInvoicePdf && (
              <span className={badge('invoice')}>{t('gas.badgeInvoice')}</span>
            )}
          </div>
        </div>
        <Button
          variant="danger"
          size="sm"
          onClick={() => setConfirmOpen(true)}
          disabled={isLoading}
        >
          {isLoading ? t('gas.deleting') : t('common.delete')}
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          {onToggleReference && (
            <Button
              variant={reading.isInvoiceReference ? 'secondary' : 'primary'}
              size="sm"
              onClick={() => onToggleReference(reading.id, !reading.isInvoiceReference)}
              disabled={isLoading}
            >
              {reading.isInvoiceReference ? t('gas.actionUnsetReference') : t('gas.actionSetReference')}
            </Button>
          )}
          {onUploadMeterImage && (
            <Button variant="ghost" size="sm" onClick={() => onUploadMeterImage(reading.id)} disabled={isLoading}>
              {reading.hasMeterImage ? t('gas.actionReplaceImage') : t('gas.actionAddImage')}
            </Button>
          )}
          {reading.hasMeterImage && onOpenMeterImage && (
            <Button variant="ghost" size="sm" onClick={() => onOpenMeterImage(reading.id)} disabled={isLoading}>
              {t('gas.actionOpenImage')}
            </Button>
          )}
        </div>

        {reading.isInvoiceReference ? (
          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-xs font-semibold text-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
              {t('gas.invoiceActionsTitle')}
            </p>
            <div className="flex flex-wrap gap-3">
              {onUploadInvoice && (
                <Button variant="primary" size="sm" onClick={() => onUploadInvoice(reading.id)} disabled={isLoading}>
                  {reading.hasInvoicePdf ? t('gas.actionReplaceInvoice') : t('gas.actionAddInvoice')}
                </Button>
              )}
              {reading.hasInvoicePdf && onOpenInvoice && (
                <Button variant="ghost" size="sm" onClick={() => onOpenInvoice(reading.id)} disabled={isLoading}>
                  {t('gas.actionOpenInvoice')}
                </Button>
              )}
              {reading.hasInvoicePdf && onDeleteInvoice && (
                <Button variant="danger" size="sm" onClick={() => onDeleteInvoice(reading.id)} disabled={isLoading}>
                  {t('gas.actionDeleteInvoice')}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-text-tertiary dark:text-dark-text-tertiary">
            {t('gas.invoiceReferenceHint')}
          </p>
        )}

        {/* Consumption Info */}
        {consumption !== null && daysDiff > 0 && (
          <div className="p-4 mt-3 rounded-lg border border-border bg-info-50 dark:border-dark-border dark:bg-info-900/20">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                  {t('gas.consumption')}
                </p>
                <p className="text-sm font-bold text-info-700 dark:text-info-100">
                  +{consumption.toFixed(2)} m³
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                  {t('gas.dailyAverage')}
                </p>
                <p className="text-sm font-bold text-info-700 dark:text-info-100">
                  {dailyConsumption.toFixed(2)} m³/day
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-text-secondary dark:text-dark-text-secondary">
              {t('gas.period')}: {daysDiff}
            </p>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('gas.deleteConfirm')}
        confirmLabel={t('common.delete')}
        variant="destructive"
        onConfirm={() => {
          setConfirmOpen(false);
          onDelete(reading.id);
        }}
      />
    </div>
  );
};

GasReadingCard.displayName = 'GasReadingCard';
