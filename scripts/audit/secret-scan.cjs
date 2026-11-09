#!/usr/bin/env node
/*
 * SEC-5: stražar nad tajnama u praćenim fajlovima.
 *
 * Zašto postoji: `env.md` i `backend/.env` su bili **u Gitu** u javnom
 * repozitoriju, sa stvarnom lozinkom baze. `.gitignore` ih nije spasio jer
 * git ignoriše samo fajlove koji još nisu praćeni — jednom dodan fajl ostaje
 * praćen zauvijek. Pravilo u `.gitignore` je zato bilo istinito i beskorisno.
 *
 * Šta skript radi: gleda SAMO fajlove koje git prati (`git ls-files`), traži
 * obrasce tajni, i pada ako nađe nešto što nije očigledan placeholder.
 *
 * Namjerno NIJE skener git historije: historija se ne može „popraviti“ ovdje,
 * a lažni osjećaj sigurnosti je gori od nikakvog. Historija je kompromitovana
 * čim je tajna u njoj — rješenje je rotacija (`docs/audit/backend/35-secret-leak.md`).
 *
 * Pokretanje:
 *   node scripts/audit/secret-scan.cjs            # provjeri
 *   node scripts/audit/secret-scan.cjs --verbose  # ispiši i dozvoljena poklapanja
 */
'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim();

/** Fajlovi koje preskačemo u cjelini (binarni, generisani, zaključani). */
const SKIP_FILES = new Set([
  'backend/package-lock.json',
  'frontend/package-lock.json',
  'mobile/package-lock.json',
  'contracts/openapi.json',
  'frontend/src/types/api.d.ts',
]);

/** Prefiksi koje preskačemo (testovi namjerno sadrže lažne tajne). */
const SKIP_PREFIXES = ['backend/src/generated/', 'node_modules/'];

const MAX_BYTES = 512 * 1024;

/**
 * Placeholder vrijednosti. Ključno za upotrebljivost: bez ovoga bi svaki
 * `DATABASE_URL=<DATABASE_URL>` i `JWT_SECRET=changeme` padali i skript bi se
 * isključio iz CI-ja u prvoj nedjelji.
 */
/**
 * Placeholderi — tri porodice, jer se u praksi pojavljuju sve tri:
 *   1. uglate zagrade: `<DATABASE_PASSWORD>` i `<VAR: opis>` (drugo ima razmak,
 *      pa se ne može opisati jednim `^<...>$` obrascem),
 *   2. prefiksi uputstva: `CHANGE_ME_*`, `your-super-secret`, `tvoj_tajni_kljuc`,
 *   3. same riječi: `xxx`, `changeme`, `redacted`.
 */
const PLACEHOLDER_FULL = /^(changeme|change-me|redacted|secret|password|token|example|dummy|placeholder|xxx+|\*+|\.\.\.|\$\{[^}]*\})$/i;
const PLACEHOLDER_PREFIX = /^([<]|CHANGE[_ -]?ME|YOUR[-_ ]|TVOJ|CI[-_]|EXAMPLE|DUMMY|PLACEHOLDER|REDACTED|TEST[-_])/i;

/** Obrasci: ime varijable + vrijednost koja izgleda stvarno. */
const PATTERNS = [
  {
    name: 'lozinka u URL-u baze',
    // postgresql://user:LOZINKA@host — lozinka mora imati bar 8 znakova i ne
    // smije biti placeholder.
    re: /\bpostgres(?:ql)?:\/\/[A-Za-z0-9_.-]+:([^@\s"'<>$]{8,})@/g,
    group: 1,
  },
  {
    name: 'tajna u dodjeli',
    // Vrijednost koja počinje s `(`, `.` ili `[` nije vrijednost nego kod
    // (`process.env.DATABASE_URL_READONLY ?? …` je pao kao „tajna" u prvom
    // prolazu). Bez ovoga bi skener kažnjavao ispravan kod.
    re: /\b(JWT_SECRET|JWT_REFRESH_SECRET|WEATHER_API_KEY|TUYA_CLIENT_SECRET|TUYA_CLIENT_ID|DATABASE_PASSWORD|SMTP_PASSWORD|EXPO_ACCESS_TOKEN|DATABASE_URL_READONLY|DATABASE_URL_BACKFILL)\s*[:=]\s*["']?((?![(.\[])[^"'\s]{16,})/g,
    group: 2,
  },
  {
    name: 'privatni ključ',
    re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g,
    group: 0,
  },
  {
    name: 'Expo/OpenAI/GitHub token',
    re: /\b(expo[a-z]{0,2}_[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{20,}|gh[pousr]_[A-Za-z0-9]{20,})\b/g,
    group: 1,
  },
];

/** Fajlovi gdje lažne tajne imaju svrhu (testovi, primjeri, dokumentacija uzorka). */
const isTestFixture = (file) =>
  /(__tests__|\.spec\.|\.test\.|fixtures?\/|\/e2e\/)/.test(file);

function isPlaceholder(value) {
  const trimmed = value.trim();
  return PLACEHOLDER_FULL.test(trimmed) || PLACEHOLDER_PREFIX.test(trimmed);
}

function main() {
  const verbose = process.argv.includes('--verbose');
  const files = execFileSync('git', ['ls-files', '-z'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
    .split('\0')
    .filter(Boolean)
    .filter((file) => !SKIP_FILES.has(file))
    .filter((file) => !SKIP_PREFIXES.some((prefix) => file.startsWith(prefix)));

  const findings = [];

  for (const file of files) {
    let content;
    try {
      const stat = fs.statSync(path.join(REPO_ROOT, file));
      if (stat.size > MAX_BYTES) continue;
      content = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');
    } catch {
      continue; // binarno ili nedostupno
    }
    if (content.includes('\0')) continue; // binarni fajl
    if (content.length === 0) continue;

    for (const pattern of PATTERNS) {
      pattern.re.lastIndex = 0;
      let match;
      while ((match = pattern.re.exec(content)) !== null) {
        const value = match[pattern.group] ?? match[0];
        const line = content.slice(0, match.index).split('\n').length;
        const allowed = isPlaceholder(value) || isTestFixture(file);

        if (allowed) {
          if (verbose) {
            process.stdout.write(`  · dozvoljeno [${pattern.name}] ${file}:${line}\n`);
          }
          continue;
        }
        findings.push({ file, line, pattern: pattern.name, value });
      }
    }
  }

  if (findings.length === 0) {
    process.stdout.write(
      `secret-scan: čisto — ${files.length} praćenih fajlova, 0 nalaza\n`,
    );
    return;
  }

  process.stdout.write(
    `secret-scan: ${findings.length} NALAZ(A) u praćenim fajlovima\n\n`,
  );
  for (const finding of findings) {
    // Vrijednost se NIKAD ne ispisuje u cjelini — ovo je CI log, javan.
    const masked =
      finding.value.length <= 6
        ? '***'
        : `${finding.value.slice(0, 3)}…${finding.value.length} znakova`;
    process.stdout.write(
      `  ${finding.file}:${finding.line} — ${finding.pattern} (${masked})\n`,
    );
  }
  process.stdout.write(
    '\nTajna koja je bila u Gitu je kompromitovana: rotirajte je, ne samo obrišite.\n' +
      'Postupak: docs/audit/backend/35-secret-leak.md\n',
  );
  process.exitCode = 1;
}

main();
