import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { addMinutes } from 'date-fns';
import {
  FlowTempInput,
  HeatingEventInput,
  HomeProfileInput,
  IntervalLearningInput,
} from '../Heating/engine/types';
import { WeatherService } from '../Weather/weather.service';
import { BoilerWeatherService } from '../Weather/boiler-weather.service';
import {
  intervalKeyCandidates,
  intervalKeyForDevice,
} from '../Heating/interval-key';
import { FlowTemperatureEngine } from '../Heating/engine/flow-temperature.engine';
import { MetricsService } from '../../common/metrics.service';
import { resolveFlowTempRange } from './flow-range';

export interface FlowTempCalculationResult {
  flowTemp: number;
  confidence: number;
  mode: 'ANONYMOUS' | 'PROFILE_ONLY' | 'FULL';
  expectedHeatTimeMin?: number;
  /**
   * Ključ intervala učenja. Može biti `undefined` kad se zona ne može odrediti —
   * bolje bez ključa nego sa ključem iz serverskog sata (F5.2).
   */
  intervalKey?: string;
}

export interface SetCurrentTempResult {
  userId: number;
  currentFlowTemp: number;
  setAt: Date;
  latestBoilerHistoryId: number | null;
  latestBoilerHistoryUpdated: boolean;
}

@Injectable()
export class BoilerService {
  private readonly logger = new Logger(BoilerService.name);
  private readonly DEFAULT_ANON_CITY = 'Visoko';
  /*
   * Granice su premještene u `./flow-range.ts` (`F13`).
   *
   * Razlog nije čišćenje koda nego dokazivost: pravilo „dom sužava, nikad ne
   * proširuje" je do sada bilo zaključano u servisu koji traži bazu, pa ga
   * nijedan test nije mogao provjeriti bez `PrismaService`. Sada je čista
   * funkcija, a servis je samo dovodi do nje.
   */

  constructor(
    private prisma: PrismaService,
    private weatherService: WeatherService,
    private metricsService: MetricsService,
    private readonly boilerWeather: BoilerWeatherService,
  ) {}

  /**
   * Calculate optimal boiler flow temperature based on
   * profile, interval learning, recent heating behavior and weather.
   *
   * ⚠️ Pure calculation only – NO persistence here.
   */
  async calculateFlowTemp(userId?: number): Promise<FlowTempCalculationResult> {
    /*
     * F5.2: ključ se računa u zoni kuće/korisnika (`Heating/interval-key.ts`), ne
     * serverskim satom. Zona se zna tek poslije `homeProfile` upita, pa se ključ
     * računa tamo — a do tada je `null` i koristi se samo u grani koja ga ima.
     */
    let intervalKey: string | null = null;

    let mode: FlowTempInput['mode'] = 'ANONYMOUS';

    // -----------------------------
    // 1️⃣ Weather (mandatory)
    // -----------------------------
    let tempMin = 0;
    let tempMax = 0;
    // The same first profile drives the existing calculation and opt-in v2 weather.
    const profile = userId
      ? await this.prisma.homeProfile.findFirst({ where: { userId } })
      : null;

    if (userId) {
      const v2Weather = profile
        ? await this.boilerWeather.getV2WeatherInput(userId, profile.id)
        : null;
      if (v2Weather) {
        tempMin = v2Weather.tempMin;
        tempMax = v2Weather.tempMax;
      } else {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
        });
        const weather = await this.weatherService.getTodayWeather(
          user?.homeLocation ?? this.DEFAULT_ANON_CITY,
        );
        tempMin = weather.temp_min!;
        tempMax = weather.temp_max!;
      }
    } else {
      const weather = await this.weatherService.getTodayWeather(
        this.DEFAULT_ANON_CITY,
      );
      tempMin = weather.temp_min!;
      tempMax = weather.temp_max!;
    }

    // -----------------------------
    // 2️⃣ Home profile (optional)
    // -----------------------------
    let homeProfileInput: HomeProfileInput = {
      floorArea: 150,
      learningOffset: 0,
      insulationFactor: 1,
      confidence: 0.1,
    };

    let homeProfileId: number | null = null;

    if (profile) {
      homeProfileId = profile.id;
      homeProfileInput = {
        floorArea: profile.floorArea,
        learningOffset: profile.learningOffset,
        insulationFactor: 1,
        confidence: profile.learningConfidence,
        // F13: motor poštuje granice doma, pa predlog nikad nije ispod onoga
        // što korisnik smije upisati (uzrok „predlaže 46, a unos traži 48").
        minFlowC: profile.minHeatingFlowC ?? null,
        maxFlowC: profile.maxHeatingFlowC ?? null,
      };
      mode = 'PROFILE_ONLY';

      // --- SEASONALITY CHECK ---
      const { seasonMode } = profile;
      if (seasonMode === 'SUMMER') {
        return this.createOffResult(intervalKey, mode);
      }
      if (seasonMode === 'AUTO') {
        // Simple auto logic: if average of min/max > 15°C -> SUMMER
        const avgTemp = (tempMin + tempMax) / 2;
        if (avgTemp > 16) {
          // 16°C cut-off
          return this.createOffResult(intervalKey, mode);
        }
      }
    }

    // -----------------------------
    // 3️⃣ Interval learning (optional)
    // -----------------------------
    let intervalLearningInput: IntervalLearningInput | undefined = undefined;
    let expectedHeatTimeMin: number | undefined = undefined;

    if (homeProfileId) {
      /*
       * Zona: kuća, pa korisnik, pa zadana (`zoneForDevice`). Ključ se traži
       * preko svih poznatih formata (`intervalKeyCandidates`) — stariji redovi su
       * upisani kao `1_afternoon`, a jedinstveni indeks ih ne spaja sam.
       */
      // Zona korisnika se čita samo ovdje (a ne uz vremensku prognozu): potrebna
      // je za ključ, i to samo kad dom postoji. Jedan upit više, ali bez njega bi
      // ključ pao na zadanu zonu i tiho promašio interval.
      const owner = await this.prisma.user.findUnique({
        where: { id: userId! },
        select: { timezone: true },
      });

      intervalKey = intervalKeyForDevice(
        {
          homeProfile: {
            weatherTimezone: profile?.weatherTimezone ?? null,
            user: { timezone: owner?.timezone ?? null },
          },
        },
        new Date(),
      );

      const candidates = intervalKey ? intervalKeyCandidates(intervalKey) : [];
      /*
       * Prioritet se bira u kodu, ne u `orderBy`.
       *
       * `orderBy: { intervalKey: 'desc' }` je izgledalo kao „noviji format ima
       * prednost", ali je poredilo **tekst**: `weekday_afternoon` > `1_afternoon`
       * je slučajno tačno za cifre, a netačno bi bilo za bilo koji drugi v2
       * prefiks. Redoslijed iz `intervalKeyCandidates` je već kanonski-prvi, pa
       * se po njemu i bira.
       */
      const intervalRows =
        intervalKey && candidates.length
          ? await this.prisma.heatingIntervalLearning.findMany({
              where: { homeProfileId, intervalKey: { in: candidates } },
            })
          : [];
      const intervalLearning =
        candidates
          .map((key) =>
            intervalRows.find(
              (row: { intervalKey: string }) => row.intervalKey === key,
            ),
          )
          .find(Boolean) ?? null;

      if (intervalLearning) {
        intervalLearningInput = {
          offset: intervalLearning.offset,
          confidence: intervalLearning.confidence,
          avgReachTimeMin: intervalLearning.avgReachTimeMin,
          avgOvershoot: intervalLearning.avgOvershoot,
        };
        expectedHeatTimeMin = intervalLearning.avgReachTimeMin ?? undefined;
        mode = 'FULL';
      }
    }

    // -----------------------------
    // 4️⃣ Recent heating behavior (last 7 days)
    // -----------------------------
    let recentEventsInput: HeatingEventInput[] | undefined = undefined;

    if (userId) {
      const recentEvents = await this.prisma.heatingEvent.findMany({
        where: {
          thermostat: { userId },
          timestampStart: {
            gte: addMinutes(new Date(), -7 * 24 * 60),
          },
        },
        orderBy: { timestampStart: 'desc' },
        take: 10,
      });

      if (recentEvents.length > 0) {
        recentEventsInput = recentEvents.map((e) => ({
          delta: e.roomTargetTemp - e.roomCurrentTemp,
          active: !e.timestampEnd,
        }));
      }
    }

    // -----------------------------
    // 5️⃣ Build engine input
    // -----------------------------
    const input: FlowTempInput = {
      mode,
      ...(intervalKey ? { intervalKey } : {}),
      homeProfile: homeProfileInput,
      intervalLearning: intervalLearningInput,
      recentEvents: recentEventsInput,
      weather: { tempMin, tempMax },
    };

    // -----------------------------
    // 6️⃣ Calculate
    // -----------------------------
    const result = FlowTemperatureEngine.calculate(input);

    this.logger.log(
      `[BoilerCalc] User=${userId ?? 'ANON'} | Mode=${mode} | Interval=${intervalKey} | FlowTemp=${result.finalTemp}`,
    );

    return {
      flowTemp: result.finalTemp,
      confidence: result.confidence,
      mode,
      expectedHeatTimeMin,
      ...(intervalKey ? { intervalKey } : {}),
    };
  }

  private createOffResult(
    intervalKey: string | null,
    mode: any,
  ): FlowTempCalculationResult {
    this.logger.log(`[BoilerCalc] Seasonality -> HEATING OFF`);
    return {
      flowTemp: 0,
      confidence: 1,
      mode,
      expectedHeatTimeMin: 0,
      ...(intervalKey ? { intervalKey } : {}),
    };
  }

  // -----------------------------
  // Interval key helper
  // -----------------------------
  /**
   * Fetch boiler history for a user
   */
  async getBoilerHistory(userId: number) {
    try {
      const history = await this.prisma.boilerHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      return history;
    } catch (error) {
      this.logger.error('Error fetching boiler history', error);
      return [];
    }
  }

  /**
   * Persist user-confirmed current boiler flow temperature and
   * sync it to the latest boiler history row (if one exists).
   */
  /**
   * Raspon u koji korisnik smije upisati polaznu (`F13`).
   *
   * Izvor je **dom**, ne konstanta: `minHeatingFlowC` je fizička granica tog
   * kotla/načina grijanja, a `maxHeatingFlowC` već postoji (`19` §2). Oba se
   * sijeku sa apsolutnim rasponom 30–55, pa neispravan zapis u bazi (npr.
   * 20 ili 70) ne može proširiti opseg — samo ga suziti.
   */
  async flowTempRange(userId: number) {
    const home = await this.prisma.homeProfile.findFirst({
      where: { userId },
      select: {
        minHeatingFlowC: true,
        maxHeatingFlowC: true,
        // Šesti krug: i model iz kataloga, jer granice nijesu konstante.
        boilerCatalogId: true,
      },
    });

    // Pravilo je u čistoj funkciji (`./flow-range.ts`) — v. komentar iznad.
    return resolveFlowTempRange(home);
  }

  async setCurrentTemp(
    userId: number,
    currentFlowTemp: number,
  ): Promise<SetCurrentTempResult> {
    const range = await this.flowTempRange(userId);
    if (currentFlowTemp < range.min || currentFlowTemp > range.max) {
      throw new Error(
        `Current flow temperature must be between ${range.min}°C and ${range.max}°C`,
      );
    }

    const setAt = new Date();

    const latestHistory = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          currentBoilerFlowTemp: currentFlowTemp,
          currentBoilerFlowTempSetAt: setAt,
        },
      });

      const latest = await tx.boilerHistory.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });

      if (latest) {
        await tx.boilerHistory.update({
          where: { id: latest.id },
          data: { actualFlowTemp: currentFlowTemp },
        });
      }

      return latest;
    });

    this.metricsService.incrementCounter('boiler_current_temp_updates_total');
    this.logger.log(
      `[BoilerCurrentTemp] User=${userId} Temp=${currentFlowTemp} SetAt=${setAt.toISOString()}`,
    );

    return {
      userId,
      currentFlowTemp,
      setAt,
      latestBoilerHistoryId: latestHistory?.id ?? null,
      latestBoilerHistoryUpdated: !!latestHistory,
    };
  }
}
