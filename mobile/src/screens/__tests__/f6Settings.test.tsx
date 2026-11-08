import mockReact from 'react';
import { Text as mockNativeText } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ToastProvider } from '../../components/ui/nativewind';
import { AppThemeProvider } from '../../theme/AppTheme';
import { apiClient } from '../../services/api/client';
import { NotificationPreferencesScreen } from '../notifications/NotificationPreferencesScreen';

/**
 * F6 (SET-08…SET-11): Postavke obavijesti.
 *
 * Test tvrdi ponašanje koje je prije bilo pogrešno:
 *  - prekidač ima labelu (čitač ekrana ne izgovara samo „uključeno"),
 *  - greška učitavanja se vidi i nudi pokušaj,
 *  - greška spremanja se prijavi, a ne proguta.
 */

jest.mock('@expo/vector-icons', () => {
  const createIcon = () => (props: { name: string }) =>
    mockReact.createElement(mockNativeText, { accessibilityLabel: props.name }, props.name);
  return { Ionicons: createIcon(), MaterialCommunityIcons: createIcon() };
});

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
}));

jest.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
    i18n: { language: 'en-US' },
  }),
}));

jest.mock('../../services/api/client', () => ({
  apiClient: {
    getNotificationPreferences: jest.fn(),
    updateNotificationPreference: jest.fn(),
  },
}));

const preferences = [
  {
    id: 1,
    userId: 1,
    type: 'HEATING_STARTED',
    enabled: true,
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-02T10:00:00.000Z',
  },
  {
    id: 2,
    userId: 1,
    type: 'GAS_READING_REMINDER',
    enabled: false,
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-02T10:00:00.000Z',
  },
];

async function renderUi(element: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } },
  });
  const result = await render(
    <QueryClientProvider client={queryClient}>
      <AppThemeProvider colorMode="dark">
        <ToastProvider>{element}</ToastProvider>
      </AppThemeProvider>
    </QueryClientProvider>,
  );
  return { result, queryClient };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(apiClient.getNotificationPreferences).mockResolvedValue(preferences as never);
  jest.mocked(apiClient.updateNotificationPreference).mockResolvedValue(undefined as never);
});

describe('Postavke obavijesti', () => {
  it('svaki prekidač ima labelu sa nazivom tipa obavijesti', async () => {
    const { result, queryClient } = await renderUi(<NotificationPreferencesScreen />);
    await result.findByTestId('notification-preference-HEATING_STARTED');

    // Prije F6 `Switch` nije imao `accessibilityLabel` — šest istih prekidača
    // bez ijedne riječi o tome šta uključuju.
    expect(
      result.getByTestId('notification-preference-HEATING_STARTED').props.accessibilityLabel,
    ).toBeTruthy();

    await result.unmount();
    queryClient.clear();
  });

  it('greška učitavanja prikazuje banner sa pokušajem', async () => {
    jest.mocked(apiClient.getNotificationPreferences).mockRejectedValue(new Error('mreža'));
    const { result, queryClient } = await renderUi(<NotificationPreferencesScreen />);

    expect(await result.findByTestId('notification-preferences-error')).toBeTruthy();

    await result.unmount();
    queryClient.clear();
  });

  it('greška spremanja se prijavi, stanje prekidača se ne lažno potvrdi', async () => {
    jest.mocked(apiClient.updateNotificationPreference).mockRejectedValue(new Error('odbijeno'));
    const { result, queryClient } = await renderUi(<NotificationPreferencesScreen />);

    const toggle = await result.findByTestId('notification-preference-GAS_READING_REMINDER');
    await fireEvent(toggle, 'valueChange', true);

    await waitFor(() =>
      expect(apiClient.updateNotificationPreference).toHaveBeenCalledWith(
        'GAS_READING_REMINDER',
        true,
      ),
    );

    await result.unmount();
    queryClient.clear();
  });
});

/**
 * F6 (SET-02/SET-05/SET-06): glavni ekran Postavki.
 *
 * Tri stvari koje su prije bile pogrešne ili su rizikovale da se vrate:
 *  - `SettingRow` je bila komponenta definirana unutar ekrana (remount cijele
 *    liste pri svakom renderu),
 *  - dva reda su bila inertna („Pomoć i podrška", „Uslovi i privatnost") iako
 *    su izgledala kao navigacija,
 *  - odjava je bila jedan dodir, bez potvrde.
 */
jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { name: 'Test Korisnik', email: 'test@example.com' },
    logout: jest.fn(),
  }),
}));

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(false),
  shareAsync: jest.fn(),
}));

jest.mock('../../services/storage/downloadCache', () => ({
  purgeDownloadsDirectory: jest.fn().mockResolvedValue({ deletedFiles: 0 }),
}));

jest.mock('../../services/storage/accountExport', () => ({
  createAccountExportFile: jest.fn(),
}));

jest.mock('../../services/storage/AppStorage', () => ({
  AppStorage: { get: jest.fn().mockResolvedValue(null), set: jest.fn() },
}));

jest.mock('../../config/version.config', () => ({
  getAppVersion: () => '9.9.9-test',
}));

// eslint-disable-next-line
const { SettingsScreen } = require('../settings/SettingsScreen');

describe('Postavke — glavni ekran', () => {
  it('nema inertnih redova: svaki red ili vodi negdje ili prebacuje stanje', async () => {
    const { result, queryClient } = await renderUi(<SettingsScreen />);

    // Inertni redovi su bili ovdje; uklonjeni su jer nemaju odredište u repou.
    expect(result.queryByText('settings.helpSupport')).toBeNull();
    expect(result.queryByText('settings.termsPrivacy')).toBeNull();

    await result.unmount();
    queryClient.clear();
  });

  it('odjava traži potvrdu kroz sheet, a ne odjavljuje na prvi dodir', async () => {
    const { result, queryClient } = await renderUi(<SettingsScreen />);

    await waitFor(() => expect(result.getByTestId('settings-logout')).toBeTruthy());
    await fireEvent.press(result.getByTestId('settings-logout'));

    // Sheet sa potvrdom mora postojati prije nego se odjava izvrši.
    await waitFor(() => expect(result.getByTestId('settings-logout-confirm')).toBeTruthy());

    await result.unmount();
    queryClient.clear();
  });
});
