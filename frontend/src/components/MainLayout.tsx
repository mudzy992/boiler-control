import React, { useEffect, useState } from 'react';
import { Button, Grid, Layout, Menu, Switch, Tooltip } from 'antd';
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
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BellOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useThemeMode } from '../context/ThemeContext';

const { Header, Sider, Content, Footer } = Layout;

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.lg;
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (isMobile) {
      setCollapsed(true);
    }
  }, [isMobile]);

  const handleMenuClick = (path: string) => {
    navigate(path);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    {
      key: 'dashboard',
      icon: <HomeOutlined />,
      label: 'Dashboard',
      onClick: () => handleMenuClick('/dashboard'),
    },
    {
      key: 'boiler',
      icon: <FireOutlined />,
      label: 'Boiler Control',
      onClick: () => handleMenuClick('/boiler'),
    },
    {
      key: 'heating',
      icon: <FireOutlined />,
      label: 'Heating Events',
      onClick: () => handleMenuClick('/heating'),
    },
    {
      key: 'gas-readings',
      icon: <DatabaseOutlined />,
      label: 'Gas Readings',
      onClick: () => handleMenuClick('/gas/readings'),
    },
    {
      key: 'gas-analytics',
      icon: <BarChartOutlined />,
      label: 'Gas Analytics',
      onClick: () => handleMenuClick('/gas/analytics'),
    },
    {
      key: 'reports',
      icon: <FileTextOutlined />,
      label: 'Reports',
      onClick: () => handleMenuClick('/reports'),
    },
    {
      key: 'home-profile',
      icon: <SettingOutlined />,
      label: 'Home Profile',
      onClick: () => handleMenuClick('/home-profile'),
    },
    {
      key: 'notifications',
      icon: <BellOutlined />,
      label: 'Notifications',
      onClick: () => handleMenuClick('/notifications'),
    },
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Profile',
      onClick: () => handleMenuClick('/profile'),
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      onClick: handleLogout,
    },
  ];

  return (
    <Layout className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        breakpoint="lg"
        collapsedWidth={0}
        width={240}
        className="border-r border-gray-200 dark:border-slate-800"
      >
        <div className="px-6 py-5 text-lg font-semibold text-black dark:text-slate-100">
          🔥 Boiler Control
        </div>
        <Menu theme={mode === 'dark' ? 'dark' : 'light'} mode="inline" items={menuItems} />
      </Sider>
      <Layout>
        <Header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:px-6">
          <div className="flex items-center gap-3">
            <Button
              type="text"
              aria-label="Toggle navigation"
              onClick={() => setCollapsed((prev) => !prev)}
              className="lg:hidden"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            />
            <div className="text-sm text-gray-600 dark:text-slate-300">
              {user?.name ? `Welcome, ${user.name}` : 'Welcome'}
            </div>
          </div>
          <Tooltip title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}>
            <Switch
              checked={mode === 'dark'}
              onChange={toggleMode}
              checkedChildren={<MoonOutlined />}
              unCheckedChildren={<SunOutlined />}
            />
          </Tooltip>
        </Header>
        <Content className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl rounded-2xl bg-white/95 p-5 shadow-sm dark:bg-slate-900/80 sm:p-6">
            {children}
          </div>
        </Content>
        <Footer className="px-4 text-center text-xs text-gray-500 dark:text-slate-500 sm:px-6">
          © 2026 Boiler Control System. All rights reserved.
        </Footer>
      </Layout>
    </Layout>
  );
};
