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
  outputsKw: number[];
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
