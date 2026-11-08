import fs from 'fs';
import path from 'path';

import enUS from '../config';

/**
 * F7 (HOME-05): nijedan `t('…')` literal u `src/` ne smije biti ključ koji ne
 * postoji u OBA jezika.
 *
 * Zašto: Početna je na uređaju ispisivala `dashboard.outdoor`, `dashboard.health`
 * i `dashboard.moreHomes` — ekran je tražio ključeve pod `dashboard.*`, a isti
 * tekstovi žive pod `boiler.*`. i18next u tom slučaju vraća sam ključ, pa greška
 * nije bila vidljiva ni u TypeScript-u ni u testovima (testovi su mockali `t` na
 * `t(key) => key`, pa su asertacije čitale iste te ključeve).
 *
 * Test čita izvor `config.ts` (jedini izvor prijevoda) i sve `t('…')` pozive u
 * `src/` i pada ako ijedan ključ nedostaje. Time se klasa greške ne može vratiti.
 */

const SRC = path.join(__dirname, '..', '..');
const CONFIG = path.join(SRC, 'locales', 'config.ts');

function flattenKeys(value: unknown, prefix = '', out = new Set<string>()): Set<string> {
  if (value === null || typeof value !== 'object') return out;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (child !== null && typeof child === 'object') flattenKeys(child, full, out);
    else out.add(full);
  }
  return out;
}

const en = flattenKeys(enUS.getResourceBundle('en-US', 'translation'));
const bs = flattenKeys(enUS.getResourceBundle('bs-BS', 'translation'));

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      sourceFiles(full, out);
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.test.tsx')) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Plural oblici: i18next bira `_one`/`_few`/`_other` sam, pa se `t('gas.readingCount')`
 * provjerava preko baznog ključa — postojanje `readingCount_one`/`_other` je
 * dovoljno (paritet test pokriva `_few` za bosanski).
 */
function hasKey(set: Set<string>, key: string): boolean {
  if (set.has(key)) return true;
  return (
    set.has(`${key}_one`) ||
    set.has(`${key}_other`) ||
    set.has(`${key}_few`) ||
    set.has(`${key}_zero`) ||
    set.has(`${key}_two`) ||
    set.has(`${key}_many`)
  );
}

/** Ključevi koji su legitimno dinamički (`t(\`a.${x}\`)`) — preskaču se. */
const DYNAMIC_PREFIXES = ['thermostat.mode.', 'notifications.types.', 'notifications.typeDescriptions.'];

describe('i18n ključevi u kodu', () => {
  it('svaki t(\'literal\') postoji u en-US i u bs-BS', () => {
    const missing: string[] = [];

    for (const file of sourceFiles(SRC)) {
      const text = fs.readFileSync(file, 'utf8');
      for (const match of text.matchAll(/\bt\(\s*'([a-zA-Z][\w.]*)'/g)) {
        const key = match[1];
        if (DYNAMIC_PREFIXES.some((prefix) => key.startsWith(prefix))) continue;
        const inEn = hasKey(en, key);
        const inBs = hasKey(bs, key);
        if (!inEn || !inBs) {
          missing.push(`${path.relative(SRC, file)} → ${key} (en=${inEn}, bs=${inBs})`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it('oba jezika imaju isti broj ključeva (paritet već pokriva druga strana)', () => {
    expect(bs.size).toBe(en.size);
  });

  it('config.ts je jedini izvor prijevoda (nema drugog fajla sa `resources`)', () => {
    const offenders = sourceFiles(SRC).filter(
      (file) =>
        file !== CONFIG &&
        /translation\s*:/.test(fs.readFileSync(file, 'utf8')) &&
        !file.includes('/locales/'),
    );
    expect(offenders).toEqual([]);
  });
});
