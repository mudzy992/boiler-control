import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SHELL_NAV_ITEMS } from './shell-nav-items';
import { cn } from '@/shared/lib/utils';

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
            cn(
              'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-base',
              isActive
                ? 'bg-brand/10 text-brand shadow-glow-soft'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive ? (
                <span
                  className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-brand shadow-glow"
                  aria-hidden
                />
              ) : null}
              {t(item.labelKey)}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
};

ShellNavList.displayName = 'ShellNavList';
