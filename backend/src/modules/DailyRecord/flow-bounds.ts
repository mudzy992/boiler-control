import { UNDERSHOOT_TOLERANCE_K } from './day-outcome';

/**
 * Tvrde granice predloga (`17` §8.2, §8.4).
 *
 * Ove funkcije **ne odlučuju** koliko će polazna biti — samo sprečavaju da
 * odluka (kad je bude) izađe iz fizičkih i bezbjednosnih granica. Zato su čiste
 * i testirane odvojeno: kad kontroler dođe u koraku 6, on neće nositi sopstvenu
 * kopiju pravila.
 */

export const FLOW_MIN_C = 30;
export const FLOW_MAX_C = 55;

/**
 * Najveća promjena po danu. Nije fizička granica nego protiv-oscilirajuća:
 * bez nje bi jedan loš dan mogao vratiti polaznu gore 8 °C, a sljedeći je
 * spustiti isto toliko.
 */
export const MAX_DAILY_CHANGE_K = 2;

/**
 * Zašto je broj promijenjen — ide u objašnjenje uz predlog, ne u log.
 *
 * `SYSTEM_MAX` je poseban slučaj: granica koju sistem dozvoljava (`19` §2) je
 * niža od noćnog minimuma. Tada se bira granica sistema, jer je ona fizička, a
 * `SYSTEM_MAX` u razlozima kaže da noć **nije** pokrivena — da se to ne bi
 * čitalo kao uspjeh.
 */
export type BoundReason =
  'RANGE' | 'NIGHT_FLOOR' | 'DAILY_CHANGE' | 'SYSTEM_MAX';

export interface HardBoundsInput {
  /** Ono što je odluka predložila. */
  candidateC: number;
  /** Polazna koja je bila na snazi; `null` ako nema historije. */
  previousC: number | null;
  /** Najmanja polazna koja pokriva noć; `null` kad nema dokaza. */
  nightFloorC: number | null;
  /**
   * Najviša polazna koju sistem dozvoljava (kotao ili podno grijanje),
   * `HomeProfile.maxHeatingFlowC`. `null` = granica kotla (55).
   */
  systemMaxC?: number | null;
}

export interface HardBoundsResult {
  flowC: number;
  reasons: BoundReason[];
}

/**
 * Redoslijed je namjeran i mora se čuvati:
 *
 * 1. **raspon** `[30, 55]` — nikad se ne prelazi;
 * 2. **noćni minimum** — podiže ako treba, jer noć je ono što predlog pokriva;
 * 3. **dnevna promjena** `±2 °C`;
 * 4. **ponovno** raspon i noćni minimum.
 *
 * Korak 4 postoji zato što ograničenje dnevne promjene smije usporiti
 * spuštanje, ali **ne smije** spustiti predlog ispod noćnog minimuma. Sigurnost
 * ima prednost pred glatkoćom, i to je jedino mjesto gdje pravilo smije biti
 * prekršeno.
 */
export function applyHardBounds(input: HardBoundsInput): HardBoundsResult {
  // Nekonačan broj se ne „popravlja" nego odbija: `NaN` provučen kroz `clamp`
  // ostaje `NaN` i kao takav bi otišao na kotao. Bolje je stati.
  assertFinite(input.candidateC, 'candidateC');
  if (input.previousC != null) assertFinite(input.previousC, 'previousC');
  if (input.nightFloorC != null) assertFinite(input.nightFloorC, 'nightFloorC');
  if (input.systemMaxC != null) assertFinite(input.systemMaxC, 'systemMaxC');

  const reasons: BoundReason[] = [];
  // Granica sistema samo sužava raspon; nikad ga ne širi.
  const ceiling =
    input.systemMaxC == null
      ? FLOW_MAX_C
      : Math.min(FLOW_MAX_C, Math.max(FLOW_MIN_C, input.systemMaxC));
  const floor =
    input.nightFloorC == null
      ? null
      : clamp(input.nightFloorC, FLOW_MIN_C, ceiling);
  const limit = (value: number) => clamp(value, FLOW_MIN_C, ceiling);

  let flowC = input.candidateC;

  const ranged = limit(flowC);
  if (ranged !== flowC) {
    reasons.push('RANGE');
    flowC = ranged;
  }

  if (floor != null && flowC < floor) {
    reasons.push('NIGHT_FLOOR');
    flowC = floor;
  }

  if (input.previousC != null) {
    const limited = limit(
      clamp(
        flowC,
        input.previousC - MAX_DAILY_CHANGE_K,
        input.previousC + MAX_DAILY_CHANGE_K,
      ),
    );
    if (limited !== flowC) {
      reasons.push('DAILY_CHANGE');
      flowC = limited;
    }
  }

  const finalRanged = limit(flowC);
  if (finalRanged !== flowC) {
    if (!reasons.includes('RANGE')) reasons.push('RANGE');
    flowC = finalRanged;
  }
  if (floor != null && flowC < floor) {
    if (!reasons.includes('NIGHT_FLOOR')) reasons.push('NIGHT_FLOOR');
    flowC = floor;
  }

  // Noćni minimum iznad onoga što sistem dozvoljava: bira se fizička granica,
  // ali se prekršaj imenuje — noć tada nije pokrivena i to se vidi.
  if (input.nightFloorC != null && input.nightFloorC > ceiling) {
    reasons.push('SYSTEM_MAX');
    flowC = ceiling;
  }

  return { flowC, reasons };
}

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(
      `${name} mora biti konačan broj, dobijeno: ${String(value)}`,
    );
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Koliko noć smije biti hladnija od mjerene da bi dokaz još važio. */
export const NIGHT_COMPARABLE_TOLERANCE_K = 2;

/**
 * Koliko iznad polazne koja je podbacila treba ići. Isti iznos kao korak
 * podizanja u `17` §8.2 (`+1,5`) bio bi prevelik za granicu koja se primjenjuje
 * svaki dan; 1,0 je najmanji korak koji izlazi iz izmjerene bande od 1,0 K.
 */
export const NIGHT_MARGIN_K = 1.0;

/** Jedna noć iz historije: šta je bilo na snazi i kako je prošlo. */
export interface NightEvidence {
  /** Polazna koja je bila na snazi te noći. */
  flowC: number;
  /** Najhladniji izmjereni sat te noći (vanjska). */
  nightMinOutdoorC: number;
  /** Manjak u toj noći; `null` = nema mjerenja. */
  nightUndershootC: number | null;
}

export type NightFloorBasis =
  | 'NO_FORECAST'
  | 'NO_EVIDENCE'
  | 'NO_FAILURE'
  | 'RAISED_FROM_FAILURE'
  | 'AT_LIMIT';

export interface NightFloorResult {
  floorC: number | null;
  basis: NightFloorBasis;
  /** Najviša polazna koja je stvarno podbacila u poredljivoj noći. */
  worstFailingFlowC: number | null;
  /** Broj noći koje su ušle u poređenje. */
  comparableNights: number;
}

/**
 * Najmanja polazna koja pokriva noć — **izmjereno, ne modelovano**.
 *
 * Pravilo: ako je u poredljivoj noći (unutar ±2 K od prognoze) polazna `F`
 * podbacila, onda sljedeći put ne smijemo ići ispod `F + 1,0`. To ne tvrdi da
 * je `F + 1,0` dovoljno — tvrdi samo da `F` nije bilo. Razlika je bitna: prvo
 * bi bio model koji nemamo, drugo je dokaz koji imamo.
 *
 * Ako poredljivih noći nema, granice nema. To je **praznina koja se ne
 * popunjava nagađanjem**: kontroler tada ne smije spuštati polaznu (obaveza iz
 * `23` §4), jer nema dokaza da je niža vrijednost bezbjedna.
 */
export function nightFloorFrom(input: {
  evidence: readonly NightEvidence[];
  forecastNightMinC: number | null;
  toleranceK?: number;
  marginK?: number;
}): NightFloorResult {
  if (input.forecastNightMinC == null) {
    return {
      floorC: null,
      basis: 'NO_FORECAST',
      worstFailingFlowC: null,
      comparableNights: 0,
    };
  }

  const tolerance = input.toleranceK ?? NIGHT_COMPARABLE_TOLERANCE_K;
  const margin = input.marginK ?? NIGHT_MARGIN_K;

  const comparable = input.evidence.filter(
    (night) =>
      night.nightUndershootC != null &&
      Math.abs(night.nightMinOutdoorC - (input.forecastNightMinC as number)) <=
        tolerance,
  );

  if (comparable.length === 0) {
    return {
      floorC: null,
      basis: 'NO_EVIDENCE',
      worstFailingFlowC: null,
      comparableNights: 0,
    };
  }

  const failing = comparable.filter(
    (night) => (night.nightUndershootC as number) > UNDERSHOOT_TOLERANCE_K,
  );

  if (failing.length === 0) {
    return {
      floorC: null,
      basis: 'NO_FAILURE',
      worstFailingFlowC: null,
      comparableNights: comparable.length,
    };
  }

  const worstFailingFlowC = Math.max(...failing.map((night) => night.flowC));
  const wanted = worstFailingFlowC + margin;

  if (wanted > FLOW_MAX_C) {
    return {
      floorC: FLOW_MAX_C,
      basis: 'AT_LIMIT',
      worstFailingFlowC,
      comparableNights: comparable.length,
    };
  }

  return {
    floorC: clamp(wanted, FLOW_MIN_C, FLOW_MAX_C),
    basis: 'RAISED_FROM_FAILURE',
    worstFailingFlowC,
    comparableNights: comparable.length,
  };
}
