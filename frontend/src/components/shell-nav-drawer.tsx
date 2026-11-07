import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/components/ui/Button';
import { ShellNavList } from './shell-nav-list';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

interface ShellNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShellNavDrawer: React.FC<ShellNavDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusables = () =>
      Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    const first = focusables()[0];
    first?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panel) {
        return;
      }
      const items = focusables();
      if (items.length === 0) {
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-fixed bg-black/50 lg:hidden"
        aria-label={t('shell.closeMenu')}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('shell.menu')}
        className="fixed inset-y-0 left-0 z-popover flex w-64 flex-col border-r border-border bg-surface shadow-lg dark:border-dark-border dark:bg-dark-surface lg:hidden"
      >
        <div className="flex items-center justify-between border-b border-border p-4 dark:border-dark-border">
          <span className="text-sm font-semibold text-text-primary">
            {t('shell.menu')}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label={t('shell.closeMenu')}
          >
            ✕
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <ShellNavList onNavigate={onClose} />
        </div>
      </div>
    </>
  );
};

ShellNavDrawer.displayName = 'ShellNavDrawer';
