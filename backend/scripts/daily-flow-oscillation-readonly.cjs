#!/usr/bin/env node
/**
 * F4.5 — KOLIKO SE BROJ MIJENJAO KROZ DAN (read-only)
 *
 * Tvrdnja koja se mjeri: **koliko različitih polaznih vrijednosti je kotao dobio
 * u istom danu za istu kuću.** Plan (F4.5) tvrdi da `/boiler/sync` i
 * `ThermostatPoll` ne smiju zvati krivu usred dana. Prije nego se to dirne,
 * mora se znati koliko oscilacije zaista postoji — inače se proizvodni kod
 * mijenja na osnovu mišljenja.
 *
 * **Zašto `BoilerHistory` a ne `params.formulaDriftC`.** Prvi pokušaj (run
 * `43241653802`) čitao je drift iz `DailyRecord.params` i vratio
 * `NO_DRIFT_RECORDED: 56 dana, 0 sa kolonom` — jer writer tu kolonu **ne
 * piše**. Umjesto da se doda upis pa da se mjeri vlastita izmjena, mjeri se
 * ono što sistem već bilježi: `BoilerHistory.suggestedFlowTemp` je broj koji je
 * otišao kotlu, sa vremenom. Različite vrijednosti **istog dana** su oscilacija
 * koju je korisnik vidio na displeju, bez obzira ko ju je proizveo.
 *
 * **Grupa je kuća + dan**, ne korisnik: ista kuća može imati više korisnika, a
 * oscilacija je svojstvo kuće.
 *
 * **Šta se mjeri, tri odvojene stvari:**
 *
 * 1. **koliko dana ima više od jedne vrijednosti** — postoji li problem.
 * 2. **raspon unutar dana** (`max − min`) — koliko se broj zaista pomjerio.
 *    0,05 K je zaokruživanje; 4 K je drugi broj na ekranu.
 * 3. **koliko dana prelazi prag 0,5 K** — tek iznad toga korisnik vidi razliku
 *    (prikaz kotla je na 0,5 °C).
 *
 * **Šta se NE tvrdi.** Ne mjeri se je li promjena bila **opravdana** (izmjeren
 * manjak) — `BoilerHistory` ne nosi razlog. Ne tvrdi se ni da svaka promjena
 * dolazi od krive: isti broj može doći iz korisnikovog rasporeda. Skripta
 * mjeri veličinu problema, ne njegov uzrok.
 *
 * Skripta je **samo čitanje**: `DATABASE_URL_READONLY`, `SET TRANSACTION READ
 * ONLY` unutra transakcije, samo `SELECT`.
 *
 * Upotreba:
 *   DATABASE_URL_READONLY=... node scripts/daily-flow-oscillation-readonly.cjs
 *   ... --json
 *   ... --days=60
 *   ... --self-test      (bez baze; provjeri klasifikaciju na sintetici)
 */
'use strict';

const { Client } = require('pg');

/** Prag iznad kojeg se razlika vidi na displeju kotla (prikaz na 0,5 °C). */
const VISIBLE_C = 0.5;

if (process.argv.includes('--help')) {
  console.log(`Upotreba: DATABASE_URL_READONLY=... node scripts/daily-flow-oscillation-readonly.cjs [opcije]

  --days=N         koliko dana unazad (zadano 60)
  --since=YYYY-MM-DD
                   mjeri samo od tog datuma (za ponovno mjerenje poslije
                   deploya; bez toga prozor uvijek hvata i staro ponasanje)
  --json           mašinski čitljiv izlaz
  --self-test      provjeri klasifikaciju na sintetičkim danima, bez baze
  --help           ova poruka

Mjeri koliko razlicitih polaznih vrijednosti kotao dobije u istom danu
(BoilerHistory.suggestedFlowTemp po kuci i danu). Samo SELECT.`);
  process.exit(0);
}

function argValue(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const value = Number(hit.slice(name.length + 3));
  return Number.isFinite(value) ? value : fallback;
}

/**
 * Donja granica prozora.
 *
 * Bez ovoga ponovno mjerenje poslije F4.5 daje **iste brojeve** kao prije —
 * jer prozor od 60 dana i dalje sadrži dane kad je stari kod radio. To nije
 * dokaz da izmjena nije pomogla; to je dokaz da se mjerilo pogrešan prozor.
 * Zato `--since`: mjeri se samo ono što je nastalo poslije deploya.
 */
function sinceDate() {
  const hit = process.argv.find((a) => a.startsWith('--since='));
  if (!hit) return null;
  const raw = hit.slice('--since='.length).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    console.error(`--since mora biti YYYY-MM-DD, dobio sam "${raw}".`);
    process.exit(2);
  }
  return raw;
}

/**
 * Klasifikacija jednog dana po rasponu.
 *
 * `SINGLE` je jedina dobra vrijednost: jedan broj za cijeli dan. `ROUNDING`
 * je raspon unutar prikaza kotla — korisnik vidi isti broj iako su brojevi
 * tehnički različiti. `VISIBLE` je razlika koju vidi.
 */
function classify(spreadC, distinct) {
  if (distinct === null || distinct === undefined) return 'MISSING';
  if (distinct <= 1) return 'SINGLE';
  const abs = Math.abs(spreadC ?? 0);
  if (abs < VISIBLE_C) return 'ROUNDING';
  return 'VISIBLE';
}

/**
 * Sažetak nad nizom `{ homeProfileId, localDate, distinct, spreadC }`.
 *
 * `days` je broj **kuća-dana**, ne kalendarskih dana: kuća sa 3 vrijednosti
 * jednog dana je jedan dan sa oscilacijom, a ne tri.
 */
function summarize(rows) {
  const days = rows.length;
  const buckets = { SINGLE: 0, ROUNDING: 0, VISIBLE: 0, MISSING: 0 };
  for (const row of rows) buckets[classify(row.spreadC, row.distinct)]++;

  const spreads = rows
    .filter((r) => classify(r.spreadC, r.distinct) !== 'MISSING')
    .map((r) => Math.abs(r.spreadC ?? 0));

  const maxSpread = spreads.length ? Math.max(...spreads) : null;
  const meanSpread = spreads.length
    ? spreads.reduce((a, b) => a + b, 0) / spreads.length
    : null;
  const multi = buckets.ROUNDING + buckets.VISIBLE;

  return {
    days,
    withMultiple: multi,
    ratio: days === 0 ? null : multi / days,
    buckets,
    maxSpreadC: maxSpread,
    meanSpreadC: meanSpread,
  };
}

/**
 * Presuda. Namjerno **imenuje uzrok brojem kad nema podataka**, jer prazan
 * izlaz koji kaže „nema se šta mjeriti" ne razlikuje „nitko nije imao
 * preporuku" od „historija se ne piše".
 */
function verdict(summary, diag) {
  if (summary.days === 0) {
    /*
     * NULA MORA IMENOVATI UZROK.
     *
     * Prvi run poslije deploya (43402878050) dao je samo "nijedna kuca-dan
     * u prozoru nema BoilerHistory red". To ne razlikuje tri stanja koja se
     * rjesavaju razlicito:
     *
     *   NEMA_UOPSTE      tabela je prazna -> polling ne pise, problem u kodu
     *   NEMA_U_PROZORU   redova ima, ali svi su prije `--since` -> prozor je
     *                    prekratak; mjerenje treba pomjeriti, ne popravljati kod
     *   NEMA_POLAZNE     redova ima u prozoru, ali nijedan nema
     *                    `suggestedTemp` -> polling pise, ali bez broja
     *
     * Bez ovoga se "nema podataka" cita kao "popravka nije uspjela" ili kao
     * "nema grijanja", a to su suprotni zakljucci iz istog izlaza.
     */
    const d = diag ?? {};
    if ((d.totalRows ?? 0) === 0) {
      return {
        verdict: 'NEMA_UOPSTE',
        reason:
          'tabela "BoilerHistory" je prazna — polling ne piše redove, ' +
          'uzrok je u kodu ili rasporedu, ne u prozoru',
      };
    }
    if ((d.rowsInWindow ?? 0) === 0) {
      return {
        verdict: 'NEMA_U_PROZORU',
        reason:
          `${d.totalRows} redova ukupno, ali nijedan poslije ` +
          `${d.since ?? 'početka prozora'} (zadnji ${String(d.lastRowAt).slice(0, 10)}) — ` +
          `prozor je prekratak, ne kod`,
      };
    }
    return {
      verdict: 'NEMA_POLAZNE',
      reason:
        `${d.rowsInWindow} redova u prozoru, ali nijedan sa \`suggestedTemp\` — ` +
        `polling piše, ali bez predloga`,
    };
  }
  if (summary.withMultiple === 0) {
    return {
      verdict: 'STABLE',
      reason:
        `${summary.days} kuća-dana, svaki sa jednom vrijednosti — ` +
        `F4.5 nema šta popraviti na ovom uzorku`,
    };
  }
  if (summary.buckets.VISIBLE === 0) {
    return {
      verdict: 'OSCILLATION_INVISIBLE',
      reason:
        `${summary.withMultiple}/${summary.days} kuća-dana ima više vrijednosti, ` +
        `ali max raspon ${summary.maxSpreadC.toFixed(2)} K < ${VISIBLE_C} K — ` +
        `korisnik vidi isti broj`,
    };
  }
  return {
    verdict: 'OSCILLATION_VISIBLE',
    reason:
      `${summary.buckets.VISIBLE}/${summary.days} kuća-dana ima raspon > ` +
      `${VISIBLE_C} K (max ${summary.maxSpreadC.toFixed(2)} K) — F4.5 mijenja ` +
      `ono što korisnik vidi`,
  };
}

async function runSelfTest() {
  // Sintetika pokriva svaki ishod presude; bez ovoga bi skripta mogla biti
  // „zelena" samo zato što nikad nije vidjela nijedan slučaj.
  const cases = [
    /*
     * Tri nule, tri uzroka. Bez ovih slucaja skripta bi mogla vratiti jednu
     * presudu za sva tri stanja — a to je greska koju je run 43402878050
     * pokazao na stvarnim podacima.
     */
    { name: 'nema redova uopste', rows: [], diag: { totalRows: 0 }, expect: 'NEMA_UOPSTE' },
    {
      name: 'redova ima, nijedan u prozoru',
      rows: [],
      diag: { totalRows: 305, rowsInWindow: 0, since: '2026-11-13', lastRowAt: '2026-11-11T22:00:00Z' },
      expect: 'NEMA_U_PROZORU',
    },
    {
      name: 'redova ima u prozoru, bez predloga',
      rows: [],
      diag: { totalRows: 305, rowsInWindow: 12, rowsWithSuggested: 0 },
      expect: 'NEMA_POLAZNE',
    },
    {
      name: 'stabilno',
      rows: [
        { homeProfileId: 1, localDate: '2026-01-01', distinct: 1, spreadC: 0 },
        { homeProfileId: 1, localDate: '2026-01-02', distinct: 1, spreadC: 0 },
      ],
      expect: 'STABLE',
    },
    {
      name: 'samo zaokruživanje',
      rows: [
        { homeProfileId: 1, localDate: '2026-01-01', distinct: 3, spreadC: 0.2 },
        { homeProfileId: 1, localDate: '2026-01-02', distinct: 1, spreadC: 0 },
      ],
      expect: 'OSCILLATION_INVISIBLE',
    },
    {
      name: 'vidljiva oscilacija',
      rows: [
        { homeProfileId: 1, localDate: '2026-01-01', distinct: 4, spreadC: 4.5 },
        { homeProfileId: 1, localDate: '2026-01-02', distinct: 1, spreadC: 0 },
      ],
      expect: 'OSCILLATION_VISIBLE',
    },
    {
      name: 'granica tacno na pragu',
      rows: [
        { homeProfileId: 1, localDate: '2026-01-01', distinct: 2, spreadC: 0.5 },
      ],
      expect: 'OSCILLATION_VISIBLE',
    },
    {
      name: 'jedna vrijednost sa rasponom nije oscilacija',
      rows: [
        { homeProfileId: 1, localDate: '2026-01-01', distinct: 1, spreadC: 9 },
      ],
      expect: 'STABLE',
    },
  ];

  let failed = 0;
  for (const c of cases) {
    const got = verdict(summarize(c.rows), c.diag);
    const ok = got.verdict === c.expect;
    if (!ok) failed++;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${c.name}: ${got.verdict} (ocekivano ${c.expect})`);
  }

  const boundary = [
    [0, 1, 'SINGLE'],
    [0.2, 2, 'ROUNDING'],
    [0.499, 3, 'ROUNDING'],
    [0.5, 2, 'VISIBLE'],
    [4, 3, 'VISIBLE'],
    [0, null, 'MISSING'],
  ];
  for (const [spread, distinct, expect] of boundary) {
    const got = classify(spread, distinct);
    const ok = got === expect;
    if (!ok) failed++;
    console.log(
      `${ok ? 'OK  ' : 'FAIL'} classify(${spread}, ${distinct}) = ${got} (ocekivano ${expect})`,
    );
  }

  if (failed > 0) {
    console.error(`\n${failed} slucajeva nije proslo.`);
    process.exit(1);
  }
  console.log('\nSvi slucajevi prolaze.');
  process.exit(0);
}

async function main() {
  if (process.argv.includes('--self-test')) {
    await runSelfTest();
    return;
  }

  // Validacija argumenata prije URL-a: pogrešan datum je greška u pozivu, a
  // ne u okruženju — poruka mora reći to.
  const since = sinceDate();

  const url = process.env.DATABASE_URL_READONLY;
  if (!url) {
    console.error(
      'Nema DATABASE_URL_READONLY. Skripta samo cita; postavi read-only URL.',
    );
    process.exit(2);
  }

  const days = argValue('days', 60);
  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    await client.query('SET TRANSACTION READ ONLY');
    await client.query('BEGIN');

    /*
     * Kolona u bazi je `suggestedTemp`, ne `suggestedFlowTemp`: sema ima
     * `@map("suggestedTemp")`, pa polje Prisme i kolona nemaju isto ime. Prvo
     * pokretanje je palo na `column b.suggestedFlowTemp does not exist` —
     * ime se čita iz seme, ne po pamćenju.
     *
     * Grupa je `(userId, dan)` — `BoilerHistory` nema `homeProfileId`, a
     * korisnik ima jednu kuću u praksi. Ograničenje je zapisano u nalazu, ne
     * prećutano: ako korisnik ima više kuća, ovo bi ih spojilo. Kolona se ne
     * dodaje samo radi mjerenja.
     *
     * `ROUND(..., 2)` prije `DISTINCT`: ista vrijednost zaokružena na dvije
     * decimale je ista vrijednost za displej; bez toga bi razlika u 4. decimali
     * izgledala kao druga vrijednost i broj dana bi bio lažno visok.
     */
    const { rows } = await client.query(
      `SELECT
         d."userId" AS "homeProfileId",
         d."day" AS "localDate",
         COUNT(*)::int AS "distinct",
         (MAX(d."flow") - MIN(d."flow"))::float8 AS "spreadC"
       FROM (
         SELECT
           b."userId",
           to_char(b."createdAt", 'YYYY-MM-DD') AS "day",
           ROUND(b."suggestedTemp"::numeric, 2) AS "flow"
         FROM "BoilerHistory" b
         WHERE b."createdAt" >= CURRENT_DATE - ($1::int || ' days')::interval
           AND ($2::date IS NULL OR b."createdAt" >= $2::date)
           AND b."suggestedTemp" IS NOT NULL
         GROUP BY 1, 2, 3
       ) d
       GROUP BY 1, 2
       ORDER BY 2 DESC, 1`,
      [days, since],
    );

    await client.query('COMMIT');

    const summary = summarize(rows);

    /*
     * Ista dijagnostika kao kod F4.7: kad je nula, mora se znati STA je nula.
     * Mjeri se ukupno redova, redova u prozoru, i koliko ih ima `suggestedTemp`.
     */
    const { rows: diagRows } = await client.query(
      `SELECT
         (SELECT count(*)::int FROM "BoilerHistory") AS "totalRows",
         (SELECT count(*)::int FROM "BoilerHistory"
           WHERE "createdAt" >= CURRENT_DATE - ($1::int || ' days')::interval
             AND ($2::date IS NULL OR "createdAt" >= $2::date)) AS "rowsInWindow",
         (SELECT count(*)::int FROM "BoilerHistory"
           WHERE "suggestedTemp" IS NOT NULL) AS "rowsWithSuggested",
         (SELECT max("createdAt")::text FROM "BoilerHistory") AS "lastRowAt",
         (SELECT max("createdAt")::text FROM "BoilerHistory"
           WHERE "suggestedTemp" IS NOT NULL) AS "lastSuggestedAt"`,
      [days, since],
    );
    const diag = { ...(diagRows[0] ?? {}), since };

    const decision = verdict(summary, diag);

    if (process.argv.includes('--json')) {
      console.log(JSON.stringify({ summary, ...decision }, null, 2));
    } else {
      console.log('F4.5 — oscilacija polazne kroz dan');
      console.log(
        `  prozor:                 ${days} dana` +
          (since ? ` (od ${since})` : ''),
      );
      console.log(`  kuća-dana:              ${summary.days}`);
      console.log(`  sa više vrijednosti:    ${summary.withMultiple}`);
      if (summary.ratio !== null) {
        console.log(`  udio:                   ${(summary.ratio * 100).toFixed(1)} %`);
      }
      console.log(
        `  jedna / zaokruzeno / vidljivo: ${summary.buckets.SINGLE} / ` +
          `${summary.buckets.ROUNDING} / ${summary.buckets.VISIBLE}`,
      );
      if (summary.maxSpreadC !== null) {
        console.log(
          `  raspon max/prosjek:     ${summary.maxSpreadC.toFixed(2)} K / ` +
            `${summary.meanSpreadC.toFixed(2)} K`,
        );
      }
      console.log(
        `  dijagnostika:           ukupno ${diag.totalRows}, u prozoru ` +
          `${diag.rowsInWindow}, sa predlogom ${diag.rowsWithSuggested}, ` +
          `zadnji red ${String(diag.lastRowAt).slice(0, 16)}`,
      );
      console.log(`\n  ${decision.verdict}: ${decision.reason}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error?.message ?? error);
  process.exit(1);
});
