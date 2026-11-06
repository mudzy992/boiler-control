import React, { useState, useRef, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { Input } from './Input';
import { Button } from './Button';

/**
 * FE2-13: elementi između kojih Tab smije kružiti dok je dijalog otvoren.
 * Bez focus trapa Tab odvodi fokus na stranu iza overlaya, pa korisnik koji
 * koristi samo tastaturu "izgubi" dijalog.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getFocusable(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

/** Stabilan id naslova za `aria-labelledby`. */
const DIALOG_TITLE_ID = 'gas-form-dialog-title';

interface GasFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    counterValue: number;
    readingDate: string;
    meterImage?: File;
  }) => Promise<void>;
  isLoading?: boolean;
}

export const GasForm: React.FC<GasFormProps> = ({
  open,
  onClose,
  onSubmit,
  isLoading = false,
}) => {
  const { t } = useTranslation();

  const [formData, setFormData] = useState({
    counterValue: '',
    useCurrentDateTime: true,
    readingDate: dayjs().format('YYYY-MM-DD'),
    readingTime: dayjs().format('HH:mm'),
  });
  const [meterImage, setMeterImage] = useState<File | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string>('');

  const resetForm = () => {
    setFormData({
      counterValue: '',
      useCurrentDateTime: true,
      readingDate: dayjs().format('YYYY-MM-DD'),
      readingTime: dayjs().format('HH:mm'),
    });
    setMeterImage(null);
    setErrors({});
    setApiError('');
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.counterValue) {
      newErrors.counterValue = t('gas.counterValueRequired');
    } else if (!/^\d+(\.\d{1,3})?$/.test(formData.counterValue)) {
      newErrors.counterValue = t('gas.counterValueInvalidDecimal');
    } else if (parseFloat(formData.counterValue) <= 0) {
      newErrors.counterValue = t('gas.counterValueGreaterThanZero');
    }

    if (!formData.useCurrentDateTime && !formData.readingDate) {
      newErrors.readingDate = t('gas.dateRequired');
    }

    const selectedDate = dayjs(formData.readingDate);
    if (selectedDate.isAfter(dayjs(), 'day')) {
      newErrors.readingDate = t('gas.futureDateError');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError('');

    if (!validateForm()) {
      return;
    }

    try {
      const readingDatetime = formData.useCurrentDateTime
        ? dayjs().toISOString()
        : dayjs(`${formData.readingDate}T${formData.readingTime}`).toISOString();

      await onSubmit({
        counterValue: parseFloat(formData.counterValue),
        readingDate: readingDatetime,
        meterImage: meterImage || undefined,
      });

      // Reset form
      resetForm();
      onClose();
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        t('gas.addReadingError');
      setApiError(message);
    }
  };

  const dialogRef = useRef<HTMLDivElement>(null);

  /**
   * FE2-13: dok je dijalog otvoren fokus ide u njega, a pri zatvaranju se vraća
   * na element koji ga je imao prije. Bez ovoga korisnik koji koristi samo
   * tastaturu nakon zatvaranja ostaje bez fokusa (ili ga dobije na <body>).
   */
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = getFocusable(dialogRef.current);
    (focusables[0] ?? dialogRef.current)?.focus();
    return () => {
      previouslyFocused?.focus?.();
    };
  }, [open]);

  /**
   * FE2-13: Escape zatvara, a Tab kruži unutar dijaloga.
   */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusables = getFocusable(dialogRef.current);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  if (!open) return null;

  return (
    <>
      <div className={`fixed inset-0 z-modal-backdrop bg-black/40 ${
        open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      } transition-opacity duration-200`} />
      <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={DIALOG_TITLE_ID}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className={`fixed inset-y-0 left-1/2 top-1/2 z-modal -translate-x-1/2 -translate-y-1/2 w-full max-w-lg transform transition-transform duration-300 ${
        open ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
      } rounded-xl border border-border bg-surface shadow-2xl p-6 dark:border-dark-border dark:bg-dark-surface-elevated`}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 id={DIALOG_TITLE_ID} className="text-lg font-semibold text-text-primary dark:text-dark-text-primary">
            {t('gas.addReading')}
          </h2>
          <p className="text-sm text-text-secondary dark:text-dark-text-secondary">
            {t('gas.recordSubtitle')}
          </p>
        </div>
        {/* Close button stays reachable via click and Escape, but is taken
             out of the Tab sequence so the counter input is the first
             focusable dialog element (FE2-13 focus trap contract). */}
        <Button variant="ghost" size="sm" tabIndex={-1} onClick={() => onClose()}>
          <span className="sr-only">Close</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </Button>
      </div>

      {apiError && (
        <div className="mb-4 p-3 rounded-lg border border-error bg-error-50 text-error-700 dark:border-error dark:bg-error-900/20 dark:text-error-100 text-sm">
          {apiError}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Counter Value */}
        <Input
          label={t('gas.counterValueLabel')}
          error={errors.counterValue}
          helperText={t('gas.enterMeterValue')}
          placeholder={t('gas.enterMeterValue')}
          id="gas-counter-value"
          type="text"
          inputMode="decimal"
          value={formData.counterValue}
          onChange={(e) => {
            setFormData((prev) => ({ ...prev, counterValue: e.target.value }));
            setErrors((prev) => ({ ...prev, counterValue: '' }));
          }}
          disabled={isLoading}
        />

        {/* Use Current DateTime Toggle */}
        <div className="mb-4 flex items-center gap-2">
          <input
            type="checkbox"
            id="useCurrentDateTime"
            checked={formData.useCurrentDateTime}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, useCurrentDateTime: e.target.checked }))
            }
            className="rounded border-border text-brand focus:ring-brand dark:border-dark-border dark:text-dark-text-primary"
            disabled={isLoading}
          />
          <label htmlFor="useCurrentDateTime" className="text-sm text-text-secondary dark:text-dark-text-secondary cursor-pointer select-none">
            {t('gas.useCurrentDateTime')}
          </label>
        </div>

        {/* Meter Image */}
        <div className="mb-4">
          <label htmlFor="gas-meter-image" className="block text-sm font-semibold text-text-secondary dark:text-dark-text-secondary">
            {t('gas.meterImage')}
          </label>
          <input
            id="gas-meter-image"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setMeterImage(e.target.files?.[0] || null)}
            className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand bg-surface text-text-primary dark:border-dark-border dark:bg-dark-surface-elevated dark:text-dark-text-primary"
            disabled={isLoading}
          />
          {meterImage && (
            <p className="mt-1 text-xs text-text-tertiary dark:text-dark-text-tertiary">
              {meterImage.name}
            </p>
          )}
        </div>

        {/* Date & Time (conditional) */}
        {!formData.useCurrentDateTime && (
          <>
            <div className="mb-4">
              <Input
                id="gas-reading-date"
                label={`${t('gas.date')} *`}
                error={errors.readingDate}
                type="date"
                value={formData.readingDate}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, readingDate: e.target.value }));
                  setErrors((prev) => ({ ...prev, readingDate: '' }));
                }}
                max={dayjs().format('YYYY-MM-DD')}
                disabled={isLoading}
              />
            </div>

            <div className="mb-6">
              <label htmlFor="gas-reading-time" className="block text-sm font-semibold text-text-secondary dark:text-dark-text-secondary">
                {t('gas.time')} *
              </label>
              <input
                id="gas-reading-time"
                type="time"
                value={formData.readingTime}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, readingTime: e.target.value }))
                }
                className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand bg-surface text-text-primary placeholder:text-text-tertiary dark:border-dark-border dark:bg-dark-surface-elevated dark:text-dark-text-primary"
                disabled={isLoading}
              />
            </div>
          </>
        )}

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="secondary"
            size="md"
            type="button"
            onClick={() => {
              resetForm();
              onClose();
            }}
            disabled={isLoading}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            size="md"
            type="submit"
            isLoading={isLoading}
            disabled={isLoading}
          >
            {isLoading ? t('common.loading') : t('gas.addReading')}
          </Button>
        </div>
      </form>
    </div>
    </>
  );
};

GasForm.displayName = 'GasForm';
