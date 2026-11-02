import mockReact from 'react';
import { BackHandler, Text as mockNativeText, View as mockNativeView } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { NativeBaseProvider } from 'native-base';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../components/ui/nativewind';
import { UiImplementationProvider } from '../../components/ui/migration';
import { AppThemeProvider } from '../../theme/AppTheme';
import { theme } from '../../theme/theme';
import { apiClient } from '../../services/api/client';
import { GasAnalysisScreen } from '../gas/GasAnalysisScreen';
import { GasReadingsScreen } from '../gas/GasReadingsScreen';
import { GasForm } from '../../components/gas/GasForm';
import { GasReadingCard } from '../../components/gas/GasReadingCard';

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
}));

jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: () => null,
  DateTimePickerAndroid: { open: jest.fn() },
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('../../services/storage/downloadCache', () => ({
  getDownloadsDirectory: jest.fn(),
  purgeDownloadsDirectory: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../services/storage/SecureStorage', () => ({
  SecureStorage: { getToken: jest.fn() },
}));

jest.mock('../../components/BottomSheetModal', () => ({
  BottomSheetModal: ({ isOpen, children }: { isOpen: boolean; children: mockReact.ReactNode }) =>
    isOpen ? mockReact.createElement(mockNativeView, null, children) : null,
}));

jest.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../services/api/client', () => ({
  apiClient: {
    getGasAnalysis: jest.fn(),
    getGasReadings: jest.fn(),
    addGasReadingWithUpload: jest.fn(),
    deleteGasReading: jest.fn(),
    updateGasReference: jest.fn(),
    uploadGasMeterImage: jest.fn(),
    uploadGasInvoice: jest.fn(),
    deleteGasInvoice: jest.fn(),
  },
}));

type Mode = 'light' | 'dark';
type Implementation = 'legacy' | 'nativewind';

const readingDate = new Date(2026, 0, 15, 12, 0, 0).toISOString();
const reading = {
  id: 7,
  userId: 3,
  counterValue: 123.45,
  readingDate,
  createdAt: readingDate,
  isInvoiceReference: false,
};

beforeAll(() => {
  // Legacy-only parity with RootNavigator; removed with the before snapshots.
  (BackHandler as any).removeEventListener = jest.fn();
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(apiClient.getGasAnalysis).mockResolvedValue({
    period: {
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      mode: 'explicit',
    },
    consumptionFromReferenceM3: 12.5,
    totalHeatingHours: 100,
    avgFlowTemp: 45,
    costExVat: 10,
    vatAmount: 1.7,
    costIncVat: 11.7,
    monthlyTrends: [],
  });
  jest.mocked(apiClient.getGasReadings).mockResolvedValue([reading]);
});

afterEach(() => {
  delete process.env.EXPO_PUBLIC_NATIVEWIND_SCREENS;
});

async function renderUi(
  element: React.ReactElement,
  mode: Mode,
  implementation: Implementation,
  directComponent = false,
) {
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
  const content = directComponent ? (
    <UiImplementationProvider screen="GasReadings">{element}</UiImplementationProvider>
  ) : (
    element
  );
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
          <ToastProvider>{content}</ToastProvider>
        </AppThemeProvider>
      </NativeBaseProvider>
    </QueryClientProvider>,
  );
  return { result, queryClient };
}

describe.each(['legacy', 'nativewind'] as const)('GasAnalysis %s', (implementation) => {
  it.each(['light', 'dark'] as const)('matches the %s snapshot', async (mode) => {
    const { result, queryClient } = await renderUi(
      <GasAnalysisScreen />,
      mode,
      implementation,
    );
    await result.findByText('gas.analysisWindowTitle');
    expect(result.toJSON()).toMatchSnapshot();
    await result.unmount();
    queryClient.clear();
  });
});

describe.each(['legacy', 'nativewind'] as const)('GasReadings %s', (implementation) => {
  it.each(['light', 'dark'] as const)('matches the %s snapshot', async (mode) => {
    const { result, queryClient } = await renderUi(
      <GasReadingsScreen />,
      mode,
      implementation,
    );
    await result.findByText('gas.title');
    await fireEvent.press(result.getByText('gas.filterAll'));
    await waitFor(() => expect(result.getAllByText('123.45 m³').length).toBeGreaterThan(0));
    expect(result.toJSON()).toMatchSnapshot();
    await result.unmount();
    queryClient.clear();
  });
});

it('submits a NativeWind gas form with a numeric reading and ISO date', async () => {
  const onSubmit = jest.fn().mockResolvedValue(undefined);
  const { result, queryClient } = await renderUi(
    <GasForm onSubmit={onSubmit} existingReadings={[]} />,
    'dark',
    'nativewind',
    true,
  );

  await fireEvent.changeText(result.getByPlaceholderText('gas.counterValuePlaceholder'), '456.78');
  await fireEvent.press(result.getByText('gas.addReading'));

  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  expect(onSubmit.mock.calls[0][0]).toEqual({
    counterValue: 456.78,
    readingDate: expect.any(String),
    meterImage: undefined,
  });
  expect(Number.isNaN(Date.parse(onSubmit.mock.calls[0][0].readingDate))).toBe(false);
  await result.unmount();
  queryClient.clear();
});

it('opens the NativeWind reading actionsheet and runs delete after the frame', async () => {
  const onDelete = jest.fn();
  const { result, queryClient } = await renderUi(
    <GasReadingCard reading={reading} onDelete={onDelete} />,
    'light',
    'nativewind',
    true,
  );

  await fireEvent.press(result.getByText('gas.actionsMenuTrigger'));
  await fireEvent.press(await result.findByText('gas.actionDeleteReading'));

  await waitFor(() => expect(onDelete).toHaveBeenCalledWith(7));
  await result.unmount();
  queryClient.clear();
});
