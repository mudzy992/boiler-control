#!/usr/bin/env node
/* FE2-7 (FE-009): offline provjera mjerodavne deploy konfiguracije frontenda. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

if (process.argv.includes('--help')) {
  console.log(
    'Upotreba: node scripts/audit/frontend_deploy_config_repro.cjs\n' +
      '\n' +
      'Provjerava FE2-7 (FE-009) bez dockera, mreze i baze:\n' +
      '  1. `frontend/docker-compose.yml` NE postoji (obrisana varijanta);\n' +
      '  2. frontend port u korijenskom compose == `listen` u `frontend/nginx.conf`\n' +
      '     (obrisana varijanta je imala 3021, nginx slusa 80 -> Traefik ne bi dosao\n' +
      '     do kontejnera);\n' +
      '  3. Traefik `loadbalancer.server.port` == isti port;\n' +
      '  4. build arg `VITE_API_URL` == dogovoreni produkcijski API base;\n' +
      '  5. `api.ts` nema `localhost:3020` fallback;\n' +
      '  6. backend servis NEMA stripprefix (backend nema setGlobalPrefix, kontroleri\n' +
      '     nose `api/...`, pa bi skidanje prefiksa dalo 404 na svim rutama);\n' +
      '  7. backend `FRONTEND_URL` == origin iz frontend Traefik rule-a (backend ga\n' +
      '     koristi kao CORS origin i baca gresku ako nedostaje);\n' +
      '  8. ako postoji `frontend/dist`: ugradjen API base prisutan, `localhost:3020`\n' +
      '     odsutan.\n' +
      '\n' +
      'Za `docker compose config` i build slike treba docker - ovdje nije instaliran,\n' +
      'pa ih pokriva CI korak "Deploy config and build args (FE2-7)".\n' +
      'Trazi js-yaml u backend/node_modules ili frontend/node_modules (npm ci).'
  );
  process.exit(0);
}
if (process.argv.length !== 2) {
  console.error('Nepoznat argument; koristite --help');
  process.exit(2);
}

const ROOT = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

/** js-yaml dolazi kao transitive zavisnost; trazimo ga u oba node_modules. */
function loadYaml() {
  for (const base of ['backend', 'frontend']) {
    try {
      return require(path.join(ROOT, base, 'node_modules/js-yaml'));
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') throw error;
    }
  }
  throw new Error('js-yaml nije instaliran; pokrenite npm ci u backend/ ili frontend/');
}

const EXPECTED_API_BASE = 'https://api.boiler-control.ba101.top/api';
const EXPECTED_FRONTEND_HOST = 'boiler-control.ba101.top';
const EXPECTED_API_HOST = 'api.boiler-control.ba101.top';

/**
 * Uklanja komentare iz TS/JS izvora, ali NE dira sadrzaj stringova.
 *
 * Naivni regexovi ovdje ne rade: `//.*$` bi odsjekao `https://...` unutar
 * stringa (URL sadrzi `//`), a `/localhost:3020/` bez skidanja komentara pada
 * na JSDoc-u koji NAMJERNO dokumentuje uklonjeni fallback. Zato pravi state
 * machine koji prati string / template / linijski / blocni komentar.
 */
function stripComments(source) {
  let out = '';
  let i = 0;
  const n = source.length;
  let state = 'code';
  while (i < n) {
    const c = source[i];
    const next = source[i + 1];
    if (state === 'code') {
      if (c === '/' && next === '/') { state = 'line'; i += 2; continue; }
      if (c === '/' && next === '*') { state = 'block'; i += 2; continue; }
      if (c === "'") { state = 'single'; out += c; i += 1; continue; }
      if (c === '"') { state = 'double'; out += c; i += 1; continue; }
      if (c === '`') { state = 'template'; out += c; i += 1; continue; }
      out += c; i += 1; continue;
    }
    if (state === 'line') {
      if (c === '\n') { state = 'code'; out += c; }
      i += 1; continue;
    }
    if (state === 'block') {
      if (c === '*' && next === '/') { state = 'code'; i += 2; continue; }
      i += 1; continue;
    }
    // string / template: pazimo na escape
    out += c;
    if (c === '\\') { out += next ?? ''; i += 2; continue; }
    if ((state === 'single' && c === "'") || (state === 'double' && c === '"') || (state === 'template' && c === '`')) {
      state = 'code';
    }
    i += 1;
  }
  return out;
}

function labelsOf(service) {
  return service.labels || [];
}

function labelValue(labels, key) {
  const hit = labels.find((l) => String(l).startsWith(`${key}=`));
  return hit === undefined ? undefined : String(hit).slice(key.length + 1);
}

async function main() {
  const yaml = loadYaml();
  const report = { scope: 'offline; bez dockera/mreze/baze' };

  // 1. obrisana varijanta ne smije postojati
  assert.equal(
    exists('frontend/docker-compose.yml'),
    false,
    'frontend/docker-compose.yml mora biti obrisan (FE2-7: jedan mjerodavni set)'
  );
  report.obrisanaVarijantaPrisutna = false;

  const composeText = read('docker-compose.yml');
  const compose = yaml.load(composeText);
  // Bez ovoga prazan/ostecen fajl daje "Cannot read properties of undefined"
  // umjesto jasne poruke — a upravo to se desi kad mutacija zapise prazno.
  assert.ok(
    compose && typeof compose === 'object' && compose.services,
    'docker-compose.yml se ne parsira u objekt sa `services` (prazan ili ostecen fajl?)'
  );
  const frontend = compose.services['boiler-control-frontend'];
  const backend = compose.services['boiler-control-backend'];
  assert.ok(frontend, 'compose mora definirati boiler-control-frontend');
  assert.ok(backend, 'compose mora definirati boiler-control-backend');

  // 2. port u compose == listen u nginx.conf
  const nginxText = read('frontend/nginx.conf');
  const listenMatch = nginxText.match(/^\s*listen\s+(\d+);/m);
  assert.ok(listenMatch, 'nginx.conf mora imati `listen <port>;`');
  const nginxPort = listenMatch[1];
  const exposed = (frontend.expose || []).map(String);
  assert.deepEqual(
    exposed,
    [nginxPort],
    `frontend expose mora biti [${nginxPort}] (nginx listen), bilo ${JSON.stringify(exposed)}`
  );
  report.nginxListenPort = Number(nginxPort);
  report.frontendExpose = exposed;

  // 3. traefik loadbalancer port == isti port
  const feLabels = labelsOf(frontend);
  const lbPort = labelValue(feLabels, 'traefik.http.services.boiler-frontend.loadbalancer.server.port');
  assert.equal(lbPort, nginxPort, `traefik loadbalancer port mora biti ${nginxPort}, bilo ${lbPort}`);
  report.traefikLoadbalancerPort = Number(lbPort);

  const feHost = labelValue(feLabels, 'traefik.http.routers.boiler-frontend.rule');
  assert.ok(feHost, 'frontend mora imati traefik rule');
  assert.ok(
    feHost.includes(EXPECTED_FRONTEND_HOST),
    `frontend rule mora sadrzavati ${EXPECTED_FRONTEND_HOST}, bilo: ${feHost}`
  );
  report.frontendHost = EXPECTED_FRONTEND_HOST;

  // 4. build arg VITE_API_URL
  const buildArg = frontend.build && frontend.build.args && frontend.build.args.VITE_API_URL;
  assert.equal(
    buildArg,
    EXPECTED_API_BASE,
    `VITE_API_URL build arg mora biti ${EXPECTED_API_BASE}, bilo ${buildArg}`
  );
  report.viteApiUrl = buildArg;

  const beHost = labelValue(labelsOf(backend), 'traefik.http.routers.boiler-backend.rule');
  assert.ok(beHost, 'backend mora imati traefik rule');
  assert.ok(
    beHost.includes(EXPECTED_API_HOST),
    `backend rule mora sadrzavati ${EXPECTED_API_HOST}, bilo: ${beHost}`
  );
  report.apiHost = EXPECTED_API_HOST;

  // 5. api.ts bez localhost fallbacka
  //
  // Provjeravamo SAMO kod (komentari skinuti): JSDoc iznad namjerno dokumentuje
  // uklonjeni fallback i spominje `http://localhost:3020/api`, pa bi naivna
  // provjera po cijelom fajlu lažno padala.
  const apiText = read('frontend/src/services/api.ts');
  const apiCode = stripComments(apiText);
  assert.ok(
    apiCode.length > 0 && apiCode.length < apiText.length,
    'stripComments mora nesto skinuti (sanity provjera state machine-a)'
  );
  assert.equal(
    /localhost:\d+/.test(apiCode),
    false,
    'api.ts (kod bez komentara) ne smije sadrzavati localhost:<port> fallback (FE2-7)'
  );
  // Dodatno: ne smije postojati fallback operator s localhost literalom.
  assert.equal(
    /(\|\||\?\?)\s*['"`][^'"`]*localhost/.test(apiCode),
    false,
    'api.ts ne smije imati `|| "…localhost…"` niti `?? "…localhost…"` fallback'
  );
  report.apiTsFallback = 'nema';
  report.apiTsKomentaraSkinutoZnakova = apiText.length - apiCode.length;

  // 6. backend bez stripprefix
  const beLabels = labelsOf(backend);
  const stripLabels = beLabels.filter((l) => String(l).includes('stripprefix'));
  assert.deepEqual(
    stripLabels,
    [],
    `backend ne smije imati stripprefix (nema setGlobalPrefix), bilo ${JSON.stringify(stripLabels)}`
  );
  report.backendStripprefix = 'nema';

  // 7. FRONTEND_URL == origin frontend-a (CORS)
  const env = backend.environment || [];
  const frontendUrlEntry = env
    .map(String)
    .find((e) => e.startsWith('FRONTEND_URL='));
  assert.ok(frontendUrlEntry, 'backend mora imati FRONTEND_URL (main.ts baca gresku bez njega)');
  const frontendUrl = frontendUrlEntry.slice('FRONTEND_URL='.length);
  assert.equal(
    frontendUrl,
    `https://${EXPECTED_FRONTEND_HOST}`,
    `FRONTEND_URL mora biti https://${EXPECTED_FRONTEND_HOST} (CORS origin), bilo ${frontendUrl}`
  );
  report.corsOrigin = frontendUrl;

  // 8. dist provjera (samo ako je build vec pokrenut)
  if (exists('frontend/dist')) {
    const assetsDir = path.join(ROOT, 'frontend/dist/assets');
    const files = fs.existsSync(assetsDir)
      ? fs.readdirSync(assetsDir).filter((f) => f.endsWith('.js'))
      : [];
    let embedded = 0;
    let leaked = 0;
    for (const f of files) {
      const text = fs.readFileSync(path.join(assetsDir, f), 'utf8');
      if (text.includes(EXPECTED_API_BASE)) embedded += 1;
      if (text.includes('localhost:3020')) leaked += 1;
    }
    assert.ok(embedded > 0, `nijedan JS cip u dist ne sadrzi ${EXPECTED_API_BASE}`);
    assert.equal(leaked, 0, `${leaked} cip(ova) u dist sadrzi localhost:3020`);
    report.dist = { jsCipova: files.length, sUgradjenimApiBase: embedded, sLocalhostCurenjem: leaked };
  } else {
    report.dist = 'nije buildovan (preskoceno)';
  }

  report.composeFajlovi = fs
    .readdirSync(ROOT)
    .filter((f) => /^docker-compose.*\.ya?ml$/.test(f))
    .sort();
  report.composeFajlovi.push('backend/docker-compose.yml (oznacen zamijenjenim)');

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error('Provjera nije uspjela:', error.message);
  process.exitCode = 1;
});
