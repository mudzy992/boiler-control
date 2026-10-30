#!/usr/bin/env node
/**
 * SEC-0 / S-005 / S-008 — canary za curenje tajni.
 *
 * Read-only i idempotentna. NE ispisuje vrijednosti tajni: izlaz sadrži samo
 * IMENA polja, putanje fajlova i brojače. Ne rotira, ne mijenja i ne čita
 * kredencijale izvana.
 *
 * Provjere:
 *   1. Docker build kontekst — je li goli `.env` isključen iz
 *      `backend/.dockerignore`? (S-005: `.env.local` ga NE isključuje.)
 *   2. Curenje vrijednosti — pojavljuje li se stvarna vrijednost osjetljivog
 *      polja u bilo kojem Gitom praćenom fajlu osim `backend/.env`?
 *   3. Paritet `.env` ↔ `.env.example` (S-005: template mora pokrivati sva polja).
 *   4. Informativno: je li `backend/.env` još uvijek praćen Gitom.
 *
 * Ograničenja: podudaranje `.dockerignore` je PODSKUP (exact, `*`, `**`,
 * negacija) i nije zamjena za stvarni `docker build`; u sandboxu nema dockera.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

if (process.argv.includes('--help')) {
  console.log(
    'Upotreba: node scripts/audit/env_leak_canary.cjs\n' +
      '\n' +
      'Read-only canary za curenje tajni (SEC-0 / S-005 / S-008).\n' +
      'NE ispisuje vrijednosti tajni — samo imena polja, putanje i brojače.\n' +
      '\n' +
      'Provjerava:\n' +
      '  1. da je goli .env isključen iz backend/.dockerignore (build kontekst)\n' +
      '  2. da se stvarne vrijednosti osjetljivih polja ne pojavljuju u Gitom\n' +
      '     praćenim fajlovima (osim u backend/.env)\n' +
      '  3. da backend/.env.example pokriva sva polja iz backend/.env\n' +
      '  4. informativno, je li backend/.env još praćen Gitom\n' +
      '\n' +
      'Izlaz: JSON sažetak. EXIT 0 = bez nalaza, 1 = nalaz, 2 = neispravni argumenti.\n' +
      'Idempotentna, bez mreže, bez baze, bez uređaja, bez rotacije kredencijala.\n' +
      '\n' +
      'Ograničenje: .dockerignore podudaranje je podskup i ne zamjenjuje stvarni\n' +
      '`docker build`; provjeru build konteksta u produkciji potvrditi canary-jem\n' +
      'unutar image-a.',
  );
  process.exit(0);
}
if (process.argv.length !== 2) {
  console.error('Nepoznat argument; koristite --help');
  process.exit(2);
}

const root = path.resolve(__dirname, '../..');
const ENV_PATH = path.join(root, 'backend/.env');
const EXAMPLE_PATH = path.join(root, 'backend/.env.example');
const DOCKERIGNORE_PATH = path.join(root, 'backend/.dockerignore');

/** Polja koja se smatraju osjetljivima; sva ostala se ne pretražuju. */
const SENSITIVE = new Set([
  'JWT_SECRET',
  'DATABASE_PASSWORD',
  'DATABASE_URL',
  'TUYA_CLIENT_SECRET',
  'TUYA_CLIENT_ID',
  'WEATHER_API_KEY',
  'DATABASE_USER',
]);

/** Minimalna dužina vrijednosti da bi pretraga imala smisla. */
const MIN_VALUE_LENGTH = 8;

function parseEnv(file) {
  const out = new Map();
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line);
    if (m) out.set(m[1], m[2].trim());
  }
  return out;
}

/**
 * Podskup .dockerignore semantike: exact, `*` unutar segmenta, `**` preko
 * segmenata, vodeći `/`, i `!` negacija (posljednje podudaranje pobjeđuje).
 */
function isExcludedByDockerignore(patterns, target) {
  let excluded = false;
  for (const raw of patterns) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const negated = line.startsWith('!');
    const pattern = (negated ? line.slice(1) : line).replace(/^\//, '');
    if (!pattern) continue;
    if (matches(pattern, target)) excluded = !negated;
  }
  return excluded;
}

function matches(pattern, target) {
  const rx = new RegExp(
    '^' +
      pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '\u0000')
        .replace(/\*/g, '[^/]*')
        .replace(/\u0000/g, '.*')
        .replace(/\?/g, '[^/]') +
      '$',
  );
  return rx.test(target);
}

function gitTrackedFiles() {
  return execFileSync('git', ['ls-files', '-z'], { cwd: root, maxBuffer: 64 * 1024 * 1024 })
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
}

const findings = [];
const report = {
  scope: 'read-only canary; bez ispisa vrijednosti tajni, bez rotacije, bez mreže',
  dockerBuildContext: null,
  valueLeakage: null,
  envExampleParity: null,
  envTrackedInGit: null,
};

// --- 1) Docker build kontekst ---
if (!fs.existsSync(DOCKERIGNORE_PATH)) {
  findings.push('backend/.dockerignore ne postoji — .env sigurno ulazi u build kontekst');
  report.dockerBuildContext = { dockerignoreExists: false, envExcluded: false };
} else {
  const patterns = fs.readFileSync(DOCKERIGNORE_PATH, 'utf8').split(/\r?\n/);
  const envExcluded = isExcludedByDockerignore(patterns, '.env');
  report.dockerBuildContext = { dockerignoreExists: true, envExcluded };
  if (!envExcluded) {
    findings.push(
      'goli .env NIJE isključen iz backend/.dockerignore (pravila poput .env.local ga ne pokrivaju) — S-005',
    );
  }
}

// --- 2) Curenje vrijednosti u Gitom praćene fajlove ---
const env = parseEnv(ENV_PATH);
const tracked = gitTrackedFiles();
const skip = new Set(['backend/.env']);
const leaked = [];
let scanned = 0;
let skippedBinaryOrLarge = 0;

for (const rel of tracked) {
  if (skip.has(rel)) continue;
  const abs = path.join(root, rel);
  let stat;
  try {
    stat = fs.statSync(abs);
  } catch {
    continue;
  }
  if (!stat.isFile() || stat.size > 5 * 1024 * 1024) {
    skippedBinaryOrLarge += 1;
    continue;
  }
  let content;
  try {
    content = fs.readFileSync(abs, 'utf8');
  } catch {
    skippedBinaryOrLarge += 1;
    continue;
  }
  if (content.includes('\u0000')) {
    skippedBinaryOrLarge += 1;
    continue;
  }
  scanned += 1;
  for (const [key, value] of env) {
    if (!SENSITIVE.has(key)) continue;
    if (value.length < MIN_VALUE_LENGTH) continue;
    if (content.includes(value)) leaked.push({ key, file: rel });
  }
}

report.valueLeakage = {
  sensitiveFieldsChecked: [...SENSITIVE].filter(
    (k) => (env.get(k) || '').length >= MIN_VALUE_LENGTH,
  ),
  filesScanned: scanned,
  filesSkipped: skippedBinaryOrLarge,
  leaks: leaked,
};
if (leaked.length > 0) {
  findings.push(
    `stvarna vrijednost osjetljivog polja pojavljuje se u ${leaked.length} praćenih fajlova (vidi leaks)`,
  );
}

// --- 3) Paritet .env ↔ .env.example ---
const example = parseEnv(EXAMPLE_PATH);
const missing = [...env.keys()].filter((k) => !example.has(k));
const extra = [...example.keys()].filter((k) => !env.has(k));
report.envExampleParity = {
  envFields: env.size,
  exampleFields: example.size,
  missingInExample: missing,
  extraInExample: extra,
};
if (missing.length > 0) {
  findings.push(`backend/.env.example ne pokriva polja: ${missing.join(', ')}`);
}

// --- 4) Informativno: praćenje ---
const envTracked = tracked.includes('backend/.env');
report.envTrackedInGit = envTracked;

report.findings = findings;
report.napomena = envTracked
  ? 'backend/.env je i dalje praćen Gitom. Uklanjanje iz HEAD-a NE briše historiju; rotaciju i čišćenje historije provodi vlasnik prema runbook-u (docs/audit/backend/11-secret-rotation-runbook.md).'
  : 'backend/.env nije praćen Gitom.';

console.log(JSON.stringify(report, null, 2));
process.exitCode = findings.length > 0 ? 1 : 0;
