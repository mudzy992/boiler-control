import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  DEFAULT_FLOW_RANGE,
  flowTempRangeMessage,
  validateFlowTempInput,
  type FlowRange,
} from "@/constants/boilerLimits";
import { Button, Field, Modal, NumberInput, fieldAria } from "@/ui";

export interface TempDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValue?: number | null;
  onSubmit: (value: number) => void | Promise<void>;
  isSubmitting?: boolean;
  /**
   * `F13`: raspon dolazi iz `GET /api/boiler/flow-range` (po domu). Dok ne
   * stigne, važi rezervni 48–55 — isti brojevi kao prije, da forma nikad ne
   * pokaže granicu koju server ne primjenjuje.
   */
  range?: FlowRange;
}

export const TempDialog = ({
  open,
  onOpenChange,
  initialValue = null,
  onSubmit,
  isSubmitting = false,
  range = DEFAULT_FLOW_RANGE,
}: TempDialogProps): React.JSX.Element => {
  const { t } = useTranslation();
  const [value, setValue] = React.useState<number | undefined>(
    typeof initialValue === "number" ? initialValue : undefined,
  );
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setValue(typeof initialValue === "number" ? initialValue : undefined);
      setError(null);
    }
  }, [open, initialValue]);

  const handleSubmit = async (): Promise<void> => {
    const result = validateFlowTempInput(value ?? null, range);
    if (!result.ok) {
      setError(
        result.reason === "required"
          ? t("tempDialog.required")
          : flowTempRangeMessage(range),
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
      title={t("tempDialog.title")}
      description={t("tempDialog.range", {
        min: range.min,
        max: range.max,
      })}
    >
      <Field
        id="temp-dialog-value"
        label={t("tempDialog.label")}
        error={error ?? undefined}
      >
        <NumberInput
          id="temp-dialog-value"
          value={value ?? ""}
          min={range.min}
          max={range.max}
          step={0.1}
          invalid={Boolean(error)}
          onValueChange={(next) => {
            setValue(next);
            setError(null);
          }}
          disabled={isSubmitting}
          {...fieldAria("temp-dialog-value", { error: error ?? undefined })}
        />
      </Field>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => onOpenChange(false)}
          disabled={isSubmitting}
        >
          {t("common.cancel")}
        </Button>
        <Button
          type="button"
          onClick={() => {
            void handleSubmit();
          }}
          isLoading={isSubmitting}
          disabled={isSubmitting}
        >
          {t("tempDialog.save")}
        </Button>
      </div>
    </Modal>
  );
};
