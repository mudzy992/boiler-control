import React, { useState } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { Input } from '../../../components/Input';
import { Button, Modal } from '@/ui';

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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('gas.addReading')}
      description={t('gas.recordSubtitle')}
    >
      {apiError ? (
        <div className="mb-4 rounded-panel border border-fault bg-fault/10 p-3 text-sm text-fault">
          {apiError}
        </div>
      ) : null}

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
            className="rounded border-border text-brand focus:ring-brand"
            disabled={isLoading}
          />
          <label htmlFor="useCurrentDateTime" className="text-sm text-text-secondary cursor-pointer select-none">
            {t('gas.useCurrentDateTime')}
          </label>
        </div>

        {/* Meter Image */}
        <div className="mb-4">
          <label htmlFor="gas-meter-image" className="block text-sm font-semibold text-text-secondary">
            {t('gas.meterImage')}
          </label>
          <input
            id="gas-meter-image"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setMeterImage(e.target.files?.[0] || null)}
            className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand bg-surface text-text-primary"
            disabled={isLoading}
          />
          {meterImage && (
            <p className="mt-1 text-xs text-text-tertiary">
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
              <label htmlFor="gas-reading-time" className="block text-sm font-semibold text-text-secondary">
                {t('gas.time')} *
              </label>
              <input
                id="gas-reading-time"
                type="time"
                value={formData.readingTime}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, readingTime: e.target.value }))
                }
                className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand bg-surface text-text-primary placeholder:text-text-tertiary"
                disabled={isLoading}
              />
            </div>
          </>
        )}

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="secondary"
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
            type="submit"
            isLoading={isLoading}
            disabled={isLoading}
          >
            {isLoading ? t('common.loading') : t('gas.addReading')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

GasForm.displayName = 'GasForm';
