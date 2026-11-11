/**
 * FE2-14 (FE-010): granice temperature polaznog voda.
 *
 * **F13 ih je promijenio.** Do tada je DTO nosio `@Min(48)`, a motor je
 * predlagao npr. 46 °C — korisnik je dobijao broj koji aplikacija odbija. Sada
 * DTO nosi **apsolutni** raspon (`@Min(30)`, `@Max(55)`), a stvarni raspon je
 * **po domu** (`HomeProfile.minHeatingFlowC/maxHeatingFlowC`, zadano 46–55) i
 * čita se sa `GET /api/boiler/flow-range`.
 *
 * Zato ove konstante više nisu „ista granica koju backend provjerava" — one su
 * **rezerva** dok odgovor servera ne stigne. Isto pravilo kao u mobilnoj
 * aplikaciji (`mobile/src/constants/boilerLimits.ts`), namjerno, jer dva
 * klijenta koja različito odlučuju o istoj vrijednosti daju korisniku
 * protivrječne poruke.
 *
 * Prije ove datoteke vrijednosti su bile duplirane u `BoilerPage.tsx:16-17` i
 * `DashboardPage.tsx:183-184` (a treća kopija postoji u
 * `mobile/src/screens/dashboard/DashboardScreen.tsx:32-33`), pa je promjena
 * granice značila tri usklađivanja i rizik da web tiho odbija ono što backend
 * prihvata.
 *
 * VAŽNO — česta zabuna: broj 46 koji se pojavljuje u
 * `backend/src/modules/Heating/strategies/base.strategy.ts:25`
 * (`Math.max(46, Math.min(55, finalTemp))`) NIJE ova granica. To je clamp
 * *izlaza preporuke*, dok je 48-55 ograničenje *korisničkog unosa*. Nalaz FE-010
 * je te dvije veličine poistovjetio i zaključio da je dio raspona nedostižan iz
 * weba; provjerom DTO-a utvrđeno je da se web i backend tačno poklapaju.
 */
/*
 * F13 (treći krug): rezerva je **46**, ne 48.
 *
 * Motor klampa izlaz na 46–55 (`backend/src/modules/Heating/strategies/
 * base.strategy.ts`), pa je zadana granica 48 odbijala predlog od 47,7 °C.
 * Rezerva mora biti ista kao donja granica motora — isto pravilo kao u
 * `mobile/src/constants/boilerLimits.ts`.
 */
export const MIN_CURRENT_FLOW_TEMP = 46;
export const MAX_CURRENT_FLOW_TEMP = 55;

/** Apsolutne granice iz DTO-a — važe bez obzira na dom. */
export const ABSOLUTE_MIN_FLOW_TEMP = 30;
export const ABSOLUTE_MAX_FLOW_TEMP = 55;

export type FlowRangeSource = "HOME" | "BOILER" | "SYSTEM";

export interface FlowRange {
  min: number;
  max: number;
  /**
   * `HOME` = granicu daje dom (ručni unos), `BOILER` = potvrđeni pod iz
   * kataloga za taj tip bojlera, `SYSTEM` = važi zadani raspon.
   *
   * Šesti krug: granica je **podatak po tipu bojlera**, pa ekran mora znati
   * odakle broj dolazi — inače bi korisnik mislio da je 30 °C njegov podatak.
   */
  source: FlowRangeSource;
}

export const DEFAULT_FLOW_RANGE: FlowRange = {
  min: MIN_CURRENT_FLOW_TEMP,
  max: MAX_CURRENT_FLOW_TEMP,
  source: "SYSTEM",
};

/**
 * Pretvara odgovor `GET /api/boiler/flow-range` u raspon za validaciju.
 *
 * Neispravan odgovor se **ne** prihvata djelimično: ako granice nisu brojevi
 * unutar apsolutnog raspona ili je `min > max`, vraća se rezervni raspon.
 * Djelimično prihvatanje bi dalo formu koja pušta 30 °C na jednom mjestu, a
 * odbija ga na drugom.
 */
export function resolveFlowRange(raw: unknown): FlowRange {
  const candidate = raw as Partial<FlowRange> | null | undefined;
  const min = candidate?.min;
  const max = candidate?.max;

  const valid =
    typeof min === "number" &&
    typeof max === "number" &&
    Number.isFinite(min) &&
    Number.isFinite(max) &&
    min >= ABSOLUTE_MIN_FLOW_TEMP &&
    max <= ABSOLUTE_MAX_FLOW_TEMP &&
    min <= max;

  if (!valid) return DEFAULT_FLOW_RANGE;

  const source: FlowRangeSource =
    candidate?.source === "HOME"
      ? "HOME"
      : candidate?.source === "BOILER"
        ? "BOILER"
        : "SYSTEM";

  return { min, max, source };
}

/**
 * Poruka validacije, na jednom mjestu umjesto tri interpolirane kopije.
 */
export function flowTempRangeMessage(
  range: FlowRange = DEFAULT_FLOW_RANGE,
): string {
  return `Temperature must be between ${range.min}°C and ${range.max}°C`;
}

/**
 * Jedinstvena provjera granice. Vraća `true` kada je vrijednost prihvatljiva.
 *
 * Namjerno je izdvojena kao funkcija: backend `class-validator` odbacuje
 * vrijednosti izvan [48, 55], pa klijent mora koristiti ISTU usporedbu da ne bi
 * propustio zahtjev koji server odbija (ili obrnuto).
 */
export function isWithinFlowTempRange(
  value: number,
  range: FlowRange = DEFAULT_FLOW_RANGE,
): boolean {
  return Number.isFinite(value) && value >= range.min && value <= range.max;
}

export type FlowTempValidation =
  | { ok: true; value: number }
  | { ok: false; reason: "required" | "outOfRange" };

/**
 * Zaokruži na jednu decimalu (ugovor API-ja i UI-ja), pa provjeri raspon doma.
 *
 * Raspon je parametar jer granica zavisi od doma; bez njega važi rezervni
 * 48–55, isto kao prije `F13`.
 */
export function validateFlowTempInput(
  value: number | null | undefined,
  range: FlowRange = DEFAULT_FLOW_RANGE,
): FlowTempValidation {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return { ok: false, reason: "required" };
  }
  const normalized = Number(value.toFixed(1));
  if (!isWithinFlowTempRange(normalized, range)) {
    return { ok: false, reason: "outOfRange" };
  }
  return { ok: true, value: normalized };
}
