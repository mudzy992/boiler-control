import mockReact from 'react';
import { BackHandler, Text as mockNativeText } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { NativeBaseProvider } from 'native-base';
import { AppThemeProvider } from '../../theme/AppTheme';
import { theme } from '../../theme/theme';
import { UiImplementationProvider } from '../../components/ui/migration';
import { MainTabNavigator } from '../../navigation/MainTabNavigator';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) =>
    mockReact.createElement(mockNativeText, { accessibilityLabel: name }, name),
}));

jest.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../navigation/DashboardStackNavigator', () => ({
  DashboardStackNavigator: () => mockReact.createElement(mockNativeText, null, 'Dashboard screen'),
}));
jest.mock('../heating/HeatingScreen', () => ({
  HeatingScreen: () => mockReact.createElement(mockNativeText, null, 'Heating screen'),
}));
jest.mock('../gas/GasScreen', () => ({
  GasScreen: () => mockReact.createElement(mockNativeText, null, 'Gas screen'),
}));
jest.mock('../../navigation/SettingsStackNavigator', () => ({
  SettingsStackNavigator: () => mockReact.createElement(mockNativeText, null, 'Settings screen'),
}));

type Mode = 'light' | 'dark';
type Implementation = 'legacy' | 'nativewind';

beforeAll(() => {
  // Legacy-only parity with MainTabNavigator; removed with the before snapshots.
  (BackHandler as any).addEventListener = jest.fn(() => ({ remove: jest.fn() }));
  (BackHandler as any).removeEventListener = jest.fn();
});

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  delete process.env.EXPO_PUBLIC_NATIVEWIND_SCREENS;
  jest.clearAllTimers();
  jest.useRealTimers();
});

async function screenTree(mode: Mode, implementation: Implementation) {
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
      <AppThemeProvider colorMode={mode}>
        <UiImplementationProvider screen="Navigation">
          <NavigationContainer>
            <MainTabNavigator />
          </NavigationContainer>
        </UiImplementationProvider>
      </AppThemeProvider>
    </NativeBaseProvider>,
  );
  await result.findByText('Dashboard screen');
  return result;
}

describe.each(['legacy', 'nativewind'] as const)('MainTabNavigator %s', (implementation) => {
  it.each(['light', 'dark'] as const)('matches the %s snapshot', async (mode) => {
    const result = await screenTree(mode, implementation);
    expect(result.toJSON()).toMatchSnapshot();
    await result.unmount();
  });
});

it('navigates to Gas with the NativeWind tab colors', async () => {
  const result = await screenTree('dark', 'nativewind');
  await fireEvent.press(result.getByText('navigation.gas'));
  expect(await result.findByText('Gas screen')).toBeTruthy();
  await result.unmount();
});
