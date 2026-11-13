import { weatherHttpTimeoutMs } from '../weather-http.adapter';

/**
 * Timeout mora biti **podesiv**, ali ne smije se pokvariti tiho.
 *
 * Zašto test postoji: `GET /api/dashboard` u ugovornim testovima zove pravi
 * Open-Meteo (nema mock-a mreže). Kad je provajder spor, jedan zahtjev čeka
 * do timeouta, a dashboard je u tom lancu tri puta — pa suite pređe
 * `testTimeout: 30000` i padne kao „exceeded timeout", iako kod nije
 * pogrešan. CI zato spušta timeout preko `WEATHER_HTTP_TIMEOUT_MS`.
 *
 * Test pokriva **granicu odbijanja**, ne samo sretnu vrijednost: `0`, `NaN` i
 * negativan broj moraju pasti na zadano. Timeout od `0` u axios-u nije
 * „nula milisekundi" nego **bez timeouta** — najgori ishod od svega, jer se
 * čeka vječno umjesto da se brzo padne.
 */
describe('weatherHttpTimeoutMs', () => {
  it('zadano je 10 000 kad env nije postavljen', () => {
    expect(weatherHttpTimeoutMs(undefined)).toBe(10_000);
  });

  it('prazan string daje zadano, ne nulu', () => {
    expect(weatherHttpTimeoutMs('')).toBe(10_000);
    expect(weatherHttpTimeoutMs('   ')).toBe(10_000);
  });

  it('vrijedan broj se poštuje', () => {
    expect(weatherHttpTimeoutMs('1500')).toBe(1500);
    expect(weatherHttpTimeoutMs('250')).toBe(250);
  });

  it('decimalan broj se siječe na cijeli', () => {
    expect(weatherHttpTimeoutMs('1500.9')).toBe(1500);
  });

  /*
   * Ovo je suština: `0` u axios-u znači BEZ timeouta, pa bi „poštujemo 0"
   * bila najgora moguća interpretacija. Isto za negativno i za `NaN`.
   */
  it.each(['0', '-1', '-5000', 'abc', 'NaN', 'Infinity'])(
    'neispravno "%s" pada na zadano umjesto da postane 0 ili NaN',
    (raw) => {
      expect(weatherHttpTimeoutMs(raw)).toBe(10_000);
    },
  );

  it('vrijednost nikad nije 0 ni NaN za bilo koji ulaz', () => {
    for (const raw of ['0', '', 'x', '-1', 'abc', '2000']) {
      const value = weatherHttpTimeoutMs(raw);
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    }
  });
});
