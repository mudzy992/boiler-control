/**
 * `APP_VERSION` — verzija koju TV poredi sa serverom.
 *
 * Ako ova vrijednost ne postoji ili je prazna, provjera nove verzije **tiho
 * ne radi**: `newVersionAvailable` vrati `null` jer ne može uporediti, i TV
 * nikad ne kaže da postoji update. To je kvar koji se ne vidi — ekran izgleda
 * potpuno ispravno.
 */
describe('APP_VERSION', () => {
  it('dolazi iz expo config-a, ne iz ruke upisanog stringa', () => {
    jest.resetModules();
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: { expoConfig: { version: '3.2.1' } },
    }));

    const { APP_VERSION } = require('../../config');
    expect(APP_VERSION).toBe('3.2.1');
  });

  it('kad verzije nema, vrijednost je prazna — i to je predvidjeno, ne rusenje', () => {
    jest.resetModules();
    jest.doMock('expo-constants', () => ({ __esModule: true, default: {} }));

    const { APP_VERSION } = require('../../config');
    expect(APP_VERSION).toBe('');
  });
});
