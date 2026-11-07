import mockReact from 'react';
import { Text as mockNativeText } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import * as Sharing from 'expo-sharing';
import { PermissionStatus } from 'expo';
import { ToastProvider } from '../../components/ui/nativewind';
import { AppThemeProvider } from '../../theme/AppTheme';
import { apiClient } from '../../services/api/client';
import { createAccountExportFile } from '../../services/storage/accountExport';
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

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

jest.mock('../../config/version.config', () => ({
  getAppVersion: () => '2.0.0',
}));

jest.mock('../../services/storage/downloadCache', () => ({
  purgeDownloadsDirectory: jest.fn(),
}));

jest.mock('../../services/storage/accountExport', () => ({
  createAccountExportFile: jest.fn(),
}));

jest.mock('../../services/api/client', () => ({
  apiClient: {
    getNotificationPreferences: jest.fn(),
    updateNotificationPreference: jest.fn(),
    changePassword: jest.fn(),
  },
}));

type Mode = 'light' | 'dark';

const EXPORT_URI = 'file:///cache/downloads/account-export-v1-test.json';

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
  jest.mocked(createAccountExportFile).mockResolvedValue(EXPORT_URI);
  jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);
  jest.mocked(Sharing.shareAsync).mockResolvedValue(undefined);
});

async function screenTree(
  mode: Mode,
  toggleColorMode?: () => void,
) {
  const result = await render(
      <AppThemeProvider colorMode={mode} toggleColorMode={toggleColorMode}>
        <ToastProvider>
          <SettingsScreen />
        </ToastProvider>
      </AppThemeProvider>
  );
  await result.findByText('settings.notificationPermissionGranted');
  await waitFor(() => expect(apiClient.getNotificationPreferences).toHaveBeenCalledTimes(1));
  await act(async () => {
    await Promise.resolve();
  });
  return result;
}

describe('Settings nativewind', () => {
  it.each(['light', 'dark'] as const)('matches the %s snapshot', async (mode) => {
    const result = await screenTree(mode);
    expect(result.toJSON()).toMatchSnapshot();
    await result.unmount();
  });
});

describe('Settings NativeWind interactions', () => {
  it('uses the shared color-mode toggle', async () => {
    const toggleColorMode = jest.fn();
    const result = await screenTree('light', toggleColorMode);
    await fireEvent(result.getAllByRole('switch')[0], 'valueChange', true);
    expect(toggleColorMode).toHaveBeenCalledTimes(1);
    await result.unmount();
  });

  it('persists the gas reminder preference and shows the existing toast', async () => {
    const result = await screenTree('dark');
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

  it('downloads the account JSON and opens native sharing', async () => {
    const result = await screenTree('light');

    await fireEvent.press(result.getByText('settings.exportData'));

    await waitFor(() => expect(createAccountExportFile).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(Sharing.shareAsync).toHaveBeenCalledWith(EXPORT_URI, {
        mimeType: 'application/json',
        dialogTitle: 'settings.exportData',
        UTI: 'public.json',
      }),
    );
    expect(await result.findByText('settings.exportReady')).toBeTruthy();
    expect(result.queryByText('settings.exportRedirect')).toBeNull();
    await result.unmount();
  });

  it('blocks repeated taps and shows progress while the export is pending', async () => {
    jest
      .mocked(createAccountExportFile)
      .mockReturnValue(new Promise<string>(() => undefined));
    const result = await screenTree('light');
    const exportRow = result.getByText('settings.exportData');

    await fireEvent.press(exportRow);
    await fireEvent.press(exportRow);

    expect(await result.findByText('settings.exportPreparing')).toBeTruthy();
    expect(createAccountExportFile).toHaveBeenCalledTimes(1);
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
    await result.unmount();
  });

  it.each([
    {
      label: 'disabled backend',
      error: { response: { status: 404 } },
      message: 'settings.exportUnavailable',
    },
    {
      label: 'oversized export',
      error: { response: { status: 413 } },
      message: 'settings.exportTooLarge',
    },
    {
      label: 'generic failure',
      error: new Error('network failed'),
      message: 'settings.exportError',
    },
  ])('shows an honest message for $label', async ({ error, message }) => {
    jest.mocked(createAccountExportFile).mockRejectedValueOnce(error);
    const result = await screenTree('light');

    await fireEvent.press(result.getByText('settings.exportData'));

    expect(await result.findByText(message)).toBeTruthy();
    expect(createAccountExportFile).toHaveBeenCalledTimes(1);
    expect(Sharing.isAvailableAsync).not.toHaveBeenCalled();
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
    expect(result.queryByText('settings.exportRedirect')).toBeNull();
    await result.unmount();
  });

  it('keeps the downloaded file when native sharing is unavailable', async () => {
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(false);
    const result = await screenTree('light');

    await fireEvent.press(result.getByText('settings.exportData'));

    expect(await result.findByText('settings.exportSaved')).toBeTruthy();
    expect(createAccountExportFile).toHaveBeenCalledTimes(1);
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
    await result.unmount();
  });

  it('reports the saved file instead of claiming success when sharing fails', async () => {
    jest.mocked(Sharing.shareAsync).mockRejectedValueOnce(new Error('share failed'));
    const result = await screenTree('light');

    await fireEvent.press(result.getByText('settings.exportData'));

    expect(await result.findByText('settings.exportSaved')).toBeTruthy();
    expect(result.queryByText('settings.exportReady')).toBeNull();
    await result.unmount();
  });
});
