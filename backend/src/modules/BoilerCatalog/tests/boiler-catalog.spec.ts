import {
  BOILER_CATALOG_ISSUES,
  BOILER_CATALOG_OK,
  BOILER_FAMILIES,
  BOILER_FAMILY_IDS,
  ENVELOPE_MAX_C,
  ENVELOPE_MIN_C,
  catalogIssues,
  effectiveCeilingC,
  findBoilerFamily,
  isFlowAdviceAllowed,
  type BoilerFamily,
} from '../boiler-catalog';

/**
 * Katalog je sigurnosni podatak, ne lista želja: iz njega se odlučuje smije li
 * se polazna uopšte snižavati. Testovi zato provjeravaju **kada pravilo kaže
 * ne**, a ne samo da zapisi postoje.
 */

describe('katalog — integritet', () => {
  it('učitan katalog prolazi sve provjere', () => {
    expect(BOILER_CATALOG_ISSUES).toEqual([]);
    expect(BOILER_CATALOG_OK).toBe(true);
  });

  it('ima zapise za Vaillant i Bosch i jedinstvene id-eve', () => {
    const brands = new Set(BOILER_FAMILIES.map((family) => family.brand));
    expect(brands.has('Vaillant')).toBe(true);
    expect(brands.has('Bosch')).toBe(true);
    expect(new Set(BOILER_FAMILY_IDS).size).toBe(BOILER_FAMILY_IDS.length);
  });

  it('potvrđeni zapisi imaju izvor i brojeve, nepotvrđeni nemaju brojeve', () => {
    for (const family of BOILER_FAMILIES) {
      if (family.specStatus === 'VERIFIED_MANUAL') {
        expect(family.source).not.toBeNull();
        expect(family.heatingFlowMinC).not.toBeNull();
        expect(family.heatingFlowMaxC).not.toBeNull();
      }
      if (family.specStatus === 'TO_VERIFY') {
        expect(family.heatingFlowMinC).toBeNull();
        expect(family.heatingFlowMaxC).toBeNull();
        expect(family.dhwTempMinC).toBeNull();
        expect(family.dhwTempMaxC).toBeNull();
      }
    }
  });

  it('pokvaren katalog se prepoznaje, a ne prećutkuje', () => {
    const broken: BoilerFamily = {
      ...BOILER_FAMILIES[0],
      id: 'test',
      specStatus: 'TO_VERIFY',
      heatingFlowMaxC: 80,
    };
    expect(catalogIssues([broken]).join('; ')).toMatch(
      /nepotvrđen, a ima brojeve/,
    );

    const duplicated = [BOILER_FAMILIES[0], BOILER_FAMILIES[0]];
    expect(catalogIssues(duplicated).join('; ')).toMatch(/duplikat/);
  });
});

describe('katalog — pravilo o snižavanju', () => {
  it('potvrđen model sa odvojenim krugovima dozvoljava savjet', () => {
    const family = findBoilerFamily('vaillant-ecotec-plus-vuw');
    expect(family?.specStatus).toBe('VERIFIED_MANUAL');
    expect(family?.separateHeatingDhwSettings).toBe(true);
    expect(isFlowAdviceAllowed(family)).toBe(true);
  });

  it('nepotvrđen model ne dozvoljava savjet — iako je u katalogu', () => {
    // `vaillant-ecotec-pro` je do 2026-11-18 bio ovdje kao TO_VERIFY; tada je
    // iz priručnika potvrđen i sada je `vaillant-ecotec-pro-vuw`. Za primjer
    // nepotvrđenog zapisa koristi se drugi model iz iste marke.
    const family = findBoilerFamily('vaillant-ecotec-exclusive');
    expect(family).not.toBeNull();
    expect(isFlowAdviceAllowed(family)).toBe(false);
  });

  it('ecoTEC pro VUW je potvrđen i dozvoljava savjet (unos korisnika 2026-11-18)', () => {
    // Korisnik ima VUW 246/5-3, a modela nije bilo u katalogu. Zapis je dodat
    // iz priručnika; bez ovog testa bi sljedeća izmjena kataloga mogla tiho
    // vratiti model u „nepotvrđeno" i ukinuti savjetovanje za tu kuću.
    const family = findBoilerFamily('vaillant-ecotec-pro-vuw');
    expect(family?.specStatus).toBe('VERIFIED_MANUAL');
    expect(family?.outputsKw).toEqual([24, 28, 30]);
    expect(family?.heatingFlowMinC).toBe(30);
    expect(family?.heatingFlowMaxC).toBe(80);
    expect(family?.separateHeatingDhwSettings).toBe(true);
    expect(isFlowAdviceAllowed(family)).toBe(true);
  });

  it('nepoznat i prazan model ne dozvoljavaju savjet', () => {
    expect(isFlowAdviceAllowed(findBoilerFamily('nepostoji'))).toBe(false);
    expect(isFlowAdviceAllowed(findBoilerFamily(null))).toBe(false);
    expect(isFlowAdviceAllowed(null)).toBe(false);
  });

  it('potvrđen model bez odvojenih krugova ne dozvoljava savjet', () => {
    const family = {
      ...BOILER_FAMILIES[0],
      separateHeatingDhwSettings: false,
    };
    expect(isFlowAdviceAllowed(family)).toBe(false);

    const unknown = {
      ...BOILER_FAMILIES[0],
      separateHeatingDhwSettings: null,
    };
    expect(isFlowAdviceAllowed(unknown)).toBe(false);
  });
});

describe('katalog — gornja granica', () => {
  it('bez profila i bez modela granica je raspon proizvoda', () => {
    expect(effectiveCeilingC({})).toBe(ENVELOPE_MAX_C);
    expect(effectiveCeilingC({ systemMaxC: null, family: null })).toBe(55);
    expect(ENVELOPE_MIN_C).toBe(30);
  });

  it('profil sužava granicu', () => {
    expect(effectiveCeilingC({ systemMaxC: 40 })).toBe(40);
  });

  it('model sužava granicu kad je niži od profila', () => {
    const family = {
      ...BOILER_FAMILIES[0],
      heatingFlowMaxC: 45,
    };
    expect(effectiveCeilingC({ systemMaxC: null, family })).toBe(45);
    expect(effectiveCeilingC({ systemMaxC: 40, family })).toBe(40);
  });

  it('nijedan ulaz ne može proširiti raspon preko 55', () => {
    const family = {
      ...BOILER_FAMILIES[0],
      heatingFlowMaxC: 80,
    };
    expect(effectiveCeilingC({ systemMaxC: 70, family })).toBe(ENVELOPE_MAX_C);
  });
});
