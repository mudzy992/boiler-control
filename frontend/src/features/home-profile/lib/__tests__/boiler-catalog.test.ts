import { describe, expect, it } from 'vitest';
import {
  catalogGroups,
  familyLabel,
  isKnownFamilyId,
  selectionHint,
  type BoilerCatalog,
  type BoilerCatalogFamily,
} from '../boiler-catalog';

/**
 * Izbor modela u UI-u (`19` §1, `25`). Testira se **tekst i posljedica**, ne
 * izgled: korisnik mora moći razlikovati potvrđen model od nepotvrđenog, a
 * aplikacija ne smije izmisliti raspon koji nema izvor.
 */

function family(
  overrides: Partial<BoilerCatalogFamily> = {},
): BoilerCatalogFamily {
  return {
    id: 'vaillant-ecotec-plus-vuw',
    brand: 'Vaillant',
    family: 'ecoTEC plus',
    variant: 'VUW',
    outputsKw: [20, 24, 30],
    dhw: 'COMBI',
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

describe('familyLabel', () => {
  it('spaja marku, porodicu i varijantu sa rasponom', () => {
    expect(familyLabel(family())).toBe(
      'Vaillant ecoTEC plus VUW · 30–80 °C',
    );
  });

  it('ne izmišlja raspon kad ga nema', () => {
    const label = familyLabel(
      family({
        id: 'vaillant-ecotec-pro',
        family: 'ecoTEC pro',
        variant: '',
        specStatus: 'TO_VERIFY',
        flowAdviceAllowed: false,
        heatingFlowMinC: null,
        heatingFlowMaxC: null,
      }),
    );
    expect(label).toBe('Vaillant ecoTEC pro · raspon nije potvrđen');
    expect(label).not.toMatch(/\d/);
  });
});

describe('catalogGroups', () => {
  it('grupiše po marki, u redu iz kataloga', () => {
    const groups = catalogGroups(
      catalog([
        family(),
        family({ id: 'bosch-condens-7000-wp', brand: 'Bosch', family: 'Condens 7000 WP', variant: '' }),
        family({ id: 'vaillant-ecotec-plus-vu', variant: 'VU' }),
      ]),
    );

    expect(groups.map((group) => group.brand)).toEqual(['Vaillant', 'Bosch']);
    expect(groups[0].options.map((option) => option.value)).toEqual([
      'vaillant-ecotec-plus-vuw',
      'vaillant-ecotec-plus-vu',
    ]);
  });

  it('nepotvrđen model nosi natuknicu zašto nema savjeta', () => {
    const [group] = catalogGroups(
      catalog([family({ flowAdviceAllowed: false })]),
    );
    expect(group.options[0].hint).toMatch(/nije potvrđen/);
  });

  it('potvrđen model nema natuknicu', () => {
    const [group] = catalogGroups(catalog([family()]));
    expect(group.options[0].hint).toBeUndefined();
  });

  it('prazan ili nedostajući katalog daje praznu listu, ne grešku', () => {
    expect(catalogGroups(null)).toEqual([]);
    expect(catalogGroups(undefined)).toEqual([]);
    expect(catalogGroups(catalog([]))).toEqual([]);
  });
});

describe('selectionHint', () => {
  const families = [
    family(),
    family({
      id: 'vaillant-ecotec-pro',
      flowAdviceAllowed: false,
      specStatus: 'TO_VERIFY',
    }),
  ];

  it('bez odabira kaže da nema savjeta o snižavanju', () => {
    expect(selectionHint(families, '')).toMatch(/ne savjetuje snižavanje/);
    expect(selectionHint(families, null)).toMatch(/ne savjetuje snižavanje/);
  });

  it('nepotvrđen model objašnjava zašto nema savjeta', () => {
    expect(selectionHint(families, 'vaillant-ecotec-pro')).toMatch(
      /nije potvrđeno/,
    );
  });

  it('potvrđen model kaže da je snižavanje bezbjedno', () => {
    expect(selectionHint(families, 'vaillant-ecotec-plus-vuw')).toMatch(
      /bezbjedno/,
    );
  });

  it('nepoznat id se tretira kao „nema modela"', () => {
    expect(selectionHint(families, 'nesto-sto-ne-postoji')).toMatch(
      /ne savjetuje snižavanje/,
    );
  });
});

describe('isKnownFamilyId', () => {
  const families = [family()];

  it('prepoznaje zapis iz kataloga', () => {
    expect(isKnownFamilyId(families, 'vaillant-ecotec-plus-vuw')).toBe(true);
  });

  it('odbija prazno, nepoznato i nedostajući katalog', () => {
    expect(isKnownFamilyId(families, '')).toBe(false);
    expect(isKnownFamilyId(families, null)).toBe(false);
    expect(isKnownFamilyId(families, 'vaillant-ecotec-pro')).toBe(false);
    expect(isKnownFamilyId(null, 'vaillant-ecotec-plus-vuw')).toBe(false);
  });
});
