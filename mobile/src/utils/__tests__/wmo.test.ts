import fs from 'fs';
import path from 'path';

import { WMO_CONDITION_KEYS, wmoConditionKey } from '../wmo';

/**
 * `F13` (treći krug): na Početnoj je za stanje vremena pisalo doslovno
 * `WMO_80`.
 *
 * Backend tim putem šalje `condition: "WMO_<kod>"`, a mobilni red (`WeatherRow`)
 * je imao samo tabelu engleskih naziva („Partly cloudy"). `WMO_80` se
 * normalizovalo u `wmo80`, nije nađeno i otišlo je na ekran kako je stiglo.
 *
 * Test ne poredi tabelu sa prepisanom listom — poredi je sa **backendovim**
 * `wmo.ts`, koji je jedini izvor kodova. Dodavanje koda na backendu bez
 * prijevoda pada ovdje, isto kao u `locales/__tests__/weatherConditionKeys.test.ts`.
 */

// Putanja je relativna iz `mobile/src/utils/__tests__`: `mobile` → korijen
// repozitorija → `backend`. Provjereno testom — ako se repo premjesti, test
// pada sa jasnom porukom umjesto da tiho preskoči poređenje.
const BACKEND_WMO = path.join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'backend',
  'src',
  'modules',
  'Weather',
  'wmo.ts',
);

function backendCodes(): Array<{ code: number; key: string }> {
  const source = fs.readFileSync(BACKEND_WMO, 'utf8');
  const table = source.split('const CONDITIONS')[1].split('};')[0];
  return [...table.matchAll(/(\d+):\s*'([a-z_]+)'/g)].map((match) => ({
    code: Number(match[1]),
    key: match[2],
  }));
}

describe('F13: WMO kod se prevodi, nikad ne stiže na ekran', () => {
  it('platforma i backend imaju isti skup kodova', () => {
    const backend = backendCodes();
    // Kontrola da test ne mjeri prazan skup.
    expect(backend.length).toBeGreaterThanOrEqual(28);

    const backendMap = Object.fromEntries(backend.map((entry) => [entry.code, entry.key]));
    expect(WMO_CONDITION_KEYS).toEqual(backendMap);
  });

  it('WMO_80 iz snimke daje ključ za „slabu kišu u pljuskovima"', () => {
    expect(wmoConditionKey('WMO_80')).toBe('slight_rain_showers');
    expect(wmoConditionKey('wmo_80')).toBe('slight_rain_showers');
    expect(wmoConditionKey('WMO-80')).toBe('slight_rain_showers');
  });

  it('nepoznat kod daje `unknown`, a ne sirov broj', () => {
    expect(wmoConditionKey('WMO_12345')).toBe('unknown');
  });

  it('tekstualni naziv i prazno ne tretiraju se kao WMO', () => {
    expect(wmoConditionKey('Partly cloudy')).toBeNull();
    expect(wmoConditionKey('')).toBeNull();
    expect(wmoConditionKey(null)).toBeNull();
  });
});
