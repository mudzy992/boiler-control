import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Moon, Sun, Menu } from 'lucide-react';
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
    <div className="min-h-screen bg-background bg-cockpit-radial text-foreground">
      <SkipLink href="#main-content" />
      <header className="sticky top-0 z-sticky flex h-14 items-center justify-between border-b border-border/80 bg-card/80 px-4 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setIsNavOpen(true)}
            aria-label={t('shell.openMenu')}
            aria-expanded={isNavOpen}
            aria-controls="shell-mobile-nav"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </Button>
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full bg-brand shadow-glow"
              aria-hidden
            />
            <span className="text-sm font-semibold tracking-tight text-foreground">
              {t('shell.brand')}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm text-foreground">{displayName}</p>
            {user?.role ? (
              <span className="inline-flex rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {user.role}
              </span>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMode}
            aria-label={
              mode === 'dark'
                ? t('shell.toggleThemeLight')
                : t('shell.toggleThemeDark')
            }
          >
            {mode === 'dark' ? (
              <Sun className="h-4 w-4" aria-hidden />
            ) : (
              <Moon className="h-4 w-4" aria-hidden />
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            aria-label={t('common.logout')}
          >
            {t('common.logout')}
          </Button>
        </div>
      </header>

      <aside className="fixed bottom-0 left-0 top-14 z-0 hidden w-56 flex-col border-r border-border/80 bg-card/60 p-4 backdrop-blur-sm lg:flex">
        <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {t('shell.primaryNav')}
        </p>
        <ShellNavList />
      </aside>

      <div id="shell-mobile-nav">
        <ShellNavDrawer isOpen={isNavOpen} onClose={handleCloseNav} />
      </div>

      <main
        id="main-content"
        className="mx-auto max-w-7xl px-4 pb-10 pt-6 sm:px-6 lg:pl-64 lg:pr-8"
        tabIndex={-1}
      >
        {children}
      </main>

      <footer className="border-t border-border/60 px-4 py-4 text-xs text-muted-foreground lg:pl-64">
        {t('shell.footer')}
      </footer>
    </div>
  );
};

MainLayout.displayName = 'MainLayout';
