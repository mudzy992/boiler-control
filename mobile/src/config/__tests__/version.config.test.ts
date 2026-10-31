/**
 * MO2-8 (MO-012): prvi izvršni testovi u mobilnoj aplikaciji.
 *
 * Prije ovog fajla `mobile/` nije imao nijedan test (`npm test` → exit 127,
 * `jest: not found`), pa nijedna tvrdnja o mobilnoj logici nije bila provjerljiva.
 *
 * Cilj je namjerno `version.config.ts` (MO2-2): to je čista logika bez UI-ja, a
 * nosi **fail-open** ugovor koji je sigurnosno najosjetljiviji u aplikaciji —
 * gate koji fail-uje na „zatvoreno" pretvorio bi svaki backend kvar u
 * neupotrebljivu aplikaciju.
 */

import axios from 'axios';
import * as Application from 'expo-application';
import Constants from 'expo-constants';

import {
  checkVersionGate,
  compareVersions,
  getAppVersion,
} from '../version.config';

jest.mock('axios');
jest.mock('expo-application', () => ({ nativeApplicationVersion: null }));

/**
 * Dvije zamke koje su ovdje morale biti riješene (obje su prvo slomile suite):
 *
 * 1. `__esModule: true` je OBAVEZAN. Bez njega babel-ov
 *    `_interopRequireDefault` omota vraćeni objekt još jednom, pa `Constants`
 *    postane `{ default: {...} }` i `Constants.expoConfig` bude `undefined`.
 *
 * 2. Factory NE SMJE referencirati vanjsku varijablu. `api.config.ts` čita
 *    `Constants.manifest` pri samom **importu** (top-level `API_CONFIG.BASE_URL`),
 *    a `babel-plugin-jest-hoist` diže `jest.mock` iznad deklaracije konstanti i
 *    babel pretvara `const` u `var` — pa je varijabla u tom trenutku
 *    `undefined`, ne TDZ greška. Zato je objekt literal unutar factory-ja, a
 *    mutacija ide preko importovanog modula.
 */
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { version: null as string | null },
    manifest: null,
  },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

/** Postavi verziju koju „instalirani build" prijavljuje. */
function setNativeVersion(value: string | null) {
  (Application as { nativeApplicationVersion: string | null }).nativeApplicationVersion = value;
}

/** Postavi verziju iz `expoConfig` (fallback kad native build ne postoji). */
function setExpoConfigVersion(value: string | null) {
  (
    Constants as unknown as { expoConfig: { version: string | null } }
  ).expoConfig.version = value;
}

beforeEach(() => {
  setNativeVersion(null);
  setExpoConfigVersion(null);
  jest.resetAllMocks();
});

describe('compareVersions', () => {
  it('jednake verzije daju 0', () => {
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
  });

  it('manja verzija daje negativno', () => {
    expect(compareVersions('1.2.3', '1.2.4')).toBeLessThan(0);
    expect(compareVersions('1.9.9', '2.0.0')).toBeLessThan(0);
  });

  it('veća verzija daje pozitivno', () => {
    expect(compareVersions('1.2.4', '1.2.3')).toBeGreaterThan(0);
    expect(compareVersions('2.0.0', '1.9.9')).toBeGreaterThan(0);
  });

  it('poredi numerički, ne leksikografski', () => {
    // Leksikografski bi "10" < "9"; numerički je 10 > 9.
    expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
  });

  it('nedostajući segment tretira kao 0', () => {
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
  });
});

describe('getAppVersion', () => {
  it('koristi native verziju kad postoji', () => {
    setNativeVersion('2.1.0');
    expect(getAppVersion()).toBe('2.1.0');
  });

  it('trim-uje native verziju', () => {
    setNativeVersion('  2.1.0  ');
    expect(getAppVersion()).toBe('2.1.0');
  });

    it('pada na expoConfig kad native nedostaje', () => {
      setExpoConfigVersion('1.5.0');
      expect(getAppVersion()).toBe('1.5.0');
    });

  it('vraća 0.0.0 kad nijedan izvor nema verziju', () => {
    expect(getAppVersion()).toBe('0.0.0');
  });
});

describe('checkVersionGate — fail-open ugovor', () => {
  const gateResponse = (data: unknown) => {
    mockedAxios.get.mockResolvedValue({ data } as never);
  };

  it('BLOKIRA samo kad backend nedvosmisleno kaže da je verzija premala', async () => {
    setNativeVersion('1.0.0');
    gateResponse({
      minSupportedVersion: '2.0.0',
      latestVersion: '2.0.0',
      versionGateEnabled: true,
    });

    const result = await checkVersionGate();

    expect(result.mustUpdate).toBe(true);
    expect(result.verifiedByBackend).toBe(true);
    expect(result.minSupportedVersion).toBe('2.0.0');
  });

  it('PUŠTA kad je verzija dovoljno nova', async () => {
    setNativeVersion('2.1.0');
    gateResponse({
      minSupportedVersion: '2.0.0',
      latestVersion: '2.1.0',
      versionGateEnabled: true,
    });

    const result = await checkVersionGate();

    expect(result.mustUpdate).toBe(false);
    expect(result.verifiedByBackend).toBe(true);
  });

  it('FAIL-OPEN: mrežni pad ne blokira korisnika', async () => {
    setNativeVersion('1.0.0');
    mockedAxios.get.mockRejectedValue(new Error('Network Error'));

    const result = await checkVersionGate();

    expect(result.mustUpdate).toBe(false);
    expect(result.verifiedByBackend).toBe(false);
  });

  it('FAIL-OPEN: HTTP 500 ne blokira korisnika', async () => {
    setNativeVersion('1.0.0');
    mockedAxios.get.mockRejectedValue(new Error('Request failed with status code 500'));

    const result = await checkVersionGate();

    expect(result.mustUpdate).toBe(false);
  });

  it('FAIL-OPEN: neispravan semver s backenda ne blokira', async () => {
    setNativeVersion('1.0.0');
    gateResponse({
      minSupportedVersion: 'najnovija',
      latestVersion: 'x',
      versionGateEnabled: true,
    });

    const result = await checkVersionGate();

    expect(result.mustUpdate).toBe(false);
    expect(result.verifiedByBackend).toBe(false);
  });

    it('FAIL-OPEN: nepoznata lokalna verzija ne blokira i ne zove backend', async () => {
      // 'dev-build' NIJE strogi semver, pa gate ne može dokazati da je prestara
      // i mora fail-open-ovati bez ijednog mrežnog poziva.
      setExpoConfigVersion('dev-build');

    const result = await checkVersionGate();

    expect(result.mustUpdate).toBe(false);
    expect(result.verifiedByBackend).toBe(false);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('kill switch: versionGateEnabled=false pušta i označava kao verificirano', async () => {
    setNativeVersion('0.0.1');
    gateResponse({
      minSupportedVersion: '9.9.9',
      latestVersion: '9.9.9',
      versionGateEnabled: false,
    });

    const result = await checkVersionGate();

    expect(result.mustUpdate).toBe(false);
    expect(result.verifiedByBackend).toBe(true);
  });

  it('FAIL-OPEN: null odgovor ne blokira', async () => {
    setNativeVersion('1.0.0');
    gateResponse(null);

    const result = await checkVersionGate();

    expect(result.mustUpdate).toBe(false);
    expect(result.verifiedByBackend).toBe(false);
  });
});
