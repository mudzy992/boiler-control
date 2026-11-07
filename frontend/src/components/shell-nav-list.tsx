import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SHELL_NAV_ITEMS } from './shell-nav-items';

interface ShellNavListProps {
  onNavigate?: () => void;
}

export const ShellNavList: React.FC<ShellNavListProps> = ({ onNavigate }) => {
  const { t } = useTranslation();

  return (
    <nav className="space-y-1" aria-label={t('shell.primaryNav')}>
      {SHELL_NAV_ITEMS.map((item) => (
        <NavLink
          key={item.key}
          to={item.href}
          onClick={onNavigate}
          className={({ isActive }) =>
            [
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-base',
              isActive
                ? 'bg-brand/10 text-brand'
                : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary dark:hover:bg-dark-surface-muted dark:hover:text-dark-text-primary',
            ].join(' ')
          }
        >
          {t(item.labelKey)}
        </NavLink>
      ))}
    </nav>
  );
};

ShellNavList.displayName = 'ShellNavList';
