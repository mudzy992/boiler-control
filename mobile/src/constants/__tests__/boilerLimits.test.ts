import {
  ABSOLUTE_MAX_FLOW_TEMP,
  ABSOLUTE_MIN_FLOW_TEMP,
  DEFAULT_FLOW_RANGE,
  MAX_CURRENT_FLOW_TEMP,
  MIN_CURRENT_FLOW_TEMP,
  isWithinCurrentFlowTempRange,
  resolveFlowRange,
} from '../boilerLimits';

/**
 * F13: granica polazne više nije tvrda 48 u klijentu.
 *
 * Do sada je ovdje stajala provjera da su konstante baš 48–55. To je čuvalo
 * grešku: motor je predlagao 46, korisnik je to fizički mogao postaviti, a
 * aplikacija je unos odbijala. Sada se raspon čita sa servera, a konstante su
 * samo rezerva — pa test čuva **ugovor rezerve i validacije**, ne broj.
 */
describe('F13 raspon polazne vode na mobilnom', () => {
  it('rezervni raspon ostaje 48–55 dok server ne odgovori', () => {
    expect(DEFAULT_FLOW_RANGE).toEqual({ min: 48, max: 55, source: 'SYSTEM' });
    expect(MIN_CURRENT_FLOW_TEMP).toBe(48);
    expect(MAX_CURRENT_FLOW_TEMP).toBe(55);
  });

  it('prihvata raspon doma koji je niži od 48', () => {
    // Ovo je konkretan slučaj iz prijave: predlog motora 46.
    const range = resolveFlowRange({ min: 46, max: 55, source: 'HOME' });
    expect(range).toEqual({ min: 46, max: 55, source: 'HOME' });
    expect(isWithinCurrentFlowTempRange(46, range)).toBe(true);
    expect(isWithinCurrentFlowTempRange(45.9, range)).toBe(false);
  });

  it.each([
    [{ min: 46, max: 55, source: 'HOME' }, { min: 46, max: 55, source: 'HOME' }],
    [{ min: 30, max: 55, source: 'SYSTEM' }, { min: 30, max: 55, source: 'SYSTEM' }],
    // Nepoznat `source` pada na `SYSTEM`, ali granice ostaju.
    [{ min: 47, max: 54 }, { min: 47, max: 54, source: 'SYSTEM' }],
    // Neispravno: min > max, van apsolutnog raspona, nije broj, prazno.
    [{ min: 55, max: 46 }, DEFAULT_FLOW_RANGE],
    [{ min: 20, max: 55 }, DEFAULT_FLOW_RANGE],
    [{ min: 46, max: 60 }, DEFAULT_FLOW_RANGE],
    [{ min: '46', max: 55 }, DEFAULT_FLOW_RANGE],
    [{ min: 46 }, DEFAULT_FLOW_RANGE],
    [null, DEFAULT_FLOW_RANGE],
    [undefined, DEFAULT_FLOW_RANGE],
  ])('resolveFlowRange(%j) → %j', (raw, expected) => {
    expect(resolveFlowRange(raw)).toEqual(expected);
  });

  it('apsolutne granice odgovaraju backendnom DTO-u', () => {
    expect(ABSOLUTE_MIN_FLOW_TEMP).toBe(30);
    expect(ABSOLUTE_MAX_FLOW_TEMP).toBe(55);
  });

  it.each([
    [47.9, false],
    [48, true],
    [52.5, true],
    [55, true],
    [55.1, false],
    [Number.NaN, false],
  ])('rezervni raspon validira %s kao %s', (value, expected) => {
    expect(isWithinCurrentFlowTempRange(value)).toBe(expected);
  });
});
