import mockReact from 'react';
import { Text as mockNativeText } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { NativeBaseProvider } from 'native-base';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../components/ui/nativewind';
import { AppThemeProvider } from '../../theme/AppTheme';
import { theme } from '../../theme/theme';
import { apiClient } from '../../services/api/client';
import { NotificationsScreen } from '../notifications/NotificationsScreen';
import { NotificationPreferencesScreen } from '../notifications/NotificationPreferencesScreen';

jest.mock('@expo/vector-icons', () => {
  const createIcon = () => (props: { name: string }) =>
    mockReact.createElement(mockNativeText, { accessibilityLabel: props.name }, props.name);
  return {
    Ionicons: createIcon(),
    MaterialCommunityIcons: createIcon(),
  };
});

jest.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../services/api/client', () => ({
  apiClient: {
    getNotifications: jest.fn(),
    markNotificationAsRead: jest.fn(),
    markAllNotificationsRead: jest.fn(),
    getNotificationPreferences: jest.fn(),
    updateNotificationPreference: jest.fn(),
  },
}));

type Mode = 'light' | 'dark';
type Implementation = 'legacy' | 'nativewind';

const notifications = [
  {
    id: 1,
    userId: 7,
    type: 'SYSTEM_ALERT',
    title: 'Test notification',
    message: 'Boiler needs attention',
    sentAt: '2026-06-15T12:00:00.000Z',
    createdAt: '2026-06-15T12:00:00.000Z',
    isRead: false,
  },
  {
    id: 2,
    userId: 7,
    type: 'HEATING_STARTED',
    title: 'Read notification',
    message: 'Heating has started',
    sentAt: '2026-06-14T12:00:00.000Z',
    createdAt: '2026-06-14T12:00:00.000Z',
    isRead: true,
  },
];

const preferences = [
  {
    id: 3,
    userId: 7,
    type: 'SYSTEM_ALERT',
    enabled: true,
    createdAt: '2026-06-15T12:00:00.000Z',
    updatedAt: '2026-06-15T12:00:00.000Z',
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(apiClient.getNotifications).mockResolvedValue(notifications);
  jest.mocked(apiClient.markNotificationAsRead).mockResolvedValue(undefined);
  jest.mocked(apiClient.markAllNotificationsRead).mockResolvedValue(undefined);
  jest.mocked(apiClient.getNotificationPreferences).mockResolvedValue(preferences);
  jest.mocked(apiClient.updateNotificationPreference).mockResolvedValue(undefined);
});

afterEach(() => {
  delete process.env.EXPO_PUBLIC_NATIVEWIND_SCREENS;
});

async function screenTree(
  children: React.ReactNode,
  mode: Mode,
  implementation: Implementation,
) {
  process.env.EXPO_PUBLIC_NATIVEWIND_SCREENS =
    implementation === 'nativewind' ? 'all' : 'none';
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  const testTheme = {
    ...theme,
    config: { ...theme.config, initialColorMode: mode },
  };
  const result = await render(
    <QueryClientProvider client={queryClient}>
      <NativeBaseProvider
        theme={testTheme}
        initialWindowMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, right: 0, bottom: 0, left: 0 },
        }}
      >
        <AppThemeProvider colorMode={mode}>
          <ToastProvider>{children}</ToastProvider>
        </AppThemeProvider>
      </NativeBaseProvider>
    </QueryClientProvider>,
  );
  return { result, queryClient };
}

const screens = [
  ['Notifications', <NotificationsScreen key="Notifications" />, 'Test notification'],
  [
    'NotificationPreferences',
    <NotificationPreferencesScreen key="NotificationPreferences" />,
    'notifications.typeDescriptions.SYSTEM_ALERT',
  ],
] as const;

describe.each(screens)('%s before/after NativeWind', (_name, screen, readyText) => {
  describe.each(['legacy', 'nativewind'] as const)('%s', (implementation) => {
    it.each(['light', 'dark'] as const)('matches the %s snapshot', async (mode) => {
      const { result, queryClient } = await screenTree(screen, mode, implementation);
      await result.findByText(readyText);
      expect(result.toJSON()).toMatchSnapshot();
      await result.unmount();
      queryClient.clear();
    });
  });
});

describe('Notifications NativeWind interactions', () => {
  it('marks an unread notification through the existing API contract', async () => {
    const { result, queryClient } = await screenTree(
      <NotificationsScreen />,
      'dark',
      'nativewind',
    );
    await fireEvent.press(await result.findByText('Test notification'));
    await waitFor(() => expect(apiClient.markNotificationAsRead).toHaveBeenCalledWith(1));
    await waitFor(() => expect(apiClient.getNotifications).toHaveBeenCalledTimes(2));
    await result.unmount();
    queryClient.clear();
  });

  it('updates a preference through the local switch', async () => {
    const { result, queryClient } = await screenTree(
      <NotificationPreferencesScreen />,
      'light',
      'nativewind',
    );
    const control = await result.findByRole('switch');
    await fireEvent(control, 'valueChange', false);
    await waitFor(() =>
      expect(apiClient.updateNotificationPreference).toHaveBeenCalledWith('SYSTEM_ALERT', false),
    );
    await waitFor(() => expect(apiClient.getNotificationPreferences).toHaveBeenCalledTimes(2));
    await result.unmount();
    queryClient.clear();
  });
});
