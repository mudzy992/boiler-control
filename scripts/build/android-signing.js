#!/usr/bin/env node
/**
 * Provjera i popravka potpisivanja Android build-a.
 *
 * ## Problem koji rješava
 *
 * `expo prebuild` generiše `android/app/build.gradle` sa:
 *
 * ```gradle
 * release { signingConfig signingConfigs.debug }
 * ```
 *
 * Dakle **lokalni release APK je potpisan debug ključem** (`debug.keystore`,
 * šifra `android`). EAS build potpisuje **svojim** ključem iz svog trezora.
 * Android za isti `applicationId` traži **isti potpis** za nadogradnju, pa
 * instalacija jednog preko drugog pada sa:
 *
 *   „App not installed as package conflicts with an existing package"
 *
 * Poruka ne pominje ni potpis ni keystore — zato se lako pogrešno pripiše
 * verziji. Verzija (`versionCode`) daje **drugu** poruku („already installed")
 * i ne mijenja se potpisom.
 *
 * ## Šta ovaj alat radi
 *
 * 1. **`check`** — čita generisani `build.gradle` i kaže čime je release
 *    potpisan. Ne mijenja ništa.
 * 2. **`wire`** — ako postoji `android/keystore.properties`, ubaci `release`
 *    `signingConfig` koji koristi taj keystore. Ako ne postoji, **ne dira**
 *    ništa i to kaže — bolje ista potpisana dva builda nego tiho različit.
 *
 * ## Zašto se keystore ne stavlja u repo
 *
 * `keystore.properties` i `.jks` su tajna. Alat ih čita ako ih ima, ali ih
 * nikad ne ispisuje.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const PROPERTIES_FILE = 'keystore.properties';

/** Putanje do generisanog gradle fajla za datu aplikaciju. */
function gradlePath(appDir) {
  return path.join(appDir, 'android', 'app', 'build.gradle');
}

/**
 * Indeks zagrade koja zatvara onu na `openIndex`, sa uvažavanjem ugniježđenih.
 *
 * Vraća `-1` ako zagrada nije zatvorena — pozivalac tada ne dira fajl.
 */
function matchBrace(text, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Granice `buildTypes { … <type> { … } }` bloka za dati tip.
 *
 * **Zašto ne regex.** Prva verzija je koristila `/release\s*\{[\s\S]*?\n\s*\}/`,
 * što staje na PRVU zatvornu zagradu — a `release` blok sadrži `signingConfig`
 * i `proguardFiles` u više linija, pa je regex mogao stati prerano ili (kad se
 * u `signingConfigs` doda `release`) uhvatiti pogrešan blok. Izmjereno: poslije
 * `wireSigning` alat je prijavljivao `signedWith: 'unknown'` za fajl koji
 * stvarno ima `signingConfig signingConfigs.release`.
 */
function findBuildTypeBlock(gradle, type) {
  const buildTypes = /buildTypes\s*\{/.exec(gradle);
  if (!buildTypes) return { start: -1, end: -1 };

  const outerOpen = gradle.indexOf('{', buildTypes.index);
  const outerEnd = matchBrace(gradle, outerOpen);
  if (outerEnd === -1) return { start: -1, end: -1 };

  const outer = gradle.slice(outerOpen, outerEnd);
  const typeMatch = new RegExp(`\\b${type}\\s*\\{`).exec(outer);
  if (!typeMatch) return { start: -1, end: -1 };

  const start = outerOpen + typeMatch.index;
  const end = matchBrace(gradle, gradle.indexOf('{', start));
  return { start, end: end === -1 ? -1 : end + 1 };
}

/**
 * Pročitaj `keystore.properties` (`key=value`, `#` komentari).
 *
 * Vraća `null` ako fajla nema — to je **normalno stanje**, ne greška: bez
 * keystorea se build potpisuje debug ključem i to je jedini izbor koji radi.
 */
function readKeystoreProperties(appDir) {
  const file = path.join(appDir, 'android', PROPERTIES_FILE);
  if (!fs.existsSync(file)) return null;

  const result = {};
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    result[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }

  // Bez ovih polja fajl ne može poslužiti — bolje ga odbiti nego napraviti
  // build koji padne na pola puta.
  const required = ['storeFile', 'storePassword', 'keyAlias', 'keyPassword'];
  const missing = required.filter((key) => !result[key]);
  if (missing.length > 0) {
    throw new Error(
      `${PROPERTIES_FILE} nema polja: ${missing.join(', ')}. ` +
        'Potrebna su: storeFile, storePassword, keyAlias, keyPassword.',
    );
  }
  return result;
}

/**
 * Čime je release potpisan prema generisanom `build.gradle`.
 *
 * `signingConfigs.debug` je ono što `prebuild` uvijek upiše; bilo šta drugo
 * znači da je neko (ili ovaj alat) ubacio `release` config.
 */
function inspectSigning(appDir) {
  const file = gradlePath(appDir);
  if (!fs.existsSync(file)) {
    return { state: 'no-prebuild', signedWith: null, hasKeystore: false };
  }

  const gradle = fs.readFileSync(file, 'utf8');
  const { start, end } = findBuildTypeBlock(gradle, 'release');
  const block = start === -1 ? '' : gradle.slice(start, end);

  const usesDebug = /signingConfig\s+signingConfigs\.debug/.test(block);
  const usesRelease = /signingConfig\s+signingConfigs\.release/.test(block);

  return {
    state: 'ok',
    signedWith: usesRelease ? 'release' : usesDebug ? 'debug' : 'unknown',
    hasKeystore: fs.existsSync(path.join(appDir, 'android', PROPERTIES_FILE)),
  };
}

/**
 * Ubaci `release` `signingConfig` u generisani `build.gradle`.
 *
 * Idempotentno: ako `release` već koristi `signingConfigs.release`, ništa se ne
 * mijenja. Vraća `true` kad je fajl izmijenjen.
 */
function wireSigning(appDir) {
  const file = gradlePath(appDir);
  if (!fs.existsSync(file)) {
    throw new Error(
      `Nema ${path.relative(process.cwd(), file)} — pokreni \`expo prebuild\` prvo.`,
    );
  }
  const properties = readKeystoreProperties(appDir);
  if (!properties) {
    throw new Error(
      `Nema android/${PROPERTIES_FILE}. Postavi ga (storeFile, storePassword, ` +
        'keyAlias, keyPassword) ili nastavi sa debug potpisom — samo znaj da ' +
        'se APK potpisan debug ključem NE može instalirati preko EAS builda.',
    );
  }

  let gradle = fs.readFileSync(file, 'utf8');

  /*
   * `signingConfigs` blok postoji (prebuild ga uvijek generiše sa `debug`).
   * Dodajemo `release` unos odmah iza `debug` bloka, čitajući vrijednosti iz
   * `keystore.properties` preko `rootProject.file(…)`.
   *
   * Putanja do keystorea ide kao `storeFile rootProject.file('keystore.jks')`
   * — relativna na `android/`, a ne apsolutna: apsolutna putanja bi bila vezana
   * za mašinu i niko drugi ne bi mogao da napravi build.
   */
  /*
   * Provjera ide **unutar** bloka `signingConfigs`, ne kroz cijeli fajl.
   *
   * Prva verzija je testirala `/signingConfigs\s*\{[\s\S]*?release\s*\{/` po
   * cijelom fajlu — a `buildTypes` TAKOĐE ima `release {`, pa je uslov uvijek
   * bio ispunjen i `release` config se nikad nije dodao. Rezultat je bio fajl
   * koji referencira `signingConfigs.release`, a ne definiše ga: gradle bi pao
   * sa „Could not get unknown property 'release'".
   */
  const signingOpen = gradle.search(/signingConfigs\s*\{/);
  if (signingOpen !== -1) {
    const braceStart = gradle.indexOf('{', signingOpen);
    const braceEnd = matchBrace(gradle, braceStart);
    const signingBlock = braceEnd === -1 ? '' : gradle.slice(braceStart, braceEnd);

    if (!/\brelease\s*\{/.test(signingBlock)) {
      const releaseConfig = `
        release {
            // Vrijednosti iz \`android/${PROPERTIES_FILE}\` (tajna, nije u repou).
            storeFile rootProject.file('${properties.storeFile}')
            storePassword '${properties.storePassword}'
            keyAlias '${properties.keyAlias}'
            keyPassword '${properties.keyPassword}'
        }`;
      // Ubaci PRIJE zatvorne zagrade bloka `signingConfigs`.
      gradle =
        gradle.slice(0, braceEnd) + releaseConfig + '\n' + gradle.slice(braceEnd);
    }
  }

  /*
   * Release build mora koristiti `release` config, ne `debug`.
   *
   * Zamjena ide preko **granica bloka**, ne regexom po cijelom fajlu. Regex
   * `/(release\s*\{[\s\S]*?)signingConfig…/` hvata PRVI `release {` u fajlu —
   * a to je `release {` koji smo upravo dodali u `signingConfigs` (on sadrži
   * `storeFile`, ne `signingConfig`), pa se zamjena nikad ne izvrši. Rezultat
   * je fajl sa ispravnim `release` configom ali `buildTypes.release` koji i
   * dalje koristi DEBUG ključ — dakle isti kvar, samo teže vidljiv.
   */
  const releaseBlock = findBuildTypeBlock(gradle, 'release');
  if (releaseBlock.start !== -1) {
    const before = gradle.slice(0, releaseBlock.start);
    const block = gradle.slice(releaseBlock.start, releaseBlock.end);
    const after = gradle.slice(releaseBlock.end);
    gradle =
      before +
      block.replace(
        /signingConfig\s+signingConfigs\.debug/,
        'signingConfig signingConfigs.release',
      ) +
      after;
  }

  fs.writeFileSync(file, gradle);
  return true;
}

module.exports = {
  findBuildTypeBlock,
  inspectSigning,
  matchBrace,
  readKeystoreProperties,
  wireSigning,
};

// --- CLI ---------------------------------------------------------------------
if (require.main === module) {
  const [command, appDir = '.'] = process.argv.slice(2);
  const dir = path.resolve(appDir);

  try {
    if (command === 'check') {
      const result = inspectSigning(dir);
      if (result.state === 'no-prebuild') {
        console.log('nema android/ — pokreni prebuild');
        process.exit(0);
      }
      console.log(`release potpisan: ${result.signedWith}`);
      console.log(`keystore.properties: ${result.hasKeystore ? 'postoji' : 'nema'}`);
      process.exit(0);
    }

    if (command === 'wire') {
      wireSigning(dir);
      console.log('release signingConfig postavljen na keystore iz keystore.properties');
      process.exit(0);
    }

    console.error('Upotreba: android-signing.js <check|wire> [appDir]');
    process.exit(2);
  } catch (error) {
    console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
