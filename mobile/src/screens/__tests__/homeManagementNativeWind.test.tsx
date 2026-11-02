import mockReact from 'react';
import { BackHandler, Text as mockNativeText, View as mockNativeView } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { NativeBaseProvider } from 'native-base';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../components/ui/nativewind';
import { AppThemeProvider } from '../../theme/AppTheme';
import { theme } from '../../theme/theme';
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

jest.mock('react-native/Libraries/Modal/Modal', () => ({
  __esModule: true,
  default: ({ visible, children }: { visible: boolean; children: mockReact.ReactNode }) =>
    visible ? mockReact.createElement(mockNativeView, null, children) : null,
}));

jest.mock('@react-native-aria/overlays', () => ({
  ...jest.requireActual('@react-native-aria/overlays'),
  // Closed NativeBase modal content is not visible UI in these snapshots.
  OverlayContainer: () => null,
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
type Implementation = 'legacy' | 'nativewind';

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

beforeAll(() => {
  // Legacy-only parity with RootNavigator; removed with the before snapshots.
  (BackHandler as any).addEventListener = jest.fn(() => ({ remove: jest.fn() }));
  (BackHandler as any).removeEventListener = jest.fn();
});

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
  delete process.env.EXPO_PUBLIC_NATIVEWIND_SCREENS;
  jest.clearAllTimers();
  jest.useRealTimers();
});

async function screenTree(mode: Mode, implementation: Implementation) {
  process.env.EXPO_PUBLIC_NATIVEWIND_SCREENS =
    implementation === 'nativewind' ? 'all' : 'none';
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  const testTheme = {
    ...theme,
    config: { ...theme.config, initialColorMode: mode },
  };
  const result = await render(
    <QueryClientProvider client={queryClient}>
      <NativeBaseProvider
        theme={testTheme}
        initialWindowMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, right: 0, bottom: 0, left: 0 },
        }}
      >
        <AppThemeProvider colorMode={mode}>
          <ToastProvider>
            <HomeManagementScreen />
          </ToastProvider>
        </AppThemeProvider>
      </NativeBaseProvider>
    </QueryClientProvider>,
  );
  await result.findByText('Main House');
  await result.findByText('Weekend House');
  return { result, queryClient };
}

describe.each(['legacy', 'nativewind'] as const)('HomeManagement %s', (implementation) => {
  it.each(['light', 'dark'] as const)('matches the %s snapshot', async (mode) => {
    const { result, queryClient } = await screenTree(mode, implementation);
    expect(result.toJSON()).toMatchSnapshot();
    await result.unmount();
    queryClient.clear();
  });
});

it('uses NativeWind select, checkbox and slider values when creating a home', async () => {
  const { result, queryClient } = await screenTree('dark', 'nativewind');

  await fireEvent.press(result.getByText('Add Home'));
  expect(await result.findByText('Add New Home')).toBeTruthy();
  await fireEvent.changeText(result.getByPlaceholderText('e.g., Main House'), 'Mountain House');

  const selects = result.getAllByRole('combobox');
  expect(selects).toHaveLength(5);
  await fireEvent.press(selects[0]);
  await fireEvent.press(result.getByText('EPS Styrofoam (8-12cm)'));

  await fireEvent.press(result.getByRole('checkbox'));
  const sliders = result.getAllByRole('adjustable');
  expect(sliders).toHaveLength(3);
  await fireEvent(sliders[0], 'onAccessibilityAction', {
    nativeEvent: { actionName: 'increment' },
  });

  const addButtons = result.getAllByText('Add Home');
  expect(addButtons).toHaveLength(2);
  await fireEvent.press(addButtons[1]);

  await waitFor(() => expect(homeProfileApi.createHomeProfile).toHaveBeenCalledTimes(1));
  expect(jest.mocked(homeProfileApi.createHomeProfile).mock.calls[0][0]).toMatchObject({
    homeName: 'Mountain House',
    insulationType: InsulationType.EPS,
    hasFloorHeating: true,
    targetMorningTemp: 22.5,
    constructionYear: 2026,
  });
  expect(await result.findByText('Home added successfully')).toBeTruthy();
  await waitFor(() => expect(homeProfileApi.getAllHomeProfiles).toHaveBeenCalledTimes(2));
  await result.unmount();
  queryClient.clear();
});
