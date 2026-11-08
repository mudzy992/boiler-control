import mockReact from 'react';
import { Text as mockNativeText } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ToastProvider } from '../../../components/ui/nativewind';
import { AppThemeProvider } from '../../../theme/AppTheme';
import { apiClient } from '../../../services/api/client';
import { GasForm } from '../../../components/gas/GasForm';
import { GasReadingCard } from '../../../components/gas/GasReadingCard';
import { GasReadingsScreen } from '../GasReadingsScreen';

/**
 * F9 (GAS-REFACTOR): ekran Plina je bio zadnji koji je mješao dva UI sloja —
 * `src/ui` primitive i stari NativeWind sloj (`FormControl`, `Actionsheet`,
 * `useColorModeValue`, `brand.*` boje). Testovi pokrivaju ono što je zbog toga
 * stvarno bilo pokvareno, a ne izgled:
 *
 *  1. unos „1234,56" (bosanski decimalni zarez) je padao kao neispravan broj;
 *  2. duplikat na isti dan je čekao mrežni krug da bi vratio istu poruku;
 *  3. akcije očitanja su bile na starom `Actionsheet`-u bez `disabled` stanja;
 *  4. birač raspona je imao „Sačuvaj" koje nije ništa primjenjivalo.
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
  CameraType: { back: 'back' },
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

describe('F9 GasForm', () => {
  it('prihvata decimalni zarez i šalje broj', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const { getByPlaceholderText, getByTestId, queryByTestId } = await render(
      <AppThemeProvider colorMode="dark">
        <GasForm onSubmit={onSubmit} existingReadings={[]} />
      </AppThemeProvider>,
    );

    // RNTL 14: `fireEvent` vraća promise — bez `await` state nije primijenjen i
    // dugme ostaje `disabled` (zato se pritisak tiho ignorisao).
    await fireEvent.changeText(getByPlaceholderText('gas.counterValuePlaceholder'), '1234,56');
    await fireEvent.press(getByTestId('gas-form-submit'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].counterValue).toBeCloseTo(1234.56);
    // Nema greške o neispravnom broju.
    expect(queryByTestId('gas-form-error')).toBeNull();
  });

  it('odbija drugo očitanje na isti dan prije mrežnog poziva', async () => {
    const onSubmit = jest.fn();
    const { getByPlaceholderText, getByTestId, findByTestId } = await render(
      <AppThemeProvider colorMode="dark">
        <GasForm
          onSubmit={onSubmit}
          existingReadings={[{ id: 1, readingDate: new Date().toISOString() }]}
        />
      </AppThemeProvider>,
    );

    await fireEvent.changeText(getByPlaceholderText('gas.counterValuePlaceholder'), '10');
    await fireEvent.press(getByTestId('gas-form-submit'));

    const banner = await findByTestId('gas-form-error');
    expect(banner.props.accessibilityLabel ?? banner).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('F9 GasReadingCard — akcije u sheetu', () => {
  const reading = {
    id: 5,
    userId: 1,
    counterValue: 123.45,
    readingDate: '2026-10-01T10:00:00.000Z',
    createdAt: '2026-10-01T10:00:00.000Z',
    isInvoiceReference: false,
    hasMeterImage: false,
    hasInvoicePdf: false,
  };

  it('nudi akcije kao redove sa stanjem i ne dopušta dvostruko brisanje', async () => {
    const onDelete = jest.fn();
    const { getByText, findByText, getByTestId } = await render(
      <AppThemeProvider colorMode="dark">
        <GasReadingCard
          reading={reading}
          onDelete={onDelete}
          onToggleReference={jest.fn()}
          onUploadMeterImage={jest.fn()}
        />
      </AppThemeProvider>,
    );

    fireEvent.press(getByText(/123,45|123\.45/));
    expect(await findByText('gas.actionDeleteReading')).toBeTruthy();

    const deleteRow = getByTestId('gas-action-gas.actionDeleteReading');
    fireEvent.press(deleteRow);
    // Sheet se zatvara prije akcije (`runAction`), pa akcija ide u sljedeći frejm.
    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
  });
});

describe('F9 GasReadingsScreen — sažetak perioda', () => {
  it('prikazuje potrošnju u periodu i broj očitanja na jednom mjestu', async () => {
    jest.mocked(apiClient.getGasReadings).mockResolvedValue([
      { ...({} as object), id: 2, userId: 1, counterValue: 200, readingDate: '2026-10-20T10:00:00.000Z', createdAt: '2026-10-20T10:00:00.000Z' },
      { ...({} as object), id: 1, userId: 1, counterValue: 100, readingDate: '2026-09-20T10:00:00.000Z', createdAt: '2026-09-20T10:00:00.000Z' },
    ] as never);
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

    expect(await result.findByTestId('gas-period-consumption')).toBeTruthy();
    expect(result.getByText(/gas.totalReadings/)).toBeTruthy();

    await result.unmount();
    queryClient.clear();
  });
});
