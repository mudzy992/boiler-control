/**
 * CLI ugovor skripte — ono što se može provjeriti bez Androida.
 *
 * Meni se ne testira (traži terminal i čovjeka), ali **ulazi** moraju raditi:
 * `--versions` i `--check` su jedini način da se stanje vidi iz CI-ja ili iz
 * druge skripte. Ako se pokvare, meni i dalje izgleda ispravno.
 */
'use strict';

const { execFileSync } = require('node:child_process');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '../../..');
const SCRIPT = path.join(REPO_ROOT, 'scripts/build/build-menu.sh');

function run(...args) {
  return execFileSync('bash', [SCRIPT, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
}

describe('build-menu.sh', () => {
  it('--help ispiše upotrebu i izađe sa 0', () => {
    const out = run('--help');
    expect(out).toMatch(/--versions/);
    expect(out).toMatch(/interaktivni meni/);
  });

  it('--versions ispiše verziju i versionCode obje aplikacije', () => {
    const out = run('--versions');
    expect(out).toMatch(/mobile/);
    expect(out).toMatch(/tv/);
    // Formula mora biti vidljiva: bez nje čovjek ne zna odakle broj.
    expect(out).toMatch(/major\*10000/);
  });

  it('verzije u izlazu odgovaraju package.json', () => {
    const mobilePkg = require(path.join(REPO_ROOT, 'mobile/package.json'));
    const tvPkg = require(path.join(REPO_ROOT, 'tv/package.json'));
    const out = run('--versions');
    expect(out).toContain(mobilePkg.version);
    expect(out).toContain(tvPkg.version);
  });

  it('--check uvijek izađe sa 0 (nedostatak alata je upozorenje, ne pad)', () => {
    // Skripta se koristi i na mašini bez Androida: dev server mora raditi.
    // Da `--check` pada, ne bi se mogao koristiti kao predprovjera.
    const out = run('--check');
    expect(out).toMatch(/node/);
    expect(out).toMatch(/node_modules|Mobile|mobile/);
  });

  it('meni nudi EAS cloud build za mobilnu i TV aplikaciju', () => {
    const source = require('node:fs').readFileSync(SCRIPT, 'utf8');
    expect(source).toMatch(/10\) EAS production APK/);
    expect(source).toMatch(/11\) EAS production APK/);
    expect(source).toMatch(/12\) EAS production APK/);
    expect(source).toMatch(/13\) EAS production APK/);
    expect(source).toMatch(/--local --output/);
    const mobileEas = require(path.join(REPO_ROOT, 'mobile/eas.json'));
    expect(mobileEas.build.production.android.buildType).toBe('apk');
    expect(mobileEas.cli.appVersionSource).toBe('local');
    expect(mobileEas.build.production.autoIncrement).toBe(false);
    const tvEas = require(path.join(REPO_ROOT, 'tv/eas.json'));
    const tvProfile = tvEas.build.production;
    expect(tvProfile.android.buildType).toBe('apk');
    expect(tvProfile.env.EXPO_TV).toBe('1');
    expect(tvEas.cli.appVersionSource).toBe('local');
    expect(tvProfile.autoIncrement).toBe(false);
  });
});
