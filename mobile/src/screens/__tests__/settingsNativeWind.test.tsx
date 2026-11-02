import mockReact from 'react';
import { Text as mockNativeText } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { NativeBaseProvider } from 'native-base';
import * as Notifications from 'expo-notifications';
import { PermissionStatus } from 'expo';
import { ToastProvider } from '../../components/ui/nativewind';
import { AppThemeProvider } from '../../theme/AppTheme';
import { theme } from '../../theme/theme';
import { apiClient } from '../../services/api/client';
import { SettingsScreen } from '../settings/SettingsScreen';

jest.mock('@expo/vector-icons', () => {
  const createIcon = () => (props: { name: string }) =>
    mockReact.createElement(mockNativeText, { accessibilityLabel: props.name }, props.name);
  return {
    Ionicons: createIcon(),
    MaterialCommunityIcons: createIcon(),
  };
});

jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 7, name: 'Test User', email: 'owner@example.com' },
    logout: jest.fn(),
  }),
}));

jest.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en-US', changeLanguage: jest.fn() },
  }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
}));

jest.mock('../../config/version.config', () => ({
  getAppVersion: () => '2.0.0',
}));

jest.mock('../../components/BottomSheetModal', () => ({
  BottomSheetModal: () => null,
}));

jest.mock('../../services/storage/downloadCache', () => ({
  purgeDownloadsDirectory: jest.fn(),
}));

jest.mock('../../services/api/client', () => ({
  apiClient: {
    getNotificationPreferences: jest.fn(),
    updateNotificationPreference: jest.fn(),
    changePassword: jest.fn(),
  },
}));

type Mode = 'light' | 'dark';
type Implementation = 'legacy' | 'nativewind';

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(apiClient.getNotificationPreferences).mockResolvedValue([
    { type: 'GAS_READING_REMINDER', enabled: true },
  ]);
  jest.mocked(apiClient.updateNotificationPreference).mockResolvedValue(undefined);
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
    status: PermissionStatus.GRANTED,
    expires: 0,
    granted: true,
    canAskAgain: true,
  });
});

afterEach(() => {
  delete process.env.EXPO_PUBLIC_NATIVEWIND_SCREENS;
});

async function screenTree(
  mode: Mode,
  implementation: Implementation,
  toggleColorMode?: () => void,
) {
  process.env.EXPO_PUBLIC_NATIVEWIND_SCREENS =
    implementation === 'nativewind' ? 'all' : 'none';
  const testTheme = {
    ...theme,
    config: { ...theme.config, initialColorMode: mode },
  };
  const result = await render(
    <NativeBaseProvider
      theme={testTheme}
      initialWindowMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
      }}
    >
      <AppThemeProvider colorMode={mode} toggleColorMode={toggleColorMode}>
        <ToastProvider>
          <SettingsScreen />
        </ToastProvider>
      </AppThemeProvider>
    </NativeBaseProvider>,
  );
  await result.findByText('settings.notificationPermissionGranted');
  await waitFor(() => expect(apiClient.getNotificationPreferences).toHaveBeenCalledTimes(1));
  await act(async () => {
    await Promise.resolve();
  });
  return result;
}

describe.each(['legacy', 'nativewind'] as const)('Settings %s', (implementation) => {
  it.each(['light', 'dark'] as const)('matches the %s snapshot', async (mode) => {
    const result = await screenTree(mode, implementation);
    expect(result.toJSON()).toMatchSnapshot();
    await result.unmount();
  });
});

describe('Settings NativeWind interactions', () => {
  it('uses the shared color-mode toggle', async () => {
    const toggleColorMode = jest.fn();
    const result = await screenTree('light', 'nativewind', toggleColorMode);
    await fireEvent(result.getAllByRole('switch')[0], 'valueChange', true);
    expect(toggleColorMode).toHaveBeenCalledTimes(1);
    await result.unmount();
  });

  it('persists the gas reminder preference and shows the existing toast', async () => {
    const result = await screenTree('dark', 'nativewind');
    await fireEvent(result.getAllByRole('switch')[1], 'valueChange', false);
    await waitFor(() =>
      expect(apiClient.updateNotificationPreference).toHaveBeenCalledWith(
        'GAS_READING_REMINDER',
        false,
      ),
    );
    expect(await result.findByText('settings.preferenceSaved')).toBeTruthy();
    await result.unmount();
  });
});
