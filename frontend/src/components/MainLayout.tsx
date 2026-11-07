import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../features/auth/hooks/useAuth';
import { useThemeMode } from '../context/ThemeContext';
import { SkipLink } from '../shared/components/SkipLink';
import { Button } from '@/shared/components/ui/Button';
import { ShellNavDrawer } from './shell-nav-drawer';
import { ShellNavList } from './shell-nav-list';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const [isNavOpen, setIsNavOpen] = useState(false);

  const handleCloseNav = useCallback(() => setIsNavOpen(false), []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const displayName = user?.name?.trim() || user?.email || t('shell.userFallback');

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SkipLink href="#main-content" />
      <header className="sticky top-0 z-sticky flex items-center justify-between border-b border-border bg-surface px-4 py-3 dark:border-dark-border dark:bg-dark-surface sm:px-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setIsNavOpen(true)}
            aria-label={t('shell.openMenu')}
            aria-expanded={isNavOpen}
            aria-controls="shell-mobile-nav"
          >
            ☰
          </Button>
          <span className="font-semibold tracking-tight text-text-primary">
            {t('shell.brand')}
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm text-text-secondary">
              {t('shell.welcome', { name: displayName })}
            </p>
            {user?.role ? (
              <p className="text-xs text-text-tertiary">
                {t('shell.role', { role: user.role })}
              </p>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleMode}
            aria-label={
              mode === 'dark'
                ? t('shell.toggleThemeLight')
                : t('shell.toggleThemeDark')
            }
          >
            {mode === 'dark' ? '☀' : '☾'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            aria-label={t('common.logout')}
          >
            {t('common.logout')}
          </Button>
        </div>
      </header>

      <aside className="fixed bottom-0 left-0 top-14 z-0 hidden w-64 flex-col border-r border-border bg-surface p-5 dark:border-dark-border dark:bg-dark-surface lg:flex">
        <ShellNavList />
      </aside>

      <div id="shell-mobile-nav">
        <ShellNavDrawer isOpen={isNavOpen} onClose={handleCloseNav} />
      </div>

      <main
        id="main-content"
        className="mx-auto max-w-7xl px-4 pb-8 pt-6 sm:px-6 lg:pl-72 lg:pr-8"
        tabIndex={-1}
      >
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm dark:border-dark-border dark:bg-dark-surface-elevated">
          {children}
        </div>
      </main>

      <footer className="border-t border-border px-4 py-4 text-xs text-text-tertiary dark:border-dark-border lg:pl-72">
        {t('shell.footer')}
      </footer>
    </div>
  );
};

MainLayout.displayName = 'MainLayout';
