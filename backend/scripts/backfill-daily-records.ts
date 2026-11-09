/**
 * Backfill `DailyRecord`-a za dane prije nego što je pisac postojao (`20`, `21`).
 *
 * Dva režima, i to je namjerno:
 *
 *   --dry-run (zadano) čita i ispisuje šta bi upisao; traži samo
 *             `DATABASE_URL_READONLY` i ne mijenja ništa;
 *   --apply   upisuje; traži `DATABASE_URL_BACKFILL` (kredencijal koji SMIJE
 *             pisati) i odbija se pokrenuti bez njega.
 *
 * Zašto dva kredencijala: isto pravilo kao kod baseline-a — čitanje produkcije i
 * pisanje u produkciju ne smiju biti ista dozvola. Skripta neće uzeti
 * `DATABASE_URL` kao zamjenu, jer bi tada „dry-run" mogao postati upis zbog
 * pogrešno postavljene varijable.
 *
 * Šta se upisuje: v. `backfill-reconstruction.ts`. Ukratko — samo dani koji imaju
 * bar jedan izvor (`HeatingEvent`, `BoilerHistory`, `GasReading`,
 * `Recommendation`), sa `modelVersion`/`outcomeVersion = backfill-events-1` i bez
 * `shadow*` i `params`.
 *
 * Upotreba:
 *   npm run backfill:daily -- --dry-run
 *   npm run backfill:daily -- --apply --from 2026-01-01 --to 2026-11-18
 */

import { Client } from 'pg';
import {
  BACKFILL_VERSION,
  reconstructDay,
  summarise,
  type BackfillBoilerRow,
  type BackfillEvent,
  type BackfillGasReading,
  type BackfillRecommendation,
  type BackfillRow,
} from '../src/modules/DailyRecord/backfill-reconstruction';
import {
  localDateKey,
  resolveHomeTimeZone,
} from '../src/modules/DailyRecord/proposal-schedule';

interface Args {
  apply: boolean;
  from: string | null;
  to: string | null;
  homeProfileId: number | null;
  limit: number | null;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    apply: false,
    from: null,
    to: null,
    homeProfileId: null,
    limit: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    switch (flag) {
      case '--apply':
        args.apply = true;
        break;
      case '--dry-run':
        args.apply = false;
        break;
      case '--from':
        args.from = argv[++index] ?? null;
        break;
      case '--to':
        args.to = argv[++index] ?? null;
        break;
      case '--home':
        args.homeProfileId = Number(argv[++index]);
        break;
      case '--limit':
        args.limit = Number(argv[++index]);
        break;
      case '--help':
        console.log(
          'Upotreba: backfill-daily-records [--dry-run|--apply] [--from YYYY-MM-DD] ' +
            '[--to YYYY-MM-DD] [--home ID] [--limit N]',
        );
        process.exit(0);
        break;
      default:
        console.error(`Nepoznat argument: ${flag}`);
        process.exit(2);
    }
  }

  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (args.from && !dateRe.test(args.from)) {
    console.error('--from mora biti YYYY-MM-DD');
    process.exit(2);
  }
  if (args.to && !dateRe.test(args.to)) {
    console.error('--to mora biti YYYY-MM-DD');
    process.exit(2);
  }

  return args;
}

const notice = (message: string): void => {
  console.log(`::notice::${message.replace(/[\r\n]+/g, ' ')}`);
};

/*
 * Zona se određuje **istom** funkcijom kao kod živog pisca
 * (`home.weatherTimezone` → `user.timezone` → zadana). Backfill koji bi koristio
 * drugačije granice dana pravi redove koji se ne slažu sa živima — a to je gore
 * od prazne tabele, jer se poslije ne vidi šta je pomjereno.
 */
async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const url = args.apply
    ? process.env.DATABASE_URL_BACKFILL
    : (process.env.DATABASE_URL_READONLY ?? process.env.DATABASE_URL_BACKFILL);

  if (!url) {
    console.error(
      args.apply
        ? 'DATABASE_URL_BACKFILL nije postavljen — upis u produkciju traži poseban kredencijal.'
        : 'DATABASE_URL_READONLY nije postavljen — dry-run čita iz produkcije, ali samo čita.',
    );
    process.exit(2);
  }

  const client = new Client({ connectionString: url, ssl: false });
  await client.connect();

  try {
    if (!args.apply) {
      await client.query('SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY');
    }

    const homes = (
      await client.query<{
        id: number;
        userId: number;
        weatherTimezone: string | null;
        userTimeZone: string | null;
      }>(
        `SELECT hp.id, hp."userId", hp."weatherTimezone", u."timezone" AS "userTimeZone"
           FROM "HomeProfile" hp
           JOIN "User" u ON u.id = hp."userId"
          ${args.homeProfileId ? 'WHERE hp.id = $1' : ''}
          ORDER BY hp.id`,
        args.homeProfileId ? [args.homeProfileId] : [],
      )
    ).rows;

    console.log(
      `# Backfill DailyRecord — ${args.apply ? 'UPIS' : 'dry-run'} (${BACKFILL_VERSION})`,
    );
    console.log('');

    let totalRows = 0;
    let totalDefaultZone = 0;
    let totalExisting = 0;
    const collected: Array<{ userId: number; homeProfileId: number; row: BackfillRow }> = [];

    for (const home of homes) {
      const resolved = resolveHomeTimeZone({
        homeTimeZone: home.weatherTimezone,
        userTimeZone: home.userTimeZone,
      });
      const zone = resolved.zone;
      if (resolved.source === 'DEFAULT') {
        // Nije greška, ali se vidi: bez zone dan se reže po zadanom vremenu.
        totalDefaultZone += 1;
        console.log(
          `- kuća #${home.id}: nema poznatu vremensku zonu — koristim ${zone} ` +
            '(isto kao živi pisac)',
        );
      }

      // Granice raspona se primjenjuju u SQL-u radi brzine; tačno pripadanje
      // lokalnom danu odlučuje funkcija, jer SQL ne zna zonu kuće.
      const from = args.from ? `${args.from} 00:00:00` : '1970-01-01';
      const to = args.to ? `${args.to} 23:59:59` : '2100-01-01';

      const userId = home.userId;

      const events = (
        await client.query<{
          timestampStart: Date;
          timestampEnd: Date | null;
          roomCurrentTemp: number;
          roomTargetTemp: number;
          hvacAction: string | null;
        }>(
          `SELECT e."timestampStart", e."timestampEnd", e."currentTemp" AS "roomCurrentTemp",
                  e."targetTemp" AS "roomTargetTemp", e."hvacAction"
             FROM "HeatingEvent" e
             JOIN "ThermostatDevice" d ON d.id = e."deviceId"
            WHERE d."homeProfileId" = $1
              AND e."timestampStart" BETWEEN $2 AND $3
            ORDER BY e."timestampStart"`,
          [home.id, from, to],
        )
      ).rows as BackfillEvent[];

      const boilerRows = (
        await client.query<{
          createdAt: Date;
          externalTemp: number;
          suggestedFlowTemp: number;
          actualFlowTemp: number | null;
        }>(
          `SELECT b."createdAt", b."externalTemp", b."suggestedTemp" AS "suggestedFlowTemp",
                  b."actualTemp" AS "actualFlowTemp"
             FROM "BoilerHistory" b
            WHERE b."userId" = $1 AND b."createdAt" BETWEEN $2 AND $3
            ORDER BY b."createdAt"`,
          [userId, from, to],
        )
      ).rows as BackfillBoilerRow[];

      const gasReadings = (
        await client.query<{ readingDate: Date; consumption: number | null }>(
          `SELECT "readingDate", "consumption" FROM "GasReading"
            WHERE "userId" = $1 AND "readingDate" BETWEEN $2 AND $3
            ORDER BY "readingDate"`,
          [userId, from, to],
        )
      ).rows as BackfillGasReading[];

      const recommendations = (
        await client.query<{ date: Date; recommendedFlowTemp: number }>(
          `SELECT "date", "recommendedFlowTemp" FROM "Recommendation"
            WHERE "userId" = $1 AND "date" BETWEEN $2 AND $3
            ORDER BY "date"`,
          [userId, from, to],
        )
      ).rows as BackfillRecommendation[];

      const existing = new Set(
        (
          await client.query<{ localDate: string }>(
            `SELECT "localDate" FROM "DailyRecord" WHERE "homeProfileId" = $1`,
            [home.id],
          )
        ).rows.map((row) => row.localDate),
      );
      totalExisting += existing.size;

      // Dani koji imaju bar jedan izvor; ostalo se ni ne razmatra.
      const days = new Set<string>();
      for (const item of [
        ...events.map((event) => event.timestampStart),
        ...boilerRows.map((row) => row.createdAt),
        ...gasReadings.map((row) => row.readingDate),
        ...recommendations.map((row) => row.date),
      ]) {
        days.add(localDateKey(item, zone));
      }

      const rows: BackfillRow[] = [];
      for (const localDate of [...days].sort()) {
        if (existing.has(localDate)) continue;
        const row = reconstructDay({
          localDate,
          zone,
          events,
          boilerRows,
          gasReadings,
          recommendation:
            recommendations.find(
              (candidate) => localDateKey(candidate.date, zone) === localDate,
            ) ?? null,
        });
        if (row) rows.push(row);
      }

      const summary = summarise(rows);
      console.log(
        `- kuća #${home.id} (${zone}): ` +
          `${summary.days} dana za upis · ciklusi ${summary.withEvents} · plin ${summary.withGas} · ` +
          `stepen-dan ${summary.withDegreeDays} · predlog ${summary.withProposal} · ` +
          `postojećih dana ${existing.size}`,
      );

      const limited = args.limit ? rows.slice(0, args.limit) : rows;
      for (const row of limited) {
        collected.push({ userId, homeProfileId: home.id, row });
      }
      totalRows += limited.length;
    }

    console.log('');
    console.log(
      `Ukupno: **${totalRows}** redova za upis, ${totalExisting} dana već postoji` +
        (totalDefaultZone > 0 ? `, ${totalDefaultZone} kuća sa zadanom zonom` : ''),
    );

    if (collected.length > 0) {
      const sample = collected.slice(0, 5);
      console.log('');
      console.log('Prvih nekoliko redova (provjera prije upisa):');
      for (const item of sample) {
        console.log(
          `- ${item.row.localDate}: predlog ${item.row.proposedFlowTemp ?? '—'} °C, ` +
            `ciklusa ${item.row.cycles ?? '—'}, duty ${item.row.dutyPercent ?? '—'} %, ` +
            `plin ${item.row.gasM3 ?? '—'} m³, stepen-dan ${item.row.degreeDays ?? '—'} ` +
            `(izvori: ${item.row.sources.join(', ')})`,
        );
      }
    }

    notice(
      `backfill ${args.apply ? 'upis' : 'dry-run'}: ${totalRows} redova, ` +
        `postojećih ${totalExisting} dana`,
    );

    if (!args.apply) {
      console.log('');
      console.log(
        'Dry-run: ništa nije upisano. Upis traži `--apply` i kredencijal ' +
          '`DATABASE_URL_BACKFILL` koji smije pisati.',
      );
      return;
    }

    if (collected.length === 0) {
      console.log('Nema šta upisati.');
      return;
    }

    // Upis u jednoj transakciji: djelimičan backfill je stanje koje niko nije
    // opisao, pa se ili upiše sve ili ništa.
    await client.query('BEGIN');
    try {
      for (const item of collected) {
        await client.query(
          `INSERT INTO "DailyRecord" (
             "userId", "homeProfileId", "localDate", "proposedFlowTemp", "proposedAt",
             "cycles", "medianCycleMin", "dutyPercent", "overshootC", "undershootC",
             "flowSetC", "flowSetSince", "flowSetSource",
             "gasM3", "degreeDays", "modelVersion", "outcomeAt", "outcomeVersion",
             "updatedAt"
           ) VALUES (
             $1, $2, $3, $4, $5,
             $6, $7, $8, $9, $10,
             $11, $12, $13,
             $14, $15, $16, now(), $17,
             now()
           )
           ON CONFLICT ("homeProfileId", "localDate") DO NOTHING`,
          [
            item.userId,
            item.homeProfileId,
            item.row.localDate,
            item.row.proposedFlowTemp,
            item.row.proposedAt,
            item.row.cycles,
            item.row.medianCycleMin,
            item.row.dutyPercent,
            item.row.overshootC,
            item.row.undershootC,
            item.row.flowSetC,
            item.row.flowSetSince,
            item.row.flowSetSource,
            item.row.gasM3,
            item.row.degreeDays,
            item.row.version,
            item.row.version,
          ],
        );
      }
      await client.query('COMMIT');
      console.log(`Upisano ${collected.length} redova (${BACKFILL_VERSION}).`);
      notice(`backfill upisan: ${collected.length} redova`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Backfill nije prošao:', error.message);
  process.exit(1);
});
