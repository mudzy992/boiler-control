/**
 * Test za `InteractionManager` shim iz `src/polyfills.ts`.
 *
 * Ovo je jedini dio F5 koji se ne može provjeriti snapshotom: RN 0.88 getter
 * baca izuzetak, pa se ponašanje mora simulirati. Test pravi modul sa istim
 * descriptorom kakav ima `react-native` (getter koji baca) i provjerava da
 * shim vrati funkcionalan API — a ne da samo „proguta" grešku.
 */

type Shim = {
  runAfterInteractions: (task?: (() => void) | { run: () => void }) => { cancel: () => void };
  createInteractionHandle: () => number;
  clearInteractionHandle: (handle: number) => void;
  setDeadline: () => void;
};

const loadPolyfillsWithFakeReactNative = () => {
  let fake: Record<string, unknown> = {};
  Object.defineProperty(fake, 'InteractionManager', {
    configurable: true,
    get() {
      throw new Error('InteractionManager has been removed from react-native core.');
    },
  });

  jest.isolateModules(() => {
    jest.doMock('react-native', () => fake);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../../polyfills');
  });

  return fake as Record<string, unknown> & { InteractionManager: Shim };
};

describe('InteractionManager shim', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.dontMock('react-native');
  });

  it('zamjenjuje getter koji baca funkcionalnim API-jem', () => {
    const fake = loadPolyfillsWithFakeReactNative();

    expect(() => fake.InteractionManager).not.toThrow();
    expect(typeof fake.InteractionManager.runAfterInteractions).toBe('function');
    expect(typeof fake.InteractionManager.createInteractionHandle).toBe('function');
    expect(typeof fake.InteractionManager.clearInteractionHandle).toBe('function');
    expect(typeof fake.InteractionManager.setDeadline).toBe('function');
  });

  it('runAfterInteractions izvršava posao (i object oblik sa run())', () => {
    const fake = loadPolyfillsWithFakeReactNative();
    const first = jest.fn();
    const second = jest.fn();

    fake.InteractionManager.runAfterInteractions(first);
    fake.InteractionManager.runAfterInteractions({ run: second });

    expect(first).not.toHaveBeenCalled();
    jest.runAllTimers();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('cancel uklanja posao iz reda', () => {
    const fake = loadPolyfillsWithFakeReactNative();
    const task = jest.fn();

    const handle = fake.InteractionManager.runAfterInteractions(task);
    handle.cancel();
    jest.runAllTimers();

    expect(task).not.toHaveBeenCalled();
  });

  it('greška u jednom poslu ne sprječava ostale', () => {
    const fake = loadPolyfillsWithFakeReactNative();
    const after = jest.fn();

    fake.InteractionManager.runAfterInteractions(() => {
      throw new Error('boom');
    });
    fake.InteractionManager.runAfterInteractions(after);
    jest.runAllTimers();

    expect(after).toHaveBeenCalledTimes(1);
  });

  it('ne dira već postojeću implementaciju', () => {
    const real = {
      runAfterInteractions: jest.fn(),
      createInteractionHandle: jest.fn(),
      clearInteractionHandle: jest.fn(),
      setDeadline: jest.fn(),
    };
    const fake: Record<string, unknown> = { InteractionManager: real };

    jest.isolateModules(() => {
      jest.doMock('react-native', () => fake);
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../../polyfills');
    });

    expect(fake.InteractionManager).toBe(real);
    jest.dontMock('react-native');
  });
});
