import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from './cn';
import { IconButton } from './icon-button';
import { useEscapeKey } from './hooks/use-escape-key';
import { useFocusTrap } from './hooks/use-focus-trap';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}

export const Drawer = ({
  open,
  onClose,
  title,
  children,
  className,
}: DrawerProps) => {
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
    <>
      <button
        type="button"
        className="fixed inset-0 z-fixed bg-canvas/70 lg:hidden"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'fixed inset-y-0 left-0 z-popover flex w-60 flex-col border-r border-panel-border bg-canvas lg:hidden',
          className,
        )}
      >
        <div className="flex items-center justify-between border-b border-line px-3 py-3">
          <span className="text-sm font-semibold text-ink">{title}</span>
          <IconButton variant="ghost" aria-label="Close" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto p-3">{children}</div>
      </div>
    </>
  );
};
