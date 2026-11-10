import {
  ABSOLUTE_MAX_FLOW_C,
  ABSOLUTE_MIN_FLOW_C,
  SYSTEM_MAX_CURRENT_FLOW_TEMP,
  SYSTEM_MIN_CURRENT_FLOW_TEMP,
  resolveFlowTempRange,
} from '../flow-range';

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
  it('dom bez granica daje sistemskih 48–55 i izvor SYSTEM', () => {
    expect(
      resolveFlowTempRange({ minHeatingFlowC: null, maxHeatingFlowC: null }),
    ).toEqual({
      min: SYSTEM_MIN_CURRENT_FLOW_TEMP,
      max: SYSTEM_MAX_CURRENT_FLOW_TEMP,
      source: 'SYSTEM',
    });
  });

  it('dom sa donjom 46 daje 46–55 — unos 47 °C više nije odbijen', () => {
    expect(
      resolveFlowTempRange({ minHeatingFlowC: 46, maxHeatingFlowC: null }),
    ).toEqual({ min: 46, max: 55, source: 'HOME' });
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
    ).toEqual({
      min: SYSTEM_MIN_CURRENT_FLOW_TEMP,
      max: SYSTEM_MAX_CURRENT_FLOW_TEMP,
      source: 'SYSTEM',
    });
  });

  it('novi korisnik bez profila dobija sistemski raspon', () => {
    expect(resolveFlowTempRange(null)).toEqual({
      min: 48,
      max: 55,
      source: 'SYSTEM',
    });
  });

  it('gornja granica doma se poštuje, ali ne preko 55', () => {
    expect(
      resolveFlowTempRange({ minHeatingFlowC: 46, maxHeatingFlowC: 52 }),
    ).toEqual({ min: 46, max: 52, source: 'HOME' });
  });
});
