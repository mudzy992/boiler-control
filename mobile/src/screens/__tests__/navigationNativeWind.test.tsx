import mockReact from 'react';
import { Text as mockNativeText } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppThemeProvider } from '../../theme/AppTheme';
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


beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

// F1: traka sada čita `useSafeAreaInsets()` da visina poštuje notch/geste.
// Bez provajdera taj hook baca, pa test mora dati iste insete kao uređaj.
const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

async function screenTree(mode: Mode) {
  const result = await render(
      <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
        <AppThemeProvider colorMode={mode}>
            <NavigationContainer>
              <MainTabNavigator />
            </NavigationContainer>
        </AppThemeProvider>
      </SafeAreaProvider>
  );
  await result.findByText('Dashboard screen');
  return result;
}

describe('MainTabNavigator nativewind', () => {
  it.each(['light', 'dark'] as const)('matches the %s snapshot', async (mode) => {
    const result = await screenTree(mode);
    expect(result.toJSON()).toMatchSnapshot();
    await result.unmount();
  });
});

it('navigates to Gas with the NativeWind tab colors', async () => {
  const result = await screenTree('dark');
  await fireEvent.press(result.getByText('navigation.gas'));
  expect(await result.findByText('Gas screen')).toBeTruthy();
  await result.unmount();
});
