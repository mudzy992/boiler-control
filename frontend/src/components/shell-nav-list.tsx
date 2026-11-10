import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ADMIN_NAV_ITEMS, SHELL_NAV_ITEMS } from './shell-nav-items';
import { useAuth } from '../features/auth/hooks/useAuth';
import { cn } from '@/ui';

interface ShellNavListProps {
  onNavigate?: () => void;
}

export const ShellNavList: React.FC<ShellNavListProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  /*
   * `F15`: admin stavke se dodaju samo administratoru. Meni nije zaštita —
   * server odbija `POST /api/app-releases` bez `ADMIN` — ali korisniku ne
   * treba link na ekran na kojem bi dobio `403`.
   */
  const items = user?.role === 'ADMIN'
    ? [...SHELL_NAV_ITEMS, ...ADMIN_NAV_ITEMS]
    : SHELL_NAV_ITEMS;

  return (
    <nav className="space-y-0.5" aria-label={t('shell.primaryNav')}>
      {items.map((item) => (
        <NavLink
          key={item.key}
          to={item.href}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'relative flex items-center gap-2 rounded-control px-2.5 py-2 text-sm font-medium no-underline transition-colors duration-fast hover:no-underline',
              isActive
                ? 'bg-raised text-ink'
                : 'text-ink-muted hover:bg-raised/70 hover:text-ink',
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive ? (
                <span
                  className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 bg-signal"
                  aria-hidden
                />
              ) : null}
              <span className={cn(isActive && 'pl-1')}>{t(item.labelKey)}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
};

ShellNavList.displayName = 'ShellNavList';
