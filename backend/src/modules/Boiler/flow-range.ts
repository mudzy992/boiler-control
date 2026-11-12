import {
  effectiveCeilingC,
  effectiveFloorC,
  findBoilerFamily,
  manualFloorOf,
  verifiedFloorOf,
  type BoilerFamily,
} from '../BoilerCatalog/boiler-catalog';

/**
 * Raspon polazne koji korisnik smije upisati (`F13`, prošireno 2026-11-21).
 *
 * Izdvojeno iz `BoilerService` da bi pravilo bilo **dokazivo bez baze**:
 * granica je po domu, a dom ne smije proširiti apsolutni raspon. Do sada je ovo
 * živjelo unutar servisa, pa se moglo provjeriti samo kroz `PrismaService` —
 * a upravo taj sloj je u sandboxu nedostupan, pa pravilo nije ni bilo pokriveno.
 *
 * Tri broja koja se lako pomiješaju — i koja su se do 2026-11-21 miješala:
 *  - **zadano** — važi kad dom nema svoje granice (motor: 46–55);
 *  - **apsolutno** (30–55) — fizička granica (`DailyRecord/flow-bounds.ts`);
 *    dom je može samo suziti;
 *  - **motor** (46–55, `Heating/strategies/base.strategy.ts`) — clamp izlaza
 *    preporuke.
 *
 * Zadana granica **mora biti granica motora**, i to je popravka trećeg kruga.
 * Prije je zadano bilo 48, a motor je predlagao 47,7 — pa je korisnik vidio
 * vlastiti predlog („Predložena 47.7 °C") i unos te iste vrijednosti je odbijen
 * sa „mora biti između 48 i 55". Ponuda koja se ne može prihvatiti je greška
 * sistema, ne korisnika.
 *
 * **Šesti krug (2026-11-21): granice su podatak, ne konstante.** Isti broj 46
 * važio je za svaki kotao, iako katalog za potvrđene modele navodi stvarni pod
 * (npr. Vaillant ecoTEC: 30 °C). Zato obje strane sada idu kroz katalog:
 *
 *  - gornja → `effectiveCeilingC({ systemMaxC, family })` — `min(55, profil, model)`;
 *  - donja  → `effectiveFloorC({ systemMinC, family, fallbackC })` — `max(30, model, profil)`.
 *
 * Model ulazi u granicu **samo** sa `VERIFIED_MANUAL` brojem (`verifiedFloorOf`).
 * `TO_VERIFY`/`PARTIAL` model nema broj, pa granicu daje `HomeProfile`
 * (`minHeatingFlowC`) ili motor — tj. korisnikov ručni unos, koji ostaje jedini
 * izvor za modele kojih nema u katalogu (`boilerCatalogId == null`).
 *
 * Ovo **ne mijenja formulu ni learning**: `base.strategy.ts` i dalje klampa izlaz
 * na 46–55, a ovdje se samo odlučuje šta korisnik smije upisati i šta smije
 * prihvatiti. Dokaz za to je u `tests/boiler-flow-range.spec.ts`
 * („raspon ne dira motor").
 */
export { SYSTEM_MAX_FLOW_C } from '../Heating/strategies/base.strategy';

// Re-export: `SYSTEM_MIN_FLOW_C` (46) je i dalje granica **motora** i drugi je
// pojam od granice **unosa** (`SYSTEM_MIN_CURRENT_FLOW_TEMP`, F4.8). Ostaje
// dostupan odavde jer su ga potrošači dosad odavde uzimali.
export { SYSTEM_MIN_FLOW_C } from '../Heating/strategies/base.strategy';

/** Apsolutni raspon — dom smije suziti, nikad proširiti. */
export const ABSOLUTE_MIN_FLOW_C = 30;
export const ABSOLUTE_MAX_FLOW_C = 55;

/**
 * Zadana donja granica kad ni dom ni katalog ne daju svoju.
 *
 * **F4.8: to je apsolutni pod, ne pod krive.** Do F4.8 ovdje je stajala granica
 * motora (`SYSTEM_MIN_FLOW_C = 46`, iz `base.strategy.ts`), jer je kriva bila
 * jedini računač. Model daje niže — za tipičnu kuću (s = 0,9, c = 1 K, cilj
 * 22 °C) ravnotežna polazna je:
 *
 * | noć | `F_eq` |
 * |---|---|
 * | +5 °C | **34,7** |
 * | 0 °C | **39,2** |
 * | −5 °C | **43,7** |
 * | −10 °C | 48,2 |
 *
 * Dakle pri noći na +5 °C model traži 34,7, a unos je bio zaključan na 46 —
 * **ponuda koja se ne može prihvatiti** (ista greška kao zadano 48 vs.
 * predlog 47,7 u `F13`). Granica unosa zato prati **fizički** pod (30 °C), a ne
 * pod krive.
 *
 * Zašto ovo ne otvara mogućnost da korisnik upiše prenisko: pod modela i dalje
 * važi (`effectiveFloorC` uzima katalog i profil), a **motor** i dalje klampuje
 * svoj izlaz na 46–55 — dok se kriva koristi, njen izlaz se ne mijenja. Ovo
 * mijenja samo šta korisnik smije **upisati**, i to je razlika koju test u
 * `boiler-flow-range.spec` („raspon ne dira motor") čuva.
 */
export const SYSTEM_MIN_CURRENT_FLOW_TEMP = ABSOLUTE_MIN_FLOW_C;
/** Zadana gornja granica kad dom nema svoju. */
export const SYSTEM_MAX_CURRENT_FLOW_TEMP = 55;
/** Odakle je granica došla — korisniku se to mora moći reći. */
export type FlowRangeSource = 'HOME' | 'BOILER' | 'SYSTEM';

export interface HomeFlowBounds {
  minHeatingFlowC: number | null;
  maxHeatingFlowC: number | null;
}

/**
 * Ulaz za raspon. `boilerCatalogId` je opcion: stariji zapisi i domovi bez
 * odabranog modela ga nemaju, pa se tada ponašanje mora svoditi na `HOME`.
 */
export interface HomeFlowContext extends HomeFlowBounds {
  boilerCatalogId?: string | null;
}

export interface FlowTempRange {
  min: number;
  max: number;
  source: FlowRangeSource;
  /** Potvrđeni pod iz kataloga za taj model, ako ga ima (za objašnjenje). */
  boilerFloorC?: number | null;
  /** Pod koji korisnik može upisati za taj model, i kad nije potvrđen. */
  boilerManualFloorC?: number | null;
}

function familyOf(
  home: HomeFlowContext | null | undefined,
): BoilerFamily | null {
  return findBoilerFamily(home?.boilerCatalogId ?? null);
}

/**
 * Raspon za dom.
 *
 * Redoslijed je namjeran: **katalog**, pa **profil**, pa **motor**. Profil ima
 * prednost nad katalogom jer je korisnikov unos konkretniji od podatka za
 * porodicu (npr. podignuta donja granica zbog loše izolacije) — ali ga katalog
 * i dalje drži unutar svog poda kad je on viši.
 */
export function resolveFlowTempRange(
  home: HomeFlowContext | null | undefined,
): FlowTempRange {
  const family = familyOf(home);
  const verifiedFloor = verifiedFloorOf(family);

  const requestedMin = effectiveFloorC({
    systemMinC: home?.minHeatingFlowC ?? null,
    family,
    fallbackC: SYSTEM_MIN_CURRENT_FLOW_TEMP,
  });
  const requestedMax = effectiveCeilingC({
    systemMaxC: home?.maxHeatingFlowC ?? null,
    family,
  });

  const min = Math.max(ABSOLUTE_MIN_FLOW_C, requestedMin);
  const max = Math.min(ABSOLUTE_MAX_FLOW_C, requestedMax);

  /*
   * Dom koji je sam sebi okrenut naopačke (min > max) nije razlog da se
   * korisnik zaključa: vraća se sigurni sistemski raspon i to je vidljivo kroz
   * `source`. Isto važi i za nesklad katalog × profil (npr. model podiže pod
   * iznad profila gornje granice) — takav zapis se ne popravlja naslijepo.
   */
  if (!(min <= max)) {
    return {
      min: SYSTEM_MIN_CURRENT_FLOW_TEMP,
      max: SYSTEM_MAX_CURRENT_FLOW_TEMP,
      source: 'SYSTEM',
      boilerFloorC: verifiedFloor,
      boilerManualFloorC: manualFloorOf(family),
    };
  }

  return {
    min,
    max,
    source: rangeSource({ home, verifiedFloor, min, max, requestedMin }),
    boilerFloorC: verifiedFloor,
    boilerManualFloorC: manualFloorOf(family),
  };
}

function rangeSource(input: {
  home: HomeFlowContext | null | undefined;
  verifiedFloor: number | null;
  min: number;
  max: number;
  requestedMin: number;
}): FlowRangeSource {
  const { home, verifiedFloor, min, max, requestedMin } = input;

  /*
   * `BOILER` samo kad je granica **stvarno** došla iz kataloga: potvrđen pod
   * postoji i on je taj koji je odredio donju granicu. Ako je dom upisao višu
   * donju granicu, izvor je `HOME` — inače bi aplikacija pripisala korisnikov
   * broj proizvođaču.
   */
  if (
    verifiedFloor != null &&
    requestedMin === verifiedFloor &&
    (home?.minHeatingFlowC == null || home.minHeatingFlowC <= verifiedFloor)
  ) {
    return 'BOILER';
  }

  const homeSetsBounds =
    home?.minHeatingFlowC != null || home?.maxHeatingFlowC != null;
  if (!homeSetsBounds) {
    /*
     * Dom bez granica, ali katalog je ipak suzio makar jednu stranu (npr. samo
     * gornju) — granica je tada opet katalog, ne motor.
     */
    const narrowedByBoiler =
      min !== SYSTEM_MIN_CURRENT_FLOW_TEMP ||
      max !== SYSTEM_MAX_CURRENT_FLOW_TEMP;
    return narrowedByBoiler ? 'BOILER' : 'SYSTEM';
  }
  return 'HOME';
}
