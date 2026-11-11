/**
 * Katalog bojlera u UI-u (`19` §1, `25`).
 *
 * Zašto zaseban fajl, a ne `map` u komponenti: izbor modela nije kozmetika —
 * on određuje **smije li aplikacija savjetovati snižavanje polazne**. Ako se
 * taj tekst sastavlja unutar JSX-a, ne može se testirati bez rendera, a greška
 * se vidi tek na uređaju. Zato je ovdje čista funkcija: katalog → opcije.
 */

export interface BoilerCatalogFamily {
  id: string;
  brand: string;
  family: string;
  variant: string;
  /** Snage koje proizvođač navodi za ovu porodicu; `null` = nije potvrđeno. */
  outputsKw: number[] | null;
  dhw: string;
  specStatus: 'VERIFIED_MANUAL' | 'PARTIAL' | 'TO_VERIFY';
  separateHeatingDhwSettings: boolean | null;
  flowAdviceAllowed: boolean;
  heatingFlowMinC: number | null;
  heatingFlowMaxC: number | null;
  notes?: string | null;
}

export interface BoilerCatalog {
  version: number;
  envelope: { minC: number; maxC: number };
  families: BoilerCatalogFamily[];
}

export interface BoilerCatalogOption {
  value: string;
  label: string;
  /** Kratko objašnjenje ispod izbora — zašto za ovaj model nema savjeta. */
  hint?: string;
}

export interface BoilerCatalogGroup {
  brand: string;
  options: BoilerCatalogOption[];
}

/** Marke iz kataloga, u redu kako dolaze (`25` §5.1: odabir je trostepen). */
export function catalogBrands(
  catalog: BoilerCatalog | null | undefined,
): string[] {
  if (!catalog?.families?.length) return [];
  return [...new Set(catalog.families.map((family) => family.brand))];
}

/** Porodice jedne marke — drugi korak odabira. */
export function familiesForBrand(
  catalog: BoilerCatalog | null | undefined,
  brand: string | null | undefined,
): BoilerCatalogFamily[] {
  if (!catalog?.families?.length || !brand) return [];
  return catalog.families.filter((family) => family.brand === brand);
}

/**
 * Snage za odabranu porodicu — treći korak odabira.
 *
 * Vraća `null` kad porodica snage **ne navodi** (nepotvrđen model): tada se
 * polje ne prikazuje, jer bi spisak opcija izgledao kao podatak, a nije ga.
 * Vraća niz kad snage postoje; prazan niz znači „nema šta odabrati" i za
 * klijenta je isto što i `null` — ali se ne miješa u tipu, da pozivalac mora
 * svjesno odlučiti šta prikazuje.
 */
export function outputOptions(
  families: BoilerCatalogFamily[] | null | undefined,
  familyId: string | null | undefined,
): number[] | null {
  const family = families?.find((candidate) => candidate.id === familyId);
  if (!family) return null;
  if (!Array.isArray(family.outputsKw) || family.outputsKw.length === 0) {
    return null;
  }
  return family.outputsKw;
}

/** Marka za sačuvani id, da se forma može otvoriti na ispravnom koraku. */
export function brandOfFamily(
  families: BoilerCatalogFamily[] | null | undefined,
  familyId: string | null | undefined,
): string {
  const family = families?.find((candidate) => candidate.id === familyId);
  return family?.brand ?? '';
}

/**
 * Naslov opcije: marka, porodica i varijanta, pa raspon ako je potvrđen.
 *
 * Raspon se **ne izmišlja**: za `TO_VERIFY` zapise stoji „raspon nije
 * potvrđen", jer bi broj napisan ovdje izgledao kao podatak proizvođača.
 */
export function familyLabel(family: BoilerCatalogFamily): string {
  const name = [family.brand, family.family, family.variant]
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(' ');

  const range =
    family.heatingFlowMinC != null && family.heatingFlowMaxC != null
      ? `${family.heatingFlowMinC}–${family.heatingFlowMaxC} °C`
      : 'raspon nije potvrđen';

  return `${name} · ${range}`;
}

/**
 * Grupisanje po marki, redoslijed marki kako dolazi iz kataloga (stabilan,
 * bez sortiranja po abecedi — katalog je uređen namjerno).
 */
export function catalogGroups(
  catalog: BoilerCatalog | null | undefined,
): BoilerCatalogGroup[] {
  if (!catalog?.families?.length) return [];

  const groups: BoilerCatalogGroup[] = [];
  for (const family of catalog.families) {
    let group = groups.find((candidate) => candidate.brand === family.brand);
    if (!group) {
      group = { brand: family.brand, options: [] };
      groups.push(group);
    }
    group.options.push({
      value: family.id,
      label: familyLabel(family),
      hint: family.flowAdviceAllowed
        ? undefined
        : 'Model nije potvrđen iz priručnika — aplikacija ga neće savjetovati snižavati.',
    });
  }
  return groups;
}

/**
 * Natuknica ispod izbora. Tri stanja, svako s posljedicom:
 * - model nije odabran → nema savjeta o snižavanju;
 * - model nije potvrđen → nema savjeta o snižavanju;
 * - model potvrđen → savjet je dozvoljen, ali tek kad ima podataka.
 */
export function selectionHint(
  families: BoilerCatalogFamily[] | null | undefined,
  selectedId: string | null | undefined,
): string {
  const family = families?.find((candidate) => candidate.id === selectedId);
  if (!family) {
    return 'Bez odabranog modela aplikacija ne savjetuje snižavanje polazne — samo je podiže ako je hladno.';
  }
  if (!family.flowAdviceAllowed) {
    return 'Za ovaj model nije potvrđeno da su grijanje i topla voda odvojena podešavanja, pa aplikacija ne savjetuje snižavanje.';
  }
  return 'Model potvrđen: grijanje i topla voda su odvojena podešavanja, pa je snižavanje polazne bezbjedno.';
}

/** Da li je vrijednost iz forme još u katalogu (npr. nakon izmjene kataloga). */
export function isKnownFamilyId(
  families: BoilerCatalogFamily[] | null | undefined,
  value: string | null | undefined,
): boolean {
  if (!value) return false;
  return Boolean(families?.some((family) => family.id === value));
}

/**
 * Pod i tavan polazne za odabrani model — ono što forma smije primiti.
 *
 * Šesti krug (2026-11-21): granica polazne je **podatak po tipu bojlera**, pa se
 * ne smije ponuditi 30 °C za model za koji katalog to ne tvrdi. Ali se ne smije
 * ni zaključati korisnika: kad modela nema u katalogu (ili nije potvrđen), polja
 * ostaju ručno podesiva unutar apsolutnog raspona 30–55.
 *
 * Vraća tri stvari, namjerno odvojene:
 *  - `min`/`max` — šta polje dozvoljava (uvijek unutar 30–55);
 *  - `fromCatalog` — da li broj dolazi iz priručnika (`VERIFIED_MANUAL`);
 *  - `manual` — da li korisnik mora upisati granicu sam.
 */
export interface FlowBoundsForFamily {
  min: number;
  max: number;
  fromCatalog: boolean;
  manual: boolean;
}

export const CATALOG_FLOW_ENVELOPE = { minC: 30, maxC: 55 } as const;

export function flowBoundsForFamily(
  families: BoilerCatalogFamily[] | null | undefined,
  familyId: string | null | undefined,
): FlowBoundsForFamily {
  const { minC, maxC } = CATALOG_FLOW_ENVELOPE;
  const family = families?.find((candidate) => candidate.id === familyId);

  const verified =
    family != null &&
    family.specStatus === 'VERIFIED_MANUAL' &&
    family.heatingFlowMinC != null &&
    family.heatingFlowMaxC != null;

  if (verified) {
    return {
      min: Math.max(minC, family.heatingFlowMinC as number),
      max: Math.min(maxC, family.heatingFlowMaxC as number),
      fromCatalog: true,
      manual: false,
    };
  }

  /*
   * Nepotvrđen model ili model kojeg nema u katalogu: granica je korisnikov
   * ručni unos. Zato se ne nudi 30 kao „pod kotla" — nudi se apsolutni raspon,
   * a tekst objašnjava da broj nije potvrđen.
   */
  return { min: minC, max: maxC, fromCatalog: false, manual: true };
}
