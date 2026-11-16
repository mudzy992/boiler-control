import {
  METRICS_COVERAGE_THRESHOLD_PERCENT,
  evaluateMetricsGate,
  fieldsWithData,
} from '../metrics-gate';

/**
 * C1 — kapija za kartice mjernih kolona (mobilni).
 *
 * Isti test kao na webu (`frontend/src/features/heating/lib/__tests__/`), i to
 * namjerno: pravilo „prikaži od 25 %" je **dogovor između dva klijenta**, ne
 * detalj jednog ekrana. Ako se jednoj strani prag promijeni, jedna od dvije
 * kopije ovog testa padne.
 */

const coverage = (days: number, best: number, byField: Record<string, number> = {}) => ({
  days,
  bestFieldShare: best,
  byField,
});

describe('C1 — kapija pokrivenosti (mobilni)', () => {
  it('stvarno stanje (5,8 %) je sakriveno', () => {
    const gate = evaluateMetricsGate(coverage(86, 5.8, { dutyPercent: 5 }));
    expect(gate.visible).toBe(false);
    if (gate.visible) throw new Error('kapija je propustila 5,8 %');
    expect(gate.reason).toBe('low-coverage');
  });

  it('granica 25 %: 24,9 skriveno, 25 vidljivo', () => {
    expect(METRICS_COVERAGE_THRESHOLD_PERCENT).toBe(25);
    expect(evaluateMetricsGate(coverage(100, 24.9)).visible).toBe(false);
    expect(evaluateMetricsGate(coverage(100, 25)).visible).toBe(true);
  });

  it('nula dana nije 0 % nego „nema podatka"', () => {
    const gate = evaluateMetricsGate(coverage(0, 0));
    expect(gate.visible).toBe(false);
    if (gate.visible) throw new Error('kapija je propustila prazan odgovor');
    expect(gate.reason).toBe('no-data');
  });

  it('prikazuje samo kolone sa mjerenjem', () => {
    const fields = fieldsWithData(
      coverage(10, 60, { dutyPercent: 6, overshootC: 0, hysteresisK: 2 })
    );
    expect(fields.map((f) => f.field)).toEqual(['dutyPercent', 'hysteresisK']);
  });
});
