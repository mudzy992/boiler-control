import 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import i18n from '../../../locales/config';
import { AppStorage } from '../../../services/storage/AppStorage';
import { SettingsScreen } from '../SettingsScreen';

/**
 * F7 (SET-LANG): stvarna reprodukcija promjene jezika.
 *
 * F6a je tvrdila da promjena radi jer je `changeLanguage` bio pozvan — a korisnik
 * je i dalje vidio engleski. Test zato ne provjerava samo `i18n.language`, nego
 * TRI stvari koje zajedno znače „radi":
 *
 *  1. dodir na red „Jezik" otvara listu (korijen F7 buga je bio `Sheet`, koji se
 *     nije prikazivao — pa se do `changeLanguage` nikad nije ni došlo);
 *  2. dodir na „Bosanski" mijenja `i18n.language`;
 *  3. UI se PREVEDE — naslov Postavki prelazi na bosanski bez ponovnog otvaranja
 *     ekrana, i izbor se perzistira u `AppStorage` (`app.language`).
 *
 * Bez trećeg koraka test bi ponovo prošao i kad korisnik vidi engleski.
 */
jest.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 7, name: 'Test', email: 'a@b.c' }, logout: jest.fn() }),
}));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
}));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock('../../../config/version.config', () => ({ getAppVersion: () => '2.0.0' }));
jest.mock('../../../services/storage/downloadCache', () => ({ purgeDownloadsDirectory: jest.fn() }));
jest.mock('../../../services/storage/accountExport', () => ({ createAccountExportFile: jest.fn() }));
jest.mock('../../../services/api/client', () => ({
  apiClient: {
    getNotificationPreferences: jest.fn().mockResolvedValue([]),
    updateNotificationPreference: jest.fn().mockResolvedValue(undefined),
    changePassword: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('F7 promjena jezika u Postavkama', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en-US');
    await AppStorage.remove('app.language');
  });

  it('otvara listu jezika, mijenja jezik, prevodi UI i pamti izbor', async () => {
    const screen = await render(<SettingsScreen />);
    expect(screen.queryByText('Settings')).toBeTruthy();

    fireEvent.press(screen.getByTestId('settings-language'));
    expect(await screen.findByTestId('language-bs-BS')).toBeTruthy();

    fireEvent.press(screen.getByTestId('language-bs-BS'));

    await waitFor(() => expect(i18n.language).toBe('bs-BS'));
    await waitFor(() => expect(screen.queryByText('Postavke')).toBeTruthy());
    expect(screen.queryByText('Settings')).toBeNull();
    await waitFor(async () =>
      expect(await AppStorage.get('app.language')).toBe('bs-BS'),
    );
  });

  it('ne mijenja ništa kad se izabere jezik koji je već aktivan', async () => {
    const spy = jest.spyOn(i18n, 'changeLanguage');
    const screen = await render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId('settings-language'));
    fireEvent.press(await screen.findByTestId('language-en-US'));
    expect(i18n.language).toBe('en-US');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
