import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * Čuvar imena temperatura (`32`).
 *
 * U sistemu postoje dvije temperature koje se obje zovu „trenutna": vazduh u
 * sobi s termostata i polazna voda u kotlu. Obje su `number` u °C, pa zamjena ne
 * pada na tipovima — vidi se kao pogrešan broj na ekranu. Ovaj test ne provjerava
 * logiku; provjerava da se **nazivi ne pogoršavaju**.
 *
 * Pravilo je „ratchet": zatečeno stanje je u `temperature-semantics.baseline.json`
 * i broj po fajlu smije samo padati. Novi fajl sa dvosmislenim imenom ili veći
 * broj u postojećem = pad, sa porukom koje ime treba koristiti. Kad se neki fajl
 * pošteno preimenuje, baseline se regeneriše (`UPDATE_TEMP_BASELINE=1`).
 *
 * Zašto ratchet, a ne potpuna zabrana: 27 fajlova i 175 pojava su zatečeni dug.
 * Zabrana danas ne bi pustila ništa kroz CI dok se sve ne preimenuje, a tolerisan
 * dug bez mjere bi se samo povećavao.
 */

/**
 * Korijen repozitorija: `backend/` je radni direktorij u CI-ju, a skeniramo i
 * `frontend/` i `mobile/`, pa se ide korak gore. Ako test slučajno radi iz
 * korijena, koristi se on.
 */
function findRepoRoot(): string {
  const cwd = process.cwd();
  return existsSync(join(cwd, 'frontend')) ? cwd : resolve(cwd, '..');
}

const REPO_ROOT = findRepoRoot();
const SCANNED_DIRS = ['backend/src', 'frontend/src', 'mobile/src'];

/** Ista lista kao u `temperature-semantics.ts`; gradnja iz dijelova da fajl ne broji sebe. */
const AMBIGUOUS = [
  'current' + 'Temp',
  'target' + 'Temp',
  'suggested' + 'Temp',
  'actual' + 'Temp',
  'temp' + 'Current',
];

const AMBIGUOUS_RE = new RegExp(`\\b(${AMBIGUOUS.join('|')})\\b`, 'g');

const SKIP_FILES = new Set([
  'backend/src/common/temperature-semantics.ts',
  'backend/src/common/tests/temperature-semantics.spec.ts',
]);

const isTestFile = (path: string): boolean =>
  path.includes('__tests__') || /\.(spec|test)\.tsx?$/.test(path);

function walk(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return; // npr. `mobile/` nije u svakom checkoutu
  }

  for (const entry of entries) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.next') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
}

function countAmbiguous(): Record<string, number> {
  const files: string[] = [];
  for (const dir of SCANNED_DIRS) walk(join(REPO_ROOT, dir), files);

  const counts: Record<string, number> = {};
  for (const file of files) {
    const key = relative(REPO_ROOT, file).split('\\').join('/');
    if (SKIP_FILES.has(key) || isTestFile(key)) continue;
    const source = readFileSync(file, 'utf8');
    const found = source.match(AMBIGUOUS_RE);
    if (found && found.length > 0) counts[key] = found.length;
  }
  return counts;
}

const BASELINE_PATH = join(
  REPO_ROOT,
  'backend/src/common/temperature-semantics.baseline.json',
);

function loadBaseline(): Record<string, number> {
  const parsed = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as {
    files: Record<string, number>;
  };
  return parsed.files;
}

describe('imena temperatura su jednoznačna', () => {
  const current = countAmbiguous();
  const baseline = loadBaseline();

  it('nijedan novi fajl ne uvodi gola imena temperatura', () => {
    if (process.env.UPDATE_TEMP_BASELINE === '1') {
      writeFileSync(
        BASELINE_PATH,
        `${JSON.stringify(
          {
            _comment:
              'Zateceno stanje dvosmislenih imena temperatura (32). Broj smije samo padati; novi fajl ili veci broj = test pada. Regenerisi sa UPDATE_TEMP_BASELINE=1.',
            files: Object.fromEntries(Object.entries(current).sort()),
          },
          null,
          2,
        )}\n`,
      );
      return;
    }

    const added = Object.keys(current).filter((file) => !(file in baseline));

    expect({ noviFajloviSaDvosmislenimImenima: added }).toEqual({
      noviFajloviSaDvosmislenimImenima: [],
    });
  });

  it('u postojećim fajlovima broj dvosmislenih imena ne raste', () => {
    const grown = Object.entries(current)
      .filter(([file, count]) => count > (baseline[file] ?? 0))
      .map(([file, count]) => `${file}: ${baseline[file] ?? 0} → ${count}`);

    // Poruka mora reći šta upisati umjesto toga, inače će sljedeći refaktor
    // samo povećati baseline i pravilo nestaje.
    expect({
      pogorsano: grown,
      pravilo:
        'soba: roomCurrentTemp/roomTargetTemp · polazna: actualFlowTemp/suggestedFlowTemp · vanjska: externalTemp/outsideTemp',
    }).toEqual({
      pogorsano: [],
      pravilo:
        'soba: roomCurrentTemp/roomTargetTemp · polazna: actualFlowTemp/suggestedFlowTemp · vanjska: externalTemp/outsideTemp',
    });
  });

  it('baseline ne sadrži fajl koji je u međuvremenu očišćen', () => {
    // Ne pada test, ali sprječava da baseline postane lažna slika stanja.
    const stale = Object.keys(baseline).filter((file) => !(file in current));
    if (stale.length > 0) {
      console.warn(
        `Baseline još navodi očišćene fajlove: ${stale.join(', ')} — ` +
          'pokreni sa UPDATE_TEMP_BASELINE=1 da se skupi.',
      );
    }
    expect(Array.isArray(stale)).toBe(true);
  });

  it('kanonska imena polja su ono što novi kod treba koristiti', () => {
    // Ako se ovo promijeni, mijenja se i dokument `32`; test to drži na okupu.
    const { TEMPERATURE_FIELDS } = jest.requireActual<
      typeof import('../temperature-semantics')
    >('../temperature-semantics');

    expect(TEMPERATURE_FIELDS).toEqual({
      roomNow: 'roomCurrentTemp',
      roomTarget: 'roomTargetTemp',
      flowRecorded: 'actualFlowTemp',
      flowSuggested: 'suggestedFlowTemp',
      flowInDailyRecord: 'flowSetC',
      outdoor: 'externalTemp',
    });
  });
});
