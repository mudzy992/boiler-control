import mockReact from 'react';
import { StyleSheet, Text as mockNativeText } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AppThemeProvider } from '../../theme/AppTheme';
import { ToastProvider } from '../../components/ui/nativewind';
import { DeviceName } from '../../ui/DeviceName';
import { Field, SliderField, Toggle } from '../../ui/Field';
import { thermostatApi } from '../../services/api/thermostat.api';
import { ScheduleManagementScreen } from '../schedule/ScheduleManagementScreen';
import { GasScreen } from '../gas/GasScreen';
import { tokensFor } from '../../theme/tokens';

/**
 * F10 — tema na „Mojim domovima", „Rasporedu grijanja" i Analitici, plus
 * tranzicija Očitanja ↔ Analiza.
 *
 * Testovi tvrde ONO ŠTO JE BILO POKVARENO, ne piksele:
 *  1. naziv uređaja/doma je velikim slovima svuda (`textTransform`), a podatak
 *     ostaje nepromijenjen (čitač ekrana ne slovka);
 *  2. kontrola iz `src/ui` uzima boju iz teme — ista komponenta u light i dark
 *     režimu mora dati RAZLIČITU podlogu, i to tačno onu iz `tokensFor`;
 *  3. prelazak Očitanja ↔ Analiza ne demontira traku i ne skriva pogrešan
 *     panel (oba panela su u stablu, `display` bira vidljivi).
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

// Očitanja i analiza imaju vlastite upite; mock mora biti POTPUN (svaka
// metoda koju ekran zove), inače `isLoading` nikad ne padne na `false` i
// header (sa trakom) se ne renderuje.
jest.mock('../../services/api/client', () => ({
  apiClient: {
    getGasReadings: jest.fn().mockResolvedValue([]),
    getGasAnalysis: jest.fn().mockResolvedValue(null),
    getGasMeterImageEndpoint: jest.fn(() => ''),
    getGasInvoiceEndpoint: jest.fn(() => ''),
  },
}));

jest.mock('../../services/api/thermostat.api', () => ({
  thermostatApi: {
    getAllDevices: jest.fn(),
    getDevicePrograms: jest.fn(),
  },
}));

const devices = [
  {
    id: 1,
    alias: 'Boiler Living Room',
    deviceId: 'tuya-1',
    vendor: 'Tuya',
    mode: 'PROGRAM' as const,
    homeProfileId: 7,
    lastSeen: '2026-06-15T12:00:00.000Z',
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(thermostatApi.getAllDevices).mockResolvedValue(devices);
  jest.mocked(thermostatApi.getDevicePrograms).mockResolvedValue([]);
});

describe('DeviceName', () => {
  it.each(['light', 'dark'] as const)(
    'prikazuje naziv velikim slovima u %s režimu, bez mijenjanja podatka',
    async (mode) => {
      const view = await render(
        <AppThemeProvider colorMode={mode}>
          <DeviceName name="Boiler Living Room" testID="naziv" />
        </AppThemeProvider>,
      );
      const node = view.getByTestId('naziv');
      // Stil, ne `toUpperCase()`: podatak ostaje isti string.
      expect(node.props.children).toBe('Boiler Living Room');
      expect(StyleSheet.flatten(node.props.style).textTransform).toBe('uppercase');
      // Jedan red, da dug naziv ne razbije karticu.
      expect(node.props.numberOfLines).toBe(1);
    },
  );

  it('koristi rezervu kad naziva nema', async () => {
    const view = await render(
      <AppThemeProvider colorMode="dark">
        <DeviceName name={null} fallback="Termostat" testID="naziv" />
      </AppThemeProvider>,
    );
    expect(view.getByTestId('naziv').props.children).toBe('Termostat');
  });
});

describe('kontrole iz teme (F10)', () => {
  it('Field uzima podlogu iz tokena te teme, ne iz hardkodovane boje', async () => {
    const light = await render(
      <AppThemeProvider colorMode="light">
        <Field label="Naziv" testID="polje" />
      </AppThemeProvider>,
    );
    const dark = await render(
      <AppThemeProvider colorMode="dark">
        <Field label="Naziv" testID="polje" />
      </AppThemeProvider>,
    );

    const lightBg = StyleSheet.flatten(light.getByTestId('polje').props.style).backgroundColor;
    const darkBg = StyleSheet.flatten(dark.getByTestId('polje').props.style).backgroundColor;

    // Prije: `FormInput` je uvijek bio `#0f172a`/`white` — dakle ista boja bez
    // obzira na temu. Sada mora biti tačno `raised` iz odgovarajuće palete.
    expect(lightBg).toBe(tokensFor('light').raised);
    expect(darkBg).toBe(tokensFor('dark').raised);
    expect(lightBg).not.toBe(darkBg);
    // Visina je dodirna meta, ne 36 px „kao prije".
    expect(StyleSheet.flatten(light.getByTestId('polje').props.style).minHeight).toBeGreaterThanOrEqual(44);
  });

  it('Toggle je 52 px red sa role="switch" (prije: 24×24 checkbox)', async () => {
    const onChange = jest.fn();
    const view = await render(
      <AppThemeProvider colorMode="dark">
        <Toggle label="Podno grijanje" value={false} onChange={onChange} testID="prekidac" />
      </AppThemeProvider>,
    );
    const node = view.getByTestId('prekidac');
    expect(node.props.accessibilityRole).toBe('switch');
    expect(node.props.accessibilityState.checked).toBe(false);
    await fireEvent.press(node);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('SliderField prihvata akciju čitača ekrana i prikazuje trenutnu vrijednost', async () => {
    const onChange = jest.fn();
    const view = await render(
      <AppThemeProvider colorMode="dark">
        <SliderField
          label="Jutarnja"
          value={22}
          min={5}
          max={30}
          step={0.5}
          unit="°C"
          onChange={onChange}
          testID="klizac"
        />
      </AppThemeProvider>,
    );
    await fireEvent(view.getByTestId('klizac'), 'onAccessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
    expect(onChange).toHaveBeenCalledWith(22.5);
    // Vrijednost je vidljiva kao tekst (22°C), a ne samo kao položaj kuglice.
    expect(view.getByText('22°C')).toBeTruthy();
  });
});

describe('Raspored grijanja — tema i naziv uređaja', () => {
  const tree = async (mode: 'light' | 'dark') => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    const result = await render(
      <QueryClientProvider client={queryClient}>
        <AppThemeProvider colorMode={mode}>
          <ToastProvider>
            <ScheduleManagementScreen />
          </ToastProvider>
        </AppThemeProvider>
      </QueryClientProvider>,
    );
    await result.findByText('Boiler Living Room');
    return { result, queryClient };
  };

  it.each(['light', 'dark'] as const)('nema hardkodovanih paleta iz starog sloja (%s)', async (mode) => {
    const { result, queryClient } = await tree(mode);
    const json = JSON.stringify(result.toJSON());
    // Stari ekran je koristio ove boje direktno; nijedna nije u `tokensFor`.
    for (const legacy of ['#e2e8f0', 'gray.50', 'dark.900', 'blue.50', 'brand.500', 'orange.400']) {
      expect(json).not.toContain(legacy);
    }
    queryClient.clear();
  });

  it('info traka je InlineBanner, ne obojena kutija bez značenja', async () => {
    const { result, queryClient } = await tree('dark');
    expect(result.getByTestId('schedule-readonly-banner')).toBeTruthy();
    queryClient.clear();
  });

  it('čitač ekrana dobija prirodan naziv, ekran velika slova', async () => {
    const { result, queryClient } = await tree('dark');
    const title = result.getByText('Boiler Living Room');
    expect(StyleSheet.flatten(title.props.style).textTransform).toBe('uppercase');
    // Ista vrijednost ide u a11y label — bez `toUpperCase()`.
    expect(result.getByTestId('schedule-device-select').props.accessibilityLabel).toContain(
      'Boiler Living Room',
    );
    queryClient.clear();
  });
});

describe('Plin — tranzicija Očitanja ↔ Analiza', () => {
  it('oba panela su u stablu i traka se ne demontira pri prelasku', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });

    const view = await render(
      <QueryClientProvider client={queryClient}>
        <AppThemeProvider colorMode="dark">
          <ToastProvider>
            <GasScreen />
          </ToastProvider>
        </AppThemeProvider>
      </QueryClientProvider>,
    );

    // Oba panela postoje od prvog rendera — zato prelazak ne čeka upite.
    // `includeHiddenElements` jer su paneli namjerno `display: 'none'` kad nisu
    // aktivni — RNTL ih zato po defaultu ne vraća, a nama trebaju oba.
    const readingsPanel = view.getByTestId('gas-readings-panel', { includeHiddenElements: true });
    const analysisPanel = view.getByTestId('gas-analysis-panel', { includeHiddenElements: true });
    expect(StyleSheet.flatten(readingsPanel.props.style).display).toBe('flex');
    expect(StyleSheet.flatten(analysisPanel.props.style).display).toBe('none');

    // Dok je Analiza skrivena, njen sadržaj ne smije doći do čitača ekrana.
    expect(analysisPanel.props.accessibilityElementsHidden).toBe(true);

    // Lista očitanja se montira tek kad upit vrati odgovor (prije toga je
    // skeleton bez trake), pa se traka čeka — to je i stvarno ponašanje.
    await waitFor(() => expect(view.getByTestId('gas-segmented')).toBeTruthy());
    await fireEvent.press(view.getByTestId('gas-segmented-analysis'));

    const after = () =>
      view.getByTestId('gas-analysis-panel', { includeHiddenElements: true });
    await waitFor(() =>
      expect(StyleSheet.flatten(after().props.style).display).toBe('flex'),
    );
    expect(
      StyleSheet.flatten(
        view.getByTestId('gas-readings-panel', { includeHiddenElements: true }).props.style,
      ).display,
    ).toBe('none');
    // Traka postoji i poslije prelaska i pokazuje novu sekciju. Bitno je da su
    // OBA panela bila u stablu PRIJE dodira (`analysisPanel` je pronađen iznad)
    // — dakle prelazak ne montira ekran iznova i ne čeka upite.
    const afterSegmented = view.getByTestId('gas-segmented');
    expect(afterSegmented.props.accessibilityLabel).toBe('Analysis');
    expect(view.getByTestId('gas-segmented-analysis').props.accessibilityState.selected).toBe(true);

    queryClient.clear();
  });
});
