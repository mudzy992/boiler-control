#!/usr/bin/env node
/*
 * F3.8 — OSJETLJIVOST KONTROLERA (grid `STEP_UP/STEP_DOWN` × `DWELL`)
 *
 * Pitanje na koje odgovara: **koliko odluka zavisi od izbora pragova?** Ako
 * kontroler radi isto za `STEP_DOWN` 0,5 i 2,0 i za `DWELL` 1 i 5, onda ti
 * brojevi nijesu podešeni nego proizvoljni — i to se mora znati prije nego se
 * model pusti (F4), a ne poslije.
 *
 * Kako, bez kopije formule: `decideProposal` čita `STEP_UP_K`, `STEP_DOWN_K` i
 * `DWELL_DAYS` iz svog modula pri svakom pozivu, pa `controller_sim.cjs` dobija
 * `--params=` i mijenja samo te vrijednosti za jedan prolaz. Sve ostalo —
 * fizika, ishod dana, noćni minimum — ostaje isto. Dakle razlika u rezultatu
 * dolazi isključivo od pragova.
 *
 * Izlaz: `docs/audit/F3.8-osjetljivost.md` + JSON. Skripta je read-only prema
 * repou osim tog jednog fajla; bez mreže, baze i tajni.
 *
 * Ograničenje koje se ne smije prećutati: simulacija nema minimalnu modulaciju
 * kotla, sunce, PTV ni otvoren prozor. Brojevi važe za model, ne za instalaciju.
 *
 * Upotreba:
 *   node scripts/audit/controller_sensitivity.cjs            # puni grid, 60 dana
 *   node scripts/audit/controller_sensitivity.cjs --days=40  # kraći prozor
 *   node scripts/audit/controller_sensitivity.cjs --dry      # samo tabela, bez upisa
 */
'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

if (process.argv.includes('--help')) {
  console.log(`Upotreba: node scripts/audit/controller_sensitivity.cjs [opcije]

  --days=<n>   broj simuliranih dana po kombinaciji (default 60)
  --dry        ne upisuj docs/audit/F3.8-osjetljivost.md
  --self-test  provjeri da pragovi stvarno utiču na odluku (za CI)
  --json       ispiši grid kao JSON na stdout
  --help       ova poruka

Pokreće controller_sim.cjs za svaku kombinaciju pragova i poredi ishode.
Bez mreže, baze i izmjene aplikacijskog koda.`);
  process.exit(0);
}

const selfTest = process.argv.includes('--self-test');
const dry = process.argv.includes('--dry') || selfTest;
const asJson = process.argv.includes('--json');
const daysArg = process.argv.find((a) => a.startsWith('--days='));
// Samotest radi kratko: poenta nije mjerenje nego dokaz da `--params` zaista
// mijenja odluku. Ako bi se to pokvarilo (npr. kontroler počne čitati prag iz
// konstante uhvaćene pri importu), grid bi tiho davao iste redove — a to je
// tačno greška koju je ovaj alat i otkrio u prvom prolazu.
const DAYS = selfTest ? 14 : daysArg ? Number(daysArg.split('=')[1]) : 60;

/*
 * Vrijednosti se biraju da pokriju **red veličine** oko sadašnjih (1,0 / 1,5 / 3):
 * upola manje, sadašnje i dvostruko. Ako se ishod ne mijenja ni na krajevima,
 * prag je neosjetljiv; ako se mijenja, prag je odluka i mora biti obrazložen.
 */
const STEP_DOWN_GRID = [0.5, 1.0, 2.0, 3.0];
const DWELL_GRID = [1, 3, 7];
const STEP_UP = 1.5; // fiksiran: podizanje je sigurnosno (komfor), ne ekonomsko

const SIM = path.join(__dirname, 'controller_sim.cjs');
const root = path.resolve(__dirname, '../..');

/** Jedan prolaz simulatora sa zadatim pragovima. */
function runSim(params) {
  // `--trace` je obavezan: bez toka po danu nema mjere „koliko dana do
  // konačne vrijednosti", a to je jedino što korak i dwell stvarno mijenjaju.
  const args = [`--days=${DAYS}`, '--json', '--trace'];
  if (params) {
    args.push(
      `--params=${Object.entries(params)
        .map(([k, v]) => `${k}=${v}`)
        .join(',')}`,
    );
  }
  const stdout = execFileSync(process.execPath, [SIM, ...args], {
    cwd: root,
    encoding: 'utf8',
    timeout: 15 * 60 * 1000,
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}

/** Zaokruži na `digits` decimala; float šum iz simulacije nije nalaz. */
function round(value, digits) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return value;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * Sažetak po kući.
 *
 * Mjeri se **koliko brzo** kontroler stigne do konačne vrijednosti, ne samo
 * koja je konačna. Razlog: `decideProposal` nikad ne ide ispod ravnotežne
 * polazne (`base`), pa se konačna vrijednost skupi na `base` bez obzira na
 * veličinu koraka — veličina koraka određuje trajanje i cikluse, ne ishod.
 * Prvo mjerenje je to propuštalo i davalo identične redove za `STEP_DOWN` 2 i 3,
 * što je izgledalo kao nalaz a bilo je posljedica pogrešne metrike.
 */
function compact(run) {
  const byHouse = {};
  for (const r of run.results) {
    const flows = (r.trace || []).map((d) => d.flow);
    const final = flows.length ? flows[flows.length - 1] : r.flow.end;
    // Prvi dan od kojeg polazna ostaje unutar 0,5 K od konačne do kraja.
    let convergeDay = null;
    for (let i = 0; i < flows.length; i++) {
      if (flows.slice(i).every((f) => Math.abs(f - final) <= 0.5)) {
        convergeDay = (r.trace[i]?.day ?? i);
        break;
      }
    }
    byHouse[r.house] = {
      end: final,
      min: r.flow.min,
      maxRatePerDay: round(r.bounds.maxDailyJump, 2),
      meanLast10: round(r.flow.meanLast10, 2),
      convergeDay,
      worstUndershoot: r.comfort.worstUndershootAfter10,
      daysOverTolerance: r.comfort.daysOverToleranceAfter10,
      cyclesLast10: r.cycles.last10,
      medianCycleLast10: r.medianCycleMin.last10,
      jumpsOver2: r.bounds.jumpsOver2,
      holds: r.holds.total,
      violations: run.violations.filter((v) => v.startsWith(`${r.house}:`)),
    };
  }
  return byHouse;
}

const houses = ['light', 'medium', 'heavy'];

if (selfTest) {
  const a = compact(runSim({ STEP_DOWN: 0.5, DWELL: 1 }));
  const b = compact(runSim({ STEP_DOWN: 3, DWELL: 1 }));
  const problems = [];
  for (const house of houses) {
    if (Math.abs(a[house].cyclesLast10 - b[house].cyclesLast10) < 1) {
      problems.push(
        `${house}: isti broj ciklusa za STEP_DOWN 0,5 i 3 — prag ne utiče, a mora`,
      );
    }
  }
  if (problems.length) {
    console.log('Samotest NIJE prošao:');
    for (const p of problems) console.log(`  - ${p}`);
    process.exit(1);
  }
  console.log(
    `Samotest prošao: STEP_DOWN 0,5 → 3 mijenja cikluse na sve ${houses.length} kuće (` +
      houses
        .map(
          (h) =>
            `${h} ${a[h].cyclesLast10}→${b[h].cyclesLast10}`,
        )
        .join(', ') +
      ').',
  );
  process.exit(0);
}

console.error(`F3.8: grid ${STEP_DOWN_GRID.length} × ${DWELL_GRID.length}, ${DAYS} dana po kombinaciji…`);

const baseline = compact(runSim(null));
const rows = [];

for (const stepDown of STEP_DOWN_GRID) {
  for (const dwell of DWELL_GRID) {
    const isBaseline = stepDown === 1.0 && dwell === 3;
    const result = isBaseline
      ? baseline
      : compact(runSim({ STEP_DOWN: stepDown, DWELL: dwell }));

    for (const house of houses) {
      const b = baseline[house];
      const r = result[house];
      rows.push({
        stepDown,
        dwell,
        house,
        baseline: isBaseline,
        end: r.end,
        min: r.min,
        meanLast10: r.meanLast10,
        convergeDay: r.convergeDay,
        deltaConvergeVsBaseline:
          r.convergeDay == null || b.convergeDay == null
            ? null
            : r.convergeDay - b.convergeDay,
        deltaEndVsBaseline: round(r.end - b.end, 2),
        deltaMeanVsBaseline: round(r.meanLast10 - b.meanLast10, 2),
        maxRatePerDay: r.maxRatePerDay,
        worstUndershoot: r.worstUndershoot,
        daysOverTolerance: r.daysOverTolerance,
        cyclesLast10: r.cyclesLast10,
        jumpsOver2: r.jumpsOver2,
        violations: r.violations.length,
      });
    }
    console.error(
      `  STEP_DOWN=${stepDown} DWELL=${dwell} … gotovo${isBaseline ? ' (baseline)' : ''}`,
    );
  }
}

/**
 * Nalazi koje skripta sama formuliše — da se ne prepisuju ručno u dokument.
 *
 * Prag je „neosjetljiv" ako nijedna kuća ne pređe granicu komfora i ako se
 * krajnja polazna ne pomjeri više od 1,5 K u odnosu na baseline. Granica od
 * 1,5 K je ista kao `STEP_UP_K`, tj. jedan korak — manje od toga je unutar
 * šuma kontrole, više je stvarna razlika.
 */
const COMFORT_LIMIT = 1.0;
const FLOW_TOLERANCE_K = 1.5;

const problems = rows.filter((r) => r.daysOverTolerance > 0 || r.violations > 0);

/*
 * Dvije različite osjetljivosti, i to je poenta mjerenja:
 *
 *  - `flowSpread`   — da li prag mijenja GOSTO konačnu polaznu;
 *  - `convergeSpread` — da li prag mijenja KOLIKO DANA treba do nje.
 *
 * Prva bi bila jedina mjera da kontroler smije i ispod ravnotežne; pošto ne
 * smije, očekivano je da je prva mala a druga velika. Ako se prva ipak pomjeri,
 * znači da je prag uticao na tok (npr. preskočio podbačaj), a to je važnije.
 */
const flowSpread = {};
const convergeSpread = {};
for (const house of houses) {
  const ends = rows.filter((r) => r.house === house).map((r) => r.end);
  flowSpread[house] = round(Math.max(...ends) - Math.min(...ends), 2);
  const days = rows
    .filter((r) => r.house === house && r.convergeDay != null)
    .map((r) => r.convergeDay);
  convergeSpread[house] = days.length
    ? Math.max(...days) - Math.min(...days)
    : null;
}
const sensitiveHouses = houses.filter(
  (h) => flowSpread[h] > FLOW_TOLERANCE_K,
);
const slowHouses = houses.filter(
  (h) => convergeSpread[h] != null && convergeSpread[h] >= 3,
);

/*
 * Marginalni efekat: za svaku vrijednost jednog praga, prosjek preko drugog.
 *
 * Grid od 12 kombinacija se ne čita ćeliju po ćeliju — tako se šum čita kao
 * nalaz. Ako se `DWELL=7` izdvaja **na svakoj** kući i kroz sve `STEP_DOWN`,
 * to je stvarni efekat; ako se dvije `STEP_DOWN` vrijednosti razlikuju za 0,2 K
 * samo u jednoj ćeliji, to je putanja, ne prag.
 */
function marginal(key, otherKey, values) {
  const out = [];
  for (const value of values) {
    const cells = rows.filter((r) => r[key] === value);
    const perHouse = {};
    for (const house of houses) {
      const ofHouse = cells.filter((r) => r.house === house);
      const mean = (field) =>
        round(
          ofHouse.reduce((sum, r) => sum + r[field], 0) / ofHouse.length,
          2,
        );
      perHouse[house] = {
        end: mean('end'),
        cycles: mean('cyclesLast10'),
        convergeDay: mean('convergeDay'),
        daysOverTolerance: ofHouse.reduce(
          (sum, r) => sum + r.daysOverTolerance,
          0,
        ),
      };
    }
    out.push({ value, perHouse });
  }
  return out;
}

const dwellMarginal = marginal('dwell', 'stepDown', DWELL_GRID);
const stepDownMarginal = marginal('stepDown', 'dwell', STEP_DOWN_GRID);

/** Da li se vrijednost izdvaja na svakoj kući u istom smjeru? */
function standout(series, field, higherIsWorse) {
  const values = series[0].perHouse ? series : [];
  const worstByHouse = {};
  for (const house of houses) {
    const sorted = [...values].sort((a, b) =>
      higherIsWorse
        ? b.perHouse[house][field] - a.perHouse[house][field]
        : a.perHouse[house][field] - b.perHouse[house][field],
    );
    worstByHouse[house] = sorted[0].value;
  }
  const unique = [...new Set(Object.values(worstByHouse))];
  return unique.length === 1
    ? { value: unique[0], consistent: true, byHouse: worstByHouse }
    : { value: null, consistent: false, byHouse: worstByHouse };
}

const findings = [];

/*
 * Prozor mjerenja je dio nalaza, ne detalj.
 *
 * Na 20 dana isti grid daje raspon konačne polazne do 7 K — jer se kontroler
 * još nije spustio, a ne zato što prag mijenja ishod. Na 60 dana raspon padne
 * na ~1–2 K. Zato se uz svaki nalaz ispisuje prozor, a `--days` manji od 45 se
 * izričito označava kao kratak.
 */
if (DAYS < 45) {
  findings.push(
    `**Prozor od ${DAYS} dana je kratak.** Kontroler se u njemu ne stigne spustiti ` +
      'do ravnotežne, pa se raspon između kombinacija čita kao „prag mijenja ishod" ' +
      'iako je to još tranzijent. Za zaključak o ishodu koristiti `--days=60`.',
  );
}

if (problems.length === 0) {
  findings.push(
    `Nijedna kombinacija ne krši granicu komfora (${COMFORT_LIMIT} K) ni tvrde granice.`,
  );
} else {
  findings.push(
    `**${problems.length} kombinacija krši** granicu komfora ili tvrde granice — v. kolonu „prekršaji".`,
  );
}
for (const house of houses) {
  const flow = flowSpread[house];
  const days = convergeSpread[house];
  let verdict;
  if (days != null && days >= 5 && flow <= FLOW_TOLERANCE_K) {
    verdict =
      'prag mijenja **brzinu** (koliko dana do ravnotežne), a ne ishod — to je ' +
      'očekivano jer `decideProposal` ne ide ispod ravnotežne polazne.';
  } else if (days != null && days >= 5 && flow > FLOW_TOLERANCE_K) {
    verdict =
      'prag mijenja **i brzinu i ishod** — ovo treba obrazloženje, ne samo izbor.';
  } else if (slowHouses.includes(house)) {
    verdict = 'prag mijenja brzinu dostizanja.';
  } else {
    verdict = 'prag ne mijenja ni ishod ni brzinu na ovom prozoru.';
  }
  findings.push(
    `\`${house}\`: konačna polazna se mijenja **${flow} K** kroz grid, ` +
      `a dan dostizanja **${days} dana** — ${verdict}`,
  );
}

// --- marginalni nalazi ----------------------------------------------------
const worstDwellEnd = standout(dwellMarginal, 'end', true);
const worstDwellCycles = standout(dwellMarginal, 'cycles', true);
const bestStepDownCycles = standout(stepDownMarginal, 'cycles', false);

if (worstDwellEnd.consistent) {
  const detail = houses
    .map((h) => `\`${h}\` ${dwellMarginal.find((d) => d.value === worstDwellEnd.value).perHouse[h].end} °C`)
    .join(', ');
  findings.push(
    `**\`DWELL=${worstDwellEnd.value}\` podiže konačnu polaznu na svakoj kući** ` +
      `(prosjek preko svih \`STEP_DOWN\`): ${detail}. Dwell je taj koji odgađa ` +
      'spuštanje, pa se izborom 7 dana gas troši u prazno.',
  );
}
if (worstDwellCycles.consistent) {
  const detail = houses
    .map(
      (h) =>
        `\`${h}\` ${dwellMarginal.find((d) => d.value === worstDwellCycles.value).perHouse[h].cycles}/dan`,
    )
    .join(', ');
  findings.push(
    `**\`DWELL=${worstDwellCycles.value}\` daje najviše ciklusa na svakoj kući**: ` +
      `${detail}. Više ciklusa pri istoj polaznoj znači više paljenja, ` +
      'a to je trošak koji se ne vidi u temperaturi.',
  );
}
if (bestStepDownCycles.consistent) {
  const best = stepDownMarginal.find(
    (d) => d.value === bestStepDownCycles.value,
  );
  findings.push(
    `\`STEP_DOWN=${best.value}\` daje najmanje ciklusa na svakoj kući ` +
      `(prosjek preko svih \`DWELL\`): ` +
      houses.map((h) => `\`${h}\` ${best.perHouse[h].cycles}/dan`).join(', ') +
      '. Razlika je unutar jednog koraka, pa je **prijedlog, ne obaveza** — ' +
      'treba potvrdu na stvarnoj kući (F3.7 shadow izvještaj).',
  );
}

// --- tabela ---------------------------------------------------------------
function marginalTable(series, label) {
  const lines = [
    `| \`${label}\` | kuća | konačna | ciklusa/dan | dan dostizanja | dana > 1 K |`,
    '|---|---|---|---|---|---|',
  ];
  for (const entry of series) {
    for (const house of houses) {
      const v = entry.perHouse[house];
      lines.push(
        `| ${entry.value} | ${house} | ${v.end} | ${v.cycles} | ${v.convergeDay} | ${v.daysOverTolerance} |`,
      );
    }
  }
  return lines.join('\n');
}

function markdownTable() {
  const lines = [
    '| `STEP_DOWN` | `DWELL` | kuća | krajnja | dan kad je stigla | Δ dana vs baseline | najveći dnevni skok | najgori podbačaj | dana > 1 K | ciklusa (zadnjih 10) | prekršaji |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const r of rows) {
    const delta =
      r.deltaConvergeVsBaseline == null
        ? '—'
        : `${r.deltaConvergeVsBaseline > 0 ? '+' : ''}${r.deltaConvergeVsBaseline}`;
    lines.push(
      `| ${r.stepDown} | ${r.dwell} | ${r.house} | ${r.end} | ` +
        `${r.convergeDay ?? '—'} | ${delta} | ${r.maxRatePerDay} | ` +
        `${r.worstUndershoot} | ${r.daysOverTolerance} | ${r.cyclesLast10} | ` +
        `${r.violations}${r.baseline ? ' *(baseline)*' : ''} |`,
    );
  }
  return lines.join('\n');
}

const output = {
  generatedAt: new Date().toISOString(),
  days: DAYS,
  grid: { stepDown: STEP_DOWN_GRID, dwell: DWELL_GRID, stepUp: STEP_UP },
  flowSpreadK: flowSpread,
  convergeSpreadDays: convergeSpread,
  marginals: { dwell: dwellMarginal, stepDown: stepDownMarginal },
  sensitiveHouses,
  slowHouses,
  findings,
  rows,
};

if (asJson) {
  console.log(JSON.stringify(output, null, 2));
} else {
  console.log(`# F3.8 — Osjetljivost kontrolera na pragove\n`);
  console.log(
    `Pokrenuto: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC, ` +
      `${DAYS} dana po kombinaciji, ${houses.length} kuće iz kataloga.\n`,
  );
  console.log(markdownTable());
  console.log('\n## Nalazi\n');
  for (const finding of findings) console.log(`- ${finding}`);
  console.log(
    '\n**Ograničenje:** model nema minimalnu modulaciju kotla, sunce, PTV ni ' +
      'otvoren prozor. Brojevi važe za model, ne za instalaciju.',
  );
}

if (!dry) {
  const target = path.join(root, 'docs/audit/F3.8-osjetljivost.md');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const md = [
    '<!-- Generisano sa: node scripts/audit/controller_sensitivity.cjs -->',
    '<!-- Ne uređivati ručno: pokreni skriptu. -->',
    '',
    `# F3.8 — Osjetljivost kontrolera na pragove`,
    '',
    `Pokrenuto: ${output.generatedAt}, **${DAYS} dana** po kombinaciji, ` +
      `kuće: ${houses.join(', ')}.`,
    '',
    'Pitanje: koliko odluka zavisi od izbora `STEP_DOWN_K` / `DWELL_DAYS`? ' +
      '`STEP_UP_K` je fiksiran na ' +
      `${STEP_UP} jer je podizanje sigurnosno (komfor), ne ekonomsko.`,
    '',
    '## Grid',
    '',
    markdownTable(),
    '',
    '## Marginalno — `DWELL` (prosjek preko svih `STEP_DOWN`)',
    '',
    marginalTable(dwellMarginal, 'DWELL'),
    '',
    '## Marginalno — `STEP_DOWN` (prosjek preko svih `DWELL`)',
    '',
    marginalTable(stepDownMarginal, 'STEP_DOWN'),
    '',
    '## Nalazi',
    '',
    ...findings.map((f) => `- ${f}`),
    '',
    '**Ograničenje:** model nema minimalnu modulaciju kotla, sunce, PTV ni ' +
      'otvoren prozor. Brojevi važe za model, ne za instalaciju.',
    '',
    '## Kako ponoviti',
    '',
    '```bash',
    'node scripts/audit/controller_sensitivity.cjs',
    '```',
    '',
  ].join('\n');
  fs.writeFileSync(target, md, 'utf8');
  console.error(`Upisano: ${path.relative(root, target)}`);
}

// Skripta nije gejt: grid izvještava, ne pada. Pad bi značio „prag je loš",
// a to nije nužno istina — može biti da je kuća iz kataloga takva.
process.exitCode = 0;
