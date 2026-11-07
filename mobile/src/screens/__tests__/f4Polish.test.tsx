import fs from 'fs';
import path from 'path';

import i18n from '../../locales/config';

/**
 * F4 (UX-06, UX-07, UX-14, UX-19, UX-23, UX-24) — ugovori završnice:
 *
 *  1. Nijedan ekran ne prikazuje spinner preko cijelog ekrana kad se podaci
 *     učitavaju — skeleton drži footprint sadržaja.
 *  2. Svaki `Pressable` u ekranima i komponentama nosi `accessibilityLabel`
 *     (ili prosljeđuje `...rest`, gdje labela dolazi od pozivaoca).
 *  3. `Alert.alert` i `components/BottomSheetModal` više ne postoje — sve
 *     potvrde idu kroz `ui/Sheet`.
 *  4. `gas` blok u OBA jezika sadrži samo gas ključeve (bug iz F1: ključevi
 *     Postavki su fizički stajali u `gas.dateRange`, sa bosanskim vrijednostima
 *     u engleskom bloku).
 */

const root = path.join(__dirname, '..', '..', '..');
const srcRoot = path.join(root, 'src');

const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : walk(full);
    return entry.isFile() && full.endsWith('.tsx') ? [full] : [];
  });

const screenFiles = walk(path.join(srcRoot, 'screens'));
const componentFiles = walk(path.join(srcRoot, 'components'));

/** Svi JSX tagovi `<Name ...>` sa punim tekstom (i prelomljeni preko redova). */
const jsxTags = (source: string, name: string): string[] => {
  const tags: string[] = [];
  let index = 0;
  for (;;) {
    const start = source.indexOf(`<${name}`, index);
    if (start === -1) return tags;
    const after = source[start + name.length + 1];
    if (after && /[A-Za-z0-9_]/.test(after)) {
      index = start + 1;
      continue;
    }
    let depth = 0;
    let cursor = start + name.length + 1;
    for (; cursor < source.length; cursor += 1) {
      const char = source[cursor];
      if (char === '{') depth += 1;
      else if (char === '}') depth -= 1;
      else if (char === '>' && depth === 0) break;
    }
    tags.push(source.slice(start, cursor + 1));
    index = cursor + 1;
  }
};

const relative = (file: string) => path.relative(root, file);

describe('F4 — skeleton umjesto spinnera', () => {
  it('nijedan ekran ne koristi Spinner za stanje učitavanja', () => {
    const offenders = screenFiles.filter((file) => /<Spinner\b/.test(fs.readFileSync(file, 'utf8')));
    expect(offenders.map(relative)).toEqual([]);
  });

  it('ekrani sa stanjem učitavanja koriste skeletone iz `ui`', () => {
    const screens = [
      'gas/GasReadingsScreen.tsx',
      'gas/GasAnalysisScreen.tsx',
      'notifications/NotificationsScreen.tsx',
      'notifications/NotificationPreferencesScreen.tsx',
      'profile/ProfileScreen.tsx',
      'schedule/ScheduleManagementScreen.tsx',
      'home/HomeManagementScreen.tsx',
      'dashboard/DashboardScreen.tsx',
      'heating/HeatingScreen.tsx',
      'analytics/AnalyticsScreen.tsx',
    ];
    for (const screen of screens) {
      const source = fs.readFileSync(path.join(srcRoot, 'screens', screen), 'utf8');
      expect(source).toMatch(/Skeleton(Rows|Panel)?/);
      expect(source).not.toMatch(/<Spinner\b/);
    }
  });
});

describe('F4 — pristupačnost', () => {
  it('svaki Pressable u ekranima ima accessibilityLabel', () => {
    const missing: string[] = [];
    for (const file of screenFiles) {
      const source = fs.readFileSync(file, 'utf8');
      for (const tag of jsxTags(source, 'Pressable')) {
        if (tag.includes('accessibilityLabel') || tag.includes('{...')) continue;
        missing.push(`${relative(file)}: ${tag.split('\n')[0].trim()}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('svaka ikonografska kontrola u komponentama ima labelu', () => {
    const missing: string[] = [];
    for (const file of componentFiles) {
      const source = fs.readFileSync(file, 'utf8');
      for (const tag of jsxTags(source, 'Pressable')) {
        if (tag.includes('accessibilityLabel') || tag.includes('{...')) continue;
        // `controls.tsx` gradi primitive čija labela dolazi iz propova.
        if (file.endsWith('controls.tsx')) continue;
        missing.push(`${relative(file)}: ${tag.split('\n')[0].trim()}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('FormInput veže labelu na polje', () => {
    const source = fs.readFileSync(path.join(srcRoot, 'components', 'FormInput.tsx'), 'utf8');
    expect(source).toMatch(/accessibilityLabel=\{props\.accessibilityLabel \?\? props\.placeholder\}/);
  });
});

describe('F4 — jedan obrazac za potvrde', () => {
  it('nema Alert.alert ni obrisanog BottomSheetModal-a', () => {
    const offenders = [...screenFiles, ...componentFiles].filter((file) => {
      const source = fs.readFileSync(file, 'utf8');
      return /Alert\.alert/.test(source) || /<BottomSheetModal\b/.test(source);
    });
    expect(offenders.map(relative)).toEqual([]);
    expect(fs.existsSync(path.join(srcRoot, 'components', 'BottomSheetModal.tsx'))).toBe(false);
  });

  it('Gas Readings koristi ui/Sheet za oba sheeta', () => {
    const source = fs.readFileSync(
      path.join(srcRoot, 'screens', 'gas', 'GasReadingsScreen.tsx'),
      'utf8',
    );
    expect(source).toMatch(/<Sheet\b/);
    expect(source).toMatch(/gas-add-sheet/);
    expect(source).toMatch(/gas-date-range-sheet/);
    expect(source).toMatch(/gas-meter-image-sheet/);
  });
});

describe('F4 — prazna stanja nude sljedeći korak', () => {
  it('grijanje bez termostata i analiza bez podataka imaju akciju', () => {
    const heating = fs.readFileSync(
      path.join(srcRoot, 'screens', 'heating', 'HeatingScreen.tsx'),
      'utf8',
    );
    expect(heating).toMatch(/noThermostatsAction/);
    const gasAnalysis = fs.readFileSync(
      path.join(srcRoot, 'screens', 'gas', 'GasAnalysisScreen.tsx'),
      'utf8',
    );
    expect(gasAnalysis).toMatch(/gas\.analysisNoDataAction/);
  });
});

describe('F4 — locale bug gas.dateRange', () => {
  const en = i18n.getResourceBundle('en-US', 'translation') as Record<string, any>;
  const bs = i18n.getResourceBundle('bs-BS', 'translation') as Record<string, any>;

  const SETTINGS_KEYS = [
    'accountSection',
    'appearanceSection',
    'notificationsSection',
    'homesSection',
    'dataPrivacySection',
    'aboutSection',
    'languageEnglish',
    'languageBosnian',
  ];

  it.each(['en-US', 'bs-BS'])('%s gas.dateRange sadrži samo ključeve raspona datuma', (lng) => {
    const bundle = lng === 'en-US' ? en : bs;
    for (const key of SETTINGS_KEYS) {
      expect(bundle.gas.dateRange).not.toHaveProperty(key);
    }
    expect(bundle.gas.dateRange).toEqual({
      title: expect.any(String),
      startDate: expect.any(String),
      endDate: expect.any(String),
      selectStart: expect.any(String),
      selectEnd: expect.any(String),
      quickPresets: expect.any(String),
      last30: expect.any(String),
      last60: expect.any(String),
      last90: expect.any(String),
    });
  });

  it('gas.units ne nosi ključ Postavki', () => {
    expect(en.gas.units).not.toHaveProperty('dailyGasReminderTime');
    expect(bs.gas.units).not.toHaveProperty('dailyGasReminderTime');
    expect(en.settings.dailyGasReminderTime).toBeTruthy();
    expect(bs.settings.dailyGasReminderTime).toBeTruthy();
  });

  it('engleski gas blok više ne sadrži bosanske vrijednosti', () => {
    const bosnian = /[čćžšđ]/i;
    const walkStrings = (value: unknown): string[] =>
      typeof value === 'string'
        ? [value]
        : value && typeof value === 'object'
          ? Object.values(value as Record<string, unknown>).flatMap(walkStrings)
          : [];
    expect(walkStrings(en.gas).filter((text) => bosnian.test(text))).toEqual([]);
  });

  it('engleski jezik vraća engleski naslov raspona datuma', () => {
    expect(i18n.t('gas.dateRange.title', { lng: 'en-US' })).toBe('Select Date Range');
    expect(i18n.t('gas.dateRange.title', { lng: 'bs-BS' })).toBe('Odaberi vremenski period');
  });
});
