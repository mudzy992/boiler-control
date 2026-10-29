#!/usr/bin/env node
/**
 * MO2-2 — verifikacija version gate-a mobilne aplikacije.
 *
 * Mobilni projekt NEMA test runner (`npm test` u `mobile/` daje exit 127 —
 * nalaz MO-012), pa se logika gate-a ne može provjeriti klasičnim jediničnim
 * testom. Ova skripta zato:
 *
 *   1. transpajlira STVARNI `mobile/src/config/version.config.ts` (i
 *      `api.config.ts` koji on importuje) preko TypeScript API-ja,
 *   2. stub-uje `expo-application` / `expo-constants` (nativni moduli),
 *   3. podigne lokalni HTTP server koji glumi `GET /api/app/config`,
 *   4. izvrši stvarni `checkVersionGate()` i assert-uje ishode.
 *
 * Time se pokreće upravo onaj kod koji ide u produkciju — ne njegova kopija.
 *
 * Upotreba:
 *   node scripts/audit/mobile_version_gate.cjs           # pokreni provjere
 *   node scripts/audit/mobile_version_gate.cjs --help    # ovaj tekst
 *
 * Izlaz: exit 0 ako sve prolazi, exit 1 uz ispis palih provjera.
 * Skripta je idempotentna i ne dira mrežu izvan 127.0.0.1.
 */
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const Module = require('module');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MOBILE_DIR = path.join(REPO_ROOT, 'mobile');
const SRC_CONFIG = path.join(MOBILE_DIR, 'src', 'config');
// Radni direktorij unutar mobile/ da Node rezolucija nadje mobile/node_modules
// (axios, typescript). Briše se nakon pokretanja.
const WORK_DIR = path.join(MOBILE_DIR, '.tmp-mo22-verify');

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  const lines = fs.readFileSync(__filename, 'utf8').split('\n');
  const start = lines.findIndex((l) => l.startsWith(' * MO2-2'));
  const end = lines.findIndex((l) => l.startsWith(' */'));
  process.stdout.write(
    lines
      .slice(start, end)
      .map((l) => l.replace(/^ ?\* ?/, ''))
      .join('\n') + '\n',
  );
  process.exit(0);
}

const ts = require(path.join(MOBILE_DIR, 'node_modules', 'typescript'));

// ---------------------------------------------------------------- priprema

/** Verzija koju "instalirani build" prijavljuje; mijenja se po testu. */
const stubState = { nativeApplicationVersion: '2.0.0', expoConfigVersion: '2.0.0' };

function installStubs() {
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'expo-application') {
      // Vraćamo SAM živi objekt s `__esModule: true`, jer tada `__importStar`
      // (nastao iz `import * as Application`) vraća modul nepromijenjen, pa
      // `Application.nativeApplicationVersion` pogađa živi getter. Bilo kakav
      // spread ovdje bi getter pozvao odmah i zamrznuo vrijednost.
      const live = { __esModule: true, applicationName: 'Boiler Control' };
      Object.defineProperty(live, 'nativeApplicationVersion', {
        get: () => stubState.nativeApplicationVersion,
        enumerable: true,
      });
      return live;
    }
    if (request === 'expo-constants') {
      const live = { manifest: null };
      Object.defineProperty(live, 'expoConfig', {
        get: () => ({ version: stubState.expoConfigVersion, extra: {} }),
        enumerable: true,
      });
      // NAMJERNO bez `{ ...live }` — spread bi ODMAH pozvao getter i zamrznuo
      // vrijednost, pa kasnije izmjene stubState ne bi bile vidljive.
      return { __esModule: true, default: live };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
}

function transpileConfigFiles() {
  const outDir = path.join(WORK_DIR, 'config');
  fs.mkdirSync(outDir, { recursive: true });

  for (const name of ['api.config.ts', 'version.config.ts']) {
    const source = fs.readFileSync(path.join(SRC_CONFIG, name), 'utf8');
    const result = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2019,
        esModuleInterop: true,
      },
      fileName: name,
    });
    fs.writeFileSync(path.join(outDir, name.replace(/\.ts$/, '.js')), result.outputText);
  }
  return path.join(outDir, 'version.config.js');
}

// ------------------------------------------------------------ HTTP server

/** Odgovor koji server vraca; mijenja se po testu. */
let serverBehaviour = { status: 200, body: {} };

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (req.url !== '/api/app/config') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
        return;
      }
      res.writeHead(serverBehaviour.status, { 'Content-Type': 'application/json' });
      res.end(typeof serverBehaviour.body === 'string'
        ? serverBehaviour.body
        : JSON.stringify(serverBehaviour.body));
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

// ------------------------------------------------------------- provjere

const failures = [];
let passed = 0;

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed += 1;
    process.stdout.write(`  ok   ${label}\n`);
  } else {
    failures.push(label);
    process.stdout.write(
      `  FAIL ${label}\n         ocekivano: ${JSON.stringify(expected)}\n         stvarno  : ${JSON.stringify(actual)}\n`,
    );
  }
}

async function main() {
  installStubs();
  global.__DEV__ = false;

  const server = await startServer();
  const { port } = server.address();
  process.env.EXPO_PUBLIC_API_URL = `http://127.0.0.1:${port}/api`;

  let mod;
  try {
    const entry = transpileConfigFiles();
    mod = require(entry);
  } catch (error) {
    process.stderr.write(`Transpajliranje/ucitavanje nije uspjelo: ${error.message}\n`);
    await new Promise((r) => server.close(r));
    fs.rmSync(WORK_DIR, { recursive: true, force: true });
    process.exit(1);
  }

  const { compareVersions, getAppVersion, checkVersionGate } = mod;

  try {
    process.stdout.write('\n== compareVersions (strogi semver) ==\n');
    check('1.0.0 < 2.0.0', Math.sign(compareVersions('1.0.0', '2.0.0')), -1);
    check('2.0.0 == 2.0.0', compareVersions('2.0.0', '2.0.0'), 0);
    check('2.1.0 > 2.0.9', Math.sign(compareVersions('2.1.0', '2.0.9')), 1);
    // Numericko, NE leksikografsko poređenje.
    check('10.0.0 > 9.9.9', Math.sign(compareVersions('10.0.0', '9.9.9')), 1);
    check('2.0.10 > 2.0.9', Math.sign(compareVersions('2.0.10', '2.0.9')), 1);

    process.stdout.write('\n== getAppVersion (jedan izvor verzije) ==\n');
    stubState.nativeApplicationVersion = '2.0.0';
    check('cita nativeApplicationVersion', getAppVersion(), '2.0.0');
    stubState.nativeApplicationVersion = null;
    check('fallback na expoConfig.version', getAppVersion(), '2.0.0');
    stubState.nativeApplicationVersion = null;
    stubState.expoConfigVersion = null;
    check('nepoznato -> 0.0.0 (ne blokira)', getAppVersion(), '0.0.0');
    stubState.nativeApplicationVersion = '2.0.0';
    stubState.expoConfigVersion = '2.0.0';

    process.stdout.write('\n== checkVersionGate: backend kaze da je verzija prestara ==\n');
    serverBehaviour = {
      status: 200,
      body: { minSupportedVersion: '3.0.0', latestVersion: '3.0.0', versionGateEnabled: true },
    };
    let gate = await checkVersionGate();
    check('mustUpdate = true', gate.mustUpdate, true);
    check('verifiedByBackend = true', gate.verifiedByBackend, true);
    check('minSupportedVersion proslijedjen', gate.minSupportedVersion, '3.0.0');
    check('currentVersion', gate.currentVersion, '2.0.0');

    process.stdout.write('\n== checkVersionGate: verzija je dovoljno nova ==\n');
    serverBehaviour = {
      status: 200,
      body: { minSupportedVersion: '1.0.0', latestVersion: '3.0.0', versionGateEnabled: true },
    };
    gate = await checkVersionGate();
    check('mustUpdate = false', gate.mustUpdate, false);
    check('verifiedByBackend = true', gate.verifiedByBackend, true);

    process.stdout.write('\n== checkVersionGate: kill switch ==\n');
    serverBehaviour = {
      status: 200,
      body: { minSupportedVersion: '9.9.9', latestVersion: '9.9.9', versionGateEnabled: false },
    };
    gate = await checkVersionGate();
    check('mustUpdate = false iako je min visok', gate.mustUpdate, false);
    check('verifiedByBackend = true', gate.verifiedByBackend, true);

    process.stdout.write('\n== FAIL-OPEN: neispravan odgovor ne smije blokirati ==\n');
    serverBehaviour = {
      status: 200,
      body: { minSupportedVersion: 'nije-verzija', versionGateEnabled: true },
    };
    gate = await checkVersionGate();
    check('neispravan semver -> mustUpdate = false', gate.mustUpdate, false);
    check('neispravan semver -> verifiedByBackend = false', gate.verifiedByBackend, false);

    serverBehaviour = { status: 200, body: 'ovo-nije-json' };
    gate = await checkVersionGate();
    check('ne-JSON odgovor -> mustUpdate = false', gate.mustUpdate, false);

    serverBehaviour = { status: 500, body: { error: 'boom' } };
    gate = await checkVersionGate();
    check('HTTP 500 -> mustUpdate = false', gate.mustUpdate, false);
    check('HTTP 500 -> verifiedByBackend = false', gate.verifiedByBackend, false);

    process.stdout.write('\n== FAIL-OPEN: backend nedostupan ==\n');
    await new Promise((r) => server.close(r));
    gate = await checkVersionGate();
    check('ECONNREFUSED -> mustUpdate = false', gate.mustUpdate, false);
    check('ECONNREFUSED -> verifiedByBackend = false', gate.verifiedByBackend, false);
  } finally {
    if (server.listening) await new Promise((r) => server.close(r));
    fs.rmSync(WORK_DIR, { recursive: true, force: true });
  }

  process.stdout.write(`\n${passed} prolazi, ${failures.length} pada\n`);
  if (failures.length > 0) {
    process.stdout.write(`Pale provjere:\n${failures.map((f) => `  - ${f}`).join('\n')}\n`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((error) => {
  process.stderr.write(`Neocekivana greska: ${error.stack || error.message}\n`);
  fs.rmSync(WORK_DIR, { recursive: true, force: true });
  process.exit(1);
});
