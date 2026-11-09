import mockReact from 'react';
import { Text as mockNativeText } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../components/ui/nativewind';
import { AppThemeProvider } from '../../theme/AppTheme';
import { apiClient } from '../../services/api/client';
import { HeatingScreen } from '../heating/HeatingScreen';

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


jest.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../hooks/useAppState', () => ({
  useAppState: () => 'active',
}));

jest.mock('../../services/api/client', () => ({
  apiClient: {
    getDashboard: jest.fn(),
    getHeatingEvents: jest.fn(),
  },
}));

type Mode = 'light' | 'dark';

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(apiClient.getDashboard).mockResolvedValue({
    homes: [
      {
        id: 1,
        name: 'Home',
        thermostats: [
          {
            id: 10,
            alias: 'Living Room',
            roomCurrentTemp: 21.5,
            roomTargetTemp: 23,
            isHeatingNow: true,
          },
        ],
      },
    ],
  });
  jest.mocked(apiClient.getHeatingEvents).mockResolvedValue([]);
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
            <HeatingScreen />
          </ToastProvider>
        </AppThemeProvider>
    </QueryClientProvider>,
  );
  await result.findByText('Living Room');
  return { result, queryClient };
}

describe('Heating nativewind', () => {
  it.each(['light', 'dark'] as const)('matches the %s snapshot', async (mode) => {
    const { result, queryClient } = await screenTree(mode);
    expect(result.toJSON()).toMatchSnapshot();
    await result.unmount();
    queryClient.clear();
  });
});

it('refreshes both queries and renders the custom NativeWind toast', async () => {
  const { result, queryClient } = await screenTree('dark');
  const scrollViews = result.container.queryAll((node) => node.type === 'RCTScrollView');
  expect(scrollViews).toHaveLength(1);

  await act(async () => {
    await scrollViews[0].props.refreshControl.props.onRefresh();
  });

  await waitFor(() => expect(apiClient.getDashboard).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(apiClient.getHeatingEvents).toHaveBeenCalledTimes(2));
  expect(await result.findByText('heating.updated')).toBeTruthy();
  await result.unmount();
  queryClient.clear();
});
