import mockReact from 'react';
import { Text as mockNativeText } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../components/ui/nativewind';
import { AppThemeProvider } from '../../theme/AppTheme';
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
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), setParams: jest.fn() }),
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

const readingDate = new Date(2026, 0, 15, 12, 0, 0).toISOString();
const reading = {
  id: 7,
  userId: 3,
  counterValue: 123.45,
  readingDate,
  createdAt: readingDate,
  isInvoiceReference: false,
};


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

async function renderUi(
  element: React.ReactElement,
  mode: Mode,
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  const result = await render(
    <QueryClientProvider client={queryClient}>
        <AppThemeProvider colorMode={mode}>
          <ToastProvider>{element}</ToastProvider>
        </AppThemeProvider>
    </QueryClientProvider>,
  );
  return { result, queryClient };
}

describe('GasAnalysis nativewind', () => {
  it.each(['light', 'dark'] as const)('matches the %s snapshot', async (mode) => {
    const { result, queryClient } = await renderUi(
      <GasAnalysisScreen />,
      mode,
    );
    await result.findByText('gas.analysisWindowTitle');
    expect(result.toJSON()).toMatchSnapshot();
    await result.unmount();
    queryClient.clear();
  });
});

describe('GasReadings nativewind', () => {
  it.each(['light', 'dark'] as const)('matches the %s snapshot', async (mode) => {
    const { result, queryClient } = await renderUi(
      <GasReadingsScreen />,
      mode,
    );
    await result.findByText('gas.title');
    // F7 (GAS-FILTER): period se bira iz menija, ne iz reda pilula. Umjesto
    // pet paralelnih dugmadi na ekranu sada postoji JEDAN red koji prikazuje
    // izabrano (default „Sve") i otvara listu — zato test ide kroz meni.
    // Lista se puni asinhrono, pa se meni čeka (ne pretpostavlja).
    await fireEvent.press(await result.findByTestId('gas-filter-menu'));
    await fireEvent.press(await result.findByTestId('gas-filter-option-all'));
    // F7 (SHEET-02): list se sklanja tek pošto se animacija zatvaranja odigra
    // (400 ms sigurnosni prozor). Snimka se pravi poslije toga — inače bi
    // zavisila od trenutka u kom se animacija prekine.
    await waitFor(() => expect(result.queryByTestId('gas-filter-sheet-modal')).toBeNull());
    // F2: red očitanja razdvaja broj i jedinicu (Readout), pa se vrijednost
    // provjerava kroz labelu reda — ista informacija, jedan a11y čvor.
    await waitFor(() =>
      expect(result.getAllByLabelText(/123\.45 m³/).length).toBeGreaterThan(0),
    );
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
  );

  await fireEvent.press(result.getByText('gas.actionsMenuTrigger'));
  await fireEvent.press(await result.findByText('gas.actionDeleteReading'));

  await waitFor(() => expect(onDelete).toHaveBeenCalledWith(7));
  await result.unmount();
  queryClient.clear();
});
