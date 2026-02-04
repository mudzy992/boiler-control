import React from 'react';
import { Layout, Menu, Switch, Tooltip } from 'antd';
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
    <Layout className="min-h-screen">
      <Sider trigger={null} collapsible className="border-r border-gray-200 dark:border-slate-800">
        <div className="px-6 py-5 text-lg font-semibold text-white dark:text-slate-100">
          🔥 Boiler Control
        </div>
        <Menu theme={mode === 'dark' ? 'dark' : 'light'} mode="inline" items={menuItems} />
      </Sider>
      <Layout>
        <Header className="flex items-center justify-between px-6 shadow-sm">
          <div className="text-sm text-gray-600 dark:text-slate-300">
            {user?.name ? `Welcome, ${user.name}` : 'Welcome'}
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
        <Content className="m-6 rounded-2xl bg-white/90 p-6 shadow-sm dark:bg-slate-900/70">
          {children}
        </Content>
        <Footer className="text-center text-xs text-gray-500 dark:text-slate-500">
          © 2026 Boiler Control System. All rights reserved.
        </Footer>
      </Layout>
    </Layout>
  );
};
