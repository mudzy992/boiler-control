import {
  boilerSelectionError,
  brandChoices,
  brandOfFamily,
  catalogBrands,
  familiesForBrand,
  familyChoices,
  familyLabel,
  isKnownFamilyId,
  outputChoices,
  outputOptions,
  selectionHint,
  type BoilerCatalog,
  type BoilerCatalogFamily,
} from '../boilerCatalog';

/**
 * Katalog u mobilnoj formi (`25` §5.1).
 *
 * Testira se **posljedica** odabira, ne izgled: koje opcije korisnik dobija,
 * šta piše kad model nije potvrđen, i da li se odbija kombinacija porodica ×
 * snaga koja ne postoji. Ista pravila kao na webu — dvije aplikacije ne smiju
 * davati različite savjete za isti dom.
 */

function family(
  overrides: Partial<BoilerCatalogFamily> = {},
): BoilerCatalogFamily {
  return {
    id: 'vaillant-ecotec-pro-vuw',
    brand: 'Vaillant',
    family: 'ecoTEC pro',
    variant: 'VUW 246/5-3',
    outputsKw: [24, 28, 30],
    dhw: 'INSTANT',
    specStatus: 'VERIFIED_MANUAL',
    separateHeatingDhwSettings: true,
    flowAdviceAllowed: true,
    heatingFlowMinC: 30,
    heatingFlowMaxC: 80,
    notes: null,
    ...overrides,
  };
}

function catalog(families: BoilerCatalogFamily[]): BoilerCatalog {
  return { version: 1, envelope: { minC: 30, maxC: 55 }, families };
}

const cat = catalog([
  family(),
  family({
    id: 'bosch-gaz-6000-w',
    brand: 'Bosch',
    family: 'Gaz 6000 W',
    variant: 'kombi',
    outputsKw: null,
    specStatus: 'TO_VERIFY',
    separateHeatingDhwSettings: null,
    flowAdviceAllowed: false,
    heatingFlowMinC: null,
    heatingFlowMaxC: null,
  }),
]);

describe('koraci odabira', () => {
  it('prvi korak nudi marke bez ponavljanja i praznu opciju', () => {
    expect(brandChoices(cat, 'Nije odabrano')).toEqual([
      { value: '', label: 'Nije odabrano' },
      { value: 'Vaillant', label: 'Vaillant' },
      { value: 'Bosch', label: 'Bosch' },
    ]);
    expect(catalogBrands(null)).toEqual([]);
  });

  it('drugi korak nudi samo porodice odabrane marke', () => {
    const choices = familyChoices(cat, 'Bosch', 'Nije odabrano');
    expect(choices).toHaveLength(2);
    expect(choices[1].value).toBe('bosch-gaz-6000-w');
    expect(familiesForBrand(cat, '')).toEqual([]);
  });

  it('treći korak nudi snage porodice, a za nepotvrđenu ih nema', () => {
    expect(outputChoices(cat, 'vaillant-ecotec-pro-vuw', 'Nije odabrano')).toEqual(
      [
        { value: '', label: 'Nije odabrano' },
        { value: '24', label: '24 kW' },
        { value: '28', label: '28 kW' },
        { value: '30', label: '30 kW' },
      ],
    );
    // Nepotvrđena porodica: nema spiska, pa se polje i ne prikazuje.
    expect(outputChoices(cat, 'bosch-gaz-6000-w', 'Nije odabrano')).toEqual([]);
    expect(outputOptions(cat, 'bosch-gaz-6000-w')).toBeNull();
  });

  it('marka se izvodi iz sačuvanog modela', () => {
    expect(brandOfFamily(cat, 'bosch-gaz-6000-w')).toBe('Bosch');
    expect(brandOfFamily(cat, 'nepostoji')).toBe('');
  });
});

describe('familyLabel', () => {
  it('prikazuje raspon samo kad je potvrđen', () => {
    expect(familyLabel(family())).toBe(
      'Vaillant ecoTEC pro VUW 246/5-3 · 30–80 °C',
    );
    expect(
      familyLabel(
        family({ heatingFlowMinC: null, heatingFlowMaxC: null }),
      ),
    ).toContain('raspon nije potvrđen');
  });
});

describe('selectionHint', () => {
  it('objašnjava zašto nema savjeta kad model nije potvrđen', () => {
    expect(selectionHint(cat, 'bosch-gaz-6000-w')).toMatch(/nije potvrđeno/);
  });

  it('bez odabira kaže da se polazna ne snižava', () => {
    expect(selectionHint(cat, '')).toMatch(/ne savjetuje snižavanje/);
  });

  it('potvrđen model kaže da je snižavanje bezbjedno', () => {
    expect(selectionHint(cat, 'vaillant-ecotec-pro-vuw')).toMatch(/bezbjedno/);
  });

  it('prepoznaje zapis iz kataloga', () => {
    expect(isKnownFamilyId(cat, 'vaillant-ecotec-pro-vuw')).toBe(true);
    expect(isKnownFamilyId(cat, 'nepostoji')).toBe(false);
    expect(isKnownFamilyId(null, 'vaillant-ecotec-pro-vuw')).toBe(false);
  });
});

describe('boilerSelectionError — porodica × snaga', () => {
  it('prihvata snagu iz kataloga', () => {
    expect(
      boilerSelectionError(cat, 'vaillant-ecotec-pro-vuw', 24),
    ).toBeNull();
  });

  it('traži snagu kad je porodica navodi, a nije odabrana', () => {
    // „Nije odabrano" ne smije proći kao da snaga nije poznata.
    expect(boilerSelectionError(cat, 'vaillant-ecotec-pro-vuw', null)).toMatch(
      /Odaberi snagu/,
    );
  });

  it('odbija snagu koje nema u katalogu i navodi dozvoljene', () => {
    const message = boilerSelectionError(cat, 'vaillant-ecotec-pro-vuw', 35);
    expect(message).toContain('35');
    expect(message).toContain('24, 28, 30');
  });

  it('odbija snagu uz nepotvrđenu porodicu', () => {
    expect(boilerSelectionError(cat, 'bosch-gaz-6000-w', 20)).toMatch(
      /nema potvrđene snage/,
    );
  });

  it('profil bez kotla prolazi samo bez snage', () => {
    expect(boilerSelectionError(cat, '', null)).toBeNull();
    expect(boilerSelectionError(cat, '', 24)).toMatch(/bez odabranog modela/);
  });

  it('kad katalog nije učitan ne tvrdi ništa o snazi', () => {
    // Katalog može pasti (mreža); tada forma ne smije izmišljati grešku.
    expect(boilerSelectionError(null, 'vaillant-ecotec-pro-vuw', 24)).toBeNull();
  });
});
