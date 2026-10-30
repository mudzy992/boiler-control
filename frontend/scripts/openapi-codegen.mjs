#!/usr/bin/env node
/**
 * FE2-8 — generisanje i provjera tipova iz OpenAPI ugovora.
 *
 * Izvor istine je `contracts/openapi.json` (generiše ga backend
 * `npm run openapi:generate`). Ovaj skript iz njega proizvodi
 * `src/types/api.d.ts` preko `openapi-typescript`.
 *
 * CI ga koristi u provjernom načinu: ako neko promijeni ugovor a ne
 * regeneriše tipove, skripta pada i time ruši promjenu.
 *
 * Načini rada:
 *   node scripts/openapi-codegen.mjs            provjeri (ne mijenja ništa)
 *   node scripts/openapi-codegen.mjs --write    generiši i zapiši
 *   node scripts/openapi-codegen.mjs --help     pomoć
 *
 * Idempotentan: `--write` dvaput zaredom daje isti fajl, a provjera nakon
 * toga prolazi. Ne čita i ne ispisuje tajne.
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HELP = `openapi-codegen — tipovi iz contracts/openapi.json

Upotreba:
  node scripts/openapi-codegen.mjs            provjeri usklađenost (zadano)
  node scripts/openapi-codegen.mjs --write    generiši i zapiši fajl
  node scripts/openapi-codegen.mjs --help     ova pomoć

Opcije:
  --write   zapiši src/types/api.d.ts umjesto samo provjere
  --help    prikaži pomoć i izađi

Izlazne vrijednosti:
  0  usklađeno (ili zapisano)
  1  ugovor i generisani tipovi se razlikuju, ili generator nije uspio
  2  pogrešno korištenje / nedostaje ugovor
`;

const here = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(here, '..');
const contractPath = resolve(frontendRoot, '../contracts/openapi.json');
const outputPath = resolve(frontendRoot, 'src/types/api.d.ts');

function fail(code, message) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  process.stdout.write(HELP);
  process.exit(0);
}

const unknown = args.filter((a) => a !== '--write');
if (unknown.length > 0) {
  process.stderr.write(`Nepoznata opcija: ${unknown.join(', ')}\n\n${HELP}`);
  process.exit(2);
}

const write = args.includes('--write');

if (!existsSync(contractPath)) {
  fail(2, `Ugovor nije pronađen: ${relative(process.cwd(), contractPath)}`);
}

/** Pokreni openapi-typescript i vrati sadržaj koji bi napisao. */
function generate(target) {
  const cli = resolve(frontendRoot, 'node_modules/.bin/openapi-typescript');
  const runner = existsSync(cli) ? cli : 'openapi-typescript';
  const res = spawnSync(runner, [contractPath, '-o', target], {
    cwd: frontendRoot,
    encoding: 'utf8',
    shell: !existsSync(cli),
  });
  if (res.status !== 0) {
    fail(
      1,
      `openapi-typescript nije uspio (exit ${res.status}).\n` +
        `${res.stderr || res.stdout || ''}`.trim(),
    );
  }
  return readFileSync(target, 'utf8');
}

if (write) {
  const content = generate(outputPath);
  process.stdout.write(
    `Zapisano ${relative(process.cwd(), outputPath)} ` +
      `(${content.split('\n').length} linija).\n`,
  );
  process.exit(0);
}

// Provjera: generiši u privremeni fajl i uporedi s komitovanim.
const dir = mkdtempSync(join(tmpdir(), 'openapi-codegen-'));
const tmp = join(dir, 'api.d.ts');
try {
  const expected = generate(tmp);

  if (!existsSync(outputPath)) {
    fail(
      1,
      `Nedostaje ${relative(process.cwd(), outputPath)}.\n` +
        'Pokreni: npm run openapi:generate',
    );
  }

  const actual = readFileSync(outputPath, 'utf8');
  if (actual === expected) {
    process.stdout.write('openapi tipovi su usklađeni s ugovorom.\n');
    process.exit(0);
  }

  const lines = (s) => s.split('\n').length;
  fail(
    1,
    [
      'Generisani tipovi se razlikuju od contracts/openapi.json.',
      '',
      `  komitovano : ${relative(process.cwd(), outputPath)} (${lines(actual)} linija)`,
      `  očekivano  : ${lines(expected)} linija iz trenutnog ugovora`,
      '',
      'Ugovor je promijenjen bez regeneracije frontend tipova.',
      'Pokreni: npm run openapi:generate  (u frontend/)',
    ].join('\n'),
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}
