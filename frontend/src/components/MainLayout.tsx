import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogOut, Menu, Moon, Sun } from 'lucide-react';
import { useAuth } from '../features/auth/hooks/useAuth';
import { useThemeMode } from '../context/ThemeContext';
import { BrandMark } from '@/shared/components/brand-mark';
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
      <header className="sticky top-0 z-sticky flex h-12 items-center justify-between border-b border-border bg-background px-4 sm:h-14 sm:px-5">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setIsNavOpen(true)}
            aria-label={t('shell.openMenu')}
            aria-expanded={isNavOpen}
            aria-controls="shell-mobile-nav"
          >
            <Menu className="h-4 w-4" aria-hidden />
          </Button>
          <div className="flex items-center gap-2">
            <BrandMark size="sm" />
            <span className="text-sm font-semibold tracking-tight text-foreground">
              {t('shell.brand')}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <div className="mr-2 hidden items-center gap-2 sm:flex">
            <span className="text-sm text-muted-foreground">{displayName}</span>
            {user?.role ? (
              <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
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
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            aria-label={t('common.logout')}
          >
            <LogOut className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </header>

      <aside className="fixed bottom-0 left-0 top-12 z-0 hidden w-60 flex-col border-r border-border bg-background p-3 sm:top-14 lg:flex">
        <div className="mb-3 flex items-center gap-2 px-2.5 py-1">
          <BrandMark size="sm" />
          <span className="text-xs font-semibold tracking-tight text-foreground">
            {t('shell.brand')}
          </span>
        </div>
        <ShellNavList />
      </aside>

      <div id="shell-mobile-nav">
        <ShellNavDrawer isOpen={isNavOpen} onClose={handleCloseNav} />
      </div>

      <main
        id="main-content"
        className="mx-auto max-w-7xl px-4 pb-10 pt-6 sm:px-6 lg:pl-60 lg:pr-8"
        tabIndex={-1}
      >
        {children}
      </main>

      <footer className="border-t border-border px-4 py-4 text-xs text-muted-foreground lg:pl-60">
        {t('shell.footer')}
      </footer>
    </div>
  );
};

MainLayout.displayName = 'MainLayout';
