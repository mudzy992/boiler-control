import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import {
  computeDayOutcome,
  cyclesFromEvents,
  type CycleEvent,
  type OutcomeSample,
} from './day-outcome';
import { localDateKey, resolveHomeTimeZone } from './proposal-schedule';
import {
  completionFields,
  reconstructDay,
  type BackfillBoilerRow,
  type BackfillGasReading,
} from './backfill-reconstruction';
import {
  nightFloorFrom,
  type NightEvidence,
  type NightFloorResult,
} from './flow-bounds';

/**
 * Mjerni podaci dana — drugi pisac `DailyRecord`, i to namjerno **drugi**.
 *
 * Predlog (`DailyRecordWriter`, `20`) je zamrznut u 06:00 i nikad se ne
 * prepisuje. Ishodi se, po prirodi stvari, znaju tek poslije ponoći. Zato ovaj
 * servis dira **isključivo mjerna polja** — nikad `proposedFlowTemp`,
 * `proposedAt`, `flowSetC` ni `flowSetSource`. Ishod serije se upisuje uz
 * `outcomeAt IS NULL`; plin i stepen-dan se dopunjuju odvojeno i samo dok je
 * njihovo vlastito polje `NULL`.
 */

export const OUTCOME_VERSION = 'outcome-1';

/**
 * Verzija zapisa popunjenog **samo iz `HeatingEvent`** redova (`F13`).
 *
 * Razlikuje se od `outcome-1` namjerno: iz nje se vidi da mjerni podaci dana
 * (podbačaj, histereza, brzina dogrijavanja) nijesu mjereni, a da su ciklusi
 * jesu. Bez te razlike bi poslije bilo nemoguće reći zašto red ima cikluse a
 * nema ništa drugo.
 */
export const OUTCOME_VERSION_EVENTS = 'outcome-events-1';

/**
 * Koliko dana nazad se popunjava. Sedam je dovoljno da se pokrije dan-dva
 * zastoja bez ponovnog računanja cijele sezone.
 *
 * Namjerno **nije** neograničeno: dan stariji od ovoga se ne popunjava sam, i
 * `outcomeAt` mu ostaje `null`. To je granica koja se priznaje, a ne skriva —
 * serija za tako star dan se više ne čita, pa se ne bi ni mogla izmjeriti.
 */
export const OUTCOME_LOOKBACK_DAYS = 7;

/**
 * Gas i stepen-dan dolaze iz odvojenih izvora koji mogu stići poslije prvog
 * upisa dnevnog reda. Svaki noćni prolaz ponovo provjerava zadnjih 30 dana;
 * upisuje samo polja koja su još NULL.
 */
export const SOURCE_METRICS_LOOKBACK_DAYS = 30;

/**
 * Prozor za dokaze o noći. 30 dana: dovoljno noći u sličnom režimu, a kratko
 * da se ne miješa zima sa prijelaznim periodom.
 */
export const NIGHT_EVIDENCE_DAYS = 30;

export interface FillResult {
  homeProfileId: number;
  filled: number;
  skipped: number;
  reasons: string[];
}

@Injectable()
export class DailyOutcomeService {
  private readonly logger = new Logger(DailyOutcomeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Noćni prolaz u 03:20 UTC — poslije fita modela (03:00) i poslije ponoći za
   * sve zone u kojima se koristi. Obračunavaju se **završeni** lokalni dani.
   */
  @Cron('20 3 * * *', {
    name: 'daily-outcome',
    disabled:
      process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test',
  })
  async fillAll(now: Date = new Date()): Promise<void> {
    const homes = await this.prisma.homeProfile.findMany({
      where: { user: { isActive: true } },
      select: { id: true },
    });

    for (const home of homes) {
      try {
        await this.fillHome(home.id, now);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Ishod dana za kuću ${home.id} nije izračunat: ${message}`,
        );
      }
    }
  }

  async fillHome(
    homeProfileId: number,
    now: Date = new Date(),
  ): Promise<FillResult> {
    const home = await this.prisma.homeProfile.findUnique({
      where: { id: homeProfileId },
      select: {
        id: true,
        userId: true,
        weatherTimezone: true,
        user: { select: { timezone: true } },
      },
    });
    if (!home) throw new Error(`HomeProfile ${homeProfileId} ne postoji`);

    const zone = resolveHomeTimeZone({
      homeTimeZone: home.weatherTimezone,
      userTimeZone: home.user.timezone,
    });
    const todayLocal = localDateKey(now, zone.zone);
    try {
      await this.completeSourceMetrics(
        homeProfileId,
        home.userId,
        zone.zone,
        now,
        todayLocal,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Plin/stepen-dan za kuću ${homeProfileId} nije dopunjen: ${message}`,
      );
    }
    const oldestLocal = localDateKey(
      new Date(now.getTime() - OUTCOME_LOOKBACK_DAYS * 24 * 60 * 60 * 1000),
      zone.zone,
    );

    const pending = await this.prisma.dailyRecord.findMany({
      where: {
        homeProfileId,
        outcomeAt: null,
        localDate: { gte: oldestLocal, lt: todayLocal },
      },
      select: { localDate: true },
      orderBy: { localDate: 'asc' },
    });

    if (pending.length === 0) {
      return { homeProfileId, filled: 0, skipped: 0, reasons: [] };
    }

    // Noć pripada danu koji se završava u 06:00, pa se čita i jedan dan ranije.
    const from = new Date(
      now.getTime() - (OUTCOME_LOOKBACK_DAYS + 1) * 24 * 60 * 60 * 1000,
    );
    const observations = await this.prisma.thermostatObservation.findMany({
      where: { homeProfileId, at: { gte: from } },
      orderBy: { at: 'asc' },
      select: {
        at: true,
        roomTempC: true,
        targetTempC: true,
        isHeating: true,
        outdoorTempC: true,
        flowSetC: true,
      },
    });

    const samples: OutcomeSample[] = observations.map((row) => ({
      at: row.at,
      roomTempC: row.roomTempC,
      targetTempC: row.targetTempC,
      isHeating: row.isHeating,
      outdoorTempC: row.outdoorTempC,
      flowSetC: row.flowSetC,
    }));

    const reasons: string[] = [];
    let filled = 0;
    let skipped = 0;

    /*
     * F13: ciklusi postoje i kao `HeatingEvent` — upisuje ih isti polling koji
     * puni seriju. Za dane u kojima serija nije potpuna obračun je dosad
     * odustajao (`INCOMPLETE`), pa je tabela historije prikazivala crtice za
     * dane za koje korisnik zna da je kotao palio 3–4 puta. Događaji su zato
     * rezerva, ne zamjena: prednost i dalje ima serija.
     */
    const eventFrom = new Date(
      now.getTime() - (OUTCOME_LOOKBACK_DAYS + 1) * 24 * 60 * 60 * 1000,
    );
    const heatingEvents = await this.prisma.heatingEvent.findMany({
      where: {
        thermostat: { homeProfileId },
        timestampStart: { gte: eventFrom },
      },
      select: { timestampStart: true, timestampEnd: true },
      orderBy: { timestampStart: 'asc' },
    });
    const cycleEvents: CycleEvent[] = heatingEvents.map((row) => ({
      startedAt: row.timestampStart,
      endedAt: row.timestampEnd,
    }));

    for (const record of pending) {
      const result = computeDayOutcome(record.localDate, samples, zone.zone);
      if (!result.ok) {
        // Serija nije dovoljna za cijeli dan, ali ciklusi su mjereni događajima.
        // Upisuje se samo ono što je stvarno izmjereno — ostala mjerna polja
        // ostaju `null` i dalje se prikazuju kao crtice, a ne kao nula.
        const fromEvents = cyclesFromEvents(
          record.localDate,
          cycleEvents,
          zone.zone,
        );
        if (fromEvents.cycles > 0) {
          const written = await this.prisma.dailyRecord.updateMany({
            where: {
              homeProfileId,
              localDate: record.localDate,
              outcomeAt: null,
            },
            data: {
              cycles: fromEvents.cycles,
              medianCycleMin: fromEvents.medianCycleMin,
              outcomeAt: now,
              outcomeVersion: OUTCOME_VERSION_EVENTS,
            },
          });
          if (written.count > 0) {
            filled += 1;
          } else {
            skipped += 1;
            reasons.push(`${record.localDate}:ALREADY_WRITTEN`);
          }
        } else {
          skipped += 1;
          reasons.push(`${record.localDate}:${result.reason}`);
        }
        continue;
      }

      const outcome = result.outcome;

      // `outcomeAt: null` u uslovu nije ukras: dva procesa ne smiju oba upisati.
      const written = await this.prisma.dailyRecord.updateMany({
        where: { homeProfileId, localDate: record.localDate, outcomeAt: null },
        data: {
          cycles: outcome.cycles,
          medianCycleMin: outcome.medianCycleMin,
          dutyPercent: outcome.dutyPercent,
          overshootC: outcome.overshootC,
          undershootC: outcome.undershootC,
          comfortOk: outcome.comfortOk,
          nightUndershootC: outcome.nightUndershootC,
          nightMinOutdoorMeasuredC: outcome.nightMinOutdoorC,
          nightFlowC: outcome.nightFlowC,
          hysteresisK: outcome.hysteresisK,
          // Brzina dogrijavanja (`29`): bez nje nema tvrdog `T_max`.
          heatRateCPerHour: outcome.heatRateCPerHour,
          heatRateFlowC: outcome.heatRateFlowC,
          heatRateRoomC: outcome.heatRateRoomC,
          hysteresisAsymmetryK: outcome.hysteresisAsymmetryK,
          outcomeAt: now,
          outcomeVersion: OUTCOME_VERSION,
        },
      });

      if (written.count > 0) {
        filled += 1;
      } else {
        // Neko drugi je upisao između čitanja i pisanja — to nije greška, ali se
        // ne smije prijaviti kao „obračunato".
        skipped += 1;
        reasons.push(`${record.localDate}:ALREADY_WRITTEN`);
      }
    }

    if (filled > 0 || skipped > 0) {
      this.logger.log(
        `Ishod dana za kuću ${homeProfileId}: ${filled} obračunato, ` +
          `${skipped} preskočeno${reasons.length ? ` (${reasons.join(', ')})` : ''}.`,
      );
    }

    return { homeProfileId, filled, skipped, reasons };
  }

  /**
   * Dopuni plin i stepen-dan na postojećim redovima iz njihovih izvornih
   * tabela. Ta dva podatka često nastaju nakon jutarnjeg `DailyRecord` upisa,
   * zato ih ne smije zavisiti od backfill-a koji se pokrene samo ručno.
   *
   * `completionFields` dijeli istu rekonstrukciju sa backfill CLI-jem; svaki
   * `UPDATE` dodatno uslovljava baš svoje polje sa `IS NULL`, da ne prepiše
   * vrijednost koja je stigla nakon čitanja.
   */
  private async completeSourceMetrics(
    homeProfileId: number,
    userId: number,
    timeZone: string,
    now: Date,
    todayLocal: string,
  ): Promise<void> {
    const oldestLocal = localDateKey(
      new Date(
        now.getTime() - SOURCE_METRICS_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
      ),
      timeZone,
    );
    const records = await this.prisma.dailyRecord.findMany({
      where: {
        homeProfileId,
        localDate: { gte: oldestLocal, lt: todayLocal },
        OR: [{ gasM3: null }, { degreeDays: null }],
      },
      select: { localDate: true, gasM3: true, degreeDays: true },
      orderBy: { localDate: 'asc' },
    });
    if (records.length === 0) return;

    // Two-day buffer covers UTC/local-day boundaries for every supported zone.
    const sourceFrom = new Date(
      now.getTime() - (SOURCE_METRICS_LOOKBACK_DAYS + 2) * 24 * 60 * 60 * 1000,
    );
    const [boilerRows, gasReadings] = await Promise.all([
      this.prisma.boilerHistory.findMany({
        where: { userId, createdAt: { gte: sourceFrom, lt: now } },
        select: {
          createdAt: true,
          externalTemp: true,
          suggestedFlowTemp: true,
          actualFlowTemp: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.gasReading.findMany({
        where: { userId, readingDate: { gte: sourceFrom, lt: now } },
        select: { readingDate: true, consumption: true },
        orderBy: { readingDate: 'asc' },
      }),
    ]);

    const boilerByDay = new Map<string, BackfillBoilerRow[]>();
    for (const row of boilerRows) {
      const localDate = localDateKey(row.createdAt, timeZone);
      const bucket = boilerByDay.get(localDate) ?? [];
      bucket.push(row);
      boilerByDay.set(localDate, bucket);
    }
    const gasByDay = new Map<string, BackfillGasReading[]>();
    for (const row of gasReadings) {
      const localDate = localDateKey(row.readingDate, timeZone);
      const bucket = gasByDay.get(localDate) ?? [];
      bucket.push(row);
      gasByDay.set(localDate, bucket);
    }

    let gasUpdated = 0;
    let degreeDaysUpdated = 0;
    for (const record of records) {
      const reconstructed = reconstructDay({
        localDate: record.localDate,
        zone: timeZone,
        events: [],
        boilerRows: boilerByDay.get(record.localDate) ?? [],
        gasReadings: gasByDay.get(record.localDate) ?? [],
        recommendation: null,
      });
      if (!reconstructed) continue;

      const patch = completionFields(
        { gasM3: record.gasM3, degreeDays: record.degreeDays },
        reconstructed,
      );
      if (patch.gasM3 != null) {
        const result = await this.prisma.dailyRecord.updateMany({
          where: { homeProfileId, localDate: record.localDate, gasM3: null },
          data: { gasM3: patch.gasM3 },
        });
        gasUpdated += result.count;
      }
      if (patch.degreeDays != null) {
        const result = await this.prisma.dailyRecord.updateMany({
          where: {
            homeProfileId,
            localDate: record.localDate,
            degreeDays: null,
          },
          data: { degreeDays: patch.degreeDays },
        });
        degreeDaysUpdated += result.count;
      }
    }

    if (gasUpdated > 0 || degreeDaysUpdated > 0) {
      this.logger.log(
        `Izvori za kuću ${homeProfileId}: dopunjen plin ${gasUpdated}, ` +
          `stepen-dan ${degreeDaysUpdated} redova.`,
      );
    }
  }

  /**
   * Najmanja polazna koja pokriva noć, izmjerena iz historije (`23` §3).
   *
   * Vraća `floorC: null` kad nema poredljivih noći — i to je odgovor, ne
   * greška: bez dokaza se ne tvrdi granica.
   */
  async nightFloorFor(
    homeProfileId: number,
    forecastNightMinC: number | null,
    now: Date = new Date(),
  ): Promise<NightFloorResult> {
    if (forecastNightMinC == null) {
      return {
        floorC: null,
        basis: 'NO_FORECAST',
        worstFailingFlowC: null,
        comparableNights: 0,
      };
    }

    const home = await this.prisma.homeProfile.findUnique({
      where: { id: homeProfileId },
      select: {
        id: true,
        weatherTimezone: true,
        user: { select: { timezone: true } },
      },
    });
    if (!home) throw new Error(`HomeProfile ${homeProfileId} ne postoji`);

    const zone = resolveHomeTimeZone({
      homeTimeZone: home.weatherTimezone,
      userTimeZone: home.user.timezone,
    });
    const from = localDateKey(
      new Date(now.getTime() - NIGHT_EVIDENCE_DAYS * 24 * 60 * 60 * 1000),
      zone.zone,
    );

    const records = await this.prisma.dailyRecord.findMany({
      where: {
        homeProfileId,
        // Noć bez sve tri stavke nije dokaz: bez polazne se ne zna šta je
        // podbacilo, a bez manjka se ne zna da je podbacilo.
        nightFlowC: { not: null },
        nightMinOutdoorMeasuredC: { not: null },
        nightUndershootC: { not: null },
        localDate: { gte: from },
      },
      select: {
        nightFlowC: true,
        nightMinOutdoorMeasuredC: true,
        nightUndershootC: true,
      },
    });

    const evidence: NightEvidence[] = records.map((record) => ({
      flowC: record.nightFlowC as number,
      nightMinOutdoorC: record.nightMinOutdoorMeasuredC as number,
      nightUndershootC: record.nightUndershootC,
    }));

    return nightFloorFrom({ evidence, forecastNightMinC });
  }
}
