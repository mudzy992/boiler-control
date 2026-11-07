import type { ReactNode } from 'react';
import { Modal } from '@/ui';

/**
 * Legacy Sheet API adapted to instrument Modal (right-side sheets become centered modals).
 * New code should import Modal/Drawer from `@/ui`.
 */
export const Sheet = ({
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
    <Modal open={open} onClose={() => onOpenChange?.(false)} title=" ">
      {children}
    </Modal>
  );
};

export const SheetContent = ({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
  side?: string;
}) => <div className={className}>{children}</div>;

export const SheetHeader = ({ children }: { children?: ReactNode }) => (
  <div className="mb-3">{children}</div>
);
export const SheetTitle = ({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) => <h2 className={className ?? 'text-sm font-semibold text-ink'}>{children}</h2>;
export const SheetDescription = ({ children }: { children?: ReactNode }) => (
  <p className="text-sm text-ink-muted">{children}</p>
);
