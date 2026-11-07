import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Modal } from '@/ui';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => void | Promise<void>;
  isConfirming?: boolean;
}

export const ConfirmDialog = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = 'default',
  onConfirm,
  isConfirming = false,
}: ConfirmDialogProps): React.JSX.Element => {
  const { t } = useTranslation();

  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      title={title}
      description={description}
    >
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => onOpenChange(false)}
          disabled={isConfirming}
        >
          {cancelLabel ?? t('common.cancel')}
        </Button>
        <Button
          type="button"
          variant={variant === 'destructive' ? 'danger' : 'primary'}
          onClick={() => {
            void onConfirm();
          }}
          isLoading={isConfirming}
          disabled={isConfirming}
        >
          {confirmLabel ?? t('common.confirm')}
        </Button>
      </div>
    </Modal>
  );
};
