/**
 * Verzije — logika koju build skripta koristi.
 *
 * Ovdje se ne testira CLI, nego **odluke**: šta je sljedeća verzija, šta se
 * odbija, i da li `package-lock.json` ide uz `package.json`. Ako ovo padne,
 * build bi izdao APK sa pogrešnim (ili nepromijenjenim) brojem.
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  bumpVersion,
  parseVersion,
  setVersion,
  versionCode,
  restoreVersion,
} = require('../versions');

describe('inkrement verzije', () => {
  it('patch diže samo patch', () => {
    expect(bumpVersion('2.0.0', 'patch')).toBe('2.0.1');
    expect(bumpVersion('2.1.7', 'patch')).toBe('2.1.8');
  });

  it('minor RESETUJE patch (2.1.5 → 2.2.0, ne 2.2.5)', () => {
    // 2.2.5 nikad nije bila izdata i preskače versionCode 20200–20204.
    expect(bumpVersion('2.1.5', 'minor')).toBe('2.2.0');
  });

  it('major resetuje minor i patch', () => {
    expect(bumpVersion('2.4.9', 'major')).toBe('3.0.0');
  });

  it('nepoznat tip izmjene je greška, ne tiho ništa', () => {
    expect(() => bumpVersion('2.0.0', 'huge')).toThrow(/Nepoznat tip/);
  });
});

describe('versionCode', () => {
  it('koristi istu formulu kao app.config.js i backend', () => {
    expect(versionCode('2.0.0')).toBe(20000);
    expect(versionCode('2.1.0')).toBe(20100);
    expect(versionCode('2.1.3')).toBe(20103);
    expect(versionCode('3.10.5')).toBe(31005);
  });

  it('svaki bump daje STROGO veći versionCode — uslov Androida', () => {
    // Android odbija nadogradnju sa istim ili manjim versionCode.
    const chain = ['2.0.0', '2.0.1', '2.1.0', '2.10.0', '3.0.0'];
    const codes = chain.map(versionCode);
    for (let i = 1; i < codes.length; i += 1) {
      expect(codes[i]).toBeGreaterThan(codes[i - 1]);
    }
  });
});

describe('nepodržani oblici verzije', () => {
  it('sufiks se ODMIJENJA jer bi versionCode KOLIDIRAO sa izdatom verzijom', () => {
    /*
     * Izmjereno, i suprotno od onoga što bi se očekivalo: `parseInt('0-beta')`
     * ne daje `NaN` nego **0**. Kvar je zato gori od NaN-a — nema greške,
     * samo tihi sudar:
     *
     *   '2.0.0-beta.1'.split('.') → [2, 0, 0, 1]
     *   versionCode              → 2*10000 + 0*100 + 0 = 20000
     *   '2.0.0'                  → 20000   ← isto
     *
     * Android bi odbio nadogradnju kao „već instalirano", bez ijedne poruke o
     * verziji. Zato skripta odbija sufiks prije upisa.
     */
    const naive = '2.0.0-beta.1'.split('.').map((n) => Number.parseInt(n, 10));
    const naiveCode = naive[0] * 10_000 + naive[1] * 100 + naive[2];
    expect(naiveCode).toBe(versionCode('2.0.0')); // kolizija, ne NaN

    expect(() => parseVersion('2.0.0-beta.1')).toThrow(
      /nije oblika major\.minor\.patch/,
    );
  });

  it('v prefiks i dvije komponente takođe padaju', () => {
    expect(() => parseVersion('v2.0.0')).toThrow();
    expect(() => parseVersion('2.0')).toThrow();
    expect(() => parseVersion('')).toThrow();
  });
});

describe('upis verzije', () => {
  let dir;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verzije-'));
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ name: 'x', version: '2.0.0' }, null, 2) + '\n',
    );
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('piše version u package.json', () => {
    setVersion(dir, '2.1.0');
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    expect(pkg.version).toBe('2.1.0');
    expect(pkg.name).toBe('x'); // ostala polja netaknuta
  });

  it('piše version i u package-lock.json, na OBA mjesta', () => {
    // Bez ovoga `npm ci` u CI-ju padne: „lock file does not satisfy package.json".
    fs.writeFileSync(
      path.join(dir, 'package-lock.json'),
      JSON.stringify(
        { name: 'x', version: '2.0.0', lockfileVersion: 3, packages: { '': { name: 'x', version: '2.0.0' } } },
        null,
        2,
      ) + '\n',
    );

    setVersion(dir, '2.1.0');

    const lock = JSON.parse(fs.readFileSync(path.join(dir, 'package-lock.json'), 'utf8'));
    expect(lock.version).toBe('2.1.0');
    expect(lock.packages[''].version).toBe('2.1.0');
  });

  it('radi i bez package-lock.json (npr. svjež klon prije instalacije)', () => {
    expect(() => setVersion(dir, '2.1.0')).not.toThrow();
  });

  it('neispravna verzija ne mijenja fajl', () => {
    expect(() => setVersion(dir, '2.1')).toThrow();
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    expect(pkg.version).toBe('2.0.0'); // ništa nije upisano
  });

  it('vraća staru i novu verziju sa oba versionCode-a', () => {
    const result = setVersion(dir, '2.1.0');
    expect(result).toEqual({
      previous: '2.0.0',
      next: '2.1.0',
      previousCode: 20000,
      nextCode: 20100,
    });
  });

  it('restore vraća prethodnu verziju (build je pao)', () => {
    setVersion(dir, '2.1.0');
    restoreVersion(dir, '2.0.0');
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    expect(pkg.version).toBe('2.0.0');
  });
});
