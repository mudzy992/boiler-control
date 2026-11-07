import React from 'react';
import { useTranslation } from 'react-i18next';
import { Drawer, LogoMark } from '@/ui';
import { ShellNavList } from './shell-nav-list';

interface ShellNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShellNavDrawer: React.FC<ShellNavDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();

  return (
    <Drawer open={isOpen} onClose={onClose} title={t('shell.menu')}>
      <div className="mb-3 flex items-center gap-2 px-1">
        <LogoMark size="sm" />
        <span className="text-sm font-semibold text-ink">{t('shell.brand')}</span>
      </div>
      <ShellNavList onNavigate={onClose} />
    </Drawer>
  );
};
