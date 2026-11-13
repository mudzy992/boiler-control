import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  intervalKeyCandidates,
  intervalKeyForDevice,
} from '../Heating/interval-key';
import { intervalConfidence } from './learning-confidence';
import { nextPercentile } from './overshoot-learning';
import { RecommendationWeatherService } from '../Weather/recommendation-weather.service';

export interface HeatingEventData {
  userId: number;
  deviceId: number;
  timestampStart: Date;
  timestampEnd?: Date;
  roomCurrentTemp: number;
  roomTargetTemp: number;
  boilerFlowTemp: number;
}

@Injectable()
export class HeatingRecommendationService {
  private readonly logger = new Logger(HeatingRecommendationService.name);

  constructor(
    private prisma: PrismaService,
    private readonly recommendationWeather: RecommendationWeatherService,
  ) {}

  /** Process heating event (start or end) */
  async processHeatingEvent(event: HeatingEventData) {
    // 1️⃣ Fetch last interval learning for this device's home profile
    const device = await this.prisma.thermostatDevice.findUnique({
      where: { id: event.deviceId },
      /*
       * `user.timezone` mora biti uz dom: `zoneForDevice` čita zonu kuće, pa
       * korisnika, pa fallback. Bez ovog uključivanja zona je uvijek padala na
       * `Europe/Sarajevo` i ključ je tiho promašivao interval — za korisnika u
       * drugoj zoni to je pogrešan dio dana, bez ijedne greške u logu.
       */
      include: {
        homeProfile: {
          include: {
            intervalLearnings: true,
            user: { select: { timezone: true } },
          },
        },
      },
    });
    if (!device || !device.homeProfile) return;

    /*
     * F5.2: ključ se računa u zoni kuće, ne u zoni servera, i dolazi iz jednog
     * modula (`Heating/interval-key.ts`). Ranije je ovdje bila sopstvena kopija
     * sa `new Date().getHours()` — ista logika, ali serverski sat.
     */
    const intervalKey =
      intervalKeyForDevice(device, event.timestampStart ?? new Date()) ??
      undefined;
    if (!intervalKey) {
      this.logger.warn(
        `Interval ključ nije određen za uređaj ${event.deviceId} (nema zone) — preskačem učenje.`,
      );
      return;
    }
    const intervalLearning = this.getOrCreateIntervalLearning(
      device.homeProfile,
      intervalKey,
    );

    // 2️⃣ Compute overshoot and reach time
    const overshoot =
      (event.roomCurrentTemp ?? 0) - (event.roomTargetTemp ?? 0);
    const reachTime =
      event.timestampEnd && event.timestampStart
        ? (event.timestampEnd.getTime() - event.timestampStart.getTime()) /
          60000
        : 0;

    // 3️⃣ Update interval learning if event ended
    if (event.timestampEnd) {
      const newSamples = (intervalLearning.samples ?? 0) + 1;

      const newAvgReach =
        ((intervalLearning.avgReachTimeMin ?? 0) *
          (intervalLearning.samples ?? 0) +
          reachTime) /
        newSamples;

      const newAvgOvershoot =
        ((intervalLearning.avgOvershoot ?? 0) *
          (intervalLearning.samples ?? 0) +
          overshoot) /
        newSamples;

      const newOffset =
        ((intervalLearning.offset ?? 0) * (intervalLearning.samples ?? 0) +
          overshoot) /
        newSamples;

      // F5.3: `confidence` se **računa iz dokaza**, a ne akumulira.
      //
      // Stara linija je bila pokretni prosjek sa fiksnim prirastom 0,1, čija je
      // fiksna tačka 0,1 — pa je poslije 320 uzoraka `confidence` bio 0,1000
      // iako ulazi u 35 % health score-a. Izmjereno, ne procijenjeno.
      //
      // Odstupanje uzoraka od modela mjeri se **istim brojem koji se već
      // akumulira**: `avgOvershoot` je prosječno premašivanje cilja u tom
      // dijelu dana, pa je njegova apsolutna vrijednost razumna mjera
      // neslaganja. Standardno odstupanje bi bilo tačnije, ali bi tražilo da
      // pamtimo svaki uzorak — a interval je jedan red u bazi.
      // F5.4: percentil premašivanja, iz istih uzoraka iz kojih nastaje prosjek.
      //
      // Zašto se ovdje vidi samo jedan novi uzorak: `HeatingIntervalLearning`
      // je **jedan red** po intervalu, pa istoriju uzoraka ne pamtimo. Zato se
      // percentil računa iz dva izvora koja se ne gube:
      //   - već zapisan `p90OvershootC` (prethodni percentil),
      //   - novi uzorak i `avgOvershoot` kao procjena repa prije nego se
      //     skupi `OVERSHOOT_MIN_SAMPLES`.
      // Dok uzoraka ima manje od praga, `estimateOvershootCorrection` vraća
      // `null` i percentil se **ne mijenja** — bolje ne tvrditi nego izmisliti
      // percentil iz dva broja.
      const p90OvershootC = nextPercentile({
        previousP90: intervalLearning.p90OvershootC,
        samples: newSamples,
        newSample: overshoot,
      });

      const residualStd = Math.abs(newAvgOvershoot);
      const { confidence: newConfidence, reason: confidenceReason } =
        intervalConfidence({ samples: newSamples, residualStd });

      await this.prisma.heatingIntervalLearning.updateMany({
        where: { id: intervalLearning.id },
        data: {
          avgReachTimeMin: newAvgReach,
          avgOvershoot: newAvgOvershoot,
          p90OvershootC,
          offset: newOffset,
          samples: newSamples,
          confidence: newConfidence,
          residualStd,
          lastUpdated: new Date(),
        },
      });

      this.logger.debug(
        `[HeatingRecommendation] Updated IntervalLearning ${intervalKey} | reachTime=${reachTime.toFixed(
          2,
        )} | overshoot=${overshoot.toFixed(2)} | ` +
          `confidence=${newConfidence.toFixed(3)} (residual ${residualStd.toFixed(2)} K` +
          `${confidenceReason === 'OK' ? '' : `, ${confidenceReason}`})`,
      );
    }

    /*
     * F4.6 — **ovaj servis više ne piše `Recommendation`.**
     *
     * Bio je drugi pisac istih redova: `DailyRecordWriter` upiše jutarnji
     * predlog u `DailyRecord` i `Recommendation` u istoj transakciji, a ovaj
     * servis je `Recommendation` **prepisivao krivinom** na svakom događaju
     * grijanja. Klijent čita `Recommendation`, pa je vidio krivu, a ne
     * predlog.
     *
     * Mjerenje prije izmjene (run `43282265347`, 60 dana): **15 od 54** dana
     * se razlikuje više od 0,5 K, najviše **3,74 K**. To nije kozmetika —
     * to je drugi broj na ekranu.
     *
     * Pravilo „jedan pisac po redu" je jedino održivo: dok dva mjesta pišu
     * isti red, posljednji pisac pobjeđuje, a to zavisi od redoslijeda događaja
     * koji niko ne kontroliše.
     *
     * **Šta ostaje ovdje:** `HeatingIntervalLearning` (naučeni offset,
     * pouzdanost, p90) — to je jedini vlasnik tog reda i ostaje. Učenje je
     * jedina stvar koju ovaj servis treba da radi; predlog nije.
     */
    this.logger.debug(
      `[HeatingRecommendation] User ${event.userId} | učenje intervala ` +
        `ažurirano; predlog piše DailyRecordWriter (F4.6).`,
    );
  }

  /** Helper: get or create interval learning */
  private getOrCreateIntervalLearning(homeProfile: any, intervalKey: string) {
    /*
     * Traže se i stariji formati (`1_afternoon`) — v. `intervalKeyCandidates`.
     * Bez toga bi prva izmjena formata izgledala kao „učenje je izgubljeno", jer
     * jedinstveni indeks `(homeProfileId, intervalKey)` ne spaja formate sam.
     */
    const candidates = intervalKeyCandidates(intervalKey);
    let learning = homeProfile.intervalLearnings?.find(
      (i: { intervalKey: string }) => candidates.includes(i.intervalKey),
    );
    if (!learning) {
      learning = {
        id: 0, // dummy, real create treba preko prisma ako želimo persist
        intervalKey,
        offset: 0,
        avgOvershoot: 0,
        avgReachTimeMin: 0,
        samples: 0,
        confidence: 0.1,
      };
      homeProfile.intervalLearnings.push(learning);
    }
    return learning;
  }

  /**
   * Fetch recommendations for a user
   */
  /**
   * Preporuke, straničeno (`33`).
   *
   * `total` se dobija istim `where` uslovom, jer klijent bez njega ne zna da
   * postoji strana 2 — a prije je servis tiho rezao na 100.
   */
  async getRecommendations(
    userId: number,
    page: {
      limit: number;
      offset: number;
      from?: Date;
      to?: Date;
    } = { limit: 50, offset: 0 },
  ): Promise<{ rows: any[]; total: number }> {
    try {
      // Filter raspona (`36`): `date` je dan na koji se preporuka odnosi.
      const where: any = { userId };
      if (page.from || page.to) {
        where.date = {
          ...(page.from ? { gte: page.from } : {}),
          ...(page.to ? { lte: page.to } : {}),
        };
      }
      const [rows, total] = await Promise.all([
        this.prisma.recommendation.findMany({
          where,
          orderBy: { date: 'desc' },
          take: page.limit,
          skip: page.offset,
        }),
        this.prisma.recommendation.count({ where }),
      ]);
      return { rows, total };
    } catch (error) {
      this.logger.error('Error fetching recommendations', error);
      return { rows: [], total: 0 };
    }
  }
}
