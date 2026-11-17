import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { TvPairingScreen } from '../TvPairingScreen';
import { parseTvPairingCode } from '../pairingCode';
import { apiClient } from '../../../services/api/client';
import '../../../locales/config';

/**
 * F16 — telefon odobrava prijavu TV-a.
 *
 * Test gleda ono što korisnik stvarno radi: prepiše kod s TV-a i pritisne
 * „Odobri". Tri stvari koje moraju biti tačne:
 *
 *  1. kod se **normalizuje** prije slanja (`abcd-2345` → `ABCD2345`) — korisnik
 *     prepisuje s TV-a i mala slova/crtica su normalno stanje, ne greška;
 *  2. nedovršen kod **ne** šalje zahtjev (dugme je onemogućeno);
 *  3. greška servera se **vidi** — ekran ne ostaje tiho na „poslano".
 */

jest.mock('../../../services/api/client', () => ({
  apiClient: {
    approveTvPairing: jest.fn(),
  },
}));

jest.mock('expo-camera', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    CameraView: ({ testID, onBarcodeScanned }: any) =>
      React.createElement(View, { testID, onBarcodeScanned }),
    useCameraPermissions: () => [
      { granted: true },
      jest.fn().mockResolvedValue({ granted: true }),
    ],
  };
});

const mockNavigation = { goBack: jest.fn() };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}));

/**
 * RTL 14: `render` je **asinhron**, pa se mora `await`-ovati. Bez toga
 * `screen.getByTestId` traži element prije nego što je stablo montirano i pada
 * sa „`render` function has not been called" — greška u testu, ne u ekranu.
 */
async function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TvPairingScreen />
    </QueryClientProvider>
  );
}

describe('F16 — ekran za uparivanje TV-a', () => {
  it('QR parser prihvata TV deep link i odbija pogrešan/nepouzdan kod', () => {
    expect(parseTvPairingCode('boilercontrol://tv-pair?code=ABCD2345')).toBe('ABCD2345');
    expect(parseTvPairingCode('abcd-2345')).toBe('ABCD2345');
    expect(parseTvPairingCode('https://example.com')).toBeNull();
    expect(parseTvPairingCode('ABCD0123')).toBeNull();
  });

  it('skenirani TV QR popunjava polje i zatvara kameru', async () => {
    await renderScreen();
    await act(async () => {
      fireEvent.press(screen.getByTestId('tv-pairing-scan'));
    });
    const camera = screen.getByTestId('tv-pairing-camera');
    await act(async () => {
      camera.props.onBarcodeScanned({
        data: 'boilercontrol://tv-pair?code=ABCD2345',
      });
    });
    expect(screen.getByTestId('tv-pairing-code').props.value).toBe('ABCD2345');
    expect(screen.queryByTestId('tv-pairing-camera')).toBeNull();
    await act(async () => {
      fireEvent.press(screen.getByTestId('tv-pairing-approve'));
    });
    await waitFor(() => expect(apiClient.approveTvPairing).toHaveBeenCalledWith('ABCD2345'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('šalje normalizovan kod i prikazuje potvrdu', async () => {
    (apiClient.approveTvPairing as jest.Mock).mockResolvedValue({ status: 'APPROVED' });

    await renderScreen();

    /*
     * `act` je obavezan: `Pressable` sa `disabled` odbija događaj, a stanje
     * (`disabled={!canSubmit}`) se mijenja tek nakon što React obradi
     * `changeText`. Bez `act` pritisak padne na još onemogućeno dugme.
     */
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('tv-pairing-code'), 'abcd-2345');
    });
    fireEvent.press(screen.getByTestId('tv-pairing-approve'));

    await waitFor(() => expect(apiClient.approveTvPairing).toHaveBeenCalledWith('ABCD2345'));
    // Potvrda mora biti vidljiva — bez nje korisnik ne zna je li prošlo.
    await waitFor(() => expect(screen.getByText('TV connected')).toBeTruthy());
  });

  it('nedovršen kod ne šalje zahtjev', async () => {
    await renderScreen();

    fireEvent.changeText(screen.getByTestId('tv-pairing-code'), 'ABCD');
    fireEvent.press(screen.getByTestId('tv-pairing-approve'));

    expect(apiClient.approveTvPairing).not.toHaveBeenCalled();
  });

  it('odbijen kod prikazuje grešku, ne tišinu', async () => {
    (apiClient.approveTvPairing as jest.Mock).mockRejectedValue(new Error('404'));

    await renderScreen();

    await act(async () => {
      fireEvent.changeText(screen.getByTestId('tv-pairing-code'), 'ABCD2345');
    });
    fireEvent.press(screen.getByTestId('tv-pairing-approve'));

    await waitFor(() => expect(screen.getByText('Code did not work')).toBeTruthy());
    // I nema lažnog uspjeha.
    expect(screen.queryByText('TV connected')).toBeNull();
  });
});
