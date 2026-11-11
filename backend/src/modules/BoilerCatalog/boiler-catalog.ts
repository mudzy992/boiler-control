import catalogJson from './catalog.json';

/**
 * Katalog poznatih bojlera (`19`, odluka vlasnika 2026-11-08).
 *
 * Katalog postoji zbog **jednog sigurnosnog pitanja**: smije li se polazna
 * grijanja snižavati a da se pritom ne dira PTV? Ako krugovi nijesu potvrđeno
 * odvojeni, snižavanje se ne savjetuje — bez obzira na to koliko bi uštede
 * donijelo.
 *
 * Zato ovaj modul nije „lista modela" nego **ulaz u pravilo**:
 *
 * - `isFlowAdviceAllowed` je `true` samo za model potvrđen iz priručnika
 *   **i** sa odvojenim podešavanjima grijanja i PTV-a;
 * - `effectiveCeilingC` nikad ne prelazi 55 — katalog sužava raspon, ne širi ga;
 * - ako katalog ne prođe provjeru, **nijedan** model se ne smatra potvrđenim i
 *   savjetovanje snižavanja prestaje. Pokvaren katalog ne smije značiti „sve
 *   je dozvoljeno".
 *
 * Vrijednosti koje nijesu iz priručnika su `null`, a `specStatus` to kaže —
 * ništa se ne popunjava nagađanjem.
 */

export type DhwKind =
  | 'INSTANT'
  | 'INTEGRATED_CYLINDER'
  | 'EXTERNAL_CYLINDER'
  | 'NONE';

export type BoilerSpecStatus = 'VERIFIED_MANUAL' | 'PARTIAL' | 'TO_VERIFY';

export interface BoilerFamily {
  id: string;
  brand: string;
  family: string;
  variant: string;
  outputsKw: readonly number[] | null;
  dhw: DhwKind;
  heatingFlowMinC: number | null;
  heatingFlowMaxC: number | null;
  heatingFlowFactoryC: number | null;
  heatingFlowLimitParam: string | null;
  dhwTempMinC: number | null;
  dhwTempMaxC: number | null;
  /** `true` = grijanje i PTV su odvojena podešavanja (sigurno za optimizaciju). */
  separateHeatingDhwSettings: boolean | null;
  condensing: boolean | null;
  modulationMinKw: number | null;
  underfloorMaxFlowC: number | null;
  specStatus: BoilerSpecStatus;
  source: string | null;
  notes: string | null;
}

const DHW_KINDS: readonly DhwKind[] = [
  'INSTANT',
  'INTEGRATED_CYLINDER',
  'EXTERNAL_CYLINDER',
  'NONE',
];
const SPEC_STATUSES: readonly BoilerSpecStatus[] = [
  'VERIFIED_MANUAL',
  'PARTIAL',
  'TO_VERIFY',
];

/** Raspon proizvoda, odluka vlasnika. Katalog ga ne mijenja (`19` §2). */
export const ENVELOPE_MIN_C = 30;
export const ENVELOPE_MAX_C = 55;

type RawFamily = Record<string, unknown>;

function asNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asBooleanOrNull(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Provjera integriteta. Vraća razloge; prazan spisak znači ispravan katalog.
 * Ista pravila kao `scripts/audit/boiler_catalog_check.py`, ali u runtime-u —
 * skripta je gate u CI-u, ovo je odbrana u aplikaciji.
 */
export function catalogIssues(
  families: readonly BoilerFamily[],
): string[] {
  const issues: string[] = [];
  const seen = new Set<string>();

  for (const family of families) {
    if (seen.has(family.id)) issues.push(`duplikat id: ${family.id}`);
    seen.add(family.id);

    if (!SPEC_STATUSES.includes(family.specStatus)) {
      issues.push(`${family.id}: nepoznat specStatus`);
    }
    if (!DHW_KINDS.includes(family.dhw)) {
      issues.push(`${family.id}: nepoznat dhw`);
    }
    if (
      family.heatingFlowMinC != null &&
      family.heatingFlowMaxC != null &&
      family.heatingFlowMinC >= family.heatingFlowMaxC
    ) {
      issues.push(`${family.id}: min polazne nije manji od max`);
    }
    if (family.specStatus === 'VERIFIED_MANUAL') {
      if (family.source == null) issues.push(`${family.id}: potvrđen bez izvora`);
      if (family.heatingFlowMinC == null || family.heatingFlowMaxC == null) {
        issues.push(`${family.id}: potvrđen bez brojeva polazne`);
      }
    }
    if (family.specStatus === 'TO_VERIFY') {
      // Nepotvrđen model ne smije nositi brojeve: oni bi izgledali kao dokaz.
      if (
        family.heatingFlowMinC != null ||
        family.heatingFlowMaxC != null ||
        family.heatingFlowFactoryC != null ||
        family.dhwTempMinC != null ||
        family.dhwTempMaxC != null
      ) {
        issues.push(`${family.id}: nepotvrđen, a ima brojeve`);
      }
    }
  }

  return issues;
}

function normalise(raw: RawFamily, brand: string): BoilerFamily {
  return {
    id: String(raw.id),
    brand,
    family: String(raw.family ?? ''),
    variant: String(raw.variant ?? ''),
    outputsKw: Array.isArray(raw.outputsKw)
      ? (raw.outputsKw as number[])
      : null,
    dhw: raw.dhw as DhwKind,
    heatingFlowMinC: asNumberOrNull(raw.heatingFlowMinC),
    heatingFlowMaxC: asNumberOrNull(raw.heatingFlowMaxC),
    heatingFlowFactoryC: asNumberOrNull(raw.heatingFlowFactoryC),
    heatingFlowLimitParam: asStringOrNull(raw.heatingFlowLimitParam),
    dhwTempMinC: asNumberOrNull(raw.dhwTempMinC),
    dhwTempMaxC: asNumberOrNull(raw.dhwTempMaxC),
    separateHeatingDhwSettings: asBooleanOrNull(
      raw.separateHeatingDhwSettings,
    ),
    condensing: asBooleanOrNull(raw.condensing),
    modulationMinKw: asNumberOrNull(raw.modulationMinKw),
    underfloorMaxFlowC: asNumberOrNull(raw.underfloorMaxFlowC),
    specStatus: raw.specStatus as BoilerSpecStatus,
    source: asStringOrNull(raw.source),
    notes: asStringOrNull(raw.notes),
  };
}

function loadFamilies(): readonly BoilerFamily[] {
  const raw = catalogJson as unknown as {
    brands?: Array<{ brand?: string; families?: RawFamily[] }>;
  };
  const families: BoilerFamily[] = [];
  for (const brand of raw.brands ?? []) {
    for (const family of brand.families ?? []) {
      families.push(normalise(family, String(brand.brand ?? '')));
    }
  }
  return families;
}

const LOADED = loadFamilies();
const ISSUES = catalogIssues(LOADED);

/**
 * Katalog je pokvaren ako ijedna provjera padne. Tada se **nijedan** model ne
 * smatra potvrđenim — pogrešan katalog mora dati manje savjeta, nikad više.
 */
export const BOILER_CATALOG_OK = ISSUES.length === 0;
export const BOILER_CATALOG_ISSUES: readonly string[] = ISSUES;

export const BOILER_FAMILIES: readonly BoilerFamily[] = BOILER_CATALOG_OK
  ? LOADED
  : [];

export const BOILER_FAMILY_IDS: readonly string[] = BOILER_FAMILIES.map(
  (family) => family.id,
);

export function findBoilerFamily(
  id: string | null | undefined,
): BoilerFamily | null {
  if (id == null) return null;
  return BOILER_FAMILIES.find((family) => family.id === id) ?? null;
}

/**
 * Smije li se savjetovati snižavanje polazne za ovaj model?
 *
 * `true` samo kad je model **potvrđen iz priručnika** i kad su grijanje i PTV
 * odvojeno podešeni. Sve ostalo — nepoznat model, nepotvrđen model, zajedničko
 * podešavanje — znači `false`, jer bi snižavanje moglo ugroziti PTV.
 */
export function isFlowAdviceAllowed(
  family: BoilerFamily | null | undefined,
): boolean {
  if (family == null) return false;
  if (!BOILER_CATALOG_OK) return false;
  return (
    family.specStatus === 'VERIFIED_MANUAL' &&
    family.separateHeatingDhwSettings === true
  );
}

/**
 * Gornja granica polazne: `min(55, profil, model)` (`19` §2).
 *
 * Nijedan ulaz ne može proširiti raspon proizvoda — samo ga suziti.
 */
export function effectiveCeilingC(input: {
  systemMaxC?: number | null;
  family?: BoilerFamily | null;
}): number {
  const candidates = [
    ENVELOPE_MAX_C,
    input.systemMaxC ?? null,
    input.family?.heatingFlowMaxC ?? null,
  ].filter((value): value is number => value != null && Number.isFinite(value));
  return Math.min(...candidates);
}

/**
 * Donja granica polazne: `max(30, model, profil)` — ogledalo `effectiveCeilingC`.
 *
 * Zašto postoji: do 2026-11-21 donja granica je bila **konstanta 46** u dva
 * mjesta (motor i `flow-range.ts`), pa je dom bez upisanih granica uvijek dobijao
 * 46 — i kad katalog za njegov kotao zna drugi broj. Gornja strana je od početka
 * išla kroz `effectiveCeilingC`; donja nije, i to je bila nedosljednost, ne
 * odluka.
 *
 * Tri pravila, sva tri namjerna:
 *  - **envelope 30** je tvrd pod: i model i profil ga mogu samo podići;
 *  - **model** ulazi samo kad je `VERIFIED_MANUAL` **i** ima broj. `TO_VERIFY` i
 *    `PARTIAL` ne nose brojeve (v. `catalogIssues`), a i da nose — nagađanje ne
 *    smije postati granica koju korisnik ne može zaobići;
 *  - kad model nema potvrđen broj, `null` iz kataloga **ne** gasi granicu —
 *    vraća se `fallbackC`, tj. ono što je važilo prije kataloga (motor 46, ili
 *    ručni unos u `HomeProfile.minHeatingFlowC`).
 *
 * Ova funkcija **ne dira motor**. Motor (`base.strategy.ts`) i dalje klampa izlaz
 * na 46–55; katalog samo kaže koji raspon korisnik smije upisati/prihvatiti.
 */
export function effectiveFloorC(input: {
  systemMinC?: number | null;
  family?: BoilerFamily | null;
  /** Vrijednost kad ni model ni dom ne daju pod. `null` = samo envelope. */
  fallbackC?: number | null;
}): number {
  const familyMin = verifiedFloorOf(input.family);
  const manual = clampToEnvelope(input.systemMinC);
  const fallback = clampToEnvelope(input.fallbackC);

  const candidates = [ENVELOPE_MIN_C, familyMin, manual].filter(
    (value): value is number => value != null,
  );

  /*
   * Ručni unos ima prednost nad katalogom: korisnik zna svoj kotao, a pod iz
   * priručnika je za porodicu, ne za njegov primjerak.
   */
  if (manual != null) return Math.max(...candidates);

  /*
   * Bez ručnog unosa: pod iz kataloga ako je potvrđen, inače dotadašnja granica
   * (motor 46). Ovdje se **ne** koristi `fallback` kad katalog ima pod — inače
   * bi 46 pregazilo potvrđenih 30 i modularnost bi bila samo na papiru.
   */
  return Math.max(ENVELOPE_MIN_C, familyMin ?? fallback ?? ENVELOPE_MIN_C);
}

function clampToEnvelope(
  value: number | null | undefined,
): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.max(ENVELOPE_MIN_C, Math.min(ENVELOPE_MAX_C, value));
}

/**
 * Pod iz kataloga — samo kad je podatak potvrđen iz priručnika.
 *
 * Izdvojeno da `effectiveFloorC` i budući pozivaoci ne moraju ponavljati isti
 * uslov; `specStatus` je jedini dokaz da broj nije izmišljen.
 */
export function verifiedFloorOf(
  family: BoilerFamily | null | undefined,
): number | null {
  if (family == null) return null;
  if (family.specStatus !== 'VERIFIED_MANUAL') return null;
  const value = family.heatingFlowMinC;
  return value != null && Number.isFinite(value) ? value : null;
}

/**
 * Pod iz kataloga, ali **bez obzira na `specStatus`** — za prikaz.
 *
 * Razlika je namjerna: korisnik smije unijeti broj i za model koji nije
 * potvrđen (tada je granica njegov ručni unos, v. `effectiveFloorC`), ali
 * aplikacija mu tada ne smije tvrditi „proizvođač kaže 30".
 */
export function manualFloorOf(
  family: BoilerFamily | null | undefined,
): number | null {
  if (family == null) return null;
  const value = family.heatingFlowMinC;
  return value != null && Number.isFinite(value)
    ? Math.max(ENVELOPE_MIN_C, Math.min(ENVELOPE_MAX_C, value))
    : null;
}
