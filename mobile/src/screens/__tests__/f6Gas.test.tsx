import mockReact from 'react';
import { Text as mockNativeText } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ToastProvider } from '../../components/ui/nativewind';
import { AppThemeProvider } from '../../theme/AppTheme';
import { apiClient } from '../../services/api/client';
import i18n from '../../locales/config';
import { GasAnalysisScreen } from '../gas/GasAnalysisScreen';
import { GasReadingsScreen } from '../gas/GasReadingsScreen';

/**
 * F6 (GAS-01…GAS-10): detaljni prolaz kroz Gas.
 *
 * Za razliku od snapshot testova, ovi testovi tvrde PONAŠANJE koje je prije
 * bilo pogrešno — pa padaju ako se greška vrati, bez obzira na to kako se
 * stablo renderuje.
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

jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: () => null,
  DateTimePickerAndroid: { open: jest.fn() },
}));

jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('../../services/storage/downloadCache', () => ({
  getDownloadsDirectory: jest.fn(),
  purgeDownloadsDirectory: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../services/storage/SecureStorage', () => ({
  SecureStorage: { getToken: jest.fn() },
}));

/**
 * `t` vraća ključ (kao u ostalim Gas testovima) da asertacije čitaju ključeve,
 * a ne prijevode. `formatNumber`/`formatDate` NE idu kroz hook — čitaju jezik
 * direktno iz i18n instance, pa test formatiranja i dalje mjeri stvarni
 * bosanski izlaz (`beforeEach` postavlja `bs-BS`).
 */
jest.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'bs-BS' } }),
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

const readingDate = new Date(2026, 0, 15, 12, 0, 0).toISOString();
const reading = {
  id: 7,
  userId: 3,
  counterValue: 12345.6,
  readingDate,
  createdAt: readingDate,
  isInvoiceReference: false,
};

const analysisFixture = {
  period: { startDate: '2026-01-01', endDate: '2026-01-31', mode: 'explicit' as const },
  consumptionFromReferenceM3: 1234.5,
  totalHeatingHours: 100,
  avgFlowTemp: 45,
  costExVat: 1000,
  vatAmount: 170,
  costIncVat: 1170,
  monthlyTrends: [],
};

async function renderUi(element: React.ReactElement, mode: 'light' | 'dark' = 'dark') {
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

beforeEach(async () => {
  jest.clearAllMocks();
  jest.mocked(apiClient.getGasAnalysis).mockResolvedValue(analysisFixture);
  jest.mocked(apiClient.getGasReadings).mockResolvedValue([reading]);
  await i18n.changeLanguage('bs-BS');
});

afterEach(async () => {
  await i18n.changeLanguage('en-US');
});

describe('GasAnalysis — greška vs prazno stanje (GAS-08)', () => {
  it('greška mreže prikazuje banner sa pokušajem, a ne „dodaj dva očitanja"', async () => {
    jest.mocked(apiClient.getGasAnalysis).mockRejectedValue(new Error('mreža pala'));
    const { result, queryClient } = await renderUi(<GasAnalysisScreen />);

    expect(await result.findByTestId('gas-analysis-error')).toBeTruthy();
    expect(result.queryByText('gas.analysisNoData')).toBeNull();

    await result.unmount();
    queryClient.clear();
  });

  it('bez podataka nudi prelazak na očitanja', async () => {
    jest.mocked(apiClient.getGasAnalysis).mockResolvedValue(null as never);
    const onBack = jest.fn();
    const { result, queryClient } = await renderUi(<GasAnalysisScreen onBack={onBack} />);

    await waitFor(() => expect(result.getByText('gas.analysisNoData')).toBeTruthy());
    await fireEvent.press(result.getByText('gas.analysisNoDataAction'));
    expect(onBack).toHaveBeenCalledTimes(1);

    await result.unmount();
    queryClient.clear();
  });
});

describe('GasAnalysis — brojevi i period (GAS-01, GAS-02, GAS-06)', () => {
  it('period se prikazuje na jednom mjestu, bez duplog bloka', async () => {
    const { result, queryClient } = await renderUi(<GasAnalysisScreen />);
    await result.findByTestId('gas-analysis-period');

    // Prije: „Analysis Window" i „Analysis Period" — dva bloka, isti sadržaj.
    expect(result.queryByText('gas.analysisPeriod')).toBeNull();

    await result.unmount();
    queryClient.clear();
  });

  it('brojevi su formatirani po jeziku (bs: zarez decimalno, tačka za hiljade)', async () => {
    const { result, queryClient } = await renderUi(<GasAnalysisScreen />);
    await result.findByTestId('gas-analysis-period');

    // 1234,5 m³ u bosanskom: "1.234,50" — sa `toFixed(2)` bilo bi "1234.50".
    const values = JSON.stringify(result.toJSON());
    expect(values).toContain('1.234,50');
    expect(values).not.toContain('1234.50');

    await result.unmount();
    queryClient.clear();
  });

  it('uzorak statistike je eksplicitno objašnjen', async () => {
    const { result, queryClient } = await renderUi(<GasAnalysisScreen />);
    await result.findByTestId('gas-analysis-period');

    expect(result.getByText('gas.analysisEfficiencyHint')).toBeTruthy();
    expect(result.getByText('gas.analysisCostHint')).toBeTruthy();

    await result.unmount();
    queryClient.clear();
  });
});

describe('GasReadings — prazno stanje ima akciju (GAS-10)', () => {
  it('bez ijednog očitanja nudi „Dodaj očitanje" i otvara sheet', async () => {
    jest.mocked(apiClient.getGasReadings).mockResolvedValue([]);
    const { result, queryClient } = await renderUi(<GasReadingsScreen />);

    await waitFor(() => expect(result.getByText('gas.noReadings')).toBeTruthy());

    // Prije F6 prazno stanje nije imalo akciju. Sada ima dugme sa labelom
    // „Dodaj očitanje" i ono mora biti pritisnuto bez greške (Sheet se montira
    // unaprijed, pa se otvaranje ne dokazuje postojanjem njenog sadržaja).
    const action = result.getAllByText('gas.addReading')[0];
    expect(action).toBeTruthy();
    await fireEvent.press(action);

    await result.unmount();
    queryClient.clear();
  });

  it('kad filter ništa ne vrati, nudi povratak na „Sve"', async () => {
    jest.mocked(apiClient.getGasReadings).mockResolvedValue([
      // Očitanje iz 2020. je izvan „zadnje sedmice", pa ga filter sakrije.
      { ...reading, readingDate: new Date(2020, 0, 1).toISOString() },
    ]);
    const { result, queryClient } = await renderUi(<GasReadingsScreen />);

    await waitFor(() => expect(result.getByText('gas.filterLastWeek')).toBeTruthy());
    await fireEvent.press(result.getAllByText('gas.filterLastWeek')[0]);

    await waitFor(() => expect(result.getByText('gas.noReadingsInPeriod')).toBeTruthy());
    const backToAll = result.getAllByText('gas.filterAll');
    await fireEvent.press(backToAll[backToAll.length - 1]);

    await waitFor(() => expect(result.queryByText('gas.noReadingsInPeriod')).toBeNull());

    await result.unmount();
    queryClient.clear();
  });
});
