#!/usr/bin/env node
/**
 * Provjera da `docs/FORMULA.md` nije ostarjeo u odnosu na kod.
 *
 * Dokument je namjerno pisan brojevima, a brojevi u dokumentu su najlakše
 * mjesto da tiho postanu laž. Zato ih ovdje **čitamo iz koda**, ne iz
 * komentara, i poredimo sa tabelom u `FORMULA.md` (§8).
 *
 * Ne parsira TypeScript. Svaka konstanta se izvozi preko `ts-node`-a iz stvarnog
 * modula, ili — za module koji vuku Prisma klijenta — čita regexom iz izvora.
 * Regex je ovdje prihvatljiv jer tražimo doslovno `export const NAME = <broj>`.
 *
 * Upotreba:
 *   node scripts/audit/formula_doc_check.cjs
 *   node scripts/audit/formula_doc_check.cjs --json
 *
 * `FORMULA_DOC=<putanja>` čita drugi dokument. To postoji zbog testa koji mora
 * dokazati da provjera **pada** kad broj odstupa — a da pri tome ne dira pravi
 * dokument (test koji kvari pravi fajl je test koji nekad ostane pokvaren).
 *
 * Izlaz: 0 = dokument i kod se slažu; 1 = razlika (ispisuje svaku).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const DOC = process.env.FORMULA_DOC
  ? path.resolve(process.env.FORMULA_DOC)
  : path.join(ROOT, 'docs/FORMULA.md');
const BACKEND = path.join(ROOT, 'backend/src/modules');

/** Tabela „konstanta → fajl", ista kao §8 u dokumentu. */
const SOURCES = {
  'equilibrium-flow.ts': 'DailyRecord/equilibrium-flow.ts',
  'proposal-controller.ts': 'DailyRecord/proposal-controller.ts',
  'day-outcome.ts': 'DailyRecord/day-outcome.ts',
  'flow-bounds.ts': 'DailyRecord/flow-bounds.ts',
  'daily-balance.ts': 'HomeModel/daily-balance.ts',
  'flow-constants.ts': 'DailyRecord/flow-constants.ts',
};

function readSource(file) {
  const rel = SOURCES[file];
  if (!rel) return null;
  const full = path.join(BACKEND, rel);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, 'utf8');
}

/**
 * Vrijednost konstante iz izvora.
 *
 * Podržava `export const X = 42;`, `export const X = 1.5;`, negativne brojeve i
 * indirekciju u jedan korak (`export const A = B`), jer `flow-constants.ts`
 * tako izvodi `CURVE_MAX_FLOW_C` i `HOME_MIN_FLOW_C`. Lanac duži od jednog
 * koraka namjerno pada — to bi značilo da dokument treba proširiti.
 */
function readConst(source, name) {
  if (!source) return { value: null, error: 'fajl nije nađen' };
  const pattern = new RegExp(
    `export\\s+const\\s+${name}\\s*=\\s*(?:(-?[\\d.]+)|([A-Z_][A-Z0-9_]*))\\s*;`,
  );
  const match = source.match(pattern);
  if (!match) return { value: null, error: 'konstanta nije nađena' };

  if (match[1] != null) {
    const value = Number(match[1]);
    if (!Number.isFinite(value)) return { value: null, error: `nije broj: ${match[1]}` };
    return { value, error: null };
  }

  const target = match[2];
  const inner = new RegExp(`export\\s+const\\s+${target}\\s*=\\s*(-?[\\d.]+)\\s*;`).exec(source);
  if (!inner) return { value: null, error: `indirekcija u ${target} nije broj` };
  return { value: Number(inner[1]), error: null };
}

/** Redovi tabele §8: `| \`NAME\` | 0.3 | \`file.ts\` |`. */
function readDocTable(text) {
  const rows = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const match = /^\|\s*`([A-Z][A-Z0-9_]*)`\s*\|\s*(-?[\d.]+)\s*\|\s*`([^`]+)`\s*\|$/.exec(
      line.trim(),
    );
    if (match) rows.push({ name: match[1], value: Number(match[2]), file: match[3] });
  }
  return rows;
}

/**
 * Brojevi koji se u dokumentu tvrde **izvan** tabele §8 i zato ih ovdje
 * provjeravamo posebno. Svaki je par (tekst u dokumentu, konstanta + vrijednost
 * koja mora važiti). Kad se neka od ovih promijeni u kodu, dokument se mora
 * promijeniti na istom mjestu — inače rečenica laže iako tabela ne laže.
 */
const PROSE = [
  { doc: 'w = 0,3', name: 'DAY_REFERENCE_WEIGHT', file: 'equilibrium-flow.ts', expect: 0.3 },
  { doc: 'dok je days < 20', name: 'SLOPE_CONSERVATIVE_MAX_DAYS', file: 'equilibrium-flow.ts', expect: 20 },
  { doc: 'više od **2 K** hladnija', name: 'NIGHT_COMPARABLE_TOLERANCE_K', file: 'flow-bounds.ts', expect: 2 },
  { doc: 'podbacila + **1 K**', name: 'NIGHT_MARGIN_K', file: 'flow-bounds.ts', expect: 1 },
  { doc: '**8 dana**', name: 'MIN_DAYS_FOR_FIT', file: 'daily-balance.ts', expect: 8 },
  { doc: '0,2–1,5', name: 'SLOPE_MIN', file: 'daily-balance.ts', expect: 0.2 },
  { doc: '0,2–1,5', name: 'SLOPE_MAX', file: 'daily-balance.ts', expect: 1.5 },
  { doc: '≥ 80 % od 288', name: 'MIN_DAY_COVERAGE_RATIO', file: 'daily-balance.ts', expect: 0.8 },
  { doc: '3·MAD', name: 'RESIDUAL_REJECTION_FACTOR', file: 'daily-balance.ts', expect: 3 },
];

function main() {
  const json = process.argv.includes('--json');
  if (!fs.existsSync(DOC)) {
    console.error('::error::docs/FORMULA.md ne postoji');
    process.exit(1);
  }
  const text = fs.readFileSync(DOC, 'utf8');
  const rows = readDocTable(text);
  if (rows.length === 0) {
    console.error('::error::docs/FORMULA.md nema tabelu konstanti (§8)');
    process.exit(1);
  }

  const cache = new Map();
  const source = (file) => {
    if (!cache.has(file)) cache.set(file, readSource(file));
    return cache.get(file);
  };

  const problems = [];
  const checked = [];

  for (const row of rows) {
    const src = source(row.file);
    if (src == null) {
      problems.push(`${row.name}: fajl \`${row.file}\` nije nađen`);
      continue;
    }
    const got = readConst(src, row.name);
    if (got.error) {
      problems.push(`${row.name}: ${got.error} (u \`${row.file}\`)`);
      continue;
    }
    checked.push({ name: row.name, doc: row.value, code: got.value, ok: got.value === row.value });
    if (got.value !== row.value) {
      problems.push(`${row.name}: dokument ${row.value} ≠ kod ${got.value} (\`${row.file}\`)`);
    }
  }

  // Prozne tvrdnje: broj mora postojati u tekstu i u kodu.
  for (const claim of PROSE) {
    if (!text.includes(claim.doc)) {
      problems.push(`proza: „${claim.doc}" više nije u dokumentu (a ${claim.name} se provjerava)`);
      continue;
    }
    const got = readConst(source(claim.file), claim.name);
    if (got.error) {
      problems.push(`proza ${claim.name}: ${got.error}`);
      continue;
    }
    if (got.value !== claim.expect) {
      problems.push(
        `proza: „${claim.doc}" tvrdi ${claim.expect}, a ${claim.name} je ${got.value}`,
      );
    }
  }

  // Dokument mora upućivati na stvarne fajlove — mrtva uputa je gora od nijedne.
  const refs = [...text.matchAll(/`((?:backend\/)?src\/modules\/[^`]+\.ts)`/g)].map((m) => m[1]);
  for (const ref of new Set(refs)) {
    const full = path.join(ROOT, ref.startsWith('backend/') ? ref : `backend/${ref}`);
    if (!fs.existsSync(full)) problems.push(`uputa na nepostojeći fajl: \`${ref}\``);
  }

  if (json) {
    console.log(JSON.stringify({ ok: problems.length === 0, checked, problems }, null, 2));
  } else if (problems.length === 0) {
    console.log(`FORMULA.md: ${rows.length} konstanti i ${PROSE.length} tvrdnji u prozi se slažu sa kodom.`);
    console.log(`::notice::FORMULA.md je u skladu sa kodom (${rows.length} konstanti)`);
  } else {
    for (const problem of problems) console.log(`  ✗ ${problem}`);
    console.error(`::error::FORMULA.md se razišao sa kodom na ${problems.length} mjesta`);
  }

  process.exit(problems.length === 0 ? 0 : 1);
}

main();
