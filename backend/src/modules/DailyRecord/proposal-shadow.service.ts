import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DailyOutcomeService } from './daily-outcome.service';
import {
  decideProposal,
  shortCycleFloorFrom,
  type ControllerDecision,
  type ModelState,
  type OutcomeSignals,
} from './proposal-controller';

/**
 * Shadow odluka kontrolera (`17` §13 korak 6, `24` §0).
 *
 * Računa se u istom trenutku kad i predlog, ali **ne mijenja predlog**. Piše se
 * u `DailyRecord.shadow*`, da se poslije može uporediti ono što bi kontroler
 * tražio sa onim što je korisnik stvarno dobio. Bez tog perioda nema osnova da
 * se odluka pusti na bojler — a bez odluke na bojleru nema ni uštede.
 *
 * Servis ne piše `proposedFlowTemp`, `flowSetC` ni mjerna polja. Upis je
 * uslovljen sa `shadowAt IS NULL`, isto kao mjerni upis u `DailyOutcomeService`.
 */

export const SHADOW_VERSION = 'shadow-1';

/**
 * Cilj sobne temperature kad profil ne kaže ništa. Nije preporuka nego
 * nedostatak podatka: bez njega se ravnotežna polazna ne može izračunati, a
 * izmišljati je značilo bi predložiti broj bez osnova.
 */
export const DEFAULT_TARGET_ROOM_C = 21;

export type ShadowStatus = 'EVALUATED' | 'NO_RECORD' | 'ALREADY_DONE';

export interface ShadowResult {
  status: ShadowStatus;
  homeProfileId: number;
  localDate: string;
  decision?: ControllerDecision;
  /** Šta bi kontroler tražio, a šta formula — samo za log i kasniju analizu. */
  proposedFlowTemp?: number | null;
}

@Injectable()
export class ProposalShadowService {
  private readonly logger = new Logger(ProposalShadowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outcomes: DailyOutcomeService,
  ) {}

  async evaluate(
    homeProfileId: number,
    localDate: string,
    now: Date = new Date(),
  ): Promise<ShadowResult> {
    const record = await this.prisma.dailyRecord.findFirst({
      where: { homeProfileId, localDate },
      select: {
        id: true,
        proposedFlowTemp: true,
        nightMinC: true,
        shadowAt: true,
      },
    });

    if (!record) {
      return { status: 'NO_RECORD', homeProfileId, localDate };
    }
    if (record.shadowAt != null) {
      return {
        status: 'ALREADY_DONE',
        homeProfileId,
        localDate,
        proposedFlowTemp: record.proposedFlowTemp,
      };
    }

    const [home, model, previous, lastOutcome] = await Promise.all([
      this.prisma.homeProfile.findUnique({
        where: { id: homeProfileId },
        select: {
          targetMorningTemp: true,
          targetDayTemp: true,
          // Najviša polazna koju sistem dozvoljava (`19` §2). Bez nje ostaje
          // granica kotla — nikad viša od 55.
          maxHeatingFlowC: true,
        },
      }),
      this.prisma.homeModel.findUnique({
        where: { homeProfileId },
        select: {
          state: true,
          slopeCiHigh: true,
          shortCycleFloorC: true,
        },
      }),
      this.prisma.dailyRecord.findFirst({
        where: {
          homeProfileId,
          localDate: { lt: localDate },
          proposedFlowTemp: { not: null },
        },
        orderBy: { localDate: 'desc' },
        select: { localDate: true, proposedFlowTemp: true },
      }),
      this.prisma.dailyRecord.findFirst({
        where: { homeProfileId, localDate: { lt: localDate }, outcomeAt: { not: null } },
        orderBy: { localDate: 'desc' },
        select: {
          localDate: true,
          undershootC: true,
          overshootC: true,
          nightUndershootC: true,
          medianCycleMin: true,
        },
      }),
    ]);

    const target =
      home?.targetMorningTemp ?? home?.targetDayTemp ?? DEFAULT_TARGET_ROOM_C;
    const nightMinC = record.nightMinC;

    // Bez prognoze noći nema ravnotežne polazne, pa kontroler ne može donijeti
    // odluku — zabilježiće se kao `NO_MODEL` i „drži prošlu", što je i tačno:
    // nema se šta mijenjati bez osnova.
    const night =
      nightMinC == null
        ? { floorC: null, basis: 'NO_FORECAST' as const }
        : await this.outcomes.nightFloorFor(homeProfileId, nightMinC, now);

    const modelFlowC =
      nightMinC != null && model?.slopeCiHigh != null
        ? target + model.slopeCiHigh * (target - nightMinC)
        : null;

    const outcome = this.outcomeSignals(lastOutcome);
    const previousFlowC =
      previous?.proposedFlowTemp == null ? null : previous.proposedFlowTemp;

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
    const storedFloor = model?.shortCycleFloorC ?? null;
    const shortCycleFloorC =
      learnedFloor == null
        ? storedFloor
        : storedFloor == null
          ? learnedFloor
          : Math.max(storedFloor, learnedFloor);

    if (learnedFloor != null && (storedFloor == null || learnedFloor > storedFloor)) {
      await this.prisma.homeModel.update({
        where: { homeProfileId },
        data: { shortCycleFloorC: learnedFloor, shortCycleFloorAt: now },
      });
    }

    const decision = decideProposal({
      modelFlowC,
      previousFlowC,
      daysSinceChange: await this.daysSinceChange(
        homeProfileId,
        previous?.localDate ?? null,
        previousFlowC,
      ),
      outcome,
      night: { floorC: night.floorC, basis: night.basis },
      shortCycleFloorC,
      maxFlowC: home?.maxHeatingFlowC ?? null,
      modelState: (model?.state ?? 'COLD_START') as ModelState,
    });

    await this.prisma.dailyRecord.updateMany({
      where: { homeProfileId, localDate, shadowAt: null },
      data: {
        shadowFlowC: decision.flowC,
        shadowAction: decision.action,
        shadowReasons: [...decision.reasons, ...decision.bounds].join('+'),
        shadowAt: now,
        shadowVersion: SHADOW_VERSION,
      },
    });

    this.logger.log(
      `Shadow kuća ${homeProfileId} ${localDate}: formula ` +
        `${record.proposedFlowTemp ?? '—'} °C, kontroler ` +
        `${decision.flowC ?? '—'} °C (${decision.action}; ` +
        `${[...decision.reasons, ...decision.bounds].join('+') || 'bez razloga'}).`,
    );

    return {
      status: 'EVALUATED',
      homeProfileId,
      localDate,
      decision,
      proposedFlowTemp: record.proposedFlowTemp,
    };
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
      (Date.parse(previousLocalDate) - Date.parse(changed.localDate)) / 86_400_000;
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
