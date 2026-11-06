import React, { useState, useRef, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';

/**
 * FE2-13: elementi između kojih Tab smije kružiti dok je dijalog otvoren.
 * Bez focus trapa Tab odvodi fokus na stranu iza overlaya, pa korisnik koji
 * koristi samo tastaturu "izgubi" dijalog.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
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
   * FE2-13: Escape zatvara, a Tab kruži unutar dijaloga. Prije toga dijalog nije
   * imao nijednu tipkovnu interakciju — nije se mogao zatvoriti bez miša.
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={DIALOG_TITLE_ID}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-lg dark:border-slate-700 dark:bg-slate-800"
      >
        <h2
          id={DIALOG_TITLE_ID}
          className="text-lg font-semibold text-gray-900 dark:text-white"
        >
          {t('gas.addReading')}
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
          {t('gas.recordSubtitle')}
        </p>

        {apiError && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Counter Value */}
          <div className="mb-4">
            {/* FE2-13 (FE-013): label bez htmlFor nije programski povezan s inputom,
                pa ga screen reader ne čita uz polje (axe: critical "label"). */}
            <label
              htmlFor="gas-counter-value"
              className="block text-sm font-medium text-gray-700 dark:text-slate-300"
            >
              {t('gas.counterValueLabel')} *
            </label>
            <input
              id="gas-counter-value"
              type="number"
              step="0.001"
              value={formData.counterValue}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, counterValue: e.target.value }));
                setErrors((prev) => ({ ...prev, counterValue: '' }));
              }}
              className={`mt-1 w-full rounded-lg border px-3 py-2 dark:bg-slate-700 dark:text-white ${
                errors.counterValue
                  ? 'border-red-500 dark:border-red-500'
                  : 'border-gray-300 dark:border-slate-600'
              }`}
              placeholder={t('gas.enterMeterValue')}
              disabled={isLoading}
            />
            {errors.counterValue && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.counterValue}
              </p>
            )}
          </div>

          {/* Use Current DateTime Toggle */}
          <div className="mb-4 flex items-center space-x-2">
            <input
              type="checkbox"
              id="useCurrentDateTime"
              checked={formData.useCurrentDateTime}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, useCurrentDateTime: e.target.checked }))
              }
              className="rounded border-gray-300 dark:border-slate-600"
              disabled={isLoading}
            />
            <label htmlFor="useCurrentDateTime" className="text-sm text-gray-700 dark:text-slate-300">
              {t('gas.useCurrentDateTime')}
            </label>
          </div>

          <div className="mb-4">
            {/* FE2-13 (FE-013): isto kao counter — file input je bio bez labele,
                što je axe prijavio kao critical "label" nalaz. */}
            <label
              htmlFor="gas-meter-image"
              className="block text-sm font-medium text-gray-700 dark:text-slate-300"
            >
              {t('gas.meterImage')}
            </label>
            <input
              id="gas-meter-image"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => setMeterImage(e.target.files?.[0] || null)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              disabled={isLoading}
            />
            {meterImage && (
              <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{meterImage.name}</p>
            )}
          </div>

          {/* Date & Time (conditional) */}
          {!formData.useCurrentDateTime && (
            <>
              <div className="mb-4">
                {/* FE2-13 (FE-013): label bez htmlFor nije povezan s inputom. */}
                <label
                  htmlFor="gas-reading-date"
                  className="block text-sm font-medium text-gray-700 dark:text-slate-300"
                >
                  {t('gas.date')} *
                </label>
                <input
                  id="gas-reading-date"
                  type="date"
                  value={formData.readingDate}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, readingDate: e.target.value }));
                    setErrors((prev) => ({ ...prev, readingDate: '' }));
                  }}
                  max={dayjs().format('YYYY-MM-DD')}
                  className={`mt-1 w-full rounded-lg border px-3 py-2 dark:bg-slate-700 dark:text-white ${
                    errors.readingDate
                      ? 'border-red-500 dark:border-red-500'
                      : 'border-gray-300 dark:border-slate-600'
                  }`}
                  disabled={isLoading}
                />
                {/*
                  FE2-11: `validateForm()` je oduvijek postavljao
                  `errors.readingDate` (obavezno + budući datum), ali ga nijedan
                  JSX nije prikazivao — korisnik bi kliknuo "Add Reading" i ne
                  bi dobio nikakvu poruku, forma se tiho nije slala.
                */}
                {errors.readingDate && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {errors.readingDate}
                  </p>
                )}
              </div>

              <div className="mb-4">
                {/* FE2-13 (FE-013): label bez htmlFor nije povezan s inputom. */}
                <label
                  htmlFor="gas-reading-time"
                  className="block text-sm font-medium text-gray-700 dark:text-slate-300"
                >
                  {t('gas.time')} *
                </label>
                <input
                  id="gas-reading-time"
                  type="time"
                  value={formData.readingTime}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, readingTime: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  disabled={isLoading}
                />
              </div>
            </>
          )}

          {/* Buttons */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                resetForm();
                onClose();
              }}
              disabled={isLoading}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-700 dark:hover:bg-blue-800"
            >
              {isLoading ? t('common.loading') : t('gas.addReading')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
