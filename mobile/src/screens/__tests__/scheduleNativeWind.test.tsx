import mockReact from 'react';
import { BackHandler, Text as mockNativeText } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { NativeBaseProvider } from 'native-base';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../components/ui/nativewind';
import { AppThemeProvider } from '../../theme/AppTheme';
import { theme } from '../../theme/theme';
import { thermostatApi } from '../../services/api/thermostat.api';
import { ScheduleManagementScreen } from '../schedule/ScheduleManagementScreen';

jest.mock('@expo/vector-icons', () => {
  const createIcon = () => (props: { name: string }) =>
    mockReact.createElement(mockNativeText, { accessibilityLabel: props.name }, props.name);
  return {
    Ionicons: createIcon(),
    MaterialCommunityIcons: createIcon(),
  };
});

jest.mock('../../services/api/thermostat.api', () => ({
  thermostatApi: {
    getAllDevices: jest.fn(),
    getDevicePrograms: jest.fn(),
  },
}));

beforeAll(() => {
  // Legacy-only parity with RootNavigator; removed with the before snapshots.
  (BackHandler as any).removeEventListener = jest.fn();
});

type Mode = 'light' | 'dark';
type Implementation = 'legacy' | 'nativewind';

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
  {
    id: 2,
    alias: 'Boiler Upstairs',
    deviceId: 'tuya-2',
    vendor: 'Tuya',
    mode: 'MANUAL' as const,
    homeProfileId: 7,
    lastSeen: '2026-06-15T12:00:00.000Z',
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(thermostatApi.getAllDevices).mockResolvedValue(devices);
  jest.mocked(thermostatApi.getDevicePrograms).mockResolvedValue([]);
});

afterEach(() => {
  delete process.env.EXPO_PUBLIC_NATIVEWIND_SCREENS;
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
            <ScheduleManagementScreen />
          </ToastProvider>
        </AppThemeProvider>
      </NativeBaseProvider>
    </QueryClientProvider>,
  );
  return { result, queryClient };
}

describe.each(['legacy', 'nativewind'] as const)('Schedule %s', (implementation) => {
  it.each(['light', 'dark'] as const)('matches the %s snapshot', async (mode) => {
    const { result, queryClient } = await screenTree(mode, implementation);
    await result.findByText('Boiler Living Room');
    await result.findByText('No heating programs found');
    expect(result.toJSON()).toMatchSnapshot();
    await result.unmount();
    queryClient.clear();
  });
});

it('changes the selected thermostat through the NativeWind select', async () => {
  const { result, queryClient } = await screenTree('dark', 'nativewind');
  const select = await result.findByRole('combobox');
  await waitFor(() => expect(thermostatApi.getDevicePrograms).toHaveBeenCalledWith(1));

  await fireEvent.press(select);
  await fireEvent.press(result.getByText('Boiler Upstairs (Tuya)'));

  await waitFor(() => expect(thermostatApi.getDevicePrograms).toHaveBeenCalledWith(2));
  expect(await result.findByText('Boiler Upstairs')).toBeTruthy();
  await result.unmount();
  queryClient.clear();
});
