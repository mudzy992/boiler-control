import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { TvPairingScreen } from '../TvPairingScreen';

/**
 * Ekran za uparivanje.
 *
 * Provjerava se ponašanje, ne izgled: šta se prikaže kad kod istekne, je li
 * QR sadržaj deep link (a ne URL), i — najvažnije — da se tokeni predaju
 * tačno jednom, jer bi drugo preuzimanje značilo drugu sesiju na TV-u.
 */

jest.mock('react-native-qrcode-svg', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ value }: { value: string }) => <Text>QR:{value}</Text>,
  };
});

// Jest ne može da izračuna `setInterval` u fake okruženju bez ovoga.
jest.useFakeTimers();

function setup(
  overrides: Partial<React.ComponentProps<typeof TvPairingScreen>> = {},
) {
  const requestCode = jest.fn(async () => ({
    code: 'ABCD2345',
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
  }));
  const pollCode = jest.fn(async () => ({ status: 'PENDING' as const }));
  const getPushToken = jest.fn(async () => 'ExponentPushToken[abc]');
  const onPaired = jest.fn();

  const props = {
    requestCode,
    pollCode,
    getPushToken,
    onPaired,
    ...overrides,
  };

  return { props, requestCode, pollCode, getPushToken, onPaired };
}

describe('TV uparivanje', () => {
  it('prikazuje HTTP status ako backend odbije zahtjev za kod', async () => {
    const { props } = setup({
      requestCode: jest.fn(async () => {
        throw { response: { status: 404 } };
      }),
    });
    await render(<TvPairingScreen {...props} />);
    await act(async () => {
      fireEvent.press(screen.getByText('Upari TV'));
    });
    expect(
      screen.getByText(/API nije pronašao rutu za uparivanje \(HTTP 404\)/),
    ).toBeTruthy();
  });

  it('prikazuje kod i QR koji nosi deep link, ne URL', async () => {
    const { props } = setup();
    // RTL 14: `render` je asinhron — bez `await` svaki `screen.*` padne sa
    // „`render` function has not been called".
    await render(<TvPairingScreen {...props} />);

    /*
     * `fireEvent.press` umjesto direktnog poziva `props.onPress`: dugme je
     * `Pressable` (mora primati fokus na TV-u), pa se ovako provjerava i da
     * je element stvarno pritisnut — a ne samo da handler postoji.
     */
    await act(async () => {
      fireEvent.press(screen.getByText('Upari TV'));
    });

    // Kod se čita iz daljine: razmak, ne crtica.
    expect(screen.getByText('ABCD 2345')).toBeTruthy();
    // QR nosi deep link aplikacije, NE URL — obična kamera ne smije otvoriti
    // browser na stranicu koja ne može dovršiti odobrenje.
    expect(
      screen.getByText('QR:boilercontrol://tv-pair?code=ABCD2345'),
    ).toBeTruthy();
    const scroll = screen.getByTestId('tv-pairing-scroll-container');
    expect(scroll.props.scrollEnabled).toBe(true);
    expect(scroll.props.focusable).toBe(true);
  });

  it('push token ide UZ zahtjev za kod — TV ne smije drugi POST', async () => {
    const { props, requestCode, getPushToken } = setup();
    await render(<TvPairingScreen {...props} />);

    /*
     * `fireEvent.press` umjesto direktnog poziva `props.onPress`: dugme je
     * `Pressable` (mora primati fokus na TV-u), pa se ovako provjerava i da
     * je element stvarno pritisnut — a ne samo da handler postoji.
     */
    await act(async () => {
      fireEvent.press(screen.getByText('Upari TV'));
    });

    expect(getPushToken).toHaveBeenCalledTimes(1);
    // Ovo je srž: token je argument zahtjeva za kod, ne zaseban poziv.
    expect(requestCode).toHaveBeenCalledWith('ExponentPushToken[abc]');
  });

  it('bez push tokena uparivanje i dalje počinje', async () => {
    // TV bez Play usluga mora moći prikazati analitiku, samo bez notifikacija.
    const { props, requestCode } = setup({
      getPushToken: jest.fn(async () => null),
    });
    await render(<TvPairingScreen {...props} />);

    /*
     * `fireEvent.press` umjesto direktnog poziva `props.onPress`: dugme je
     * `Pressable` (mora primati fokus na TV-u), pa se ovako provjerava i da
     * je element stvarno pritisnut — a ne samo da handler postoji.
     */
    await act(async () => {
      fireEvent.press(screen.getByText('Upari TV'));
    });

    expect(requestCode).toHaveBeenCalledWith(null);
    expect(screen.getByText('ABCD 2345')).toBeTruthy();
  });

  it('greška pri dobijanju push tokena ne sprječava uparivanje', async () => {
    const { props, requestCode } = setup({
      getPushToken: jest.fn(async () => {
        throw new Error('nema Play usluga');
      }),
    });
    await render(<TvPairingScreen {...props} />);

    /*
     * `fireEvent.press` umjesto direktnog poziva `props.onPress`: dugme je
     * `Pressable` (mora primati fokus na TV-u), pa se ovako provjerava i da
     * je element stvarno pritisnut — a ne samo da handler postoji.
     */
    await act(async () => {
      fireEvent.press(screen.getByText('Upari TV'));
    });

    expect(requestCode).toHaveBeenCalledWith(null);
  });

  it('kad telefon odobri, tokeni se predaju TAČNO jednom', async () => {
    const pollCode = jest
      .fn()
      .mockResolvedValueOnce({ status: 'PENDING' })
      .mockResolvedValue({
        status: 'READY',
        token: 'access-7',
        refreshToken: 'refresh-7',
        userId: 7,
      });
    const { props, onPaired } = setup({ pollCode });
    await render(<TvPairingScreen {...props} />);

    /*
     * `fireEvent.press` umjesto direktnog poziva `props.onPress`: dugme je
     * `Pressable` (mora primati fokus na TV-u), pa se ovako provjerava i da
     * je element stvarno pritisnut — a ne samo da handler postoji.
     */
    await act(async () => {
      fireEvent.press(screen.getByText('Upari TV'));
    });

    // Dva intervala: drugi odgovor je READY, treći bi bio CLAIMED.
    await act(async () => {
      jest.advanceTimersByTime(2000);
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    await waitFor(() => expect(onPaired).toHaveBeenCalledTimes(1));
    expect(onPaired).toHaveBeenCalledWith({
      token: 'access-7',
      refreshToken: 'refresh-7',
      userId: 7,
    });
    expect(screen.getByText('TV je uparen')).toBeTruthy();
  });

  it('istekao kod prikazuje poruku i novi kod, ne vječno čekanje', async () => {
    const { props, onPaired } = setup({
      requestCode: jest.fn(async () => ({
        code: 'ABCD2345',
        // Kod je već istekao — TV to mora primijetiti bez mreže.
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      })),
    });
    await render(<TvPairingScreen {...props} />);

    /*
     * `fireEvent.press` umjesto direktnog poziva `props.onPress`: dugme je
     * `Pressable` (mora primati fokus na TV-u), pa se ovako provjerava i da
     * je element stvarno pritisnut — a ne samo da handler postoji.
     */
    await act(async () => {
      fireEvent.press(screen.getByText('Upari TV'));
    });
    await act(async () => {
      jest.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(screen.getByText('Kod je istekao')).toBeTruthy();
    expect(screen.getByText('Novi kod')).toBeTruthy();
    // Neupareni TV ne smije se predstaviti kao uparen.
    expect(onPaired).not.toHaveBeenCalled();
  });

  it('pad mreže ne obara stanje — TV nastavlja pitati', async () => {
    const pollCode = jest
      .fn()
      .mockRejectedValueOnce(new Error('mreža'))
      .mockResolvedValue({ status: 'PENDING' });
    const { props } = setup({ pollCode });
    await render(<TvPairingScreen {...props} />);

    /*
     * `fireEvent.press` umjesto direktnog poziva `props.onPress`: dugme je
     * `Pressable` (mora primati fokus na TV-u), pa se ovako provjerava i da
     * je element stvarno pritisnut — a ne samo da handler postoji.
     */
    await act(async () => {
      fireEvent.press(screen.getByText('Upari TV'));
    });

    await act(async () => {
      jest.advanceTimersByTime(2000 * 3);
      await Promise.resolve();
    });

    expect(screen.getByText('ABCD 2345')).toBeTruthy();
    expect(screen.queryByText('Greška')).toBeNull();
  });
});
