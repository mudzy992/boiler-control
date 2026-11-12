import {
  ABSOLUTE_MAX_FLOW_C,
  ABSOLUTE_MIN_FLOW_C,
  SYSTEM_MAX_CURRENT_FLOW_TEMP,
  SYSTEM_MIN_CURRENT_FLOW_TEMP,
  resolveFlowTempRange,
} from '../flow-range';
import {
  SYSTEM_MAX_FLOW_C,
  SYSTEM_MIN_FLOW_C,
} from '../../Heating/strategies/base.strategy';
import type { FlowTempInput } from '../../Heating/engine/types';
import {
  BOILER_FAMILIES,
  effectiveCeilingC,
  effectiveFloorC,
  findBoilerFamily,
  manualFloorOf,
  verifiedFloorOf,
} from '../../BoilerCatalog/boiler-catalog';

/**
 * `F13` (treći krug): korisnik i dalje vidi „Dozvoljeni raspon polazne: 48 °C do
 * 55 °C" i odbijanje unosa 47 °C.
 *
 * Prva popravka je uvela `HomeProfile.minHeatingFlowC`, ali **nijedan ekran
 * nije mogao da ga upiše**: DTO nije imao to polje, pa je granica uvijek
 * ostajala zadana 48. Popravka je bila nevidljiva — isto kao da nije urađena.
 *
 * Ovi testovi zaključavaju pravilo: dom → raspon → klijent. Rade bez baze,
 * jer je pravilo izdvojeno iz servisa u čistu funkciju — upravo zato što se
 * unutar servisa (koji traži `PrismaService`) nije moglo izvršiti.
 */

describe('F13: raspon polazne po domu', () => {
  it('dom bez granica dobija raspon motora i izvor SYSTEM', () => {
    expect(
      resolveFlowTempRange({ minHeatingFlowC: null, maxHeatingFlowC: null }),
    ).toMatchObject({
      min: SYSTEM_MIN_CURRENT_FLOW_TEMP,
      max: SYSTEM_MAX_CURRENT_FLOW_TEMP,
      source: 'SYSTEM',
    });
  });

  /*
   * Suština korisnikove snimke od 2026-11-21: „Predložena 47.7 °C", a unos iste
   * vrijednosti odbijen sa „mora biti između 48 i 55". Zadana granica je bila
   * viša od onoga što motor predlaže — ponuda koja se ne može prihvatiti.
   */
  /*
   * F4.8: zadana granica unosa prati **fizički** pod, ne pod krive.
   *
   * Do F4.8 je bilo 46 (granica motora) — i to je bilo ispravno dok je kriva
   * bila jedini računač. Model daje niže: za tipičnu kuću (s = 0,9, c = 1 K,
   * cilj 22 °C) `F_eq` je 34,7 pri noći na +5 °C. Unos zaključan na 46 znači
   * da korisnik ne može prihvatiti vlastiti predlog — ista greška kao „zadano
   * 48 vs. predlog 47,7", samo dublje.
   *
   * Motor i dalje klampuje svoj izlaz na 46–55 (`SYSTEM_MIN_FLOW_C`); to čuva
   * test „raspon ne dira motor" niže. Ovdje se tvrdi samo granica **unosa**.
   */
  it('zadana donja granica prati fizički pod, ne pod krive', () => {
    expect(SYSTEM_MIN_CURRENT_FLOW_TEMP).toBe(ABSOLUTE_MIN_FLOW_C);
    expect(SYSTEM_MIN_CURRENT_FLOW_TEMP).toBe(30);
    // I dalje ne viša od onoga što motor predlaže na svom minimumu.
    expect(SYSTEM_MIN_CURRENT_FLOW_TEMP).toBeLessThanOrEqual(SYSTEM_MIN_FLOW_C);
  });

  it('modelski predlog od 34,7 °C prolazi kroz zadani raspon', () => {
    // Mjerenje iz §10.27: noć +5 °C, s = 0,9, c = 1 K, cilj 22 °C.
    const range = resolveFlowTempRange(null);
    expect(34.7).toBeGreaterThanOrEqual(range.min);
    expect(34.7).toBeLessThanOrEqual(range.max);
  });

  it('predlog od 47.7 °C prolazi kroz zadani raspon', () => {
    const range = resolveFlowTempRange(null);

    expect(47.7).toBeGreaterThanOrEqual(range.min);
    expect(47.7).toBeLessThanOrEqual(range.max);
  });

  it('dom sa donjom 46 daje 46–55 — unos 47 °C više nije odbijen', () => {
    expect(
      resolveFlowTempRange({ minHeatingFlowC: 46, maxHeatingFlowC: null }),
    ).toMatchObject({ min: 46, max: 55, source: 'HOME' });
  });

  it('dom ne može proširiti apsolutni raspon', () => {
    const range = resolveFlowTempRange({
      minHeatingFlowC: 10,
      maxHeatingFlowC: 90,
    });

    expect(range.min).toBe(ABSOLUTE_MIN_FLOW_C);
    expect(range.max).toBe(ABSOLUTE_MAX_FLOW_C);
    expect(range.min).toBe(30);
    expect(range.max).toBe(55);
  });

  it('naopak dom (min > max) ne zaključava korisnika — vraća se sistemski raspon', () => {
    expect(
      resolveFlowTempRange({ minHeatingFlowC: 54, maxHeatingFlowC: 40 }),
    ).toMatchObject({
      min: SYSTEM_MIN_CURRENT_FLOW_TEMP,
      max: SYSTEM_MAX_CURRENT_FLOW_TEMP,
      source: 'SYSTEM',
    });
  });

  it('novi korisnik bez profila dobija sistemski raspon', () => {
    expect(resolveFlowTempRange(null)).toMatchObject({
      min: SYSTEM_MIN_CURRENT_FLOW_TEMP,
      max: 55,
      source: 'SYSTEM',
    });
  });

  it('gornja granica doma se poštuje, ali ne preko 55', () => {
    expect(
      resolveFlowTempRange({ minHeatingFlowC: 46, maxHeatingFlowC: 52 }),
    ).toMatchObject({ min: 46, max: 52, source: 'HOME' });
  });
});

/**
 * Šesti krug (2026-11-21): granice su **podatak po tipu bojlera**, ne dvije
 * konstante. Do sada je gornja strana već išla kroz katalog
 * (`effectiveCeilingC`), a donja je bila tvrdih 46 za svaki kotao — iako
 * katalog za potvrđene modele zna stvarni pod (Vaillant ecoTEC: 30 °C).
 *
 * Ovi testovi zaključavaju tri stvari:
 *  1. potvrđen model **spušta** donju granicu (i to se vidi kroz `source`);
 *  2. nepotvrđen model **ne izmišlja** granicu — ostaje korisnikov ručni unos;
 *  3. raspon **ne dira motor**: isti ulaz u motor daje isti izlaz, prije i
 *     poslije promjene granica.
 */
describe('šesti krug: raspon polazne po tipu bojlera', () => {
  const vaillant = findBoilerFamily('vaillant-ecotec-plus-vuw');
  const boschW = findBoilerFamily('bosch-condens-7000-w');

  beforeAll(() => {
    // Katalog se učitava iz JSON-a; ako padne, `BOILER_FAMILIES` je prazan i
    // svi testovi ispod mjere pogrešnu stvar — zato tvrdnja na početku.
    expect(BOILER_FAMILIES.length).toBeGreaterThan(0);
    expect(vaillant?.specStatus).toBe('VERIFIED_MANUAL');
    expect(boschW?.specStatus).toBe('TO_VERIFY');
  });

  it('potvrđen model nosi svoj pod, a nepotvrđen ne nosi ništa', () => {
    expect(verifiedFloorOf(vaillant)).toBe(30);
    expect(verifiedFloorOf(boschW)).toBeNull();
    expect(verifiedFloorOf(null)).toBeNull();
  });

  it('dom sa potvrđenim modelom dobija pod iz kataloga i izvor BOILER', () => {
    const range = resolveFlowTempRange({
      minHeatingFlowC: null,
      maxHeatingFlowC: null,
      boilerCatalogId: 'vaillant-ecotec-plus-vuw',
    });

    expect(range.min).toBe(30);
    expect(range.max).toBe(55);
    expect(range.source).toBe('BOILER');
    expect(range.boilerFloorC).toBe(30);
  });

  it('dom bez modela ostaje na 46 — ništa se ne mijenja zatečenim korisnicima', () => {
    expect(
      resolveFlowTempRange({
        minHeatingFlowC: null,
        maxHeatingFlowC: null,
        boilerCatalogId: null,
      }),
    ).toEqual({
      min: SYSTEM_MIN_CURRENT_FLOW_TEMP,
      max: SYSTEM_MAX_CURRENT_FLOW_TEMP,
      source: 'SYSTEM',
      boilerFloorC: null,
      boilerManualFloorC: null,
    });
  });

  it('nepotvrđen model ne mijenja raspon — granicu daje korisnikov ručni unos', () => {
    const bezUnosa = resolveFlowTempRange({
      minHeatingFlowC: null,
      maxHeatingFlowC: null,
      boilerCatalogId: 'bosch-condens-7000-w',
    });
    expect(bezUnosa.min).toBe(SYSTEM_MIN_CURRENT_FLOW_TEMP);
    expect(bezUnosa.source).toBe('SYSTEM');
    expect(bezUnosa.boilerFloorC).toBeNull();

    const saUnosom = resolveFlowTempRange({
      minHeatingFlowC: 41,
      maxHeatingFlowC: null,
      boilerCatalogId: 'bosch-condens-7000-w',
    });
    expect(saUnosom).toEqual({
      min: 41,
      max: 55,
      source: 'HOME',
      boilerFloorC: null,
      boilerManualFloorC: null,
    });
  });

  it('dom bez modela u katalogu ostaje ručno podesiv (40–52)', () => {
    expect(
      resolveFlowTempRange({
        minHeatingFlowC: 40,
        maxHeatingFlowC: 52,
        boilerCatalogId: null,
      }),
    ).toMatchObject({ min: 40, max: 52, source: 'HOME' });
  });

  it('korisnikov viši pod nadjačava katalog i izvor je HOME, ne BOILER', () => {
    const range = resolveFlowTempRange({
      minHeatingFlowC: 48,
      maxHeatingFlowC: null,
      boilerCatalogId: 'vaillant-ecotec-plus-vuw',
    });

    expect(range.min).toBe(48);
    expect(range.source).toBe('HOME');
    // Pod iz kataloga se i dalje vraća — za objašnjenje, ne za granicu.
    expect(range.boilerFloorC).toBe(30);
  });

  it('katalog nikad ne probija envelope 30–55', () => {
    for (const family of BOILER_FAMILIES) {
      const range = resolveFlowTempRange({
        minHeatingFlowC: null,
        maxHeatingFlowC: null,
        boilerCatalogId: family.id,
      });
      expect(range.min).toBeGreaterThanOrEqual(ABSOLUTE_MIN_FLOW_C);
      expect(range.max).toBeLessThanOrEqual(ABSOLUTE_MAX_FLOW_C);
      expect(range.min).toBeLessThanOrEqual(range.max);
    }
  });

  it('gornja granica iz kataloga je već bila modularna i siječe se na 55', () => {
    // Vaillant navodi max 80 °C — envelope to svodi na 55.
    expect(effectiveCeilingC({ family: vaillant })).toBe(55);
    expect(effectiveCeilingC({ systemMaxC: 52, family: vaillant })).toBe(52);
    expect(effectiveCeilingC({ systemMaxC: 70, family: null })).toBe(55);
  });

  it('effectiveFloorC poštuje sva tri pravila', () => {
    // model 30 + motor 46 → motor je viši, ali fallback se koristi samo bez modela.
    expect(effectiveFloorC({ family: vaillant, fallbackC: 46 })).toBe(30);
    expect(effectiveFloorC({ family: null, fallbackC: 46 })).toBe(46);
    expect(effectiveFloorC({ family: null, fallbackC: null })).toBe(30);
    // profil 40 + model 30 → 40
    expect(
      effectiveFloorC({ systemMinC: 40, family: vaillant, fallbackC: 46 }),
    ).toBe(40);
    // ništa ne smije ispod envelope-a
    expect(effectiveFloorC({ systemMinC: 5, family: null, fallbackC: 5 })).toBe(
      30,
    );
  });

  it('manualFloorOf daje broj i za nepotvrđen model, ali ga ne tvrdi kao dokaz', () => {
    expect(manualFloorOf(vaillant)).toBe(30);
    expect(manualFloorOf(boschW)).toBeNull();
    expect(verifiedFloorOf(boschW)).toBeNull();
  });

  /*
   * Uslov koji je korisnik postavio uz zahtjev: **ne smije uticati na formulu i
   * learning**.
   *
   * Dokaz je mjerenje, ne tvrdnja: motor se poziva (pravi `ProfileStrategy`,
   * ne maketa) sa istim ulazom i parametrima dok se raspon mijenja. Test pada
   * čim se katalog umiješa u `finalTemp`.
   */
  it('raspon ne dira motor: isti ulaz daje isti finalTemp bez obzira na granice', () => {
    const { ProfileStrategy } = jest.requireActual<
      typeof import('../../Heating/strategies/profile.strategy')
    >('../../Heating/strategies/profile.strategy');
    const strategy = new ProfileStrategy();

    const input = {
      weather: { tempMin: -2, tempMax: 4, windSpeed: 3, humidity: 60 },
      homeProfile: {
        floorArea: 120,
        ceilingHeight: 2.6,
        insulationType: 'STANDARD',
        insulationThickness: 5,
        windowType: 'DOUBLE_GLAZED',
        heatingType: 'RADIATOR',
        constructionYear: 1998,
        hasFloorHeating: false,
        targetMorningTemp: 22,
        targetDayTemp: 21,
        targetNightTemp: 19,
        rooms: [],
      },
      roomTemp: 19,
      targetTemp: 22,
      events: [],
      hour: 7,
    } as unknown as FlowTempInput;

    const baseline = strategy.calculate(input);

    // Isti motor, isti ulaz — ali raspon se mijenja (katalog / ručni unos).
    const ranges = [
      resolveFlowTempRange({
        minHeatingFlowC: null,
        maxHeatingFlowC: null,
        boilerCatalogId: 'vaillant-ecotec-plus-vuw',
      }),
      resolveFlowTempRange({
        minHeatingFlowC: 30,
        maxHeatingFlowC: 55,
        boilerCatalogId: null,
      }),
      resolveFlowTempRange({
        minHeatingFlowC: 51,
        maxHeatingFlowC: 55,
        boilerCatalogId: 'bosch-condens-7000-w',
      }),
    ];
    expect(new Set(ranges.map((range) => range.min)).size).toBeGreaterThan(1);

    const after = strategy.calculate(input);

    expect(after).toEqual(baseline);
    // Formula ostaje unutar granica motora — katalog je ne pomjera.
    expect(baseline.finalTemp).toBeGreaterThanOrEqual(SYSTEM_MIN_FLOW_C);
    expect(baseline.finalTemp).toBeLessThanOrEqual(SYSTEM_MAX_FLOW_C);
  });
});
