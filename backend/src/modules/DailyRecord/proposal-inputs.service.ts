import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DailyOutcomeService } from './daily-outcome.service';
import { DEFAULT_TARGET_ROOM_C, DAY_GAIN_IN_PROPOSAL } from './flow-constants';
import type { OutcomeSignals } from './proposal-controller';
import type { NightFloorBasis } from './flow-bounds';
import { shortCycleFloorFrom } from './proposal-controller';
import { effectiveShortCycleFloor } from './short-cycle-floor';
import { heatTimeFloorFor } from './proposal-decision';

/**
 * F4.2 — **prikupljanje ulaza za odluku predloga**, na jednom mjestu.
 *
 * Dosad je ovih ~238 redova stajalo unutar `ProposalShadowService.evaluate()`,
 * pomiješano sa upisom shadow kolona. Zbog toga `DailyRecordWriter` nije mogao
 * koristiti isto pravilo: writer radi **prije** shadow odluke, a `evaluate()`
 * čita `DailyRecord` — red koji writer tek treba da napiše.
 *
 * Rješenje nije da writer zove shadow servis (to bi bila ciklična zavisnost i
 * odluka o nepostojećem redu), nego da se **prikupljanje** izdvoji i da dvije
 * vrijednosti koje se razlikuju — `nightMinC` i `dayMaxC` — postanu **ulaz**:
 * shadow ih čita iz zapisa, writer iz prognoze koju upravo upisuje.
 *
 * **Servis ne piše ništa** osim dvije korekcije `HomeModel`-a које je i dosad
 * pisao (`shortCycleFloorC` i njegovo brisanje po isteku). To nije odluka o
 * predlogu, nego pamćenje dokaza — i mora ostati vezano za čitanje, inače bi
 * se granica učila dvaput.
 */

/** Šta sve odluka traži, a dolazi iz baze. */
export interface GatheredProposalInputs {
  targetRoomC: number;
  previousFlowC: number | null;
  daysSinceChange: number | null;
  outcome: OutcomeSignals | null;
  shortCycleFloorC: number | null;
  recentOvershootC: Array<number | null>;
  exploredYesterday: boolean;
  heatTimeFloorC: number | null;
  model: {
    state: string;
    slopeS: number | null;
    slopeCiHigh: number | null;
    days: number | null;
    internalGainC: number | null;
    uDayC: number | null;
    shortCycleFloorC: number | null;
    shortCycleFloorAt: Date | null;
  } | null;
  maxFlowC: number | null;
  boilerCatalogId: string | null;
  /** Izmjereni `u_day` — ide u log čak i kad ne ulazi u predlog. */
  uDayMeasuredC: number | null;
  /** Noćna granica iz ishoda (F1). Traži `nightMinC`, pa je i ona ulaz. */
  nightFloor: { floorC: number | null; basis: NightFloorBasis };
  /** Mjesta gdje je granica iz kratkih ciklusa promijenjena (za log). */
  shortCycleFloorEvent: 'LEARNED' | 'EXPIRED' | null;
  expiredAfterDays: number | null;
}

@Injectable()
export class ProposalInputsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outcomes: DailyOutcomeService,
  ) {}

  /**
   * @param nightMinC prognoza noći — shadow je čita iz zapisa, writer iz prognoze
   * @param dayMaxC   prognoza dana — isto
   */
  async gather(params: {
    homeProfileId: number;
    localDate: string;
    now: Date;
    nightMinC: number | null;
    dayMaxC: number | null;
    /**
     * Da li se `T_max` pod računa. Writer ga **ne** računa: sobna temperatura
     * koja mu treba je iz uzorka koji shadow čita uz `at <= now`; u trenutku
     * pisanja predloga taj uzorak postoji, ali njegovo tumačenje pripada
     * odluci, ne pisanju. Isključeno ⇒ `null`, a ne izmišljen pod.
     */
    withHeatTimeFloor?: boolean;
  }): Promise<GatheredProposalInputs> {
    const { homeProfileId, localDate, now, nightMinC } = params;

    const [home, model, previous, recentOutcomes, lastOutcome, latestRoom] =
      await Promise.all([
        this.prisma.homeProfile.findUnique({
          where: { id: homeProfileId },
          select: {
            targetMorningTemp: true,
            targetDayTemp: true,
            maxHeatingFlowC: true,
            boilerCatalogId: true,
          },
        }),
        this.prisma.homeModel.findUnique({
          where: { homeProfileId },
          select: {
            state: true,
            slopeS: true,
            slopeCiHigh: true,
            days: true,
            internalGainC: true,
            shortCycleFloorC: true,
            shortCycleFloorAt: true,
            uDayC: true,
          },
        }),
        this.prisma.dailyRecord.findFirst({
          where: {
            homeProfileId,
            localDate: { lt: localDate },
            proposedFlowTemp: { not: null },
          },
          orderBy: { localDate: 'desc' },
          select: {
            localDate: true,
            proposedFlowTemp: true,
            shadowExplorationDirection: true,
          },
        }),

        this.prisma.dailyRecord.findMany({
          where: {
            homeProfileId,
            localDate: { lt: localDate },
            outcomeAt: { not: null },
          },
          orderBy: { localDate: 'desc' },
          take: 5,
          select: { localDate: true, overshootC: true },
        }),
        this.prisma.dailyRecord.findFirst({
          where: {
            homeProfileId,
            localDate: { lt: localDate },
            outcomeAt: { not: null },
          },
          orderBy: { localDate: 'desc' },
          select: {
            localDate: true,
            undershootC: true,
            overshootC: true,
            nightUndershootC: true,
            medianCycleMin: true,
            heatRateCPerHour: true,
            heatRateFlowC: true,
            heatRateRoomC: true,
          },
        }),
        this.prisma.thermostatObservation.findFirst({
          where: { homeProfileId, at: { lte: now } },
          orderBy: { at: 'desc' },
          select: { at: true, roomTempC: true },
        }),
      ]);

    const targetRoomC =
      home?.targetMorningTemp ?? home?.targetDayTemp ?? DEFAULT_TARGET_ROOM_C;
    const previousFlowC = previous?.proposedFlowTemp ?? null;

    // Kratki ciklusi se mjere na danu čija je polazna bila prošli predlog —
    // ako ishod tog dana još nije obračunat, ne izmišlja se.
    const measuredOnProposal =
      previous != null &&
      lastOutcome != null &&
      lastOutcome.localDate === previous.localDate &&
      previousFlowC != null;
    const learnedFloor = measuredOnProposal
      ? shortCycleFloorFrom({
          flowC: previousFlowC,
          medianCycleMin: lastOutcome.medianCycleMin,
        })
      : null;

    // Granica se pamti, ali ne zauvijek: dokaz stariji od 30 dana prestaje da
    // bude dokaz (`24` §7). Istekla granica se i briše iz modela — inače bi
    // stajala kao podatak koji više ništa ne znači.
    const stored = effectiveShortCycleFloor(
      {
        floorC: model?.shortCycleFloorC ?? null,
        at: model?.shortCycleFloorAt ?? null,
      },
      now,
    );
    const storedFloor = stored.floorC;
    const shortCycleFloorC =
      learnedFloor == null
        ? storedFloor
        : storedFloor == null
          ? learnedFloor
          : Math.max(storedFloor, learnedFloor);

    let shortCycleFloorEvent: 'LEARNED' | 'EXPIRED' | null = null;
    if (
      learnedFloor != null &&
      (storedFloor == null || learnedFloor > storedFloor)
    ) {
      await this.prisma.homeModel.update({
        where: { homeProfileId },
        data: { shortCycleFloorC: learnedFloor, shortCycleFloorAt: now },
      });
      shortCycleFloorEvent = 'LEARNED';
    } else if (stored.age === 'EXPIRED') {
      await this.prisma.homeModel.update({
        where: { homeProfileId },
        data: { shortCycleFloorC: null, shortCycleFloorAt: null },
      });
      shortCycleFloorEvent = 'EXPIRED';
    }

    const heatTimeFloorC =
      params.withHeatTimeFloor === false
        ? null
        : heatTimeFloorFor({
            roomC: latestRoom?.roomTempC ?? null,
            targetRoomC: targetRoomC,
            heatRateCPerHour: lastOutcome?.heatRateCPerHour ?? null,
            measuredFlowC: lastOutcome?.heatRateFlowC ?? null,
            measuredRoomC: lastOutcome?.heatRateRoomC ?? null,
          });

    // Bez prognoze noći nema ravnotežne polazne, pa kontroler ne može donijeti
    // odluku — zabilježiće se kao `NO_MODEL` i „drži prošlu", što je i tačno:
    // nema se šta mijenjati bez osnova.
    const nightFloor =
      nightMinC == null
        ? { floorC: null, basis: 'NO_FORECAST' as NightFloorBasis }
        : await this.outcomes.nightFloorFor(homeProfileId, nightMinC, now);

    return {
      targetRoomC,
      previousFlowC,
      nightFloor,
      daysSinceChange: await this.daysSinceChange(
        homeProfileId,
        previous?.localDate ?? null,
        previousFlowC,
      ),
      outcome: this.outcomeSignals(lastOutcome),
      shortCycleFloorC,
      recentOvershootC: recentOutcomes.map((row) => row.overshootC),
      exploredYesterday: previous?.shadowExplorationDirection === 'LOWER',
      heatTimeFloorC,
      model,
      maxFlowC: home?.maxHeatingFlowC ?? null,
      boilerCatalogId: home?.boilerCatalogId ?? null,
      uDayMeasuredC: model?.uDayC ?? null,
      shortCycleFloorEvent,
      expiredAfterDays:
        shortCycleFloorEvent === 'EXPIRED' ? (stored.ageDays ?? null) : null,
    };
  }

  /** Da li `u_day` ulazi u predlog — odluka vlasnika, prosljeđuje se dalje. */
  get dayGainInProposal(): boolean {
    return DAY_GAIN_IN_PROPOSAL;
  }

  /**
   * Koliko dana je prošla polazna nepromijenjena. `null` kad se ne zna —
   * `null` ne blokira (dwell je zaštita od oscilacije, ne od prve odluke).
   */
  private async daysSinceChange(
    homeProfileId: number,
    previousLocalDate: string | null,
    previousFlowC: number | null,
  ): Promise<number | null> {
    if (previousLocalDate == null || previousFlowC == null) return null;

    const changed = await this.prisma.dailyRecord.findFirst({
      where: {
        homeProfileId,
        localDate: { lt: previousLocalDate },
        proposedFlowTemp: { not: previousFlowC },
      },
      orderBy: { localDate: 'desc' },
      select: { localDate: true },
    });
    if (!changed) return null;

    const days =
      (Date.parse(previousLocalDate) - Date.parse(changed.localDate)) /
      86_400_000;
    return Number.isFinite(days) ? days : null;
  }

  private outcomeSignals(
    row: {
      undershootC: number | null;
      overshootC: number | null;
      nightUndershootC: number | null;
      medianCycleMin: number | null;
    } | null,
  ): OutcomeSignals | null {
    if (!row) return null;
    return {
      undershootC: row.undershootC ?? 0,
      overshootC: row.overshootC ?? 0,
      nightUndershootC: row.nightUndershootC,
      medianCycleMin: row.medianCycleMin,
    };
  }
}
