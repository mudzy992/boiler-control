#!/usr/bin/env node
/* Runtime CORS/helmet probe reproducing the exact middleware chain of backend/src/main.ts, plus static
   configuration probes (trust proxy, per-route @Throttle). Local Nest HTTP only; no external network,
   no database, no real credentials. Test values are synthetic or taken from the committed compose file. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
if (process.argv.includes('--help')) {
  console.log('Upotreba: node scripts/audit/cors_headers_repro.cjs\nIzolovana lokalna Nest HTTP reprodukcija istog middleware lanca iz backend/src/main.ts (helmet + enableCors s istim opcijama) uz statičke provere: postoji li trust proxy i postoje li per-route @Throttle dekoratori. Bez vanjske mreže, baze ili stvarnih vjerodajnica; dozvoljeni origin dolazi iz FRONTEND_URL iz komitovanog docker-compose.yml i smatra se testnom vrijednošću.');
  process.exit(0);
}
if (process.argv.length !== 2) { console.error('Nepoznat argument; koristite --help'); process.exit(2); }
const root = path.resolve(__dirname, '../..');
const backend = path.join(root, 'backend');
const nm = (name) => require(path.join(backend, 'node_modules', name));

function read(rel) { return fs.readFileSync(path.join(backend, rel), 'utf8'); }

/* ---- static anchors: the runtime below must mirror main.ts exactly ---- */
const mainSrc = read('src/main.ts');
const anchors = {
  helmetDefault: /app\.use\(helmet\(\)\)/.test(mainSrc),
  originFromEnv: /origin:\s*frontendUrl/.test(mainSrc),
  credentialsFromFlag: /credentials:\s*authCookieEnabled\(\)/.test(mainSrc),
  methodsList: /methods:\s*\[\s*'GET'\s*,\s*'POST'\s*,\s*'PUT'\s*,\s*'PATCH'\s*,\s*'DELETE'\s*,\s*'OPTIONS'\s*\]/.test(mainSrc),
  allowedHeaders: /allowedHeaders:\s*\[\s*'Content-Type'\s*,\s*'Authorization'\s*\]/.test(mainSrc),
  frontendUrlRequired: /throw new Error\('FRONTEND_URL environment variable is required'\)/.test(mainSrc),
};
assert.ok(Object.values(anchors).every(Boolean), `main.ts middleware anchors changed: ${JSON.stringify(anchors)}; update this repro to match the new bootstrap.`);

/* ---- static probes over the whole backend source ---- */
const tsFiles = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'generated' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.ts')) tsFiles.push(full);
  }
})(path.join(backend, 'src'));
let trustProxyHits = [], throttleHits = [];
for (const file of tsFiles) {
  const src = fs.readFileSync(file, 'utf8');
  if (/trust\s+proxy/i.test(src)) trustProxyHits.push(path.relative(backend, file));
  if (/@Throttle\s*\(/.test(src)) throttleHits.push(path.relative(backend, file));
}

/* ---- compose evidence that the app runs behind a reverse proxy ---- */
const rootCompose = fs.readFileSync(path.join(root, 'docker-compose.yml'), 'utf8');
const backendCompose = read('docker-compose.yml');
const composeEvidence = {
  rootComposeExposesOnly: /expose:\s*\n\s*-\s*"3020"/.test(rootCompose),
  traefikLabels: /traefik\.http\.routers\.boiler-backend/.test(backendCompose),
  traefikPrefixStrip: /stripprefix\.prefixes=\/backend/.test(backendCompose),
  backendComposeNoHealthcheck: !/healthcheck:/.test(backendCompose),
  rootComposeNoBackendHealthcheck: !/healthcheck:/.test(rootCompose.split('boiler-control-frontend:')[0]),
};

const ALLOWED_ORIGIN = 'https://boiler-control.ba101.top'; // FRONTEND_URL from committed docker-compose.yml
const DISALLOWED_ORIGIN = 'https://attacker.example.invalid';
process.env.FRONTEND_URL = ALLOWED_ORIGIN;

async function main() {
  const { Test } = nm('@nestjs/testing');
  const { Controller, Get } = nm('@nestjs/common');
  const helmet = nm('helmet');
  const request = nm('supertest');

  class PingController {}
  PingController.prototype.ping = function () { return { ok: true }; };
  Get('ping')(PingController.prototype, 'ping', Object.getOwnPropertyDescriptor(PingController.prototype, 'ping'));
  Controller('api')(PingController);

  /* SEC-4: main.ts sada postavlja `credentials: authCookieEnabled()`, pa se
     reprodukcija pokreće DVAPUT — jednom sa zastavicom off (zadano, ponašanje
     identično prijašnjem) i jednom s on (httpOnly refresh cookie zahtijeva
     credentials). */
  async function launch(credentials) {
    const testing = await Test.createTestingModule({ controllers: [PingController] }).compile();
    const app = testing.createNestApplication({ logger: false });
    /* identical chain to main.ts: helmet defaults + enableCors with the same option values */
    app.use(helmet());
    app.enableCors({
      origin: process.env.FRONTEND_URL,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials,
    });
    await app.init();
    return app;
  }

  const app = await launch(false);
  const server = app.getHttpServer();
  const instance = app.getHttpAdapter().getInstance();
  const trustProxySetting = instance.get('trust proxy');

  try {
    const allowed = await request(server).get('/api/ping').set('Origin', ALLOWED_ORIGIN);
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers['access-control-allow-origin'], ALLOWED_ORIGIN);
    assert.ok(String(allowed.headers['vary'] || '').split(',').map((v) => v.trim()).includes('Origin'), 'Vary: Origin expected');
    assert.equal(allowed.headers['access-control-allow-credentials'], undefined, 'credentials must stay false');
    const helmetHeaders = ['x-content-type-options', 'x-frame-options', 'strict-transport-security', 'content-security-policy', 'referrer-policy', 'cross-origin-resource-policy', 'x-dns-prefetch-control', 'x-download-options', 'x-permitted-cross-domain-policies'];
    const presentHelmet = helmetHeaders.filter((h) => allowed.headers[h] !== undefined);
    assert.equal(allowed.headers['x-content-type-options'], 'nosniff');
    assert.ok(presentHelmet.length === helmetHeaders.length, `missing helmet headers: ${JSON.stringify(helmetHeaders.filter((h) => allowed.headers[h] === undefined))}`);

    /* cors-js treats a string origin as a FIXED origin: the header is emitted on every response with the
       configured value, without matching the request Origin. Security property: the value is never
       reflected, so a foreign page cannot read the response (browser matches ACAO against its own origin). */
    const disallowed = await request(server).get('/api/ping').set('Origin', DISALLOWED_ORIGIN);
    assert.equal(disallowed.status, 200);
    assert.notEqual(disallowed.headers['access-control-allow-origin'], DISALLOWED_ORIGIN, 'request origin must never be reflected (open CORS)');
    const fixedOriginEmittedOnForeign = disallowed.headers['access-control-allow-origin'] === ALLOWED_ORIGIN;

    const preflight = await request(server)
      .options('/api/ping')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'Authorization');
    assert.ok([200, 204].includes(preflight.status), `preflight status ${preflight.status}`);
    const allowMethods = String(preflight.headers['access-control-allow-methods'] || '').split(',').map((v) => v.trim());
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) assert.ok(allowMethods.includes(method), `preflight missing ${method}`);
    const allowHeaders = String(preflight.headers['access-control-allow-headers'] || '').split(',').map((v) => v.trim());
    assert.ok(allowHeaders.includes('Content-Type') && allowHeaders.includes('Authorization'), 'preflight must allow the declared headers');

    const preflightForeign = await request(server)
      .options('/api/ping')
      .set('Origin', DISALLOWED_ORIGIN)
      .set('Access-Control-Request-Method', 'GET');
    assert.notEqual(preflightForeign.headers['access-control-allow-origin'], DISALLOWED_ORIGIN, 'foreign preflight origin must never be reflected');

    /* --- SEC-4: prolaz sa zastavicom ON --- */
    const appCred = await launch(true);
    let credResult;
    try {
      const credServer = appCred.getHttpServer();
      const withCred = await request(credServer).get('/api/ping').set('Origin', ALLOWED_ORIGIN);
      assert.equal(withCred.headers['access-control-allow-credentials'], 'true', 'credentials must be emitted when the flag is on');
      /* sigurnosno svojstvo se ne smije promijeniti: origin ostaje fiksna
         vrijednost, nikad refleksija, iako su credentials uključeni */
      assert.equal(withCred.headers['access-control-allow-origin'], ALLOWED_ORIGIN);
      const foreign = await request(credServer).get('/api/ping').set('Origin', DISALLOWED_ORIGIN);
      assert.notEqual(foreign.headers['access-control-allow-origin'], DISALLOWED_ORIGIN, 'request origin must never be reflected even with credentials on');
      credResult = {
        allowCredentialsHeader: withCred.headers['access-control-allow-credentials'],
        originStillFixed: withCred.headers['access-control-allow-origin'] === ALLOWED_ORIGIN,
        foreignOriginReflected: foreign.headers['access-control-allow-origin'] === DISALLOWED_ORIGIN,
      };
    } finally {
      await appCred.close();
    }

    console.log(JSON.stringify({
      scope: 'local Nest HTTP app reproducing backend/src/main.ts middleware chain (helmet defaults + enableCors with the same option values), run twice for AUTH_COOKIE_REFRESH_ENABLED off and on; static probes over backend/src and committed compose files; no external network, database or credentials',
      credentialsFlagOn: credResult,
      mainTsAnchors: anchors,
      composeEvidence,
      staticProbes: {
        trustProxyConfiguredInSrc: trustProxyHits.length > 0,
        trustProxyHits,
        perRouteThrottleDecorators: throttleHits.length > 0,
        throttleHits,
        expressTrustProxySettingAtRuntime: trustProxySetting,
      },
      runtime: {
        allowedOrigin: { status: allowed.status, allowOrigin: allowed.headers['access-control-allow-origin'], varyOrigin: true, credentialsHeader: allowed.headers['access-control-allow-credentials'] ?? null, helmetHeadersPresent: presentHelmet },
        disallowedOrigin: { status: disallowed.status, allowOrigin: disallowed.headers['access-control-allow-origin'] ?? null, fixedOriginEmittedOnForeign, originReflected: false },
        preflightAllowed: { status: preflight.status, allowMethods, allowHeaders },
        preflightDisallowed: { status: preflightForeign.status, allowOrigin: preflightForeign.headers['access-control-allow-origin'] ?? null },
      },
    }, null, 2));
  } finally { await app.close(); }
}
main().catch(() => { console.error('CORS/helmet reprodukcija nije uspjela; provjerite zavisnosti i da li je main.ts middleware lanac promijenjen.'); process.exitCode = 1; });
