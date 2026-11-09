/**
 * Katalog bojlera u mobilnoj formi (`19` §1, `25` §5.1).
 *
 * Isti posao kao `frontend/src/features/home-profile/lib/boiler-catalog.ts`, i
 * namjerno **ista pravila**: ako web i mobilna aplikacija različito tumače
 * katalog, dvije aplikacije istog sistema daju različite savjete za isti dom.
 * Zato su funkcije čiste (katalog → opcije), pa se testiraju bez rendera.
 *
 * Sigurnosni bit koji nosi ovaj fajl: bez porodice iz kataloga aplikacija ne
 * smije savjetovati snižavanje polazne, jer se iz naziva modela ne može znati
 * jesu li grijanje i PTV odvojeni.
 */

export type BoilerSpecStatus = 'VERIFIED_MANUAL' | 'PARTIAL' | 'TO_VERIFY';

export interface BoilerCatalogFamily {
  id: string;
  brand: string;
  family: string;
  variant: string;
  /** Snage koje proizvođač navodi; `null` = nije potvrđeno. */
  outputsKw: number[] | null;
  dhw: string;
  specStatus: BoilerSpecStatus;
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

export interface CatalogChoice {
  value: string;
  label: string;
}

/** Marke iz kataloga, u redu kako dolaze. */
export function catalogBrands(
  catalog: BoilerCatalog | null | undefined,
): string[] {
  if (!catalog?.families?.length) return [];
  return [...new Set(catalog.families.map((family) => family.brand))];
}

/** Opcije za prvi korak; prazna vrijednost znači „nije odabrano". */
export function brandChoices(
  catalog: BoilerCatalog | null | undefined,
  noneLabel: string,
): CatalogChoice[] {
  return [
    { value: '', label: noneLabel },
    ...catalogBrands(catalog).map((brand) => ({ value: brand, label: brand })),
  ];
}

/** Porodice jedne marke; bez marke nema opcija. */
export function familiesForBrand(
  catalog: BoilerCatalog | null | undefined,
  brand: string | null | undefined,
): BoilerCatalogFamily[] {
  if (!catalog?.families?.length || !brand) return [];
  return catalog.families.filter((family) => family.brand === brand);
}

/** Natpis porodice: marka, porodica, varijanta i raspon — samo ako je potvrđen. */
export function familyLabel(family: BoilerCatalogFamily): string {
  const name = [family.brand, family.family, family.variant]
    .map((part) => (part ?? '').trim())
    .filter((part) => part.length > 0)
    .join(' ');

  const range =
    family.heatingFlowMinC != null && family.heatingFlowMaxC != null
      ? `${family.heatingFlowMinC}–${family.heatingFlowMaxC} °C`
      : 'raspon nije potvrđen';

  return `${name} · ${range}`;
}

/** Opcije za drugi korak. */
export function familyChoices(
  catalog: BoilerCatalog | null | undefined,
  brand: string | null | undefined,
  noneLabel: string,
): CatalogChoice[] {
  return [
    { value: '', label: noneLabel },
    ...familiesForBrand(catalog, brand).map((family) => ({
      value: family.id,
      label: familyLabel(family),
    })),
  ];
}

/**
 * Snage za odabranu porodicu; `null` kad ih porodica ne navodi.
 *
 * `null` i prazan niz se namjerno ne stapaju: prvo znači „nema podatka, polje
 * se ne prikazuje", drugo bi značilo „postoji spisak, ali je prazan".
 */
export function outputOptions(
  catalog: BoilerCatalog | null | undefined,
  familyId: string | null | undefined,
): number[] | null {
  const family = catalog?.families?.find(
    (candidate) => candidate.id === familyId,
  );
  if (!family) return null;
  if (!Array.isArray(family.outputsKw) || family.outputsKw.length === 0) {
    return null;
  }
  return family.outputsKw;
}

/** Opcije za treći korak (snaga); bez porodice nema opcija. */
export function outputChoices(
  catalog: BoilerCatalog | null | undefined,
  familyId: string | null | undefined,
  noneLabel: string,
): CatalogChoice[] {
  const powers = outputOptions(catalog, familyId);
  if (!powers) return [];
  return [
    { value: '', label: noneLabel },
    ...powers.map((power) => ({ value: String(power), label: `${power} kW` })),
  ];
}

/** Marka za sačuvani model — da forma otvori ispravan korak. */
export function brandOfFamily(
  catalog: BoilerCatalog | null | undefined,
  familyId: string | null | undefined,
): string {
  const family = catalog?.families?.find(
    (candidate) => candidate.id === familyId,
  );
  return family?.brand ?? '';
}

/**
 * Posljedica odabira, u tri stanja — ista tri kao na webu.
 *
 * Ovo nije natuknica za ljepši prikaz: korisnik mora znati **zašto** za njegov
 * model nema savjeta, inače izgleda kao da aplikacija ne radi.
 */
export function selectionHint(
  catalog: BoilerCatalog | null | undefined,
  familyId: string | null | undefined,
): string {
  const family = catalog?.families?.find(
    (candidate) => candidate.id === familyId,
  );
  if (!family) {
    return 'Bez odabranog modela aplikacija ne savjetuje snižavanje polazne — samo je podiže ako je hladno.';
  }
  if (!family.flowAdviceAllowed) {
    return 'Za ovaj model nije potvrđeno da su grijanje i topla voda odvojena podešavanja, pa aplikacija ne savjetuje snižavanje.';
  }
  return 'Model potvrđen: grijanje i topla voda su odvojena podešavanja, pa je snižavanje polazne bezbjedno.';
}

/** Da li je sačuvani id još u katalogu. */
export function isKnownFamilyId(
  catalog: BoilerCatalog | null | undefined,
  familyId: string | null | undefined,
): boolean {
  if (!familyId) return false;
  return Boolean(catalog?.families?.some((family) => family.id === familyId));
}

/**
 * Greška za nepotpun odabir kotla, ili `null`.
 *
 * Pravilo je isto kao na backendu (`HomeProfileService.validateBoilerSelection`):
 * porodica koja navodi snage traži snagu, a snaga mora biti jedna od ponuđenih.
 * Ne provjerava se na serveru samo zato što je poruka tu korisniju — server
 * odbija isto, i to ostaje jedina prava brana.
 */
export function boilerSelectionError(
  catalog: BoilerCatalog | null | undefined,
  familyId: string | null | undefined,
  outputKw: number | null | undefined,
): string | null {
  if (!familyId) {
    return outputKw != null
      ? 'Snaga bez odabranog modela ne opisuje nijedan uređaj.'
      : null;
  }

  const family = catalog?.families?.find(
    (candidate) => candidate.id === familyId,
  );
  if (!family) {
    // Katalog se nije učitao ili je model povučen: ne tvrdi se ništa o snazi.
    return null;
  }

  const powers = outputOptions(catalog, familyId);
  if (!powers) {
    return outputKw != null
      ? `${familyLabel(family)} nema potvrđene snage u katalogu — snaga se ne upisuje.`
      : null;
  }

  if (outputKw == null) {
    return `Odaberi snagu za ${family.brand} ${family.family}: ${powers.join(', ')} kW.`;
  }
  if (!powers.includes(outputKw)) {
    return `Snaga ${outputKw} kW nije u katalogu; dozvoljeno: ${powers.join(', ')} kW.`;
  }
  return null;
}
