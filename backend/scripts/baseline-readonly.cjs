#!/usr/bin/env node
/**
 * Baseline iz PRODUKCIONE baze, **samo čitanje** (`19` §5).
 *
 * Zašto postoji: tvrdnja o uštedi je „prije i poslije". Prije nego što se
 * prekidač okrene, mora postojati izmjereno stanje — koliko se plina trošilo po
 * stepen-danu, sa kojom polaznom, pod kojim vanjskim temperaturama. Bez toga se
 * poslije ne može reći ni da je bolje ni da je isto; može se samo reći da je
 * drugačije.
 *
 * Sigurnosna pravila ovog fajla, namjerno:
 *   - veza je preko `DATABASE_URL_READONLY`, nikad glavnog `DATABASE_URL`;
 *   - sesija je `read only`, pa nijedan `INSERT`/`UPDATE` ne bi prošao čak i da
 *     se potkrade kroz grešku u kodu — to je zaštita na strani servera, ne
 *     obećanje u komentaru;
 *   - svaki upit je `SELECT`; skripta ne piše ni u jednu tabelu;
 *   - URL se **nikad** ne ispisuje (može sadržati lozinku), samo host i baza.
 *
 * Izlaz je markdown u `$GITHUB_STEP_SUMMARY` plus nekoliko `::notice::`
 * anotacija — u ovom okruženju se log job-a ne može preuzeti, a anotacije idu
 * kroz API.
 */

const { Client } = require('pg');

const url = process.env.DATABASE_URL_READONLY;
if (!url) {
  console.error(
    'DATABASE_URL_READONLY nije postavljen. Skripta namjerno ne pada na ' +
      'DATABASE_URL: baseline se čita iz produkcije, ali nikad kroz kredencijal ' +
      'koji smije pisati.',
  );
  process.exit(2);
}

/** Markdown izlaz za job summary. */
const lines = [];
const out = (line = '') => {
  lines.push(line);
  console.log(line);
};
const notice = (message) => {
  // Jedna linija po anotaciji; `%` i novi redovi bi pokvarili format.
  const flat = String(message).replace(/[\r\n]+/g, ' ').replace(/%/g, '%25');
  console.log(`::notice::${flat}`);
};

const fmt = (value, digits = 1) =>
  value == null || Number.isNaN(Number(value))
    ? '—'
    : Number(value).toFixed(digits);

const day = (value) =>
  value == null ? '—' : new Date(value).toISOString().slice(0, 10);

async function q(client, sql, params = []) {
  const { rows } = await client.query(sql, params);
  return rows;
}

/** Upit koji smije pasti bez rušenja izvještaja (npr. tabela još ne postoji). */
async function soft(client, label, sql, params = []) {
  try {
    return await q(client, sql, params);
  } catch (error) {
    out(`- ⚠️ **${label}**: \`${error.message}\``);
    return null;
  }
}

async function main() {
  const client = new Client({ connectionString: url, ssl: false });
  await client.connect();

  try {
    // Zaštita na strani servera: i greška u kodu ostaje samo za čitanje.
    await client.query('SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY');
    const ro = await q(client, 'SHOW transaction_read_only');
    const readOnly = ro[0]?.transaction_read_only === 'on';

    const meta = await q(
      client,
      'SELECT current_database() AS db, current_user AS usr, now() AS now',
    );
    out('# Baseline iz produkcije (samo čitanje)');
    out();
    out(
      `Baza \`${meta[0].db}\`, korisnik \`${meta[0].usr}\`, ` +
        `sesija read-only: **${readOnly ? 'da' : 'NE'}**, ` +
        `izmjereno ${meta[0].now.toISOString()}.`,
    );
    if (!readOnly) {
      // Ako server ne garantuje read-only, izvještaj ne smije izgledati sigurno.
      out();
      out('> ⚠️ Sesija nije potvrđeno read-only — brojeve ispod ne tretirati kao provjerene.');
    }
    out();

    // --- domovi -------------------------------------------------------------
    out('## Domovi (profili)');
    out();
    const homes = await soft(
      client,
      'HomeProfile',
      `SELECT id, "homeName", "floorArea", "heatingType", "hasFloorHeating",
              "boilerCatalogId", "maxHeatingFlowC", "boilerModel", "createdAt"
         FROM "HomeProfile" ORDER BY id`,
    );
    if (homes) {
      if (homes.length === 0) out('- nema profila');
      for (const home of homes) {
        out(
          `- #${home.id} ${home.homeName ?? '(bez imena)'} · ` +
            `${fmt(home.floorArea, 0)} m² · ${home.heatingType}` +
            `${home.hasFloorHeating ? ' + podno' : ''} · ` +
            `model: \`${home.boilerCatalogId ?? 'nije odabran'}\`` +
            `${
              home.boilerCatalogId == null && home.boilerModel
                ? ` (stari tekst: „${home.boilerModel}")`
                : ''
            } · ` +
            `maxHeatingFlowC: ${home.maxHeatingFlowC == null ? '—' : fmt(home.maxHeatingFlowC, 0)}`,
        );
      }
    }
    out();

    // --- plin ---------------------------------------------------------------
    out('## Očitanja plina');
    out();
    const gas = await soft(
      client,
      'GasReading',
      `SELECT "userId",
              count(*) AS readings,
              min("readingDate") AS first_date,
              max("readingDate") AS last_date,
              sum(CASE WHEN "consumption" IS NOT NULL THEN "consumption" END) AS total_m3,
              count("consumption") AS with_consumption
         FROM "GasReading" GROUP BY "userId" ORDER BY "userId"`,
    );
    if (gas) {
      if (gas.length === 0) out('- nema očitanja');
      for (const row of gas) {
        out(
          `- korisnik ${row.userId}: ${row.readings} očitanja ` +
            `(${day(row.first_date)} → ${day(row.last_date)}), ` +
            `${fmt(row.total_m3)} m³ ukupno, ` +
            `${row.with_consumption} sa izračunatom potrošnjom`,
        );
      }
      const span = await soft(
        client,
        'GasReading span',
        `SELECT (max("readingDate") - min("readingDate")) AS span
           FROM "GasReading" WHERE "consumption" IS NOT NULL`,
      );
      if (span && span[0] && span[0].span) {
        out(
          `- raspon sa potrošnjom: **${span[0].span.days} dana** — ` +
            `365 dana je puna sezona, kraće znači da baseline pokriva samo dio.`,
        );
      }
    }
    out();

    // --- dnevni zapisi ------------------------------------------------------
    out('## Dnevni zapisi (`DailyRecord`)');
    out();
    const daily = await soft(
      client,
      'DailyRecord',
      `SELECT "homeProfileId",
              count(*) AS rows,
              min("localDate") AS first_date,
              max("localDate") AS last_date,
              count("proposedFlowTemp") AS with_proposal,
              count("outcomeAt") AS with_outcome,
              count("gasM3") AS with_gas,
              count(CASE WHEN "degreeDays" IS NOT NULL AND "degreeDays" > 0 THEN 1 END) AS with_degree_days,
              count("shadowFlowC") AS with_shadow,
              count("heatRateCPerHour") AS with_heat_rate,
              avg("proposedFlowTemp") AS avg_proposed,
              avg("flowSetC") AS avg_set,
              avg("nightUndershootC") AS avg_night_undershoot
         FROM "DailyRecord" GROUP BY "homeProfileId" ORDER BY "homeProfileId"`,
    );
    if (daily) {
      if (daily.length === 0) out('- nema zapisa');
      for (const row of daily) {
        out(
          `- profil ${row.homeProfileId}: ${row.rows} dana ` +
            `(${row.first_date} → ${row.last_date}) · ` +
            `predlog ${row.with_proposal} · mjereno ${row.with_outcome} · ` +
            `plin ${row.with_gas} · stepen-dan ${row.with_degree_days} · ` +
            `shadow ${row.with_shadow} · heatRate ${row.with_heat_rate} · ` +
            `prosječna polazna ${fmt(row.avg_proposed)} °C ` +
            `(stvarno na kotlu ${fmt(row.avg_set)} °C), ` +
            `noćni manjak ${fmt(row.avg_night_undershoot, 2)} K`,
        );
      }
    }
    out();

    // --- ono što baseline-u daje smisao ------------------------------------
    out('## Odnos plin ↔ stepen-dan (osnov za „prije")');
    out();
    const ratio = await soft(
      client,
      'gas per degree day',
      `SELECT count(*) AS days,
              sum("gasM3") AS gas_m3,
              sum("degreeDays") AS degree_days,
              avg("gasM3" / "degreeDays") AS m3_per_dd
         FROM "DailyRecord"
        WHERE "gasM3" IS NOT NULL AND "degreeDays" IS NOT NULL AND "degreeDays" > 0`,
    );
    if (ratio && ratio[0]) {
      const row = ratio[0];
      if (Number(row.days) === 0) {
        out(
          '- **nema dana sa i plinom i stepen-danom** — baseline se ne može ' +
            'izračunati iz dnevnih zapisa. To znači da povezivanje plina sa ' +
            'stepen-danom još nije urađeno, ne da nema podataka.',
        );
      } else {
        out(
          `- ${row.days} dana · ${fmt(row.gas_m3)} m³ · ` +
            `${fmt(row.degree_days, 0)} K·dan · ` +
            `**${fmt(row.m3_per_dd, 3)} m³/K·dan**`,
        );
        if (Number(row.days) < 60) {
          out(
            `- ⚠️ ${row.days} dana je premalo za tvrdnju o sezoni; ` +
              `regresija na 60 dana daje broj, ne zaključak.`,
          );
        }
      }
    }
    out();

    // --- mjerenja -----------------------------------------------------------
    out('## Mjerenja (`ThermostatObservation`)');
    out();
    const obs = await soft(
      client,
      'ThermostatObservation',
      `SELECT count(*) AS samples,
              min("at") AS first_at,
              max("at") AS last_at
         FROM "ThermostatObservation"`,
    );
    if (obs && obs[0]) {
      out(
        `- ${obs[0].samples} uzoraka (${day(obs[0].first_at)} → ${day(obs[0].last_at)})`,
      );
    }
    out();

    const events = await soft(
      client,
      'HeatingEvent',
      `SELECT count(*) AS events,
              count(CASE WHEN "isAnomaly" THEN 1 END) AS anomalies,
              min("timestampStart") AS first_at,
              max("timestampStart") AS last_at
         FROM "HeatingEvent"`,
    );
    if (events && events[0]) {
      out(
        `- ciklusa grijanja: ${events[0].events} ` +
          `(${events[0].anomalies} anomalija), ` +
          `${day(events[0].first_at)} → ${day(events[0].last_at)}`,
      );
    }
    out();

    out('---');
    out();
    out(
      'Ovo je **stanje prije promjene polazne**. Ušteda se ne može izračunati ' +
        'iz ovih brojeva — potreban je period poslije, sa istim mjerilom ' +
        '(`m³/K·dan`), pa razlika. Baseline bez „poslije" dokazuje samo da je ' +
        'mjerenje moguće.',
    );

    // Kratak sažetak kao anotacije: log se ne može preuzeti, a ovo može.
    const dailyTotals = (daily ?? []).reduce(
      (acc, row) => ({
        rows: acc.rows + Number(row.rows),
        gas: acc.gas + Number(row.with_gas),
        dd: acc.dd + Number(row.with_degree_days),
        shadow: acc.shadow + Number(row.with_shadow),
      }),
      { rows: 0, gas: 0, dd: 0, shadow: 0 },
    );
    notice(
      `DailyRecord: ${dailyTotals.rows} dana, plin ${dailyTotals.gas}, ` +
        `stepen-dan ${dailyTotals.dd}, shadow ${dailyTotals.shadow}`,
    );
    notice(
      `plin po stepen-danu: ${ratio && ratio[0] ? `${ratio[0].days} dana, ${fmt(ratio[0].m3_per_dd, 3)} m³/K·dan` : 'n/a'}`,
    );
    notice(
      `mjerenja: ${obs && obs[0] ? obs[0].samples : 'n/a'} uzoraka, ` +
        `ciklusa: ${events && events[0] ? events[0].events : 'n/a'}`,
    );
  } finally {
    await client.end();
  }

  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) {
    require('node:fs').appendFileSync(summary, lines.join('\n') + '\n');
  }
}

main().catch((error) => {
  // Poruka bez konekcionog stringa — `pg` ga zna ubaciti u tekst greške.
  console.error('Baseline nije prošao:', error.message);
  process.exit(1);
});
