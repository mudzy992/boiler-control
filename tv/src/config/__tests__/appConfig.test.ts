/**
 * Konfiguracija TV gradnje.
 *
 * Provjerava se **uslovljavanje**, ne vrijednosti: TV plugin se mora dodati
 * samo kad je `EXPO_TV=1`. Bez testa bi neko mogao „pojednostaviti" uslov i
 * tiho pokvariti `prebuild` — a to se vidi tek na gradle build-u.
 */

describe('app.config.js', () => {
  const originalEnv = process.env.EXPO_TV;

  afterEach(() => {
    process.env.EXPO_TV = originalEnv;
    jest.resetModules();
  });

  function load() {
    jest.resetModules();
    return require('../../../app.config.js');
  }

  it('bez EXPO_TV nema TV plugina — običan prebuild ostaje običan', () => {
    delete process.env.EXPO_TV;
    const config = load();
    expect(config.plugins).toEqual(['expo-notifications']);
  });

  it('sa EXPO_TV=1 dodaje se config-tv plugin sa isTV: true', () => {
    process.env.EXPO_TV = '1';
    const config = load();
    expect(config.plugins).toContainEqual([
      '@react-native-tvos/config-tv',
      { isTV: true },
    ]);
  });

  it('TV aplikacija je zaključana na landscape i tamnu pozadinu', () => {
    // TV visi na zidu: portret nema smisla, a svijetli ekran je reflektor.
    const config = load();
    expect(config.orientation).toBe('landscape');
    expect(config.backgroundColor).toBe('#05070b');
  });

  it('API base zadano odgovara javnom /api endpointu', () => {
    const { API_BASE_URL } = require('../../config');
    expect(API_BASE_URL).toMatch(/^https:\/\/api\.boiler-control\.ba101\.top\/api$/);
  });

  it('koristi brand boje iz mobilne dark teme', () => {
    const { colors } = require('../../theme');
    expect(colors).toMatchObject({
      background: '#05070b',
      surface: '#0b0f16',
      raised: '#111723',
      text: '#e8edf4',
      accent: '#ff6b3d',
      fault: '#f87171',
    });
  });

  it('koristi istu aplikacijsku i adaptive ikonicu kao mobilna', () => {
    const config = load();
    expect(config.icon).toBe('./assets/boiler-control-icon-master.png');
    expect(config.android.adaptiveIcon).toEqual({
      foregroundImage: './assets/ic_launcher_foreground.png',
      backgroundImage: './assets/ic_launcher_background.png',
      monochromeImage: './assets/ic_launcher_monochrome.png',
      backgroundColor: '#ffffff',
    });
  });

  it('koristi Firebase config za registrovani TV package ID', () => {
    const config = load();
    expect(config.android.package).toBe('com.boilercontrol.tv');
    expect(config.android.googleServicesFile).toBe('./assets/google-services.json');
  });

  it('deklarira Buffer polyfill potreban react-native-svg QR bundleu', () => {
    const packageJson = require('../../../package.json');
    expect(packageJson.dependencies.buffer).toBeDefined();
  });

  it('EAS ID je upisan u dinamičku konfiguraciju za credentials CLI', () => {
    const config = load();
    expect(config.extra.eas.projectId).toBe(
      '5e53f78e-129d-4505-94f5-880fde2867cc',
    );
  });
});
