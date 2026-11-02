import mockReact from 'react';
import { Text as mockNativeText } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { NativeBaseProvider } from 'native-base';
import { ToastProvider } from '../../components/ui/nativewind';
import { AppThemeProvider } from '../../theme/AppTheme';
import { theme } from '../../theme/theme';
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
type Implementation = 'legacy' | 'nativewind';

async function screenTree(
  children: React.ReactNode,
  mode: Mode,
  implementation: Implementation,
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
      <AppThemeProvider colorMode={mode}>
        <ToastProvider>{children}</ToastProvider>
      </AppThemeProvider>
    </NativeBaseProvider>,
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

afterEach(() => {
  delete process.env.EXPO_PUBLIC_NATIVEWIND_SCREENS;
});

describe.each(screens)('%s before/after NativeWind', (_name, screen) => {
  describe.each(['legacy', 'nativewind'] as const)('%s', (implementation) => {
    it.each(['light', 'dark'] as const)('matches the %s snapshot', async (mode) => {
      const result = await screenTree(screen, mode, implementation);
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
      'nativewind',
    );

    await fireEvent.press(result.getByRole('button', { name: 'auth.signIn' }));
    expect(result.getByText('auth.fillAllFields')).toBeTruthy();

    await fireEvent.press(result.getByText('auth.signUp'));
    expect(navigate).toHaveBeenCalledWith('Register');
  });
});
