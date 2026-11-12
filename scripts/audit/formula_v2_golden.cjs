#!/usr/bin/env node
/**
 * Zlatni brojevi za **kontroler toplotnog bilansa** (F2).
 *
 * Zašto ovaj fajl postoji: `formula_golden.json` čuva ponašanje **stare krive**.
 * Ona odlazi u penziju (F4), pa njeno ponašanje ništa ne štiti. Ono što poslije
 * ostaje je kontroler — i njegova regresija je tiha: polazna se promijeni za
 * 0,5 K, komfor ostane isti, a niko ne primijeti dok kuća ne ostane hladna.
 *
 * Skripta pokreće `learning_sim.cjs` (stvarna simulacija, ne kopija formule) i
 * poredi rezultat sa `fixtures/formula_v2_golden.json`. Razlika veća od
 * tolerancije = exit 1.
 *
 * Upotreba:
 *   node scripts/audit/formula_v2_golden.cjs            # provjeri
 *   node scripts/audit/formula_v2_golden.cjs --write    # upiši nove brojeve
 *   node scripts/audit/formula_v2_golden.cjs --json     # mašinski čitljiv izlaz
 *
 * Namjerno NIJE test u `jest`-u: simulacija traje nekoliko sekundi i ne dira
 * bazu, a ovdje je važno da se pokreće **ista** skripta koju koristi čovjek
 * kad istražuje. Kopija formule u testu bi se mogla pokvariti zajedno s njom.
 */
'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log(
    'Upotreba: node scripts/audit/formula_v2_golden.cjs [--write] [--json]\n' +
      'Pokreće learning_sim.cjs za tri tipa kuće i poredi sa zlatnim brojevima.\n' +
      'Exit 1 na drift. --write upisuje nove brojeve (samo uz svjesnu odluku).',
  );
  process.exit(0);
}

const ROOT = path.resolve(__dirname, '../..');
const SIM = path.join(__dirname, 'learning_sim.cjs');
const FIXTURE = path.join(__dirname, 'fixtures', 'formula_v2_golden.json');

/** Kuće koje ulaze u snimak — iste tri kao u `learning_sim.cjs`. */
const HOUSES = ['light', 'medium', 'heavy'];
const DAYS = 60;

/**
 * Šta se poredi i koliko smije da odstupi.
 *
 * Tolerancije nijesu „koliko je tačno" nego „koliko smije da se promijeni a da
 * to nije namjera". Najstroža je na `undershootDaysAfter10`: to je broj dana
 * kad je kuća bila ispod cilja, i tu nema opravdanog povećanja.
 */
const TOLERANCE = {
  flowEnd: 0.05,
  cyclesPerDay: 0.05,
  undershootDaysAfter10: 0,
  worstUndershoot: 0.01,
  daysOverTmax: 0,
};

function runSim(house) {
  const output = execFileSync(
    process.execPath,
    [SIM, '--scenario=controller', `--house=${house}`, `--days=${DAYS}`, '--json'],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  const parsed = JSON.parse(output);
  const result = Array.isArray(parsed) ? parsed[0] : parsed.results[0];
  return {
    house,
    flowEnd: result.flow.end,
    cyclesPerDay: result.cycles.perDayMean,
    undershootDaysAfter10: result.comfort.undershootDaysAfter10,
    daysAfter10: result.comfort.daysAfter10,
    worstUndershoot: result.comfort.worstUndershoot,
    daysOverTmax: result.comfort.daysOverTmax,
    modelSlope: result.modelTrace.find((m) => m.s != null)?.s ?? null,
  };
}

function collect() {
  return {
    version: 1,
    generatedBy: 'node scripts/audit/formula_v2_golden.cjs --write',
    controller: 'scripts/audit/learning_sim.cjs --scenario=controller',
    expression: 'backend/src/modules/DailyRecord/equilibrium-flow.ts',
    days: DAYS,
    // Iste postavke koje skripta koristi kao zadane; ako se promijene, mijenja
    // se i snimak — i to se vidi u diffu.
    // `u_day` je u snimak ušao sa F3.3: bez njega je simulirana kuća imala
    // konstantne dobitke, pa je `u_day` bio uvijek 0 i njegova ablacija nije
    // dokazivala ništa. `dayGain` označava da dobici variraju (±450 W, spori
    // udio period 9 dana) — v. §10.14 u planu.
    settings: { c: true, dayRef: true, conservativeDays: 20, dayGain: true },
    why: 'F3.3: dnevni dobici variraju; zlatni brojevi prepisani uz dokaz ablacije (§10.14)',
    houses: Object.fromEntries(HOUSES.map((h) => [h, runSim(h)])),
  };
}

function compare(expected, actual) {
  const problems = [];
  for (const house of HOUSES) {
    const want = expected.houses?.[house];
    const got = actual.houses[house];
    if (!want) {
      problems.push(`${house}: nema zlatnih brojeva`);
      continue;
    }
    for (const [key, tolerance] of Object.entries(TOLERANCE)) {
      const a = want[key];
      const b = got[key];
      if (typeof a !== 'number' || typeof b !== 'number') {
        if (a !== b) problems.push(`${house}.${key}: ${a} → ${b}`);
        continue;
      }
      if (Math.abs(a - b) > tolerance) {
        problems.push(
          `${house}.${key}: ${a} → ${b} (tolerancija ${tolerance})`,
        );
      }
    }
  }
  return problems;
}

const write = args.includes('--write');
const asJson = args.includes('--json');

const actual = collect();

if (write) {
  fs.writeFileSync(FIXTURE, `${JSON.stringify(actual, null, 2)}\n`);
  console.log(`Zlatni brojevi upisani: ${path.relative(ROOT, FIXTURE)}`);
  process.exit(0);
}

if (!fs.existsSync(FIXTURE)) {
  console.error(
    `Nema zlatnih brojeva (${path.relative(ROOT, FIXTURE)}). ` +
      'Prvi put: node scripts/audit/formula_v2_golden.cjs --write',
  );
  process.exit(2);
}

const expected = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
const problems = compare(expected, actual);

if (asJson) {
  console.log(JSON.stringify({ ok: problems.length === 0, problems, actual }, null, 2));
} else if (problems.length === 0) {
  console.log(
    `Kontroler se poklapa sa zlatnim brojevima (${HOUSES.length} kuće, ${DAYS} dana).`,
  );
  for (const house of HOUSES) {
    const h = actual.houses[house];
    console.log(
      `  ${house.padEnd(7)} polazna ${h.flowEnd} °C | ` +
        `${h.cyclesPerDay} cikl/dan | ` +
        `podbačaj ${h.undershootDaysAfter10}/${h.daysAfter10} | ` +
        `najgori ${h.worstUndershoot} K`,
    );
  }
} else {
  console.error('Kontroler je odstupio od zlatnih brojeva:');
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error(
    '\nAko je promjena namjerа, upiši nove brojeve sa --write i objasni ih u ' +
      'commitu. Ako nije, formula je regresirala.',
  );
  process.exit(1);
}
