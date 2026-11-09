import {
  FLOW_MAX_C,
  FLOW_MIN_C,
  applyHardBounds,
  type BoundReason,
  type NightFloorBasis,
} from './flow-bounds';
import { UNDERSHOOT_TOLERANCE_K } from './day-outcome';

/**
 * Kontroler — silazak do granice komfora (`17` §8).
 *
 * Ovo je **odluka**, a ne mjerenje (`23`) ni granica (`flow-bounds.ts`). Red je
 * namjeran: prvo se izmjeri šta se dogodilo, onda se odluči, pa se odluka
 * propusti kroz tvrde granice. Nijedan korak ne preskače prethodni.
 *
 * Tri stvari koje kontroler ne smije:
 *
 * - **spustiti polaznu bez dokaza** da je niža vrijednost bila dovoljna (nema
 *   modela, `DEGRADED`, nema poredljivih noći);
 * - **spustiti polaznu zbog formule**: formula je početna vrijednost, ne cilj;
 * - **pogađati smjer** kad mjerenje ne razlikuje „previsoko" od „prenisko" —
 *   tada se ne mijenja, osim kad kratki ciklusi traže jedan korak gore (v.
 *   `SHORT_CYCLES`).
 */

/** Korak prema dolje (`17` §8.2). */
export const STEP_DOWN_K = 1.0;

/** Korak prema gore (`17` §8.2) — asimetrija: hladno je skuplje od toplog. */
export const STEP_UP_K = 1.5;

/** Najmanje dana između dvije promjene koje nijesu iz nužde (`17` §8.2). */
export const DWELL_DAYS = 3;

/** Prebačaj iznad ovoga je dokaz da je polazna previsoka (`17` §8.2). */
export const OVERSHOOT_TOLERANCE_K = 1.5;

/**
 * Ispod ovoga je ciklus **kratak**, u smislu u kojem to nestručno ne treba
 * tumačiti: 2–3 min se u praksi (`gvshvac`, `pickcomfort`) navodi kao kratak
 * ciklus, a 4–5 ciklusa na sat u prijelaznom periodu (`idm-energie`) kao
 * normalan rad, tj. 12–15 min.
 *
 * Uzeto je **6 min** — dvostruko iznad „2–3 min", a daleko ispod „normalnih"
 * 12–15 min. To je namjerno: prag služi da uhvati patološko ciklusiranje, a ne
 * da ocijeni rad koji je samo ispod prosjeka. Mjeri se **medijana**, pa jedan
 * kratak ciklus ne pokreće ništa.
 *
 * Zašto ne 15 min: kuća koja pri današnjoj formuli ima cikluse od 10 min bila
 * bi proglašena kratkom i kontroler se ne bi smio spustiti — a spuštanje je
 * upravo ono što cikluse produžava. Prag od 15 min blokirao bi učenje.
 */
export const SHORT_CYCLE_MIN = 6;

/**
 * Koliko iznad polazne pri kojoj su kratki ciklusi izmjereni treba ići. Isti
 * iznos i isto obrazloženje kao noćni minimum (`23` §4): tvrdi se samo da `F`
 * nije bilo dobro, ne da je `F + 1` dovoljno.
 */
export const SHORT_CYCLE_MARGIN_K = 1.0;

/**
 * Granica naučena iz kratkih ciklusa — ili `null` kad ih nije bilo.
 *
 * Pozivalac je **pamti** (najviša zabilježena vrijednost, dok se ne zaboravi po
 * pravilu iz `24` §5); da se računa samo iz zadnjeg dana, polazna bi padala na
 * `F` svaki drugi dan i vraćala se na `F + 1`, u krug.
 */
export function shortCycleFloorFrom(input: {
  flowC: number | null;
  medianCycleMin: number | null;
}): number | null {
  if (input.flowC == null) return null;
  if (input.medianCycleMin == null) return null;
  if (input.medianCycleMin >= SHORT_CYCLE_MIN) return null;
  return input.flowC + SHORT_CYCLE_MARGIN_K;
}

export type ControllerAction = 'HOLD' | 'LOWER' | 'RAISE';

export type ControllerReason =
  | 'DEGRADED'
  | 'NO_OUTCOME'
  | 'NO_MODEL'
  | 'NO_NIGHT_EVIDENCE'
  | 'UNDERSHOOT'
  | 'NIGHT_UNDERSHOOT'
  | 'OVERSHOOT'
  | 'SHORT_CYCLES'
  | 'COMFORT_HOLD'
  | 'STEADY'
  | 'DWELL'
  | 'MODEL_UNVERIFIED';

export type ModelState = 'TRACKING' | 'COLD_START' | 'DEGRADED';

/** Samo ono što odluka koristi — ne cijeli `DayOutcome`. */
export interface OutcomeSignals {
  undershootC: number;
  overshootC: number;
  nightUndershootC: number | null;
  medianCycleMin: number | null;
}

export interface NightGuard {
  floorC: number | null;
  basis: NightFloorBasis;
}

export interface ControllerInput {
  /**
   * Bazna vrijednost iz modela: `T_cilj + s·(T_cilj − noćni_min)`.
   *
   * To je **ravnotežna polazna**: pri njoj kuća u najhladnijem satu dana drži
   * cilj uz neprekidno grijanje. Ispod nje cilj se matematički ne može držati,
   * pa se ispod nje ne ide (v. `24` §4). Pozivalac je računa sa **gornjom**
   * granicom intervala za `s`: potcijenjen `s` daje prenisku bazu, a preniska
   * baza je hladna kuća.
   */
  modelFlowC: number | null;
  /** Polazna koja je bila na snazi. `null` = prva odluka. */
  previousFlowC: number | null;
  /** Dana od zadnje promjene polazne; `null` ako se ne zna. */
  daysSinceChange: number | null;
  /** Izmjereni ishod zadnjeg obračunatog dana. `null` = nema mjerenja. */
  outcome: OutcomeSignals | null;
  night: NightGuard;
  /**
   * Polazna pri kojoj su izmjereni kratki ciklusi. Kao i noćni minimum, to je
   * dokaz „ova vrijednost nije bila dobra" — nikad se ne ide ispod nje.
   * `null` = nije zabilježeno.
   */
  shortCycleFloorC?: number | null;
  /**
   * Smije li se polazna uopšte savjetovati snižavati (`BoilerCatalog`).
   *
   * `false` kad model bojlera nije potvrđen iz priručnika ili kad nije
   * potvrđeno da su grijanje i PTV odvojena podešavanja — tada bi snižavanje
   * moglo ugroziti PTV (toplu vodu), pa se predlog **ne spušta**. Podizanje
   * ostaje dozvoljeno: ono ne može ugroziti PTV.
   *
   * Nije opciono namjerno: svaki pozivalac mora odlučiti, jer je zadana
   * vrijednost „dozvoljeno" upravo ona koju ne treba imati.
   */
  flowAdviceAllowed: boolean;
  modelState: ModelState;
  /** Najviše što sistem dozvoljava (podno grijanje, model kotla). */
  maxFlowC?: number | null;
}

export interface ControllerDecision {
  /** `null` = kontroler ne odlučuje; pozivalac ostaje pri formuli. */
  flowC: number | null;
  action: ControllerAction;
  reasons: ControllerReason[];
  /** Šta su tvrde granice promijenile u odluci. */
  bounds: BoundReason[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Odluka za sutrašnji predlog.
 *
 * Red pravila je dio odluke, ne stil:
 *
 * 1. **nema osnova** (`DEGRADED`, nema ishoda, nema modela) → ne mijenjaj;
 * 2. **podbačaj** (dan ili noć) → gore, i to bez obzira na dwell — komfor je
 *    sigurnosna stvar, ne udobnost;
 * 3. **prebačaj** → dolje;
 * 4. **kratki ciklusi** → jedan korak gore (v. `SHORT_CYCLES` u `24` §4);
 * 5. **udobno i dugi ciklusi** → dolje jedan korak;
 * 6. **dwell** i **deadband** — samo za promjene koje nijesu iz nužde;
 * 7. **tvrde granice** na kraju, uvijek.
 */
export function decideProposal(input: ControllerInput): ControllerDecision {
  const previous = input.previousFlowC;

  if (input.modelState === 'DEGRADED') {
    return { flowC: previous, action: 'HOLD', reasons: ['DEGRADED'], bounds: [] };
  }
  if (input.outcome == null) {
    return { flowC: previous, action: 'HOLD', reasons: ['NO_OUTCOME'], bounds: [] };
  }
  if (input.modelFlowC == null) {
    return { flowC: previous, action: 'HOLD', reasons: ['NO_MODEL'], bounds: [] };
  }

  const maxFlow =
    input.maxFlowC == null ? FLOW_MAX_C : Math.min(FLOW_MAX_C, input.maxFlowC);
  const base = clamp(input.modelFlowC, FLOW_MIN_C, Math.max(FLOW_MIN_C, maxFlow));

  const failingDay = input.outcome.undershootC > UNDERSHOOT_TOLERANCE_K;
  const failingNight =
    (input.outcome.nightUndershootC ?? 0) > UNDERSHOOT_TOLERANCE_K;
  const tooHigh = input.outcome.overshootC > OVERSHOOT_TOLERANCE_K;
  const shortCycles =
    input.outcome.medianCycleMin != null &&
    input.outcome.medianCycleMin < SHORT_CYCLE_MIN;

  // Dvije izmjerene granice, isti smisao: „ova polazna nije bila dovoljna".
  const floors = [input.night.floorC, input.shortCycleFloorC ?? null].filter(
    (value): value is number => value != null,
  );
  const floorC = floors.length === 0 ? null : Math.max(...floors);

  let intended: number;
  let reasons: ControllerReason[] = [];
  /** Promjena iz nužde ne čeka dwell. */
  let forced = false;

  if (failingDay || failingNight) {
    // Podbačaj nikad ne smije rezultirati nižom polaznom. Bazna vrijednost
    // modela ovdje **ne** ograničava podizanje: hladna kuća se podiže i kad
    // model tvrdi da je niža polazna dovoljna — inače bi model mogao držati
    // kuću hladnom. Granicu i dalje drže `±2 K/dan`, raspon i noćni minimum.
    intended = previous == null ? base : previous + STEP_UP_K;
    forced = true;
    reasons = [failingDay ? 'UNDERSHOOT' : 'NIGHT_UNDERSHOOT'];
  } else if (tooHigh) {
    intended = previous == null ? base : previous - STEP_DOWN_K;
    reasons = ['OVERSHOOT'];
  } else if (shortCycles) {
    // Kratki ciklusi znače da se **ne spušta**, jer je spuštanje ono što ih je
    // i proizvelo. Smjer se ne nagađa: ako je granica zapamćena, ide se na nju
    // (ili ostaje gdje je); ako nije, ostaje se pri prošloj vrijednosti.
    intended =
      input.shortCycleFloorC == null
        ? (previous ?? base)
        : Math.max(previous ?? base, input.shortCycleFloorC);
    reasons = ['SHORT_CYCLES'];
  } else if (previous == null) {
    intended = base;
    reasons = ['STEADY'];
  } else {
    intended = previous - STEP_DOWN_K;
    reasons = ['COMFORT_HOLD'];
  }

  // Nikad ispod ravnotežne polazne: to nije „konzervativno", to je granica
  // fizike. Iznad nje se troši gas uzalud; ispod nje se troši komfor.
  if (intended < base) {
    intended = base;
  }
  intended = clamp(intended, FLOW_MIN_C, Math.max(FLOW_MIN_C, maxFlow));

  // Spuštanje je dozvoljeno samo kad za njega postoji dokaz.
  const wantsLower = previous != null && intended < previous;
  if (wantsLower) {
    if (!input.flowAdviceAllowed) {
      intended = previous;
      reasons = ['MODEL_UNVERIFIED'];
    } else if (input.modelState !== 'TRACKING') {
      intended = previous;
      reasons = ['NO_MODEL'];
    } else if (
      input.night.basis === 'NO_FORECAST' ||
      input.night.basis === 'NO_EVIDENCE'
    ) {
      // Bez poredljivih noći ne znamo da je niža vrijednost pokrila noć —
      // a noć je ono što predlog mora pokriti (`23` §4).
      intended = previous;
      reasons = ['NO_NIGHT_EVIDENCE'];
    }
  }

  // Dwell vrijedi samo za promjene koje nijesu iz nužde. Deadband iz `17` §8.2
  // (0,5 K) ovdje ne postoji kao pravilo jer su koraci fiksni i nikad manji od
  // 1,0 K — pravilo je zadovoljeno po konstrukciji, a ne propušteno.
  if (!forced && previous != null && intended !== previous) {
    if (input.daysSinceChange != null && input.daysSinceChange < DWELL_DAYS) {
      intended = previous;
      reasons = ['DWELL'];
    }
  }

  const bounded = applyHardBounds({
    candidateC: intended,
    previousC: previous,
    nightFloorC: floorC,
    systemMaxC: input.maxFlowC ?? null,
  });

  // Kad su granice te koje su podigle odluku, razlog se imenuje tačno.
  if (
    shortCycles &&
    input.shortCycleFloorC != null &&
    floorC === input.shortCycleFloorC &&
    !reasons.includes('SHORT_CYCLES')
  ) {
    reasons = ['SHORT_CYCLES'];
  }

  const action: ControllerAction =
    previous == null || bounded.flowC === previous
      ? 'HOLD'
      : bounded.flowC > previous
        ? 'RAISE'
        : 'LOWER';

  return {
    flowC: bounded.flowC,
    action,
    reasons,
    bounds: bounded.reasons,
  };
}
