import axios from 'axios';
import {
  createTvClient,
  requestPairingCode,
  TV_ENDPOINTS,
  TvWriteBlockedError,
} from '../client';

/**
 * **Ovo je najvažniji test TV aplikacije.**
 *
 * Zahtjev korisnika je bio doslovno „aplikacija ne radi nijedan PUT ni POST".
 * Tvrdnja se ne provjerava čitanjem koda — provjerava se tako što se pokuša
 * pisati i vidi da zahtjev **ne ode**.
 *
 * Ako ovaj test ikad padne, TV može promijeniti stanje kotla, a to je jedina
 * stvar koju TV ne smije nikad.
 */

jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  const mockInstance = {
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
    request: jest.fn(),
    get: jest.fn(),
  };
  const create = jest.fn(() => mockInstance);
  return { __esModule: true, default: { ...actual, create }, create };
});

const mockedAxios = axios as unknown as { create: jest.Mock };

/** Minimalna zamjena za `AxiosHeaders` — dovoljna za `set`/`get` u testu. */
class Headers0 {
  private map = new Map<string, string>();
  set(k: string, v: string) {
    this.map.set(k.toLowerCase(), v);
    return this;
  }
  get(k: string) {
    return this.map.get(k.toLowerCase());
  }
}

/** Uzmi pravi request interceptor koji je klijent registrovao. */
function registeredRequestInterceptor() {
  const instance = mockedAxios.create.mock.results.at(-1)!.value;
  // axios: `use(onFulfilled, onRejected)` — fulfilled je PRVI argument.
  const [onFulfilled] = instance.interceptors.request.use.mock.calls.at(-1)!;
  return { instance, onFulfilled };
}

describe('TV klijent je samo za čitanje', () => {
  beforeEach(() => {
    mockedAxios.create.mockClear();
  });

  it('GET rute su relativne API base-u koji već završava sa /api', async () => {
    const client = createTvClient({
      baseUrl: 'https://api.example.com/api',
      getToken: () => null,
    });
    const { onFulfilled } = registeredRequestInterceptor();

    expect(TV_ENDPOINTS.pairingSession).toBe('/tv-pairing/sessions');
    expect(TV_ENDPOINTS.dashboard).toBe('/dashboard');
    expect(TV_ENDPOINTS.gasAnalysis).toBe('/gas/analysis');
    expect(TV_ENDPOINTS.releaseLatest).toBe('/app-releases/latest');
    const config = {
      method: 'get',
      url: TV_ENDPOINTS.gasAnalysis,
      headers: new Headers0(),
    };
    // Interceptor vraća config sinhrono kad zahtjev prolazi (Promise samo za odbijene).
    expect(onFulfilled(config)).toBe(config);
    expect(client).toBeDefined();
  });

  it('POST kod za uparivanje ne registruje push token', async () => {
    const response = {
      data: { code: 'ABCD2345', expiresAt: '2030-01-01T00:00:00.000Z' },
    };
    const post = jest.spyOn(axios, 'post').mockResolvedValue(response as never);

    await expect(
      requestPairingCode('https://api.example.com/api', {
        deviceLabel: 'Android TV',
      }),
    ).resolves.toEqual(response.data);

    expect(post).toHaveBeenCalledWith(
      'https://api.example.com/api/tv-pairing/sessions',
      { deviceLabel: 'Android TV' },
      { timeout: 15_000 },
    );
    post.mockRestore();
  });

  it('odbija neispravan pairing JSON umjesto da ga proslijedi UI-ju', async () => {
    const post = jest.spyOn(axios, 'post').mockResolvedValue({ data: { code: '', expiresAt: 'neispravan' } } as never);
    await expect(
      requestPairingCode('https://api.example.com/api', {}),
    ).rejects.toThrow('neispravan odgovor za pairing kod');
    post.mockRestore();
  });

  it.each(['post', 'put', 'patch', 'delete'])(
    '%s je odbijen prije slanja',
    async (method) => {
      createTvClient({
        baseUrl: 'https://api.example.com',
        getToken: () => null,
      });
      const { onFulfilled } = registeredRequestInterceptor();

      await expect(
        onFulfilled({
          method,
          url: '/api/boiler/mode',
          headers: new Headers0(),
        }),
      ).rejects.toBeInstanceOf(TvWriteBlockedError);
    },
  );

  it('metoda koja nije zadana tretira se kao GET (axios tako radi)', async () => {
    createTvClient({
      baseUrl: 'https://api.example.com',
      getToken: () => null,
    });
    const { onFulfilled } = registeredRequestInterceptor();

    expect(
      onFulfilled({ url: '/health', headers: new Headers0() }),
    ).toBeDefined();
  });

  it('post/put/patch/delete padaju bučno, ne tiho', () => {
    // Druga linija odbrane: čak i poziv zaobiđen kroz `instance.request` sa
    // varijablom kao metodom pada bučno, ne tiho.
    const client = createTvClient({
      baseUrl: 'https://api.example.com',
      getToken: () => null,
    }) as unknown as Record<string, unknown>;

    for (const verb of ['post', 'put', 'patch', 'delete']) {
      expect(typeof client[verb]).toBe('function');
      expect(() => (client[verb] as () => void)()).toThrow(TvWriteBlockedError);
    }
  });

  it('token se dodaje kad postoji, ne dodaje se kad je null', () => {
    let token: string | null = null;
    createTvClient({ baseUrl: '', getToken: () => token });
    const { onFulfilled } = registeredRequestInterceptor();

    const without = { method: 'get', url: '/x', headers: new Headers0() };
    onFulfilled(without);
    expect(without.headers.get('Authorization')).toBeUndefined();

    token = 'access-7';
    const withToken = { method: 'get', url: '/x', headers: new Headers0() };
    onFulfilled(withToken);
    expect(withToken.headers.get('Authorization')).toBe('Bearer access-7');
  });

  it('401 znači da je sesija opozvana — poziva se onUnauthorized', async () => {
    const onUnauthorized = jest.fn();
    createTvClient({ baseUrl: '', getToken: () => 'x', onUnauthorized });
    const instance = mockedAxios.create.mock.results.at(-1)!.value;
    const [, onRejected] =
      instance.interceptors.response.use.mock.calls.at(-1)!;

    await expect(
      onRejected({ response: { status: 500 } }),
    ).rejects.toBeDefined();
    expect(onUnauthorized).not.toHaveBeenCalled();

    await expect(
      onRejected({ response: { status: 401 } }),
    ).rejects.toBeDefined();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});
