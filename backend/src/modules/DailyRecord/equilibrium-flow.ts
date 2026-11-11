/**
 * Ravnotežna polazna iz **izmjerenog** modela kuće — jedan broj, jedan izraz.
 *
 * Do sada se ovaj izraz nalazio u `proposal-shadow.service.ts` i bio je
 * nepotpun na dva načina (F2 u `docs/plans/PLAN-formula-v2.md`):
 *
 * 1. **`c` nije oduziman.** Model kuće je `y = s·x − c`, gdje je `c` ukupni
 *    dnevni dobitak (`q_int/k1`). Ako se `c` izmjeri i ne upotrijebi, polazna
 *    je sistematski viša za `c` — u simulaciji 0,92–1,01 K — i to je greška
 *    koja uvijek ide u istu stranu.
 * 2. **Referenca je bila najhladniji sat noći**, a polazna je jedna za cijeli
 *    dan. Sunčan dan sa hladnom noći tako je dobijao polaznu za najgori sat,
 *    a `u_day` je to pokriven samo do ±2 K i samo kad ima 4 dana.
 *
 * Zato je izraz sada:
 *
 * ```
 * F_eq = T_cilj + s·(T_cilj − O_ref) − c
 * ```
 *
 * gdje je `O_ref` mješavina noći i najtoplijeg sata dana, i gdje `s` ima
 * **starost**: dok je model mlad koristi se gornja granica intervala
 * (konzervativno — bolje malo više nego hladna kuća), poslije tačka-procjena.
 *
 * Modul je čist: nema baze, nema sata, nema mutacije. Zbog toga se izraz može
 * testirati bez ijednog stubа i uporediti sa simulatorom.
 */

/**
 * Verzija izraza — ide u `params` predloga, da se „prije/poslije" može
 * izmjeriti na istoj istoriji. Mijenja se kad se promijeni bilo koji član.
 */
export const EQUILIBRIUM_VERSION = 'equilibrium-1';

/**
 * Do kog broja dana u fitu se koristi gornja granica intervala.
 *
 * Zašto uopšte granica: mlad fit ima širok CI, a greška prema dolje znači
 * hladnu kuću. Zašto ograničenje: poslije ~20 dana CI je ±0,01 (`learning_sim`:
 * dan 20 → CI 0,940–0,955 za `s = 0,943`), pa gornja granica prestaje da štiti
 * od ičega i ostaje samo jednosmjerna pristrasnost od +0,2–0,3 K.
 */
export const SLOPE_CONSERVATIVE_MAX_DAYS = 20;

/**
 * Koliko najtoplijeg sata dana ulazi u referencu: `O_ref = w·noć + (1−w)·dan`.
 *
 * 0,3 je mjereno, ne izabrano: u `learning_sim` sa tri tipa kuće prelaz sa
 * čiste noći na ovu mješavinu smanjio je cikluse/dan za 22 % (medium 18,22 →
 * 13,25) bez ijednog dana podbačaja. Veći udio dana značio bi nižu polaznu na
 * svakom sunčanom danu, a to je greška koja se ne vidi do prve hladne noći.
 */
export const DAY_REFERENCE_WEIGHT = 0.3;

export interface EquilibriumInput {
  /** Ciljna sobna temperatura (`targetMorningTemp` ?? `targetDayTemp`). */
  targetRoomC: number;
  /** Prognoza najhladnijeg sata noći 22:00 → 06:00 (`DailyRecord.nightMinC`). */
  nightMinC: number | null;
  /**
   * Prognoza najtoplijeg sata dana (`DailyRecord.dayMaxC`). `null` = nema
   * satne prognoze; tada se mješavina ne pravi i ostaje čista noć — ne
   * izmišlja se dnevni maksimum.
   */
  dayMaxC?: number | null;
  /** Tačka-procjena nagiba (`HomeModel.slopeS`). */
  slopeS: number | null;
  /** Gornja granica intervala (`HomeModel.slopeCiHigh`). */
  slopeCiHigh?: number | null;
  /** Dani u fitu (`HomeModel.days`) — odlučuju koja se vrijednost nagiba koristi. */
  modelDays?: number | null;
  /**
   * `c = q_int/k1` (`HomeModel.internalGainC`), pozitivan broj stepeni.
   * `null` = nije izmjeren; tada se **ne oduzima** ništa, jer nepoznat
   * dobitak nije isto što i nulti.
   */
  internalGainC?: number | null;
  /** Dnevni dobitak iz ostatka (`HomeModel.uDayC`); pozitivan spušta. */
  uDayC?: number | null;
}

export type EquilibriumFailure = 'NO_NIGHT' | 'NO_SLOPE';

export interface EquilibriumResult {
  /** `null` kad nema noći ili nagiba — kontroler tada nema osnova. */
  flowC: number | null;
  /** Nagib koji je stvarno upotrijebljen. */
  slopeUsed: number | null;
  slopeSource: 'CI_HIGH' | 'POINT' | null;
  /** Referentna vanjska temperatura poslije mješavine. */
  outdoorRefC: number | null;
  outdoorRefSource: 'NIGHT' | 'NIGHT_DAY_BLEND' | null;
  /** Koliko je `c` stvarno oduzeto (0 kad nije izmjeren). */
  internalGainAppliedC: number;
  /** Koliko je `u_day` stvarno oduzeto (0 kad nije izmjeren). */
  dayGainAppliedC: number;
  /** Članovi izraza — za `params` i za objašnjenje uz predlog. */
  terms: {
    targetC: number;
    /** `s·(T_cilj − O_ref)` — koliko polazna mora biti iznad sobe. */
    slopeTermC: number;
    /** `−(c + u_day)` — ukupno oduzeto. */
    gainTermC: number;
  } | null;
  /** Zašto nema broja; prazno kad `flowC` nije `null`. */
  reasons: EquilibriumFailure[];
}

function finite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Koji nagib ide u izraz.
 *
 * Granica se koristi **samo dok je model mlad**, i to je jedina razlika od
 * ranijeg ponašanja: ranije je gornja granica bila trajna, pa je predlog
 * uvijek bio malo viši nego što model tvrdi, bez obzira na to koliko je
 * mjerenje pouzdano.
 */
export function chooseSlope(input: {
  slopeS: number | null;
  slopeCiHigh?: number | null;
  modelDays?: number | null;
}): { slope: number | null; source: 'CI_HIGH' | 'POINT' | null } {
  const point = finite(input.slopeS);
  const high = finite(input.slopeCiHigh);
  const days = finite(input.modelDays);

  if (point == null) return { slope: null, source: null };

  // Nepoznat broj dana tretiramo kao „mlad": konzervativno je sigurnije, a
  // stari model uvijek ima `days` zapisan u fitu.
  const young = days == null || days < SLOPE_CONSERVATIVE_MAX_DAYS;
  if (young && high != null && high >= point) {
    return { slope: high, source: 'CI_HIGH' };
  }
  return { slope: point, source: 'POINT' };
}

/**
 * Referentna vanjska temperatura: noć uvijek, dan kada je izmjeren.
 *
 * Vraća i **izvor**, jer „noć" i „noć + dan" nijesu ista tvrdnja: prva kaže
 * „polazna za najhladniji sat", druga „polazna za dan kakav je predviđen".
 */
export function referenceOutdoorC(input: {
  nightMinC: number | null;
  dayMaxC?: number | null;
  dayWeight?: number;
}): { outdoorRefC: number | null; source: 'NIGHT' | 'NIGHT_DAY_BLEND' | null } {
  const night = finite(input.nightMinC);
  if (night == null) return { outdoorRefC: null, source: null };

  const day = finite(input.dayMaxC ?? null);
  if (day == null) return { outdoorRefC: night, source: 'NIGHT' };

  const weight = input.dayWeight ?? DAY_REFERENCE_WEIGHT;
  const clamped = Math.min(1, Math.max(0, weight));
  return {
    outdoorRefC: (1 - clamped) * night + clamped * day,
    source: 'NIGHT_DAY_BLEND',
  };
}

/**
 * Ravnotežna polazna. `null` znači „nema osnova" i kontroler tada drži prošlu
 * vrijednost — nikad se ne pogađa broj.
 */
export function equilibriumFlow(input: EquilibriumInput): EquilibriumResult {
  const target = finite(input.targetRoomC);
  const reference = referenceOutdoorC({
    nightMinC: input.nightMinC,
    dayMaxC: input.dayMaxC,
  });
  const { slope, source: slopeSource } = chooseSlope({
    slopeS: input.slopeS,
    slopeCiHigh: input.slopeCiHigh,
    modelDays: input.modelDays,
  });

  const reasons: EquilibriumFailure[] = [];
  if (reference.outdoorRefC == null || target == null) reasons.push('NO_NIGHT');
  if (slope == null) reasons.push('NO_SLOPE');

  const base: EquilibriumResult = {
    flowC: null,
    slopeUsed: slope,
    slopeSource,
    outdoorRefC: reference.outdoorRefC,
    outdoorRefSource: reference.source,
    internalGainAppliedC: 0,
    dayGainAppliedC: 0,
    terms: null,
    reasons,
  };

  if (reference.outdoorRefC == null || target == null || slope == null) {
    return base;
  }

  const slopeTermC = slope * (target - reference.outdoorRefC);
  // Znak je namjeran: `c` je **dobitak**, pa polaznu spušta. Isto važi za
  // `u_day`. Oduzimaju se kao jedan član, da se ne bi desilo da se jedan
  // primijeni dvaput (v. test „c i u_day se ne oduzimaju dvaput").
  const c = finite(input.internalGainC) ?? 0;
  const uDay = finite(input.uDayC) ?? 0;
  const gainTermC = -(c + uDay);

  return {
    ...base,
    flowC: target + slopeTermC + gainTermC,
    internalGainAppliedC: c,
    dayGainAppliedC: uDay,
    terms: {
      targetC: target,
      slopeTermC,
      gainTermC,
    },
    reasons: [],
  };
}
