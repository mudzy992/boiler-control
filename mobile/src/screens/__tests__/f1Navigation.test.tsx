import mockReact from 'react';
import { Text as mockNativeText, Pressable as mockNativePressable } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import fs from 'fs';
import path from 'path';

import { AppThemeProvider } from '../../theme/AppTheme';
import { GasScreen } from '../gas/GasScreen';

/**
 * F1 (nalaz UX-03 / UX-02) — ugovori koje ovaj test čuva:
 *
 *  1. Plin VIŠE nije ugniježđeni tab navigator. Druga traka je trošila ~112px
 *     na 800px ekrana i tražila da korisnik nauči koja traka šta mijenja.
 *  2. Sekcije se mijenjaju `Segmented` kontrolom u zaglavlju.
 *  3. Glavna traka nema hardkodovanih hex boja — sve dolazi iz tokena.
 *  4. `userInterfaceStyle` je `automatic`, inače iOS ignoriše našu tamnu temu.
 */

jest.mock('@expo/vector-icons', () => {
  const createIcon = () => (props: { name: string }) =>
    mockReact.createElement(mockNativeText, { accessibilityLabel: props.name }, props.name);
  return { Ionicons: createIcon(), MaterialCommunityIcons: createIcon() };
});

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: {} }),
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), setParams: jest.fn() }),
}));

jest.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Sekcije se mockuju: ovaj test provjerava NAVIGACIJU unutar Plina, ne
// sadržaj ekrana (taj je pokriven u gasNativeWind.test.tsx).
jest.mock('../gas/GasReadingsScreen', () => ({
  GasReadingsScreen: ({ headerSlot }: { headerSlot?: mockReact.ReactNode }) =>
    mockReact.createElement(
      'View',
      null,
      mockReact.createElement(mockNativeText, null, 'readings section'),
      headerSlot ?? null,
    ),
}));

jest.mock('../gas/GasAnalysisScreen', () => ({
  GasAnalysisScreen: ({
    onBack,
    headerSlot,
  }: {
    onBack?: () => void;
    headerSlot?: mockReact.ReactNode;
  }) =>
    mockReact.createElement(
      'View',
      null,
      mockReact.createElement(mockNativeText, null, 'analysis section'),
      headerSlot ?? null,
      onBack
        ? mockReact.createElement(
            mockNativePressable,
            { onPress: onBack, accessibilityRole: 'button', accessibilityLabel: 'back' },
            mockReact.createElement(mockNativeText, null, 'analysis back'),
          )
        : null,
    ),
}));

const read = (relative: string) =>
  fs.readFileSync(path.join(__dirname, '..', '..', relative), 'utf8');

describe('Gas is one screen with a segmented control', () => {
  it('starts on Readings and switches to Analysis without a second tab bar', async () => {
    const result = await render(
      <AppThemeProvider colorMode="dark">
        <GasScreen />
      </AppThemeProvider>,
    );

    expect(await result.findByText('readings section')).toBeTruthy();
    expect(result.queryByText('analysis section')).toBeNull();

    await fireEvent.press(result.getByTestId('gas-segmented-analysis'));
    expect(await result.findByText('analysis section')).toBeTruthy();

    await fireEvent.press(result.getByTestId('gas-segmented-readings'));
    expect(await result.findByText('readings section')).toBeTruthy();

    await result.unmount();
  });

  it('lets Analysis go back to Readings', async () => {
    const result = await render(
      <AppThemeProvider colorMode="dark">
        <GasScreen />
      </AppThemeProvider>,
    );

    await fireEvent.press(await result.findByTestId('gas-segmented-analysis'));
    await fireEvent.press(await result.findByLabelText('back'));

    expect(await result.findByText('readings section')).toBeTruthy();
    await result.unmount();
  });

  it('registers no nested navigator of any kind', () => {
    const source = read('screens/gas/GasScreen.tsx');
    // `createBottomTabNavigator` se u fajlu pominje samo u komentaru koji
    // objašnjava šta je uklonjeno — zato se provjerava import, ne riječ.
    expect(source).not.toMatch(/from '@react-navigation\/(bottom-tabs|material-top-tabs)'/);
    expect(source).not.toMatch(/<Tab\.Navigator/);
  });
});

describe('Navigation and theme wiring', () => {
  it('keeps every main-tab colour in tokens (no raw hex)', () => {
    const source = read('navigation/MainTabNavigator.tsx');
    // Boje u traci dolaze iz `useTokens()`; hardkodovani hex bi vratio tačno
    // onaj problem zbog kojeg je traka i prepravljena (32 takva mjesta u auditu).
    expect(source).not.toMatch(/['"]#[0-9a-fA-F]{3,8}['"]/);
    expect(source).toMatch(/useTokens\(\)/);
  });

  it('lets iOS follow the in-app theme', () => {
    const appJson = JSON.parse(read('../app.json'));
    expect(appJson.expo.userInterfaceStyle).toBe('automatic');
  });

  it('keeps the four tabs and their route names', () => {
    const source = read('navigation/MainTabNavigator.tsx');
    for (const route of ['Dashboard', 'Heating', 'Gas', 'Settings']) {
      expect(source).toContain(`name="${route}"`);
    }
  });
});
