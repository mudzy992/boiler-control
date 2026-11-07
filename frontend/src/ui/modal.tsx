import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from './cn';
import { IconButton } from './icon-button';
import { useEscapeKey } from './hooks/use-escape-key';
import { useFocusTrap } from './hooks/use-focus-trap';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export const Modal = ({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: ModalProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);
  useEscapeKey(open, onClose);

  useEffect(() => {
    if (!open) {
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 z-modal-backdrop bg-canvas/70"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ui-modal-title"
        aria-describedby={description ? 'ui-modal-desc' : undefined}
        className={cn(
          'relative z-modal w-full max-w-lg rounded-panel border border-panel-border bg-panel p-4 text-ink shadow-none',
          className,
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="ui-modal-title" className="text-base font-semibold text-ink">
              {title}
            </h2>
            {description ? (
              <p id="ui-modal-desc" className="mt-1 text-sm text-ink-muted">
                {description}
              </p>
            ) : null}
          </div>
          <IconButton variant="ghost" aria-label="Close" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  );
};
