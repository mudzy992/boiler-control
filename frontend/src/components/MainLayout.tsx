import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogOut, Menu, Moon, Sun } from 'lucide-react';
import { useAuth } from '../features/auth/hooks/useAuth';
import { useThemeMode } from '../context/ThemeContext';
import { Badge, IconButton, LogoMark } from '@/ui';
import { SkipLink } from '../shared/components/SkipLink';
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
    <div className="min-h-screen bg-canvas text-ink">
      <SkipLink href="#main-content" />
      <header className="sticky top-0 z-sticky flex h-12 items-center justify-between border-b border-line bg-canvas px-4 sm:h-14 sm:px-6">
        <div className="flex items-center gap-2">
          <IconButton
            className="lg:hidden"
            onClick={() => setIsNavOpen(true)}
            aria-label={t('shell.openMenu')}
            aria-expanded={isNavOpen}
            aria-controls="shell-mobile-nav"
          >
            <Menu className="h-4 w-4" aria-hidden />
          </IconButton>
          <div className="flex items-center gap-2">
            <LogoMark size="sm" />
            <span className="text-sm font-semibold tracking-tight text-ink">
              {t('shell.brand')}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-1.5">
          <div className="mr-1 hidden items-center gap-2 sm:mr-3 sm:flex">
            <span className="text-sm text-ink-muted">{displayName}</span>
            {user?.role ? <Badge tone="muted">{user.role}</Badge> : null}
          </div>
          <IconButton
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
          </IconButton>
          <IconButton onClick={handleLogout} aria-label={t('common.logout')}>
            <LogOut className="h-4 w-4" aria-hidden />
          </IconButton>
        </div>
      </header>

      <aside className="fixed bottom-0 left-0 top-12 z-0 hidden w-60 flex-col border-r border-line bg-canvas p-3 sm:top-14 lg:flex">
        <ShellNavList />
      </aside>

      <div id="shell-mobile-nav">
        <ShellNavDrawer isOpen={isNavOpen} onClose={handleCloseNav} />
      </div>

      <main
        id="main-content"
        className="px-4 pb-10 pt-6 sm:px-6 lg:ml-60 lg:px-8"
        tabIndex={-1}
      >
        {children}
      </main>

      <footer className="border-t border-line px-4 py-4 text-xs text-ink-muted sm:px-6 lg:ml-60 lg:px-8">
        {t('shell.footer')}
      </footer>
    </div>
  );
};

MainLayout.displayName = 'MainLayout';
