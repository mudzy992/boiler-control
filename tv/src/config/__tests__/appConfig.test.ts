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
    expect(config.backgroundColor).toBe('#0B1418');
  });

  it('koristi Firebase config za registrovani TV package ID', () => {
    const config = load();
    expect(config.android.package).toBe('com.boilercontrol.tv');
    expect(config.android.googleServicesFile).toBe('./assets/google-services.json');
  });

  it('push traži projectId iz okoline, ne iz repoa', () => {
    process.env.EAS_PROJECT_ID = 'abc-123';
    const config = load();
    expect(config.extra.eas.projectId).toBe('abc-123');
    delete process.env.EAS_PROJECT_ID;
  });
});
