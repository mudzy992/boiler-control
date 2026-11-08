import mockReact from 'react';
import { Text as mockNativeText, View as mockNativeView } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../components/ui/nativewind';
import { AppThemeProvider } from '../../theme/AppTheme';
import {
  homeProfileApi,
  type HomeProfile,
} from '../../services/api/homeProfile.api';
import {
  HeatingType,
  InsulationType,
  SeasonMode,
  WindowType,
} from '../../constants/homeProfileEnums';
import { HomeManagementScreen } from '../home/HomeManagementScreen';

jest.mock('@expo/vector-icons', () => {
  const createIcon = () => (props: { name: string }) =>
    mockReact.createElement(mockNativeText, { accessibilityLabel: props.name }, props.name);
  return {
    Ionicons: createIcon(),
    MaterialCommunityIcons: createIcon(),
  };
});

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: {} }),
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), setParams: jest.fn() }),
}));

jest.mock('react-native/Libraries/Modal/Modal', () => ({
  __esModule: true,
  default: ({ visible, children }: { visible: boolean; children: mockReact.ReactNode }) =>
    visible ? mockReact.createElement(mockNativeView, null, children) : null,
}));

jest.mock('../../services/api/homeProfile.api', () => ({
  homeProfileApi: {
    getAllHomeProfiles: jest.fn(),
    createHomeProfile: jest.fn(),
    updateHomeProfile: jest.fn(),
    deleteHomeProfile: jest.fn(),
    switchActiveHome: jest.fn(),
  },
}));

type Mode = 'light' | 'dark';

const activeHome: HomeProfile = {
  id: 1,
  userId: 3,
  name: 'Main House',
  homeName: 'Main House',
  location: 'Sarajevo',
  isActive: true,
  thermostats: 2,
  createdAt: '2026-01-01T08:00:00.000Z',
  floorArea: 120,
  ceilingHeight: 2.7,
  insulationType: InsulationType.MINERAL_WOOL,
  insulationThickness: 12,
  windowType: WindowType.DOUBLE_GLAZED,
  heatingType: HeatingType.RADIATOR,
  constructionYear: 2005,
  numberOfResidents: 3,
  boilerModel: 'Boiler A',
  hasFloorHeating: false,
  targetMorningTemp: 22,
  targetDayTemp: 20,
  targetNightTemp: 18,
  seasonMode: SeasonMode.WINTER,
  updatedAt: '2026-01-01T08:00:00.000Z',
};
const inactiveHome: HomeProfile = {
  ...activeHome,
  id: 2,
  name: 'Weekend House',
  homeName: 'Weekend House',
  location: 'Bjelašnica',
  isActive: false,
  thermostats: 1,
};
const createdHome: HomeProfile = {
  ...activeHome,
  id: 4,
  name: 'Mountain House',
  homeName: 'Mountain House',
  isActive: false,
  thermostats: 0,
};


beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 10, 2, 12, 0));
  jest.clearAllMocks();
  jest.mocked(homeProfileApi.getAllHomeProfiles).mockResolvedValue([activeHome, inactiveHome]);
  jest.mocked(homeProfileApi.createHomeProfile).mockResolvedValue(createdHome);
  jest.mocked(homeProfileApi.updateHomeProfile).mockResolvedValue(activeHome);
  jest.mocked(homeProfileApi.deleteHomeProfile).mockResolvedValue(undefined);
  jest.mocked(homeProfileApi.switchActiveHome).mockResolvedValue(activeHome);
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

async function screenTree(mode: Mode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  const result = await render(
    <QueryClientProvider client={queryClient}>
        <AppThemeProvider colorMode={mode}>
          <ToastProvider>
            <HomeManagementScreen />
          </ToastProvider>
        </AppThemeProvider>
    </QueryClientProvider>,
  );
  await result.findByText('Main House');
  await result.findByText('Weekend House');
  return { result, queryClient };
}

describe('HomeManagement nativewind', () => {
  it.each(['light', 'dark'] as const)('matches the %s snapshot', async (mode) => {
    const { result, queryClient } = await screenTree(mode);
    expect(result.toJSON()).toMatchSnapshot();
    await result.unmount();
    queryClient.clear();
  });
});

/**
 * F10 (HOME-THEME): tok je preveden na novu formu, bez slabljenja tvrdnji.
 *
 * Šta se promijenilo i zašto:
 *  - „Add home" nije više tekst u tijelu ekrana, nego akcija u zaglavlju
 *    (`home-management-header-action`) — isto mjesto kao na Plinu i Postavkama;
 *  - `Select` starog sloja (5 combobox-ova) zamijenjen je `ChoiceField`-om:
 *    do tri opcije `Segmented` (tip grijanja), više od tri `Sheet` sa radio
 *    listom (izolacija, prozori, sezona, debljina) — zato nema `combobox`-ova,
 *    nego `radiogroup`-ovi čije se opcije biraju dodirom;
 *  - `Checkbox` 24×24 je `Toggle` sa `role="switch"`;
 *  - tri `Slider`-a su `SliderField`-ovi koji i dalje nose
 *    `accessibilityRole="adjustable"` i akcije `increment`/`decrement`.
 *
 * Tvrdnje o poslanom payloadu su NEPROMIJENJENE.
 */
it('uses the new form controls when creating a home', async () => {
  const { result, queryClient } = await screenTree('dark');

  await fireEvent.press(result.getByTestId('home-management-header-action'));
  expect(await result.findByText('Add New Home')).toBeTruthy();
  await fireEvent.changeText(result.getByTestId('home-form-name'), 'Mountain House');

  // Izolacija: 4 opcije → red koji otvara sheet sa radio listom.
  await fireEvent.press(result.getByTestId('home-form-insulation'));
  await fireEvent.press(await result.findByTestId('home-form-insulation-option-EPS'));

  // Podno grijanje: `Toggle` sa `role="switch"`.
  await fireEvent.press(result.getByRole('switch'));

  const sliders = result.getAllByRole('adjustable');
  expect(sliders).toHaveLength(3);
  await fireEvent(sliders[0], 'onAccessibilityAction', {
    nativeEvent: { actionName: 'increment' },
  });

  await fireEvent.press(result.getByTestId('home-form-submit'));

  await waitFor(() => expect(homeProfileApi.createHomeProfile).toHaveBeenCalledTimes(1));
  expect(jest.mocked(homeProfileApi.createHomeProfile).mock.calls[0][0]).toMatchObject({
    homeName: 'Mountain House',
    insulationType: InsulationType.EPS,
    hasFloorHeating: true,
    targetMorningTemp: 22.5,
    constructionYear: 2026,
  });
  expect(await result.findByText('Home added')).toBeTruthy();
  await waitFor(() => expect(homeProfileApi.getAllHomeProfiles).toHaveBeenCalledTimes(2));
  await result.unmount();
  queryClient.clear();
});

it('keeps the form error inside the sheet instead of a toast', async () => {
  const { result, queryClient } = await screenTree('dark');

  await fireEvent.press(result.getByTestId('home-management-header-action'));
  // Prazan naziv: validacija mora ostati vidljiva u formi (prije je bila toast
  // koji nestane za 3 s, pa korisnik nije znao koje polje je pogrešno).
  await fireEvent.press(result.getByTestId('home-form-submit'));

  expect(await result.findByTestId('home-form-error')).toBeTruthy();
  expect(homeProfileApi.createHomeProfile).not.toHaveBeenCalled();
  await result.unmount();
  queryClient.clear();
});
