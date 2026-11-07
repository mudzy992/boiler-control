import i18n from '../config';

/**
 * F1 (odluka 5 u `decisions.md`): tri ekrana koja su bila potpuno neprevedena —
 * `Profile`, `HomeManagement`, `ScheduleManagement` — sada imaju ključeve u OBA
 * jezika. Ovaj test čuva da se prevodi ne razilaze: ako ključ postoji samo u
 * `en-US`, bosanski korisnik dobija engleski (ili goli ključ) bez ikakve greške
 * u build-u, pa je jedina odbrana provjera pariteta u testu.
 */

/**
 * F4: paritet više nije ograničen na tri F1 ekrana — u istom prolazu se
 * provjerava i `gas`/`settings`, jer je tu bug (ključevi Postavki fizički u
 * `gas.dateRange`, uz bosanske vrijednosti u engleskom bloku) i prošao neopažen.
 */
const PARITY_NAMESPACES = [
  'profile',
  'schedule',
  'homeManagement',
  'gas',
  'settings',
  'notifications',
  'analytics',
] as const;

type Bundle = Record<string, unknown>;

/** Svi listovi kao `putanja` → `vrijednost`. */
const leaves = (value: unknown, prefix = ''): [string, string][] => {
  if (value === null || typeof value !== 'object') return [[prefix, String(value)]];
  return Object.entries(value as Bundle).flatMap(([key, child]) =>
    leaves(child, prefix ? `${prefix}.${key}` : key),
  );
};

/**
 * i18next pluralni sufiksi nisu dio „prevoda" nego gramatike jezika: bosanski
 * ima `_one/_few/_other`, engleski `_one/_other`. Zato se za paritet poredi
 * osnova ključa, a oblici se provjeravaju odvojeno (test na dnu fajla).
 */
/**
 * Ključevi koji su NAMJERNO isti u oba jezika: internacionalizmi i nazivi
 * režima rada koje i web aplikacija prikazuje nepromijenjene. Ako se ovdje
 * pojavi novi ključ, to znači da prevod nedostaje — zato je lista eksplicitna.
 */
const SAME_IN_BOTH: Record<string, readonly string[]> = {
  profile: ['email'],
  schedule: ['mode.PROGRAM', 'mode.MANUAL', 'mode.OFF'],
  // F4: izmjereno u oba jezika — jedinice i međunarodne oznake se ne prevode,
  // a šabloni bez teksta (`{{value}} / m³`) su identični po definiciji.
  gas: ['badgeStandard', 'currencyKM', 'analysisPriceExVatValue', 'units.m3', 'units.m3h'],
  // F4: isto — „Period", „Min"/„Max" i putanja API-ja su iste u oba jezika;
  // `targetDash`/`chartMin`/`chartMax` su čisti šabloni brojeva.
  analytics: [
    'periodLabel',
    'minutes',
    'targetDash',
    'dataSource',
    'chartMin',
    'chartMax',
    'minLabel',
    'maxLabel',
  ],
};

const PLURAL_SUFFIXES = ['_zero', '_one', '_two', '_few', '_many', '_other'];
const baseKey = (key: string) => {
  const suffix = PLURAL_SUFFIXES.find((candidate) => key.endsWith(candidate));
  return suffix ? key.slice(0, -suffix.length) : key;
};

describe('locale parity for the F1 namespaces', () => {
  const en = i18n.getResourceBundle('en-US', 'translation') as Bundle;
  const bs = i18n.getResourceBundle('bs-BS', 'translation') as Bundle;

  it.each(PARITY_NAMESPACES)('%s has the same keys in en-US and bs-BS', (namespace) => {
    const enKeys = [...new Set(leaves(en[namespace], namespace).map(([key]) => baseKey(key)))];
    const bsKeys = [...new Set(leaves(bs[namespace], namespace).map(([key]) => baseKey(key)))];

    expect(bsKeys.sort()).toEqual(enKeys.sort());
  });

  it.each(PARITY_NAMESPACES)('%s is actually translated in bs-BS', (namespace) => {
    const enValues = leaves(en[namespace]).map(([, value]) => value);
    const bsValueByKey = new Map(leaves(bs[namespace]));

    const allowed = SAME_IN_BOTH[namespace] ?? [];
    const untranslated = leaves(en[namespace]).filter(
      ([key, value]) => bsValueByKey.get(baseKey(key)) === value && !allowed.includes(key),
    );

    expect(enValues.length).toBeGreaterThan(0);
    // Nije nužno da se SVAKA vrijednost razlikuje (npr. „Email", „PDV"), ali
    // kopiran engleski blok bi pao ovdje.
    expect(untranslated.map(([key]) => key)).toEqual([]);
  });
});

describe('plural resolution', () => {
  it('resolves every Bosnian plural form (1 / 2-4 / 5+)', () => {
    expect(i18n.t('homeManagement.thermostatCount', { count: 1, lng: 'bs-BS' })).toBe('1 termostat');
    expect(i18n.t('homeManagement.thermostatCount', { count: 3, lng: 'bs-BS' })).toBe(
      '3 termostata',
    );
    expect(i18n.t('homeManagement.thermostatCount', { count: 5, lng: 'bs-BS' })).toBe(
      '5 termostata',
    );
  });

  it('resolves the English plural', () => {
    expect(i18n.t('homeManagement.thermostatCount', { count: 1, lng: 'en-US' })).toBe('1 thermostat');
    expect(i18n.t('homeManagement.thermostatCount', { count: 2, lng: 'en-US' })).toBe(
      '2 thermostats',
    );
  });
});
