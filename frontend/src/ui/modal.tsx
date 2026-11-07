import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
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
  /** Hide the built-in header when the body already contains a title. */
  hideChrome?: boolean;
}

export const Modal = ({
  open,
  onClose,
  title,
  description,
  children,
  className,
  hideChrome = false,
}: ModalProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
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

  if (!open || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 z-0 bg-canvas/75"
        aria-label="Dismiss overlay"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={hideChrome ? undefined : titleId}
        aria-label={hideChrome ? title : undefined}
        aria-describedby={!hideChrome && description ? descId : undefined}
        className={cn(
          'relative z-10 w-full max-w-lg rounded-panel border border-panel-border bg-panel p-4 text-ink',
          className,
        )}
      >
        {!hideChrome ? (
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-semibold text-ink">
                {title}
              </h2>
              {description ? (
                <p id={descId} className="mt-1 text-sm text-ink-muted">
                  {description}
                </p>
              ) : null}
            </div>
            <IconButton variant="ghost" aria-label="Close" onClick={onClose}>
              <X className="h-4 w-4" aria-hidden />
            </IconButton>
          </div>
        ) : null}
        {children}
      </div>
    </div>,
    document.body,
  );
};
