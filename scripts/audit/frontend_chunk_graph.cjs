#!/usr/bin/env node
/**
 * FE2-7: provjera grafa čipova i evaluacije bundlea.
 *
 * Zašto postoji (stvaran incident, 2026-10-30)
 * --------------------------------------------
 * FE2-4 je uveo `manualChunks` i izdvojio `@ant-design/icons` u `vendor-icons`.
 * Ali antd bezuslovno importuje icons, a icons importuje `rc-util` — koji isti
 * taj `manualChunks` prepoznaje preko `/rc-/` i smješta u `vendor-antd`. Nastao
 * je KRUŽAN odnos među čipovima:
 *
 *     vendor-antd  ->  vendor-icons  ->  vendor-antd
 *
 * Pri evaluaciji takvog grafa jedan od modula čita binding koji još nije
 * inicijaliziran. Izmjereno na sagradjenom bundleu:
 *
 *     TypeError: Cannot read properties of undefined (reading 'primary')
 *       at vendor-icons-*.js   (B(P.primary), P uvezen iz vendor-antd)
 *
 * React se zato uopšte nije mountovao — korisnik bi vidio POTPUNO PRAZAN ekran.
 *
 * Zašto to nitko nije uhvatio ranije
 * ----------------------------------
 *  - `npm test` (Vitest) čita IZVORNI kod i `vite.config.ts` kao tekst; nikad
 *    ne evaluira sagradjeni bundle, pa kružne čipove ne može vidjeti.
 *  - `curl /` vraća 200 i ispravan HTML — server radi, pada tek JS.
 *  - `tsc` i `eslint` isto rade na izvornom kodu.
 *
 * Ova skripta zatvara tu rupu: radi na STVARNOM `dist/` i to na dva načina.
 *
 *  1. STATIČKI: traži kružne odnose u grafu importa medu čipovima.
 *  2. DINAMIČKI: stvarno evaluira entry čip u jsdom-u i tvrdi da React nešto
 *     montira u `#root`. Ovo hvata i buduće padove koji nisu kružni graf.
 *
 * Upotreba:
 *   node scripts/audit/frontend_chunk_graph.cjs [--help] [--dist <putanja>]
 *                                               [--skip-eval]
 *
 * Izlaz: JSON izvještaj na stdout; EXIT=0 ako sve prolazi, inače 1.
 * Skripta je idempotentna i ne sadrži tajne.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const ROOT = path.resolve(__dirname, '..', '..');

function help() {
  process.stdout.write(
    'frontend_chunk_graph.cjs — provjera grafa čipova i evaluacije bundlea (FE2-7)\n' +
      '\n' +
      'Upotreba:\n' +
      '  node scripts/audit/frontend_chunk_graph.cjs [opcije]\n' +
      '\n' +
      'Opcije:\n' +
      '  --help          ovaj tekst\n' +
      '  --dist <dir>    putanja do build izlaza (default: frontend/dist)\n' +
      '  --skip-eval     preskoči dinamičku evaluaciju entry čipa u jsdom-u\n' +
      '\n' +
      'Provjere:\n' +
      '  1. nijedan par čipova se ne importuje uzajamno (kružni graf ruši evaluaciju)\n' +
      '  2. entry čip se evaluira bez greške i React montira sadržaj u #root\n' +
      '\n' +
      'Zahtijeva prethodno pokrenut `npm run build` u frontend/.\n'
  );
}

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  help();
  process.exit(0);
}
const skipEval = args.includes('--skip-eval');
const distArgIdx = args.indexOf('--dist');
const DIST =
  distArgIdx !== -1 && args[distArgIdx + 1]
    ? path.resolve(args[distArgIdx + 1])
    : path.join(ROOT, 'frontend', 'dist');

function fail(msg) {
  process.stderr.write(`GRESKA: ${msg}\n`);
  process.exit(1);
}

if (!fs.existsSync(DIST)) {
  fail(`ne postoji build izlaz: ${DIST} — pokrenite najprije \`npm run build\``);
}

const assetsDir = path.join(DIST, 'assets');
if (!fs.existsSync(assetsDir)) fail(`ne postoji ${assetsDir}`);

const jsFiles = fs
  .readdirSync(assetsDir)
  .filter((f) => f.endsWith('.js'))
  .sort();

if (jsFiles.length === 0) fail(`u ${assetsDir} nema nijednog .js čipa`);

/**
 * Čita import relacije jednog čipa.
 *
 * Vite/Rollup minificirani izlaz koristi `from"./x.js"` i `import"./x.js"` bez
 * razmaka, pa razmaci u regexu NE rade. Uzimamo samo relativne reference na
 * čipove u istom direktoriju — dinamički `import()` stranica je poželjan i nije
 * kružni.
 */
function importsOf(file) {
  const src = fs.readFileSync(path.join(assetsDir, file), 'utf8');
  const head = src.slice(0, 8000); // sve import izjave su na vrhu modula
  const deps = new Set();
  for (const re of [/from"\.\/([^"]+\.js)"/g, /import"\.\/([^"]+\.js)"/g]) {
    for (const m of head.matchAll(re)) {
      if (jsFiles.includes(m[1])) deps.add(m[1]);
    }
  }
  return [...deps];
}

const graph = new Map(jsFiles.map((f) => [f, importsOf(f)]));

// 1. kružni odnosi (A->B i B->A). To je obrazac koji je srušio bundle.
const cycles = [];
for (const [a, deps] of graph) {
  for (const b of deps) {
    if (a < b && (graph.get(b) || []).includes(a)) cycles.push([a, b]);
  }
}
if (cycles.length > 0) {
  const lines = cycles.map(([a, b]) => `  ${a}  <->  ${b}`).join('\n');
  fail(
    `naden ${cycles.length} kružan odnos među čipovima — pri evaluaciji ovakvog\n` +
      `grafa modul čita binding koji još nije inicijaliziran i cijela aplikacija\n` +
      `pada na prazan ekran (v. FE2-4 incident s vendor-antd/vendor-icons):\n${lines}`
  );
}

// 2. entry čip iz index.html
const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
const entryMatch = html.match(/<script[^>]*src="\/assets\/([^"]+\.js)"/);
if (!entryMatch) fail('index.html ne referencira nijedan /assets/*.js entry čip');
const entry = entryMatch[1];
if (!jsFiles.includes(entry)) fail(`entry čip ${entry} nije medu izgradjenim čipovima`);

const report = {
  dist: DIST,
  jsCipova: jsFiles.length,
  entryCip: entry,
  kruznihOdnosa: cycles.length,
  evaluacija: 'preskocena (--skip-eval)',
};

if (skipEval) {
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Dinamička evaluacija. jsdom se uzima iz frontend/node_modules jer tamo živi.
// ---------------------------------------------------------------------------
const frontendRequire = createRequire(path.join(ROOT, 'frontend', 'package.json'));
let JSDOM;
let VirtualConsole;
try {
  ({ JSDOM, VirtualConsole } = frontendRequire('jsdom'));
} catch {
  fail('jsdom nije dostupan u frontend/node_modules — pokrenite `npm install` u frontend/');
}

(async () => {
  // Mrežni pozivi koje aplikacija pokrene nakon mounta nisu dio ove provjere i
  // ne smiju je srušiti — bez ovog bi npr. `detectAuthMode()` pao na ECONNREFUSED.
  const networkNoise = [];
  process.on('unhandledRejection', (e) => networkNoise.push(String((e && e.message) || e)));

  // jsdom-ov defaultni VirtualConsole prosljedjuje svaku mrežnu gresku na
  // stderr. Aplikacija nakon mounta stvarno pokusa pozvati API (ovdje nema
  // servera), pa bi taj sum zagadio CI izlaz iako nije dio ove provjere.
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => networkNoise.push('jsdomError: ' + e.message));
  virtualConsole.on('error', (m) => networkNoise.push('console.error: ' + m));

  const dom = new JSDOM(
    '<!doctype html><html lang="en"><body><div id="root"></div></body></html>',
    { url: 'http://127.0.0.1:4173/login', pretendToBeVisual: true, virtualConsole }
  );
  const w = dom.window;

  // Node >=21: `navigator` je getter-only na globalThis, pa direktno
  // dodjeljivanje baca. Mora defineProperty.
  const expose = (k, v) => {
    if (v === undefined) return;
    Object.defineProperty(globalThis, k, { value: v, writable: true, configurable: true });
  };
  for (const k of [
    'window', 'document', 'navigator', 'location', 'history', 'HTMLElement', 'Element',
    'Node', 'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'getComputedStyle',
    'requestAnimationFrame', 'cancelAnimationFrame', 'localStorage', 'sessionStorage',
    'CSS', 'DOMParser', 'MutationObserver', 'HTMLInputElement', 'HTMLFormElement',
    'HTMLAnchorElement', 'Image', 'XMLHttpRequest',
    // `ShadowRoot` je OBAVEZAN: antd-ov rc-util radi `instanceof ShadowRoot`.
    // Bez njega se React mounta, prikaze Suspense fallback, a zatim baci
    // ReferenceError i CIJELO stablo se unmounta (#root padne na 0 znakova).
    // Izmjereno 2026-10-30 — izgledalo je kao bug aplikacije, a bio je propust
    // ove skripte.
    'ShadowRoot', 'DocumentFragment', 'HTMLButtonElement', 'HTMLTextAreaElement',
    'SVGElement', 'FocusEvent', 'InputEvent', 'CompositionEvent', 'NodeList',
    'HTMLCollection', 'Text', 'Comment',
  ]) {
    expose(k, w[k]);
  }
  // antd i rc-* komponente diraju ove API-je; jsdom ih ne implementira.
  w.matchMedia =
    w.matchMedia ||
    (() => ({
      matches: false, media: '', onchange: null,
      addListener() {}, removeListener() {},
      addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; },
    }));
  expose('matchMedia', w.matchMedia);
  class RO { observe() {} unobserve() {} disconnect() {} }
  class IO { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } }
  expose('ResizeObserver', RO);
  expose('IntersectionObserver', IO);
  expose('self', w);

  const entryUrl = 'file://' + path.join(assetsDir, entry);
  let evalError = null;
  try {
    await import(entryUrl);
  } catch (e) {
    evalError = e;
  }

  if (evalError) {
    fail(
      `entry čip ${entry} se NIJE evaluirao:\n` +
        `  ${evalError.constructor.name}: ${evalError.message}\n` +
        `  ${(evalError.stack || '').split('\n')[1] || ''}\n` +
        'Ovo znači da sagradjena aplikacija pada prije mounta (prazan ekran), iako\n' +
        'HTTP odgovor, tsc, eslint i Vitest prolaze.'
    );
  }

  // `LoginPage` je lazy (FE2-4), pa se ne pojavljuje odmah: React prvo renderuje
  // Suspense fallback, a zatim dohvati cip stranice. Cekamo poll-om umjesto
  // fiksnog sleep-a da provjera ne bi bila osjetljiva na brzinu masine.
  const deadline = Date.now() + 15_000;
  let rootHtml = '';
  let rendered = false;
  for (;;) {
    rootHtml = w.document.getElementById('root').innerHTML;
    // `Boiler Control` je tekst iz `<h1>` u LoginPage.tsx — njegov prisustvo
    // dokazuje da se ODLOZENI cip stranice dohvatio i izvrsio, a ne samo da je
    // React montirao fallback.
    rendered = /Boiler Control/.test(rootHtml);
    if (rendered || Date.now() > deadline) break;
    await new Promise((r) => setTimeout(r, 100));
  }

  if (rootHtml.trim().length === 0) {
    fail(
      `entry čip ${entry} se evaluirao, ali #root je ostao PRAZAN — React nije\n` +
        'montirao nijedan element. Sagradjena aplikacija bi prikazala prazan ekran.'
    );
  }
  if (!rendered) {
    fail(
      `#root ima ${rootHtml.length} znakova, ali login forma se nikad nije\n` +
        'renderovala (nema teksta "Boiler Control"). Vjerovatno je ostalo na\n' +
        'Suspense fallbacku, tj. odlozeni cip stranice se nije izvrsio.\n' +
        `  prvih 200 znakova: ${rootHtml.slice(0, 200)}`
    );
  }

  report.evaluacija = {
    status: 'ok',
    entryCipSeEvaluira: true,
    rootDuzina: rootHtml.length,
    loginFormaRenderovana: true,
    mreznogSumaIgnorisano: networkNoise.length,
  };
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  process.exit(0);
})().catch((e) => fail(`dinamička evaluacija je pala: ${e && e.message}`));
