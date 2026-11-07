import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  flowTempRangeMessage,
  MAX_CURRENT_FLOW_TEMP,
  MIN_CURRENT_FLOW_TEMP,
  validateFlowTempInput,
} from '@/constants/boilerLimits';
import { Button, Field, Modal, NumberInput, fieldAria } from '@/ui';

export interface TempDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValue?: number | null;
  onSubmit: (value: number) => void | Promise<void>;
  isSubmitting?: boolean;
}

export const TempDialog = ({
  open,
  onOpenChange,
  initialValue = null,
  onSubmit,
  isSubmitting = false,
}: TempDialogProps): React.JSX.Element => {
  const { t } = useTranslation();
  const [value, setValue] = React.useState<number | undefined>(
    typeof initialValue === 'number' ? initialValue : undefined,
  );
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setValue(typeof initialValue === 'number' ? initialValue : undefined);
      setError(null);
    }
  }, [open, initialValue]);

  const handleSubmit = async (): Promise<void> => {
    const result = validateFlowTempInput(value ?? null);
    if (!result.ok) {
      setError(
        result.reason === 'required'
          ? t('tempDialog.required')
          : flowTempRangeMessage(),
      );
      return;
    }
    setError(null);
    await onSubmit(result.value);
  };

  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      title={t('tempDialog.title')}
      description={t('tempDialog.range', {
        min: MIN_CURRENT_FLOW_TEMP,
        max: MAX_CURRENT_FLOW_TEMP,
      })}
    >
      <Field id="temp-dialog-value" label={t('tempDialog.label')} error={error ?? undefined}>
        <NumberInput
          id="temp-dialog-value"
          value={value ?? ''}
          min={MIN_CURRENT_FLOW_TEMP}
          max={MAX_CURRENT_FLOW_TEMP}
          step={0.1}
          invalid={Boolean(error)}
          onValueChange={(next) => {
            setValue(next);
            setError(null);
          }}
          disabled={isSubmitting}
          {...fieldAria('temp-dialog-value', { error: error ?? undefined })}
        />
      </Field>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => onOpenChange(false)}
          disabled={isSubmitting}
        >
          {t('common.cancel')}
        </Button>
        <Button
          type="button"
          onClick={() => {
            void handleSubmit();
          }}
          isLoading={isSubmitting}
          disabled={isSubmitting}
        >
          {t('tempDialog.save')}
        </Button>
      </div>
    </Modal>
  );
};
