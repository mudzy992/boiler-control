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

/**
 * Mock se postavlja **u `beforeEach`**, ne u `renderScreen()`.
 *
 * `jest.config.js` ima `clearMocks: true`, što briše i implementacije mockova
 * prije svakog testa. Kada je postavljanje bilo u `renderScreen()`, radilo je
 * samo ako `renderScreen()` uspije — a prvi test je čekao `gas.title` sa 1 s
 * (vidi `renderScreen` niže) i padao **prije** nego što je mock uopšte
 * postavljen. Drugi test je prolazio jer je njegov `renderScreen()` išao drugi.
 *
 * Tiket: `SHEET_DIAG[testID=gas-readings-header;label=-;treeBytes=4467]` —
 * nijedan label i samo skeleton znače „podaci nisu stigli", ne „sheet ne radi".
 * Time se isključuje cijela teorija o `Sheet`-u: ekran nikad nije ni izašao iz
 * `isLoading`.
 */
beforeEach(() => {
  jest.mocked(apiClient.getGasReadings).mockResolvedValue([reading]);
  jest.mocked(apiClient.getGasAnalysis).mockResolvedValue({});
});

async function renderScreen() {
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
  /*
   * Čeka se **sadržaj liste**, ne naslov.
   *
   * `gas.title` postoji i u stanju učitavanja (zaglavlje se crta iznad
   * skeletonа), pa je `findByText('gas.title')` prolazio dok je ekran još bio u
   * `isLoading` — a u toj grani dugme „+" ne postoji. Lokalno bez `--coverage`
   * je podatak stizao dovoljno brzo da razlika ne bude vidljiva; u auditu
   * (`--coverage`, sporije izvršavanje) test je padao sa
   * `SHEET_DIAG[testID=gas-readings-header;label=-;treeBytes=4467]` — samo
   * skeleton, nijedan label.
   *
   * `gas-filter-menu` postoji **samo** kad su podaci stigli, pa je on ispravna
   * tačka sinhronizacije.
   */
  await result.findByTestId(
    'gas-filter-menu',
    {},
    { timeout: SHEET_TIMEOUT_MS },
  );
  return { result, queryClient };
}

/**
 * Pri svakom padu dodaje stanje ekrana u poruku (`SHEET_DIAG[...]`), pa
 * `jest_report.cjs` to prenese u anotaciju.
 *
 * Zašto omotava **cijelo** tijelo, a ne samo traženje polja: prvi pokušaj je
 * imao `try/catch` samo oko `findByPlaceholderText`, a pad je bio prije njega
 * (`getByLabelText`, ili samo renderovanje) — pa je anotacija ostala bez
 * dijagnostike. Ovako nema putanje koja padne bez opisa.
 */
async function withSheetDiag<T>(
  result: { toJSON: () => unknown },
  body: () => Promise<T>,
): Promise<T> {
  try {
    return await body();
  } catch (error) {
    const tree = JSON.stringify(result.toJSON());
    const testIds = [
      ...new Set(
        (tree.match(/"testID":"([^"]+)"/g) ?? []).map((hit) => hit.slice(10, -1)),
      ),
    ];
    const labels = [
      ...new Set(
        (tree.match(/"accessibilityLabel":"([^"]*)"/g) ?? []).map((hit) =>
          hit.slice(24, -1),
        ),
      ),
    ];
    throw new Error(
      [
        String((error as Error)?.message ?? error).slice(0, 180),
        `SHEET_DIAG[testID=${testIds.slice(0, 10).join('|') || '-'}` +
          `;label=${labels.slice(0, 8).join('|') || '-'}` +
          `;treeBytes=${tree.length}]`,
      ].join(' | '),
    );
  }
}

/**
 * Koliko se čeka pojava sadržaja sheeta.
 *
 * `Sheet` montira sadržaj poslije animacije, a zadani `findBy*` čeka 1 s. Na
 * opterećenom CI runneru (2 jezgre, više paralelnih workers) to povremeno nije
 * dovoljno — test je 2026-11-07 pao na CI-ju i prošao na rerun-u bez promjene
 * koda. Zato je granica podignuta i **ispisana u imenu** kad se prekorači:
 * flaky gejt se počne ignorisati, a onda ne štiti ništa.
 */
const SHEET_TIMEOUT_MS = 15_000;

describe('F7 Plin — radnje koje su izgledale mrtve', () => {
  it('plus u zaglavlju otvara sheet za dodavanje očitanja', async () => {
    const { result, queryClient } = await renderScreen();

    await withSheetDiag(result, async () => {
      fireEvent.press(result.getByLabelText('gas.addReading'));

      // Tražimo SADRŽAJ sheeta, ne `showAddModal`: forma ima svoje polje, koje
      // postoji samo kad je sheet stvarno montiran u vidljivom stanju.
      await result.findByPlaceholderText(
        'gas.counterValuePlaceholder',
        {},
        { timeout: SHEET_TIMEOUT_MS },
      );
    });

    await result.unmount();
    queryClient.clear();
  });

  it('red „Period" otvara listu perioda i mijenja prikaz', async () => {
    const { result, queryClient } = await renderScreen();

    await withSheetDiag(result, async () => {
      // Zaglavlje liste (i meni u njemu) postoji tek kad očitanja stignu, pa se
      // čeka pojava umjesto pretpostavke da je list već izrenderovan.
      const trigger = await result.findByTestId(
        'gas-filter-menu',
        {},
        { timeout: SHEET_TIMEOUT_MS },
      );
      fireEvent.press(trigger);
      const optionMonth = await result.findByTestId(
        'gas-filter-option-month',
        {},
        { timeout: SHEET_TIMEOUT_MS },
      );
      expect(optionMonth).toBeTruthy();

      fireEvent.press(optionMonth);
      // Poslije izbora, trigger pokazuje novi period umjesto starog. `waitFor`
      // jer dodir mijenja state, a `Sheet` se zatvara u istom prolazu.
      await waitFor(
        () =>
          expect(
            result.getByTestId('gas-filter-menu').props.accessibilityLabel,
          ).toContain('gas.filterMonth'),
        { timeout: SHEET_TIMEOUT_MS },
      );
    });

    await result.unmount();
    queryClient.clear();
  });
});
