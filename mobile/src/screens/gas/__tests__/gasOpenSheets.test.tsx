import mockReact from 'react';
import { Text as mockNativeText } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ToastProvider } from '../../../components/ui/nativewind';
import { AppThemeProvider } from '../../../theme/AppTheme';
import { apiClient } from '../../../services/api/client';
import { GasReadingsScreen } from '../GasReadingsScreen';

/**
 * F7 (GAS-OPEN / SHEET-01): tri radnje na ekranu Plina nisu radile ništa:
 * „+" u zaglavlju, „Dodaj očitanje" u praznom stanju i izbor perioda.
 *
 * Uzrok nije bio u ovim dugmadima — sva tri su ispravno mijenjala state. Uzrok
 * je bio `Sheet` primitiv: `BottomSheet` je bio dijete ekrana (unutar
 * `ScreenStack` kartice) umjesto korijena, a otvaranje je zavisilo isključivo
 * od imperativnog `snapToIndex(0)`, koji tiho odustane dok `isLayoutCalculated`
 * nije izračunat. Stanje se mijenjalo, sheet se nije prikazivao — dakle dodir
 * je izgledao mrtav.
 *
 * Ovaj test zato ne provjerava state, nego SADRŽAJ koji se pojavi poslije
 * dodira: polje brojila u sheetu za dodavanje i radio lista u meniju perioda.
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
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
}));

jest.mock('../../../services/storage/downloadCache', () => ({
  getDownloadsDirectory: jest.fn(),
  purgeDownloadsDirectory: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../services/storage/SecureStorage', () => ({
  SecureStorage: { getToken: jest.fn() },
}));

jest.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../../../services/api/client', () => ({
  apiClient: {
    getGasAnalysis: jest.fn(),
    getGasReadings: jest.fn(),
    addGasReadingWithUpload: jest.fn(),
    deleteGasReading: jest.fn(),
    setGasReadingReference: jest.fn(),
  },
}));

const reading = {
  id: 1,
  counterValue: 123.45,
  readingDate: '2026-10-01',
  isInvoiceReference: true,
  hasMeterImage: false,
  hasInvoicePdf: false,
};

async function renderScreen() {
  jest.mocked(apiClient.getGasReadings).mockResolvedValue([reading]);
  jest.mocked(apiClient.getGasAnalysis).mockResolvedValue({});
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const result = await render(
    <QueryClientProvider client={queryClient}>
      <AppThemeProvider colorMode="dark">
        <ToastProvider>
          <GasReadingsScreen />
        </ToastProvider>
      </AppThemeProvider>
    </QueryClientProvider>,
  );
  await result.findByText('gas.title');
  return { result, queryClient };
}

describe('F7 Plin — radnje koje su izgledale mrtve', () => {
  it('plus u zaglavlju otvara sheet za dodavanje očitanja', async () => {
    const { result, queryClient } = await renderScreen();

    fireEvent.press(result.getByLabelText('gas.addReading'));

    // Tražimo SADRŽAJ sheeta, ne `showAddModal`: forma ima svoje polje, koje
    // postoji samo kad je sheet stvarno montiran u vidljivom stanju.
    // Eksplicitan timeout: `Sheet` montira sadržaj tek poslije animacije, a
    // zadani `findBy*` čeka 1 s. Na opterećenom CI runneru (2 jezgre, više
    // paralelnih workers) to povremeno nije dovoljno i test padne kao „sheet se
    // ne otvara" — iako se otvori. Flaky test u CI-ju je gori od nikakvog, jer
    // se crveni znak počne ignorisati.
    expect(
      await result.findByPlaceholderText('gas.counterValuePlaceholder', {}, { timeout: 5000 }),
    ).toBeTruthy();
    await result.unmount();
    queryClient.clear();
  });

  it('red „Period" otvara listu perioda i mijenja prikaz', async () => {
    const { result, queryClient } = await renderScreen();

    // Zaglavlje liste (i meni u njemu) postoji tek kad očitanja stignu, pa se
    // čeka pojava umjesto pretpostavke da je list već izrenderovan.
    const trigger = await result.findByTestId('gas-filter-menu', {}, { timeout: 5000 });
    fireEvent.press(trigger);
    const optionMonth = await result.findByTestId('gas-filter-option-month', {}, { timeout: 5000 });
    expect(optionMonth).toBeTruthy();

    fireEvent.press(optionMonth);
    // Poslije izbora, trigger pokazuje novi period umjesto starog. `waitFor`
    // jer dodir mijenja state, a `Sheet` se zatvara u istom prolazu.
    await waitFor(() =>
      expect(result.getByTestId('gas-filter-menu').props.accessibilityLabel).toContain(
        'gas.filterMonth',
      ),
    );

    await result.unmount();
    queryClient.clear();
  });
});
