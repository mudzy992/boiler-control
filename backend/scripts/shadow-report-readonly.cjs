#!/usr/bin/env node
/**
 * F3.7 — SHADOW vs. PREDLOG, nad STVARNIM podacima (read-only)
 *
 * Zašto zasebna skripta: `shadow-report.service.ts` izvještaj već ima, ali je
 * dostupan samo kroz HTTP rutu, tj. samo unutar aplikacije. Ovaj alat čita istu
 * tabelu direktno i pušta **istu** funkciju (`shadow-report.ts`), tako da pravilo
 * ne postoji u dvije kopije — jedina razlika je odakle dolaze redovi.
 *
 * Pitanja na koja odgovara (plan `PLAN-formula-v2.md`, F3.7):
 *
 *   1. koliko se odluka kontrolera razlikuje od predloga koji je otišao korisniku;
 *   2. u kojem smjeru (spušta / podiže);
 *   3. je li **svaka** razlika objašnjiva razlogom;
 *   4. koliko dana blokira `MODEL_UNVERIFIED` (nepotvrđen model bojlera).
 *
 * Skripta je **samo čitanje**: `DATABASE_URL_READONLY`, `read only` sesija na
 * strani servera, samo `SELECT`. Ne piše ništa i ne mijenja šemu.
 *
 * Ograničenje koje se ispisuje uz rezultat: shadow postoji samo za dane koje je
 * napisao pisac `daily-2` (v. §10.3 plana) — backfill dani ga nemaju, pa
 * „0 razlika" na malom uzorku znači „nema podataka", ne „kontroler se slaže".
 *
 * Upotreba:
 *   DATABASE_URL_READONLY=... node scripts/shadow-report-readonly.cjs
 *   ... --from=2026-11-01 --to=2026-11-30 --json
 */
'use strict';

const { Client } = require('pg');
const path = require('node:path');

if (process.argv.includes('--help')) {
  console.log(`Upotreba: DATABASE_URL_READONLY=... node scripts/shadow-report-readonly.cjs [opcije]

  --from=YYYY-MM-DD   prvi dan (uključivo)
  --to=YYYY-MM-DD     zadnji dan (uključivo)
  --json              mašinski čitljiv izlaz
  --help              ova poruka

Čita DailyRecord i pušta istu funkciju koju koristi HTTP ruta
(src/modules/DailyRecord/shadow-report.ts). Samo SELECT.`);
  process.exit(0);
}

const url = process.env.DATABASE_URL_READONLY;
if (!url) {
  console.error('DATABASE_URL_READONLY nije postavljen.');
  process.exit(2);
}

const asJson = process.argv.includes('--json');
const fromArg = process.argv.find((a) => a.startsWith('--from='));
const toArg = process.argv.find((a) => a.startsWith('--to='));
const from = fromArg ? fromArg.split('=')[1] : null;
const to = toArg ? toArg.split('=')[1] : null;

/*
 * Isti modul koji koristi servis — bez kopije pravila.
 *
 * `TS_NODE_PROJECT` je obavezan: bez njega ts-node traži konfiguraciju iz radnog
 * direktorija i, pokrenut iz korijena repoa, nađe `mobile/tsconfig.json` (koji
 * extenduje `expo/tsconfig.base`) i padne sa TS6053. Isti razlog i isti obrazac
 * kao u `scripts/audit/controller_sim.cjs`.
 */
const root = path.resolve(__dirname, '../..');
process.env.TS_NODE_PROJECT = path.join(root, 'backend/tsconfig.json');
require(path.join(root, 'backend/node_modules/ts-node/register/transpile-only'));
const { shadowReport, SHADOW_MIN_DAYS } = require(
  path.join(root, 'backend/src/modules/DailyRecord/shadow-report.ts'),
);

const lines = [];
const out = (line = '') => {
  lines.push(line);
  console.log(line);
};
const notice = (message) => {
  const flat = String(message).replace(/[\r\n]+/g, ' ').replace(/%/g, '%25');
  console.log(`::notice::${flat}`);
};

async function main() {
  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    await client.query('SET TRANSACTION READ ONLY');
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT "localDate",
              "proposedFlowTemp",
              "shadowFlowC",
              "shadowAction",
              "shadowReasons",
              "shadowVersion",
              "shadowExploration",
              "shadowAt",
              "modelVersion"
         FROM "DailyRecord"
        WHERE $1::date IS NULL OR "localDate" >= $1
        ORDER BY "localDate"`,
      [from],
    );

    const filtered = to ? rows.filter((row) => row.localDate <= to) : rows;
    const report = shadowReport(filtered);

    /*
     * Kontekst bez kojeg se brojevi čitaju pogrešno: koliko redova uopšte ima
     * shadow kolone, i po kom `modelVersion`-u. Backfill dani ih nemaju, pa
     * izvještaj nad njima izgleda kao „nema razlika".
     */
    const byModel = new Map();
    for (const row of filtered) {
      const key = row.modelVersion ?? '(bez oznake)';
      const entry = byModel.get(key) ?? { days: 0, withShadow: 0 };
      entry.days += 1;
      if (row.shadowAt != null) entry.withShadow += 1;
      byModel.set(key, entry);
    }

    await client.query('ROLLBACK');

    if (asJson) {
      console.log(
        JSON.stringify(
          { window: { from, to }, report, byModel: [...byModel.entries()] },
          null,
          2,
        ),
      );
    } else {
      out('## F3.7 — shadow vs. predlog (stvarni podaci)');
      out();
      out(
        `Period: ${report.firstDate ?? '—'} → ${report.lastDate ?? '—'}, ` +
          `redova **${report.days}**, sa shadow-om **${report.evaluated}**, ` +
          `bez formule **${report.withoutFormula}**.`,
      );
      out();
      out('| model | dana | sa shadow-om |');
      out('|---|---|---|');
      for (const [model, entry] of byModel) {
        out(`| \`${model}\` | ${entry.days} | ${entry.withShadow} |`);
      }
      out();
      out(`**Presuda:** \`${report.verdict}\` — ${report.verdictNote}`);
      out();
      out('| mjera | vrijednost |');
      out('|---|---|');
      out(`| dana sa razlikom | ${report.differences} od ${report.evaluated} |`);
      out(`| spušta / podiže / isto | ${report.lowered} / ${report.raised} / ${report.same} |`);
      out(`| udio dana sa razlikom | ${report.changeSharePct} % |`);
      out(`| najveća razlika | ${report.maxAbsDeltaC} °C |`);
      out(`| prosječna razlika | ${report.meanAbsDeltaC} °C |`);
      out(`| neobjašnjene razlike | ${report.unexplained.length} |`);
      out(`| blokirano modelom bojlera | ${report.blockedByModel} |`);
      out(`| istraživanja | ${report.explored} |`);

      if (report.byReason.length > 0) {
        out();
        out('| razlog | dana |');
        out('|---|---|');
        for (const entry of report.byReason) {
          out(`| \`${entry.reason}\` | ${entry.days} |`);
        }
      }

      if (report.unexplained.length > 0) {
        out();
        out('**Neobjašnjene razlike** (razlika bez ijednog razloga je greška):');
        out();
        for (const item of report.unexplained) {
          out(
            `- ${item.localDate}: ${item.formulaC} → ${item.decisionC} °C ` +
              `(${item.deltaC > 0 ? '+' : ''}${item.deltaC})`,
          );
        }
      }

      if (report.evaluated < SHADOW_MIN_DAYS) {
        out();
        out(
          `**Uzorak je manji od ${SHADOW_MIN_DAYS} dana** (\`SHADOW_MIN_DAYS\`), ` +
            'pa presuda `NOT_ENOUGH_DAYS` nije loša vijest nego stanje: shadow još ' +
            'nema iz čega da se ocijeni.',
        );
      }

      out();
      out(
        '> Ograničenje: shadow postoji samo za dane koje je napisao pisac ' +
          '`daily-2`. Backfill dani ga nemaju, pa „0 razlika" na malom uzorku ' +
          'znači „nema podataka", ne „kontroler se slaže".',
      );

      notice(
        `F3.7 shadow: ${report.verdict}, ${report.differences}/${report.evaluated} dana sa razlikom ` +
          `(spušta ${report.lowered}, podiže ${report.raised}), neobjašnjeno ${report.unexplained.length}, ` +
          `blokirano modelom ${report.blockedByModel}, prozor ${report.firstDate ?? '—'}→${report.lastDate ?? '—'}`,
      );
    }

    const summary = process.env.GITHUB_STEP_SUMMARY;
    if (summary) {
      require('node:fs').appendFileSync(summary, lines.join('\n') + '\n');
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
