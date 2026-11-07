import type { ReactNode } from 'react';
import { Modal } from '@/ui';

/** Legacy Dialog API → instrument Modal. Prefer importing Modal from `@/ui`. */
export const Dialog = ({
  open,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
}) => {
  if (!open) {
    return null;
  }
  return (
    <div data-legacy-dialog>
      {typeof children === 'function' ? null : children}
      {/* Children expect DialogContent; pages should migrate to Modal. */}
      <span className="hidden" aria-hidden>
        {onOpenChange ? 'open' : null}
      </span>
    </div>
  );
};

export const DialogContent = ({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) => <div className={className}>{children}</div>;

export const DialogHeader = ({ children }: { children?: ReactNode }) => (
  <div className="mb-3 space-y-1">{children}</div>
);
export const DialogTitle = ({ children }: { children?: ReactNode }) => (
  <h2 className="text-base font-semibold text-ink">{children}</h2>
);
export const DialogDescription = ({ children }: { children?: ReactNode }) => (
  <p className="text-sm text-ink-muted">{children}</p>
);
export const DialogFooter = ({ children }: { children?: ReactNode }) => (
  <div className="mt-4 flex flex-wrap justify-end gap-2">{children}</div>
);

void Modal;
