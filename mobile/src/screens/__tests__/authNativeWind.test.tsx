import mockReact from 'react';
import { Text as mockNativeText } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { ToastProvider } from '../../components/ui/nativewind';
import { AppThemeProvider } from '../../theme/AppTheme';
import { LoginScreen } from '../auth/LoginScreen';
import { RegisterScreen } from '../auth/RegisterScreen';
import { UpdateRequiredScreen } from '../common/UpdateRequiredScreen';

jest.mock('@expo/vector-icons', () => {
  const createIcon = () => (props: { name: string }) =>
    mockReact.createElement(mockNativeText, { accessibilityLabel: props.name }, props.name);
  return {
    Ionicons: createIcon(),
    MaterialCommunityIcons: createIcon(),
  };
});

jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ login: jest.fn(), register: jest.fn() }),
}));

jest.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { android: { package: 'com.boilercontrol.test' } } },
}));

type Mode = 'light' | 'dark';

async function screenTree(
  children: React.ReactNode,
  mode: Mode,
) {
  return render(
      <AppThemeProvider colorMode={mode}>
        <ToastProvider>{children}</ToastProvider>
      </AppThemeProvider>
  );
}

const navigation = { navigate: jest.fn() };
const screens = [
  ['Login', <LoginScreen key="Login" navigation={navigation} />],
  ['Register', <RegisterScreen key="Register" navigation={navigation} />],
  [
    'UpdateRequired',
    <UpdateRequiredScreen
      key="UpdateRequired"
      currentVersion="2.0.0"
      minSupportedVersion="2.1.0"
    />,
  ],
] as const;

describe.each(screens)('%s before/after NativeWind', (_name, screen) => {
  describe('nativewind', () => {
    it.each(['light', 'dark'] as const)('matches the %s snapshot', async (mode) => {
      const result = await screenTree(screen, mode);
      expect(result.toJSON()).toMatchSnapshot();
    });
  });
});

describe('Auth NativeWind interaction', () => {
  it('keeps validation toasts and navigation working', async () => {
    const navigate = jest.fn();
    const result = await screenTree(
      <LoginScreen navigation={{ navigate }} />,
      'dark',
    );

    await fireEvent.press(result.getByRole('button', { name: 'auth.signIn' }));
    expect(result.getByText('auth.fillAllFields')).toBeTruthy();

    await fireEvent.press(result.getByText('auth.signUp'));
    expect(navigate).toHaveBeenCalledWith('Register');
  });
});
