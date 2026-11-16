#!/usr/bin/env node
/**
 * Da li analitika koju korisnik vidi odgovara podacima u bazi? (read-only)
 *
 * **Šta se mjeri.** Tri stvari, svaka sa svojim upitom i svojom presudom — jer
 * se na ekranu sve tri vide kao jedan broj:
 *
 *   M1 — `totalCycles` vs. `totalDurationMin`. Backend sabira trajanja **samo**
 *        za događaje sa `timestampEnd`, a cikluse broji za sve. Ako otvorenih
 *        ciklusa ima, prosječno trajanje je podcijenjeno. Presuda:
 *        `NEMA_OTVORENIH` / `OTVORENI_PODCJENJUJU` (sa brojem).
 *
 *   M2 — `avgIndoorTemp`. Kolona je `Float` (obavezna), pa `?? 0` u servisu ne
 *        miješa nulu u prosjek. Provjerava se ipak, jer bi nula iz bilo kojeg
 *        izvora (writer, import) tiho pokvarila prosjek na cijelom ekranu:
 *        broje se događaji sa `roomCurrentTemp = 0`. Presuda:
 *        `NEMA_NULA` / `NULA_U_PROSJEKU`.
 *
 *   M4 — `degreeDays` je 0 na svih 87 dana. Backfill traži
 *        `MIN_OUTDOOR_SAMPLES_PER_DAY = 8` uzoraka vanjske temperature **u tom
 *        danu** (`backfill-reconstruction.ts:247`). Ako `BoilerHistory` ima
 *        manje, `null` je tačan — ali ako izvor ima podatak, onda je prag taj
 *        koji gasi polje. Mjeri se raspodjela, ne pretpostavka: prosjek redova
 *        po danu, koliko dana dostiže prag. Presuda:
 *        `PODATKA_NEMA` / `PRAG_GA_ISKLJUCUJE` / `POLJE_SE_PISE`.
 *
 *   M3 — dnevna analitika koje **nema**. `DailyRecord` ima 20+ mjernih kolona
 *        (`dutyPercent`, `overshootC`, `hysteresisK`, `nightUndershootC`, …),
 *        a nijedan analitički endpoint ih ne čita. Mjeri se koliko dana ih
 *        stvarno ima — da se zna da li je „prikaz je siromašan" problem
 *        podataka ili ekrana. Presuda: `NEMA_PODATAKA` / `IMA_PODATAKA`.
 *
 * Skripta je **samo čitanje**: `SET TRANSACTION READ ONLY`, samo `SELECT`.
 *
 * Upotreba:
 *   DATABASE_URL_READONLY=... node scripts/analytics-truth-readonly.cjs
 *   ... --days=90 ... --json ... --self-test
 */
'use strict';

const { Client } = require('pg');

if (process.argv.includes('--help')) {
  console.log(`Upotreba: DATABASE_URL_READONLY=... node scripts/analytics-truth-readonly.cjs [opcije]

  --days=N         koliko dana unazad (zadano 90)
  --json           mašinski čitljiv izlaz
  --self-test      provjeri presude na sintetici, bez baze
  --help           ova poruka

Mjeri tri stvari: otvorene cikluse (prosječno trajanje), nule u
avgIndoorTemp, i popunjenost dnevnih mjernih kolona koje UI ne prikazuje.
Samo SELECT.`);
  process.exit(0);
}

function argValue(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const value = Number(hit.slice(name.length + 3));
  return Number.isFinite(value) ? value : fallback;
}

/**
 * M1. Otvoreni ciklusi.
 *
 * `totalCycles` u servisu je `events.length`; `totalDurationMin` sabira samo
 * redove sa `timestampEnd`. Ova dva broja se zato razilaze čim postoji jedan
 * otvoren ciklus — a otvoren ciklus je normalno stanje dok grijanje traje, ne
 * kvar. Zato presuda mora reći **koliko** ih je, a ne samo „ima".
 */
function judgeOpenCycles({ cycles, open }) {
  if (cycles === 0) return 'NEMA_DOGADJAJA';
  if (open === 0) return 'NEMA_OTVORENIH';
  return 'OTVORENI_PODCJENJUJU';
}

/**
 * M2. Nule u temperaturi.
 *
 * Kolona je `Float` (obavezna) — nula u njoj je **vrijednost**, ne odsustvo
 * podatka. Zato nula ulazi u prosjek kao 0 °C. Presuda imenuje koliko redova.
 */
function judgeZeroTemps({ events, zero }) {
  if (events === 0) return 'NEMA_DOGADJAJA';
  if (zero === 0) return 'NEMA_NULA';
  return 'NULA_U_PROSJEKU';
}

/**
 * M3. Dnevne mjerne kolone.
 *
 * `null` je ovdje tačan odgovor kad dan nije obračunat (`outcomeAt` je null).
 * Zato se broje samo dani **sa** obračunom — inače bi nerazrađen dan izgledao
 * kao kvar.
 */
function judgeDailyMetrics({ days, withOutcome, withMetrics }) {
  if (days === 0) return 'NEMA_DANA';
  if (withOutcome === 0) return 'NEMA_OBRACUNA';
  if (withMetrics === 0) return 'OBRACUN_BEZ_METRIKA';
  /*
   * Prag od 25 % je **imenovan**, ne osjećaj: ispod njega dnevna metrika ne
   * može nositi ni jedan ekran (prosjek preko 4 dana od 87 nije analitika).
   * Gola presuda `IMA_PODATAKA` na 5/86 bila bi tehnički tačna i praktično
   * lažna — zato se ta dva slučaja razdvajaju.
   */
  const share = withMetrics / withOutcome;
  if (share < 0.25) return 'METRIKE_RIJETKE';
  return 'IMA_PODATAKA';
}

/**
 * M4. `degreeDays` iz izvora.
 *
 * Otvoreno pitanje iz §10.46 bilo je „ako izvor ima podatak, gdje se gubi".
 * Tri ishoda, tri različita popravka:
 *   - `PODATKA_NEMA` — `BoilerHistory` nema `externalTemp` za te dane. Popravka
 *     je u izvoru (mjerenje), ne u pragu i ne u piscu.
 *   - `PRAG_GA_ISKLJUCUJE` — podatak postoji, ali manje od 8 redova po danu.
 *     Popravka je prag (ili gušći polling) — **ne** pisac.
 *   - `POLJE_SE_PISE` — prag dostignut a polje ipak prazno. Tek tada je pisac.
 */
function judgeDegreeDays({ daysWithOutdoor, belowThreshold, stored }) {
  if (daysWithOutdoor === 0) return 'PODATKA_NEMA';
  if (belowThreshold > 0) return 'PRAG_GA_ISKLJUCUJE';
  if (stored === 0) return 'PISAC_GA_PRESKACE';
  return 'POLJE_SE_PISE';
}

async function runSelfTest() {
  let failed = 0;
  const ok = (cond, label) => {
    if (!cond) failed++;
    console.log(`${cond ? 'OK  ' : 'FAIL'} ${label}`);
  };

  // M1: redoslijed je bitan — prazan prozor nije isto što i „svi zatvoreni".
  ok(judgeOpenCycles({ cycles: 0, open: 0 }) === 'NEMA_DOGADJAJA', 'M1 0 ciklusa -> NEMA_DOGADJAJA');
  ok(judgeOpenCycles({ cycles: 40, open: 0 }) === 'NEMA_OTVORENIH', 'M1 40/40 zatvorenih -> NEMA_OTVORENIH');
  ok(judgeOpenCycles({ cycles: 40, open: 1 }) === 'OTVORENI_PODCJENJUJU', 'M1 1 otvoren -> OTVORENI_PODCJENJUJU');

  // M2.
  ok(judgeZeroTemps({ events: 0, zero: 0 }) === 'NEMA_DOGADJAJA', 'M2 bez događaja -> NEMA_DOGADJAJA');
  ok(judgeZeroTemps({ events: 50, zero: 0 }) === 'NEMA_NULA', 'M2 bez nula -> NEMA_NULA');
  ok(judgeZeroTemps({ events: 50, zero: 3 }) === 'NULA_U_PROSJEKU', 'M2 3 nule -> NULA_U_PROSJEKU');

  // M3: dan bez obračuna nije kvar metrika.
  ok(judgeDailyMetrics({ days: 0, withOutcome: 0, withMetrics: 0 }) === 'NEMA_DANA', 'M3 bez dana -> NEMA_DANA');
  ok(
    judgeDailyMetrics({ days: 30, withOutcome: 0, withMetrics: 0 }) === 'NEMA_OBRACUNA',
    'M3 30 dana bez outcomeAt -> NEMA_OBRACUNA',
  );
  ok(
    judgeDailyMetrics({ days: 30, withOutcome: 10, withMetrics: 0 }) === 'OBRACUN_BEZ_METRIKA',
    'M3 obračunat ali bez metrika -> OBRACUN_BEZ_METRIKA',
  );
  ok(
    judgeDailyMetrics({ days: 30, withOutcome: 10, withMetrics: 8 }) === 'IMA_PODATAKA',
    'M3 8/10 sa metrikama -> IMA_PODATAKA',
  );
  // Granica je prag, ne osjećaj: 2/10 je ispod 25 %, 3/10 iznad.
  ok(
    judgeDailyMetrics({ days: 30, withOutcome: 10, withMetrics: 2 }) === 'METRIKE_RIJETKE',
    'M3 2/10 (20 %) -> METRIKE_RIJETKE, ne IMA_PODATAKA',
  );
  ok(
    judgeDailyMetrics({ days: 30, withOutcome: 10, withMetrics: 3 }) === 'IMA_PODATAKA',
    'M3 3/10 (30 %) -> IMA_PODATAKA',
  );
  ok(
    judgeDailyMetrics({ days: 86, withOutcome: 86, withMetrics: 5 }) === 'METRIKE_RIJETKE',
    'M3 5/86 (6 %) -> METRIKE_RIJETKE',
  );

  // M4: tri ishoda se ne smiju stisnuti u jedan — svaki ima drugu popravku.
  ok(judgeDegreeDays({ daysWithOutdoor: 0, belowThreshold: 0, stored: 0 }) === 'PODATKA_NEMA', 'M4 nema izvora -> PODATKA_NEMA');
  ok(
    judgeDegreeDays({ daysWithOutdoor: 20, belowThreshold: 18, stored: 0 }) === 'PRAG_GA_ISKLJUCUJE',
    'M4 18/20 dana ispod praga -> PRAG_GA_ISKLJUCUJE (ne pisac)',
  );
  ok(
    judgeDegreeDays({ daysWithOutdoor: 20, belowThreshold: 0, stored: 0 }) === 'PISAC_GA_PRESKACE',
    'M4 prag dostignut a polje prazno -> PISAC_GA_PRESKACE',
  );
  ok(
    judgeDegreeDays({ daysWithOutdoor: 20, belowThreshold: 0, stored: 20 }) === 'POLJE_SE_PISE',
    'M4 prag dostignut i polje puno -> POLJE_SE_PISE',
  );

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

  const url = process.env.DATABASE_URL_READONLY;
  if (!url) {
    console.error('DATABASE_URL_READONLY nije postavljen — mjerenje nije pokrenuto.');
    process.exit(1);
  }

  const days = argValue('days', 90);
  const asJson = process.argv.includes('--json');
  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    await client.query('SET TRANSACTION READ ONLY');
    await client.query('BEGIN');

    const windowStart = `now() - ($1::int || ' days')::interval`;

    // M1 + M2 u jednom prolazu: isti skup redova, dva broja.
    const events = await client.query(
      `SELECT count(*)::int AS cycles,
              count(*) FILTER (WHERE "timestampEnd" IS NULL)::int AS open,
              count(*) FILTER (WHERE "currentTemp" = 0)::int AS zero_current,
              count(*) FILTER (WHERE "targetTemp" = 0)::int AS zero_target,
              avg("currentTemp") AS avg_current,
              avg("currentTemp") FILTER (WHERE "currentTemp" <> 0) AS avg_current_no_zero
         FROM "HeatingEvent"
        WHERE "timestampStart" >= ${windowStart}`,
      [days],
    );

    // M3: koliko dana ima obračun i koliko ih stvarno nosi mjerne kolone.
    const daily = await client.query(
      `SELECT count(*)::int AS days,
              count(*) FILTER (WHERE "outcomeAt" IS NOT NULL)::int AS with_outcome,
              count(*) FILTER (
                WHERE "dutyPercent" IS NOT NULL
                  AND "overshootC" IS NOT NULL
                  AND "hysteresisK" IS NOT NULL
              )::int AS with_metrics,
              count(*) FILTER (WHERE "gasM3" IS NOT NULL)::int AS with_gas,
              count(*) FILTER (WHERE "degreeDays" IS NOT NULL)::int AS with_degree_days
         FROM "DailyRecord"
        WHERE "localDate" >= to_char(CURRENT_DATE - ($1::int || ' days')::interval, 'YYYY-MM-DD')`,
      [days],
    );

    /*
     * M4: koliko `BoilerHistory` redova nosi vanjsku temperaturu po danu.
     * Prag je 8 (ista konstanta kao u backfillu) — ne prepisuje se ovdje kao
     * druga vrijednost, nego se poredi sa stvarnom raspodjelom.
     */
    const outdoor = await client.query(
      `SELECT count(*) FILTER (WHERE "n" > 0)::int AS days_with_outdoor,
              count(*) FILTER (WHERE "n" > 0 AND "n" < 8)::int AS below_threshold,
              coalesce(avg("n") FILTER (WHERE "n" > 0), 0) AS avg_rows,
              coalesce(max("n"), 0)::int AS max_rows
         FROM (
           SELECT to_char("createdAt" AT TIME ZONE 'Europe/Sarajevo', 'YYYY-MM-DD') AS d,
                  count(*) FILTER (WHERE "externalTemp" IS NOT NULL)::int AS n
             FROM "BoilerHistory"
            WHERE "createdAt" >= ${windowStart}
            GROUP BY 1
         ) per_day`,
      [days],
    );
    const o = outdoor.rows[0];

    const e = events.rows[0];
    const d = daily.rows[0];

    const m1 = judgeOpenCycles({ cycles: e.cycles, open: e.open });
    const m2 = judgeZeroTemps({ events: e.cycles, zero: e.zero_current });
    /*
     * Koliko nula stvarno pomjera broj na ekranu. Nula ulazi u prosjek kao
     * 0 °C, pa je prikazani prosjek NIŽI od stvarnog. Bez ovog broja nalaz
     * „ima nula" ne kaže da li je razlika 0,01 K ili 3 K.
     */
    const avgShown = e.avg_current === null ? null : Number(e.avg_current);
    const avgNoZero = e.avg_current_no_zero === null ? null : Number(e.avg_current_no_zero);
    const zeroBiasK =
      avgShown !== null && avgNoZero !== null
        ? Number((avgNoZero - avgShown).toFixed(2))
        : null;
    const m4 = judgeDegreeDays({
      daysWithOutdoor: o.days_with_outdoor,
      belowThreshold: o.below_threshold,
      stored: d.with_degree_days,
    });
    const m3 = judgeDailyMetrics({
      days: d.days,
      withOutcome: d.with_outcome,
      withMetrics: d.with_metrics,
    });

    // Prosječno trajanje kakvo servis vraća danas vs. kakvo bi bilo da se
    // ciklusi bez kraja ne broje. Ovo je broj koji korisnik vidi na ekranu.
    const durationRow = await client.query(
      `SELECT coalesce(sum(EXTRACT(EPOCH FROM ("timestampEnd" - "timestampStart")) / 60), 0) AS total_min,
              count(*) FILTER (WHERE "timestampEnd" IS NOT NULL)::int AS closed
         FROM "HeatingEvent"
        WHERE "timestampStart" >= ${windowStart}`,
      [days],
    );
    const totalMin = Number(durationRow.rows[0].total_min);
    const closed = durationRow.rows[0].closed;
    const avgAsShown = e.cycles ? totalMin / e.cycles : 0;
    const avgIfClosedOnly = closed ? totalMin / closed : 0;

    const result = {
      windowDays: days,
      m1: { verdict: m1, cycles: e.cycles, open: e.open, totalMin: Math.round(totalMin), avgAsShown: Number(avgAsShown.toFixed(2)), avgIfClosedOnly: Number(avgIfClosedOnly.toFixed(2)) },
      m2: { verdict: m2, events: e.cycles, zeroCurrent: e.zero_current, zeroTarget: e.zero_target, avgShown, avgNoZero, zeroBiasK },
      m3: { verdict: m3, days: d.days, withOutcome: d.with_outcome, withMetrics: d.with_metrics, withGas: d.with_gas, withDegreeDays: d.with_degree_days },
      m4: { verdict: m4, daysWithOutdoor: o.days_with_outdoor, belowThreshold: o.below_threshold, avgRows: Number(Number(o.avg_rows).toFixed(1)), maxRows: o.max_rows, storedDegreeDays: d.with_degree_days },
    };

    if (asJson) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      /*
       * Jedna `SAZETAK:` linija sa SVE TRI presude.
       *
       * `emit_notice.sh` uzima **prvu** liniju koja nosi odluku — a GitHub
       * prihvata 50 anotacija po job-u i tiho odbacuje ostatak. Tri odvojene
       * linije zato ne bi bile tri anotacije, nego bi samo prva (M1) stigla do
       * nalaza. Zato sve tri idu u jednu liniju, razdvojene sa `|`.
       */
      console.log(`ANALITIKA prozor ${days} dana`);
      console.log(
        `  SAZETAK: M1 ${m1} (${e.cycles} ciklusa, ${e.open} bez kraja, prosj. ${avgAsShown.toFixed(2)} vs ${avgIfClosedOnly.toFixed(2)} min) | M2 ${m2} (${e.zero_current} nula od ${e.cycles}, prikazano ${avgShown === null ? '—' : avgShown.toFixed(2)} vs stvarno ${avgNoZero === null ? '—' : avgNoZero.toFixed(2)} °C, razlika ${zeroBiasK === null ? '—' : zeroBiasK.toFixed(2)} K) | M3 ${m3} (${d.with_metrics}/${d.with_outcome} obracunatih dana ima metrike, ${d.with_gas} plin od ${d.days}) | M4 ${m4} (${o.days_with_outdoor} dana sa outdoorTempC, ${o.below_threshold} ispod praga 8, prosj. ${Number(o.avg_rows).toFixed(1)} redova, max ${o.max_rows}, stepen-dan upisan ${d.with_degree_days}/${d.days})`,
      );
      console.log(
        `  detalj M1: prosj. trajanje kako se prikazuje ${avgAsShown.toFixed(2)} min, samo zatvoreni ${avgIfClosedOnly.toFixed(2)} min`,
      );
      console.log(
        `  detalj M2: ${e.zero_current} nula u currentTemp, ${e.zero_target} nula u targetTemp (od ${e.cycles} dogadjaja); prosj. sa nulama ${avgShown === null ? '—' : avgShown.toFixed(3)} °C, bez nula ${avgNoZero === null ? '—' : avgNoZero.toFixed(3)} °C`,
      );
      console.log(
        `  detalj M3: ${d.days} dana, ${d.with_outcome} sa outcomeAt, ${d.with_metrics} sa metrikama, ${d.with_gas} sa plinom, ${d.with_degree_days} sa stepen-danom`,
      );
      console.log(
        `  detalj M4: ${o.days_with_outdoor} dana ima outdoorTempC, od toga ${o.below_threshold} ispod praga 8; prosj. ${Number(o.avg_rows).toFixed(1)} redova/dan, max ${o.max_rows}`,
      );
    }

    await client.query('ROLLBACK');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('ANALITIKA mjerenje palo:', err.message);
  process.exit(1);
});
