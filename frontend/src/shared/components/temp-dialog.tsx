import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  flowTempRangeMessage,
  MAX_CURRENT_FLOW_TEMP,
  MIN_CURRENT_FLOW_TEMP,
  validateFlowTempInput,
} from '@/constants/boilerLimits';
import { InputNumber } from '@/components/InputNumber';
import { Button } from '@/shared/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';

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
  const [value, setValue] = React.useState<number | null>(initialValue);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setValue(typeof initialValue === 'number' ? initialValue : null);
      setError(null);
    }
  }, [open, initialValue]);

  const handleSubmit = async (): Promise<void> => {
    const result = validateFlowTempInput(value);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('tempDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('tempDialog.range', {
              min: MIN_CURRENT_FLOW_TEMP,
              max: MAX_CURRENT_FLOW_TEMP,
            })}
          </DialogDescription>
        </DialogHeader>
        <InputNumber
          id="temp-dialog-value"
          label={t('tempDialog.label')}
          value={value}
          min={MIN_CURRENT_FLOW_TEMP}
          max={MAX_CURRENT_FLOW_TEMP}
          step={0.1}
          precision={1}
          addonAfter="°C"
          error={error ?? undefined}
          onChange={(next) => {
            setValue(next);
            setError(null);
          }}
          disabled={isSubmitting}
        />
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
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
            loadingLabel={t('tempDialog.saving')}
            disabled={isSubmitting}
          >
            {t('tempDialog.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
