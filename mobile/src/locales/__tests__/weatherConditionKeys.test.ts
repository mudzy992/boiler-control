import fs from 'fs';
import path from 'path';

import i18n from '../config';

/**
 * F13 (prevod na uređaju): `WeatherV2Card` ispisuje uslov **ključem koji
 * backend pošalje**, a ne svojim prijevodom.
 *
 * `backend/src/modules/Weather/wmo.ts` gradi `conditionI18nKey` kao
 * `weather.condition.<key>`. Mobilna aplikacija je imala svoj blok
 * `weather.condition`, ali sa pet drugačijih imena (`slight_snow` umjesto
 * `slight_snowfall`, `thunderstorm_slight_hail` umjesto
 * `thunderstorm_with_slight_hail`, …). Za te kodove `t()` vraća sam ključ, pa
 * je na ekranu pisalo `weather.condition.slight_snowfall`. Test poredi skupove
 * direktno sa backend izvorom — ne sa prepisanom listom, koja bi mogla ostariti
 * isto kao i prevod.
 *
 * Putanja do backenda je relativna iz `mobile/src/locales/__tests__`; ako se
 * repozitorij promijeni tako da backend više nije tu, test pada sa jasnom
 * porukom umjesto da tiho preskoči provjeru.
 */

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

function backendConditionKeys(): string[] {
  const source = fs.readFileSync(BACKEND_WMO, 'utf8');
  const table = source.split('const CONDITIONS')[1];
  return [...table.matchAll(/:\s*'([a-z_]+)'/g)].map((match) => match[1]).sort();
}

function mobileConditionKeys(language: 'en-US' | 'bs-BS'): string[] {
  const bundle = i18n.getResourceBundle(language, 'translation') as Record<string, unknown>;
  const conditions = (bundle.weather as Record<string, unknown> | undefined)?.condition as
    | Record<string, unknown>
    | undefined;
  return Object.keys(conditions ?? {}).sort();
}

describe('F13 — WMO uslovi: backend i mobilni koriste ista imena', () => {
  it('backend lista uslove (kontrola da test ne mjeri prazan skup)', () => {
    // 28 WMO kodova + `unknown` u `WMO_UNKNOWN`. Ako ovo padne, izvor se
    // promijenio i test bi dalje poredio dva prazna skupa.
    expect(backendConditionKeys().length).toBeGreaterThanOrEqual(28);
  });

  it('engleski prevod pokriva svaki uslov koji backend može poslati', () => {
    expect(mobileConditionKeys('en-US')).toEqual(backendConditionKeys());
  });

  it('bosanski prevod pokriva isti skup', () => {
    expect(mobileConditionKeys('bs-BS')).toEqual(backendConditionKeys());
  });
});
