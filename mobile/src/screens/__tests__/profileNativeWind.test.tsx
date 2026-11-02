import mockReact from 'react';
import { Text as mockNativeText } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { NativeBaseProvider } from 'native-base';
import { ToastProvider } from '../../components/ui/nativewind';
import { AppThemeProvider } from '../../theme/AppTheme';
import { theme } from '../../theme/theme';
import { apiClient } from '../../services/api/client';
import { ProfileScreen } from '../profile/ProfileScreen';

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
    user: {
      id: 7,
      email: 'owner@example.com',
      name: 'Test User',
      username: 'owner',
    },
    logout: jest.fn(),
    setUser: jest.fn(),
  }),
}));

jest.mock('../../services/api/client', () => ({
  apiClient: {
    getUserProfile: jest.fn(),
    updateUserProfile: jest.fn(),
  },
}));

type Mode = 'light' | 'dark';
type Implementation = 'legacy' | 'nativewind';

const profile = {
  id: 7,
  email: 'owner@example.com',
  name: 'Test User',
  username: 'owner',
  homeLocation: 'Sarajevo',
  gasPriceExVat: 1.25,
  gasPriceSource: 'manual',
  gasPriceLastUpdatedAt: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(apiClient.getUserProfile).mockResolvedValue(profile);
  jest.mocked(apiClient.updateUserProfile).mockResolvedValue(profile);
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
  return render(
    <NativeBaseProvider
      theme={testTheme}
      initialWindowMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
      }}
    >
      <AppThemeProvider colorMode={mode} toggleColorMode={toggleColorMode}>
        <ToastProvider>
          <ProfileScreen />
        </ToastProvider>
      </AppThemeProvider>
    </NativeBaseProvider>,
  );
}

describe.each(['legacy', 'nativewind'] as const)('Profile %s', (implementation) => {
  it.each(['light', 'dark'] as const)('matches the %s snapshot', async (mode) => {
    const result = await screenTree(mode, implementation);
    await result.findByDisplayValue('Test User');
    expect(result.toJSON()).toMatchSnapshot();
    await result.unmount();
  });
});

describe('Profile NativeWind interactions', () => {
  it('uses the shared color-mode toggle', async () => {
    const toggleColorMode = jest.fn();
    const result = await screenTree('light', 'nativewind', toggleColorMode);
    const control = await result.findByRole('switch');
    await fireEvent(control, 'valueChange', true);
    expect(toggleColorMode).toHaveBeenCalledTimes(1);
    await result.unmount();
  });

  it('saves once without retriggering the toast-dependent profile effect', async () => {
    const result = await screenTree('dark', 'nativewind');
    await result.findByDisplayValue('Test User');
    expect(apiClient.getUserProfile).toHaveBeenCalledTimes(1);

    await fireEvent.press(result.getByRole('button', { name: 'Save Profile' }));
    await result.findByText('Profile updated');

    expect(apiClient.updateUserProfile).toHaveBeenCalledWith({
      name: 'Test User',
      username: 'owner',
      homeLocation: 'Sarajevo',
      gasPriceExVat: 1.25,
    });
    await waitFor(() => expect(apiClient.getUserProfile).toHaveBeenCalledTimes(2));
    expect(apiClient.getUserProfile).toHaveBeenCalledTimes(2);
    await result.unmount();
  });
});
