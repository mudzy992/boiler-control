import mockReact from 'react';
import { Text as mockNativeText } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../components/ui/nativewind';
import { AppThemeProvider } from '../../theme/AppTheme';
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


type Mode = 'light' | 'dark';

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
            <ScheduleManagementScreen />
          </ToastProvider>
        </AppThemeProvider>
    </QueryClientProvider>,
  );
  return { result, queryClient };
}

describe('Schedule nativewind', () => {
  it.each(['light', 'dark'] as const)('matches the %s snapshot', async (mode) => {
    const { result, queryClient } = await screenTree(mode);
    await result.findByText('Boiler Living Room');
    await result.findByText('No heating programs found');
    expect(result.toJSON()).toMatchSnapshot();
    await result.unmount();
    queryClient.clear();
  });
});

it('changes the selected thermostat through the NativeWind select', async () => {
  const { result, queryClient } = await screenTree('dark');
  const select = await result.findByRole('combobox');
  await waitFor(() => expect(thermostatApi.getDevicePrograms).toHaveBeenCalledWith(1));

  await fireEvent.press(select);
  await fireEvent.press(result.getByText('Boiler Upstairs (Tuya)'));

  await waitFor(() => expect(thermostatApi.getDevicePrograms).toHaveBeenCalledWith(2));
  expect(await result.findByText('Boiler Upstairs')).toBeTruthy();
  await result.unmount();
  queryClient.clear();
});
