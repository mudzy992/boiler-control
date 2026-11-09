import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DailyOutcomeService } from './daily-outcome.service';
import { applyDayGain } from '../HomeModel/day-gain';
import { effectiveShortCycleFloor } from './short-cycle-floor';
import { explorationFor } from './exploration';
import { flowForHeatTime } from './heat-time';
import {
  effectiveCeilingC,
  findBoilerFamily,
  isFlowAdviceAllowed,
} from '../BoilerCatalog/boiler-catalog';
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

    const [home, model, previous, recentOutcomes, lastOutcome, latestRoom] =
      await Promise.all([
      this.prisma.homeProfile.findUnique({
        where: { id: homeProfileId },
        select: {
          targetMorningTemp: true,
          targetDayTemp: true,
          // Najviša polazna koju sistem dozvoljava (`19` §2). Bez nje ostaje
          // granica kotla — nikad viša od 55.
          maxHeatingFlowC: true,
          // Iz kataloga se zna smije li se polazna uopšte snižavati.
          boilerCatalogId: true,
        },
      }),
      this.prisma.homeModel.findUnique({
        where: { homeProfileId },
        select: {
          state: true,
          slopeCiHigh: true,
          shortCycleFloorC: true,
          // Dokaz o granici ističe (`24` §7); bez datuma se starost ne zna.
          shortCycleFloorAt: true,
          // Dnevni dobitak (`17` §13 korak 7): dan sa suncem/gostima traži nižu
          // polaznu. `null` = nema procjene, pa se ne oduzima ništa.
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
          // Jučerašnje istraživanje blokira novo (`17` §8.5).
          shadowExplorationDirection: true,
        },
      }),

      // Rezerva za istraživanje: prebačaji zadnjih 5 obračunatih dana.
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
        where: { homeProfileId, localDate: { lt: localDate }, outcomeAt: { not: null } },
        orderBy: { localDate: 'desc' },
        select: {
          localDate: true,
          undershootC: true,
          overshootC: true,
          nightUndershootC: true,
          medianCycleMin: true,
          // Brzina dogrijavanja za `T_max` (`29`).
          heatRateCPerHour: true,
          heatRateFlowC: true,
          heatRateRoomC: true,
        },
      }),

      // Sobna temperatura sada: bez nje se ne zna koliko stepeni fali do cilja,
      // pa `T_max` nema šta da računa. Uzorak stariji od ovog dana ne vrijedi.
      this.prisma.thermostatObservation.findFirst({
        where: { homeProfileId, at: { lte: now } },
        orderBy: { at: 'desc' },
        select: { at: true, roomTempC: true },
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

    // Ravnotežna polazna za **prosječan** dan, umanjena za današnji dobitak.
    // `slopeCiHigh` je gornja granica intervala — namjerno konzervativno: bolje
    // malo viša polazna nego kuća koja ne stigne da se ugrije.
    const equilibriumFlowC =
      nightMinC != null && model?.slopeCiHigh != null
        ? target + model.slopeCiHigh * (target - nightMinC)
        : null;
    const modelFlowC =
      equilibriumFlowC == null
        ? null
        : applyDayGain(equilibriumFlowC, model?.uDayC);

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

    if (learnedFloor != null && (storedFloor == null || learnedFloor > storedFloor)) {
      await this.prisma.homeModel.update({
        where: { homeProfileId },
        data: { shortCycleFloorC: learnedFloor, shortCycleFloorAt: now },
      });
    } else if (stored.age === 'EXPIRED') {
      await this.prisma.homeModel.update({
        where: { homeProfileId },
        data: { shortCycleFloorC: null, shortCycleFloorAt: null },
      });
      this.logger.log(
        `Granica iz kratkih ciklusa za kuću ${homeProfileId} istekla ` +
          `(${stored.ageDays?.toFixed(0)} dana bez ponavljanja) — briše se.`,
      );
    }

    // Model bojlera: bez potvrđenog zapisa nema savjeta o snižavanju (`19` §1).
    const family = findBoilerFamily(home?.boilerCatalogId);
    const ceiling = effectiveCeilingC({
      systemMaxC: home?.maxHeatingFlowC ?? null,
      family,
    });

    // `T_max` kao pod (`17` §8.6): najniža polazna koja stigne do cilja na
    // vrijeme. Bez izmjerenog dogrijavanja nema proračuna — i tada se ništa ne
    // podiže naslijepo.
    const roomC = latestRoom?.roomTempC ?? null;
    const heatRate = lastOutcome?.heatRateCPerHour ?? null;
    const heatTimeFloorC =
      roomC != null &&
      heatRate != null &&
      lastOutcome?.heatRateFlowC != null &&
      lastOutcome?.heatRateRoomC != null
        ? flowForHeatTime({
            riseC: target - roomC,
            roomC,
            heatRateCPerHour: heatRate,
            measuredFlowC: lastOutcome.heatRateFlowC,
            measuredRoomC: lastOutcome.heatRateRoomC,
          })
        : null;

    // Istraživanje se dopušta samo kad je rezerva dokazana i noć nije hladna.
    const exploration = explorationFor({
      recentOvershootC: recentOutcomes.map((row) => row.overshootC),
      nightMinC,
      exploredYesterday: previous?.shadowExplorationDirection === 'LOWER',
      hasPreviousFlow: previousFlowC != null,
    });

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
      maxFlowC: ceiling,
      flowAdviceAllowed: isFlowAdviceAllowed(family),
      modelState: (model?.state ?? 'COLD_START') as ModelState,
      exploration: exploration.direction,
      heatTimeFloorC,
    });

    await this.prisma.dailyRecord.updateMany({
      where: { homeProfileId, localDate, shadowAt: null },
      data: {
        shadowFlowC: decision.flowC,
        shadowAction: decision.action,
        shadowReasons: [...decision.reasons, ...decision.bounds].join('+'),
        shadowAt: now,
        shadowVersion: SHADOW_VERSION,
        shadowExploration: decision.exploration,
        shadowExplorationDirection: decision.exploration ? 'LOWER' : null,
      },
    });

    this.logger.log(
      `Shadow kuća ${homeProfileId} ${localDate}: u_day ` +
        `${model?.uDayC == null ? '—' : `${model.uDayC.toFixed(1)} K`}, formula ` +
        `${record.proposedFlowTemp ?? '—'} °C, kontroler ` +
        `${decision.flowC ?? '—'} °C (${decision.action}` +
        `${decision.exploration ? ', istraživanje' : ''}; ` +
        `${heatTimeFloorC == null ? '' : `T_max pod ${heatTimeFloorC.toFixed(1)} °C, `}` +
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
