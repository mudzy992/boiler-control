import { equilibriumFlow } from './equilibrium-flow';
import { flowForHeatTime } from './heat-time';
import { explorationFor } from './exploration';
import { decideProposal } from './proposal-controller';
import type { NightFloorBasis } from './flow-bounds';
import type { ModelState } from './proposal-controller';
import {
  effectiveCeilingC,
  findBoilerFamily,
  isFlowAdviceAllowed,
} from '../BoilerCatalog/boiler-catalog';

/**
 * F4.2 — **odluka predloga kao čista funkcija**.
 *
 * Do sada je pravilo „koliko polazna treba da bude" postojalo samo unutar
 * `ProposalShadowService.evaluate()`, pomiješano sa ~238 redova prikupljanja
 * iz baze i upisima. Zbog toga `DailyRecordWriter` **nije mogao** da ga
 * koristi: writer radi **prije** shadow odluke (`daily.recommendation.service`
 * piše predlog na `:76`, a shadow zove na `:95`), pa bi poziv servisa bio ili
 * ciklična zavisnost ili odluka o redu koji još ne postoji.
 *
 * Ovdje je izdvojeno **samo ono što je čisto**: izraz ravnotežne polazne,
 * pod `T_max`, istraživanje i kontroler. Sve što traži bazu ostaje u servisu.
 *
 * **Ponašanje je nepromijenjeno.** Redoslijed izračuna i ulazi u `decideProposal`
 * su isti; ovo je premještanje, ne prepisivanje. To dokazuje test „isti ulaz ⇒
 * isti izlaz kao shadow" (`proposal-decision.spec.ts`), koji poredi rezultat
 * ove funkcije sa rezultatom koji servis upiše za isti dan.
 */

/** Ono što odluka treba — ništa od ovoga ne dolazi iz baze unutar funkcije. */
export interface ProposalDecisionInput {
  homeProfileId: number;
  localDate: string;
  now: Date;

  /** Ciljna sobna temperatura (jutro, pa dan, pa zadano). */
  targetRoomC: number;
  /** Prognoza najhladnijeg sata noći; `null` = nema prognoze. */
  nightMinC: number | null;
  /** Prognoza najtoplijeg sata dana (F2 referenca). */
  dayMaxC: number | null;

  /** Granica koju kuća dozvoljava (`maxHeatingFlowC`). */
  maxFlowC: number | null;
  /** Porodica bojlera iz kataloga — odlučuje smije li se polazna snižavati. */
  boilerCatalogId: string | null;

  /** Model kuće (`HomeModel`), ili `null` bez fita. */
  model: {
    state: ModelState;
    slopeS: number | null;
    slopeCiHigh: number | null;
    days: number | null;
    internalGainC: number | null;
    uDayC: number | null;
    shortCycleFloorC: number | null;
    shortCycleFloorAt: Date | null;
  } | null;

  /** Noćna granica iz ishoda (F1) — `null` kad je nema. */
  nightFloor: { floorC: number | null; basis: NightFloorBasis };
  /** Granica iz kratkih ciklusa (naučena ili zapamćena). */
  shortCycleFloorC: number | null;
  /** Koliko dana je polazna nepromijenjena; `null` = ne zna se. */
  daysSinceChange: number | null;

  previousFlowC: number | null;
  outcome: Parameters<typeof decideProposal>[0]['outcome'];

  /** Pod `T_max` (`29`); `null` kad nema izmjerenog dogrijavanja. */
  heatTimeFloorC: number | null;
  /** Rezerva za istraživanje iz zadnjih obračuna. */
  recentOvershootC: Array<number | null>;
  exploredYesterday: boolean;

  /**
   * Da li `u_day` ulazi u predlog (odluka vlasnika 2026-11-12: **ne**).
   *
   * Prekidač ostaje **ulaz**, a ne konstanta u ovom modulu: inače bi izdvajanje
   * odluke tiho preuzelo i odluku o prekidaču, a to je odluka vlasnika i mora
   * ostati na jednom mjestu (`proposal-shadow.service.ts`).
   */
  dayGainInProposal: boolean;
}

/** Rezultat: odluka + članovi izraza, da se log i breakdown ne rekonstruišu. */
export interface ProposalDecisionResult {
  equilibrium: ReturnType<typeof equilibriumFlow>;
  exploration: ReturnType<typeof explorationFor>;
  decision: ReturnType<typeof decideProposal>;
  /** Granica sistema nakon kataloga — ide u odluku i u breakdown. */
  ceilingC: number;
}

/**
 * Odluka. Ista matematika, isti redoslijed kao `evaluate()` — samo bez baze.
 */
export function decideDailyProposal(
  input: ProposalDecisionInput,
): ProposalDecisionResult {
  const equilibrium = equilibriumFlow({
    targetRoomC: input.targetRoomC,
    nightMinC: input.nightMinC,
    dayMaxC: input.dayMaxC,
    slopeS: input.model?.slopeS ?? null,
    slopeCiHigh: input.model?.slopeCiHigh ?? null,
    modelDays: input.model?.days ?? null,
    internalGainC: input.model?.internalGainC ?? null,
    // Prekidač, jer je uključivanje odluka vlasnika, a ne svojstvo izraza.
    // Isključeno ⇒ `null`, a ne `0`: `null` znači „nema člana", dok bi `0`
    // tvrdio izmjereni nulti dobitak.
    uDayC: input.dayGainInProposal ? (input.model?.uDayC ?? null) : null,
  });

  const family = findBoilerFamily(input.boilerCatalogId);
  const ceilingC = effectiveCeilingC({
    systemMaxC: input.maxFlowC,
    family,
  });

  const exploration = explorationFor({
    recentOvershootC: input.recentOvershootC,
    nightMinC: input.nightMinC,
    exploredYesterday: input.exploredYesterday,
    hasPreviousFlow: input.previousFlowC != null,
  });

  const decision = decideProposal({
    modelFlowC: equilibrium.flowC,
    previousFlowC: input.previousFlowC,
    daysSinceChange: input.daysSinceChange,
    outcome: input.outcome,
    night: { floorC: input.nightFloor.floorC, basis: input.nightFloor.basis },
    shortCycleFloorC: input.shortCycleFloorC,
    maxFlowC: ceilingC,
    flowAdviceAllowed: isFlowAdviceAllowed(family),
    modelState: input.model?.state ?? 'COLD_START',
    exploration: exploration.direction,
    heatTimeFloorC: input.heatTimeFloorC,
  });

  return { equilibrium, exploration, decision, ceilingC };
}

/**
 * Pod `T_max` (`29` §8.6) — čisto, pa pripada ovdje.
 *
 * Bez izmjerenog dogrijavanja nema proračuna: bolje `null` (nema poda) nego
 * izmišljen pod koji bi podigao polaznu naslijepo.
 */
export function heatTimeFloorFor(input: {
  roomC: number | null;
  targetRoomC: number;
  heatRateCPerHour: number | null;
  measuredFlowC: number | null;
  measuredRoomC: number | null;
}): number | null {
  if (
    input.roomC == null ||
    input.heatRateCPerHour == null ||
    input.measuredFlowC == null ||
    input.measuredRoomC == null
  ) {
    return null;
  }
  return flowForHeatTime({
    riseC: input.targetRoomC - input.roomC,
    roomC: input.roomC,
    heatRateCPerHour: input.heatRateCPerHour,
    measuredFlowC: input.measuredFlowC,
    measuredRoomC: input.measuredRoomC,
  });
}

/**
 * F4.2 — odluka od **već izračunatih** ulaza.
 *
 * Zašto dva sloja (`decideDailyProposal` i ova funkcija): servis mora ostati
 * fleksibilan oko toga **kada** čita bazu (`daysSinceChange`, `nightFloorFor`
 * su `await`-ovi između izračuna), a writer ima sve ulaze odjednom. Jedna
 * funkcija koja prima sve bi natjerala jedno od njih dvoje da čita bazu na
 * mjestu gdje to ne pripada.
 *
 * `equilibrium` i `modelFlowC` se predaju gotovi jer ih servis koristi i
 * poslije odluke (log nosi članove izraza) — ponovni izračun bi bio druga
 * kopija istog broja.
 */
export interface ProposalDecisionFromInputs {
  modelFlow: {
    modelFlowC: number | null;
    equilibrium: ReturnType<typeof equilibriumFlow>;
  };
  previousFlowC: number | null;
  daysSinceChange: number | null;
  outcome: Parameters<typeof decideProposal>[0]['outcome'];
  night: { floorC: number | null; basis: NightFloorBasis };
  shortCycleFloorC: number | null;
  ceilingC: number;
  family: ReturnType<typeof findBoilerFamily>;
  modelState: ModelState;
  heatTimeFloorC: number | null;
  recentOvershootC: Array<number | null>;
  nightMinC: number | null;
  exploredYesterday: boolean;
}

export function decideProposalFromInputs(input: ProposalDecisionFromInputs): {
  decision: ReturnType<typeof decideProposal>;
  exploration: ReturnType<typeof explorationFor>;
} {
  // Istraživanje se dopušta samo kad je rezerva dokazana i noć nije hladna.
  const exploration = explorationFor({
    recentOvershootC: input.recentOvershootC,
    nightMinC: input.nightMinC,
    exploredYesterday: input.exploredYesterday,
    hasPreviousFlow: input.previousFlowC != null,
  });

  const decision = decideProposal({
    modelFlowC: input.modelFlow.modelFlowC,
    previousFlowC: input.previousFlowC,
    daysSinceChange: input.daysSinceChange,
    outcome: input.outcome,
    night: { floorC: input.night.floorC, basis: input.night.basis },
    shortCycleFloorC: input.shortCycleFloorC,
    maxFlowC: input.ceilingC,
    flowAdviceAllowed: isFlowAdviceAllowed(input.family),
    modelState: input.modelState,
    exploration: exploration.direction,
    heatTimeFloorC: input.heatTimeFloorC,
  });

  return { decision, exploration };
}
