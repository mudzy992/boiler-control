#!/usr/bin/env node
/**
 * Verzije za lokalni build — **jedno mjesto gdje se broj diže**.
 *
 * Zajedničko je i mobilnoj i TV aplikaciji, pa je jedna implementacija umjesto
 * dvije koje se razilaze. `mobile/app.config.js` i `tv/app.config.js` već
 * izvode `versionCode` iz `version`, pa skripta **ne piše** `versionCode` —
 * samo `version`.
 *
 * ## Šta se mijenja, a šta ne
 *
 * | polje | mijenja se | zašto |
 * |---|---|---|
 * | `package.json` → `version` | **da** | jedini izvor (MO2-2) |
 * | `app.json` → `version` | ne | ne postoji više; drugi izvor bi bio konkurencija |
 * | `versionCode` | ne | izvodi se u `app.config.js` iz `version` |
 *
 * ## Dvije stvari koje su izmjerene, ne pretpostavljene
 *
 * 1. **`package-lock.json` mora ići uz `package.json`.** `npm ci` u CI-ju puca
 *    ako se verzije u ta dva fajla ne slažu, a `npm install --package-lock-only`
 *    to ne popravi uvijek sam. Zato `setVersion` piše u oba, u istom pozivu.
 * 2. **Semver `major.minor.patch` je jedini oblik koji `app.config.js` umije da
 *    pročita.** `versionCodeFromVersion` radi `split('.')` i `parseInt`.
 *    Izmjereno: `'2.0.0-beta.1'.split('.')` → `[2, 0, 0, 1]`, a
 *    `parseInt('0-beta')` → **0**, ne `NaN`. Dobije se `versionCode = 20000` —
 *    **isto kao za `2.0.0`** — pa Android odbije nadogradnju kao „već
 *    instalirano", bez poruke o verziji. Tihi sudar je gori od greške, zato
 *    skripta **odbija** takvu verziju umjesto da je upiše.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

/** Formula mora biti ista kao `buildNumberFromVersion` na backendu i `app.config.js`. */
const VERSION_CODE_FORMULA = 'major * 10000 + minor * 100 + patch';

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

/**
 * Parsiraj `major.minor.patch`. Baca na svemu drugom — v. zašto u uvodu.
 */
function parseVersion(version) {
  const match = SEMVER.exec(String(version).trim());
  if (!match) {
    throw new Error(
      `Verzija "${version}" nije oblika major.minor.patch. ` +
        `Sufiksi ("-beta.1") i "v" prefiks nijesu podržani: ` +
        `app.config.js izvodi versionCode preko split('.'), pa bi "2.0.0-beta.1" ` +
        `dao versionCode 20000 — isti kao "2.0.0", i Android bi odbio nadogradnju.`,
    );
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

/** `2.1.3` → `20103`. */
function versionCode(version) {
  const { major, minor, patch } = parseVersion(version);
  return major * 10_000 + minor * 100 + patch;
}

/**
 * Sljedeća verzija.
 *
 * `minor` **resetuje** `patch`, a `major` resetuje oba — standardni semver.
 * Ovo je mjesto gdje ljudi obično pogriješe: `2.1.5` → minor bi dao `2.2.5`,
 * što nije verzija koja je ikad bila izdata niti se poklapa sa versionCode
 * formulom (`2.2.5` = 20205, preskače 20200–20204 bez razloga).
 */
function bumpVersion(version, bump) {
  const { major, minor, patch } = parseVersion(version);
  switch (bump) {
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'major':
      return `${major + 1}.0.0`;
    default:
      throw new Error(`Nepoznat tip izmjene verzije: "${bump}" (major|minor|patch)`);
  }
}

/** Pročitaj verziju iz `package.json` u datom folderu. */
function readVersion(appDir) {
  const pkg = readJson(path.join(appDir, 'package.json'));
  return String(pkg.version ?? '');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * Upiši verziju u `package.json` i `package-lock.json`.
 *
 * **Brave daske.** `package-lock.json` ima `version` na dva mjesta: na vrhu
 * (`lockfileVersion` 2+) i u `packages[""]`. Ako se promijeni samo prvo, `npm ci`
 * u CI-ju padne sa „lock file does not satisfy package.json" — a poruka ne
 * kaže na koju verziju misli. Zato se mijenjaju oba.
 *
 * Vraća staru i novu verziju, da pozivalac može da prijavi šta je urađeno i
 * da odluči da li da poništi.
 */
function setVersion(appDir, nextVersion) {
  parseVersion(nextVersion); // odbaci neispravan oblik PRIJE nego što išta piše

  const pkgPath = path.join(appDir, 'package.json');
  const lockPath = path.join(appDir, 'package-lock.json');

  const pkg = readJson(pkgPath);
  const previous = String(pkg.version ?? '');

  pkg.version = nextVersion;
  writeJson(pkgPath, pkg);

  if (fs.existsSync(lockPath)) {
    const lock = readJson(lockPath);
    lock.version = nextVersion;
    if (lock.packages && lock.packages['']) {
      lock.packages[''].version = nextVersion;
    }
    writeJson(lockPath, lock);
  }

  return { previous, next: nextVersion, previousCode: versionCode(previous), nextCode: versionCode(nextVersion) };
}

/**
 * JSON se piše sa dva razmaka i završnim novim redom — isto kako ga `npm`
 * piše. Bez toga bi svaki bump pravio diff po cijelom fajlu.
 */
function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

/**
 * Vrati verziju na prethodnu vrijednost.
 *
 * **Zašto je ovo potrebno.** Skripta diže verziju **prije** builda. Ako build
 * padne, ostala bi verzija koju nijedan izdat APK ne nosi — pa sljedeći
 * uspješan build preskoči broj. Android to dozvoljava, ali čovjek koji čita
 * istoriju više ne može da zaključi šta je izdato.
 */
function restoreVersion(appDir, previousVersion) {
  if (!previousVersion) return null;
  return setVersion(appDir, previousVersion);
}

module.exports = {
  VERSION_CODE_FORMULA,
  bumpVersion,
  parseVersion,
  readVersion,
  restoreVersion,
  setVersion,
  versionCode,
};
