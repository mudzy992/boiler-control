import React, { useState } from 'react';
import {
  HomeOutlined,
  FireOutlined,
  FileTextOutlined,
  UserOutlined,
  SettingOutlined,
  LogoutOutlined,
  MoonOutlined,
  SunOutlined,
  BarChartOutlined,
  DatabaseOutlined,
  MenuOutlined,
  BellOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useThemeMode } from '../context/ThemeContext';
import { Button } from './Button';

interface MainLayoutProps {
  children: React.ReactNode;
}

interface MenuItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  onClick?: () => void;
}

const MENU_ITEMS: MenuItem[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    href: '/dashboard',
    icon: <HomeOutlined />,
  },
  {
    key: 'boiler',
    label: 'Boiler Control',
    href: '/boiler',
    icon: <FireOutlined />,
  },
  {
    key: 'heating',
    label: 'Heating Events',
    href: '/heating',
    icon: <FireOutlined />,
  },
  {
    key: 'gas-readings',
    label: 'Gas Readings',
    href: '/gas/readings',
    icon: <DatabaseOutlined />,
  },
  {
    key: 'gas-analytics',
    label: 'Gas Analytics',
    href: '/gas/analytics',
    icon: <BarChartOutlined />,
  },
  {
    key: 'reports',
    label: 'Reports',
    href: '/reports',
    icon: <FileTextOutlined />,
  },
  {
    key: 'home-profile',
    label: 'Home Profile',
    href: '/home-profile',
    icon: <SettingOutlined />,
  },
  {
    key: 'notifications',
    label: 'Notifications',
    href: '/notifications',
    icon: <BellOutlined />,
  },
  {
    key: 'profile',
    label: 'Profile',
    href: '/profile',
    icon: <UserOutlined />,
  },
];

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const [collapsed, setCollapsed] = useState(false);

  const handleMenuClick = (href: string) => {
    navigate(href);
    setCollapsed(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-surface-muted text-text-primary transition-colors duration-300">
      <a href="#content" className="skip-link">
        Skip to content
      </a>

      {/* Mobile top bar */}
      <header className="fixed top-0 left-0 right-0 z-sticky border-b border-border bg-surface/95 backdrop-blur-sm px-4 py-3 dark:border-dark-border dark:bg-dark-surface/95">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCollapsed((prev) => !prev)}
              aria-label="Toggle navigation"
              icon={<MenuOutlined />}
            />
            <span className="font-semibold text-text-primary tracking-tight">
              🔥 Boiler Control
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:block text-sm text-text-secondary dark:text-dark-text-secondary">
              Welcome, {user?.name || 'User'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleMode}
              aria-label={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}
              icon={mode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              aria-label="Logout"
              icon={<LogoutOutlined />}
            />
          </div>
        </div>
      </header>

      {/* Sidebar — desktop only */}
      <aside
        className={`hidden lg:flex flex-col w-64 border-r border-border bg-surface dark:border-dark-border dark:bg-dark-surface transition-all duration-300`}
      >
        <div className="p-5">
          <div className="flex items-center gap-2 mb-8">
            <span className="text-xl">🔥</span>
            <span className="font-semibold text-text-primary tracking-tight">
              Boiler Control
            </span>
          </div>
          <nav className="space-y-1">
            {MENU_ITEMS.map((item) => (
              <Button
                key={item.key}
                variant="ghost"
                size="md"
                fullWidth
                className="flex items-center gap-3 text-left justify-start text-text-secondary hover:bg-surface-muted hover:text-text-primary dark:hover:bg-dark-surface-muted dark:hover:text-dark-text-primary border-transparent hover:border-transparent"
                onClick={() => handleMenuClick(item.href)}
              >
                {item.icon}
                <span className="flex-1">{item.label}</span>
              </Button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {collapsed && (
        <div
          className="fixed inset-0 z-fixed bg-black/50 lg:hidden"
          onClick={() => setCollapsed(false)}
          aria-hidden="true"
        />
      )}
      {collapsed && (
        <div
          className={`fixed inset-y-0 left-0 z-popover w-64 bg-surface border-r border-border shadow-lg dark:border-dark-border dark:bg-dark-surface transform transition-transform duration-300 lg:hidden`}
        >
          <div className="p-4 border-b border-border dark:border-dark-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCollapsed(false)}
              className="w-full justify-between"
              aria-label="Close navigation"
            >
              <span>Menu</span>
              <MenuOutlined />
            </Button>
          </div>
          <nav className="p-4 space-y-1">
            {MENU_ITEMS.map((item) => (
              <Button
                key={item.key}
                variant="ghost"
                size="md"
                fullWidth
                className="flex items-center gap-3 text-left justify-start text-text-secondary hover:bg-surface-muted hover:text-text-primary dark:hover:bg-dark-surface-muted dark:hover:text-dark-text-primary"
                onClick={() => handleMenuClick(item.href)}
              >
                {item.icon}
                <span>{item.label}</span>
              </Button>
            ))}
          </nav>
        </div>
      )}

      <main id="content" className="lg:pl-64 pt-16 lg:pt-0 pb-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="rounded-2xl border border-border bg-surface shadow-sm p-6 dark:border-dark-border dark:bg-dark-surface-elevated">
          {children}
        </div>
      </main>

      <footer className="border-t border-border bg-surface/80 px-4 py-4 text-xs text-text-tertiary dark:border-dark-border dark:bg-dark-surface/80 dark:text-dark-text-tertiary">
        © 2026 Boiler Control System. All rights reserved.
      </footer>
    </div>
  );
};

MainLayout.displayName = 'MainLayout';
