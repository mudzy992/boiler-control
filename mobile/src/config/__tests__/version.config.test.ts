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
  isNewerRelease,
  releaseDownloadUrl,
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

/**
 * `F15`: novija verzija se nudi, ali ne blokira dok je verzija podržana.
 *
 * Test čuva granicu između dvije stvari koje se lako pobrkaju: „postoji novija
 * verzija" (ponuda) i „ova verzija više ne smije raditi" (blokada). Prvo je
 * `updateAvailable`, drugo je `mustUpdate`.
 */
describe('checkVersionGate — F15 ponuda nove verzije', () => {
  /**
   * `gateResponse` u gornjem `describe`-u je u lokalnom opsegu (tamo je i
   * definisan). Ovdje treba vlastiti jer `jest.mock` factory ne smije
   * referencirati vanjske varijable — pa se odgovor postavlja eksplicitno.
   */
  const gateResponse = (data: unknown) => {
    mockedAxios.get.mockResolvedValue({ data });
  };

  const release = (version: string) => ({
    version,
    buildNumber: 1400,
    sizeBytes: 12_000_000,
    notes: null,
    downloadUrl: '/api/app-releases/3/apk',
    publishedAt: '2026-11-20T09:00:00.000Z',
  });

  it('nudi ažuriranje kad je objavljena verzija novija, bez blokade', async () => {
    setNativeVersion('1.0.0');
    gateResponse({
      minSupportedVersion: '1.0.0',
      latestVersion: '1.4.0',
      versionGateEnabled: true,
      latestRelease: release('1.4.0'),
    });

    const result = await checkVersionGate();

    expect(result.mustUpdate).toBe(false);
    expect(result.updateAvailable).toBe(true);
    expect(result.release?.version).toBe('1.4.0');
  });

  it('ista verzija nije „nova" — nema ponude', async () => {
    setNativeVersion('1.4.0');
    gateResponse({
      minSupportedVersion: '1.0.0',
      latestVersion: '1.4.0',
      versionGateEnabled: true,
      latestRelease: release('1.4.0'),
    });

    expect((await checkVersionGate()).updateAvailable).toBe(false);
  });

  it('objavljena starija verzija se ne nudi (nije downgrade)', async () => {
    setNativeVersion('1.5.0');
    gateResponse({
      minSupportedVersion: '1.0.0',
      latestVersion: '1.4.0',
      versionGateEnabled: true,
      latestRelease: release('1.4.0'),
    });

    const result = await checkVersionGate();
    expect(result.updateAvailable).toBe(false);
    expect(result.release).toBeNull();
  });

  it('blokada i ponuda mogu stajati zajedno', async () => {
    setNativeVersion('1.0.0');
    gateResponse({
      minSupportedVersion: '1.2.0',
      latestVersion: '1.4.0',
      versionGateEnabled: true,
      latestRelease: release('1.4.0'),
    });

    expect(await checkVersionGate()).toMatchObject({
      mustUpdate: true,
      updateAvailable: true,
    });
  });

  it('FAIL-OPEN: pad mreže ne nudi ništa (nema podatka, nema tvrdnje)', async () => {
    setNativeVersion('1.0.0');
    mockedAxios.get.mockRejectedValue(new Error('offline'));

    const result = await checkVersionGate();
    expect(result.updateAvailable).toBe(false);
    expect(result.release).toBeNull();
  });
});

describe('isNewerRelease / releaseDownloadUrl', () => {
  const base = {
    version: '1.4.0',
    buildNumber: 1,
    sizeBytes: 1,
    notes: null,
    downloadUrl: '/api/app-releases/3/apk',
    publishedAt: '2026-11-20T09:00:00.000Z',
  };

  it('poredi strogo semver; nepoznata verzija nije nova', () => {
    expect(isNewerRelease('1.3.0', base)).toBe(true);
    expect(isNewerRelease('1.4.0', base)).toBe(false);
    expect(isNewerRelease('dev-build', base)).toBe(false);
    expect(isNewerRelease('1.0.0', null)).toBe(false);
  });

  it('download URL se lijepi na API bazu bez duplog /api', () => {
    // Relativna putanja iz backend-a + baza klijenta = jedna `/api` putanja.
    expect(releaseDownloadUrl(base)).toMatch(/\/api\/app-releases\/3\/apk$/);
    expect(releaseDownloadUrl(base)).not.toMatch(/\/api\/api\//);
  });
});
