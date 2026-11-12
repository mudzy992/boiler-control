import { resolveDailyFlow } from '../daily-flow';

/**
 * F4.5 — jedan broj za dan.
 *
 * Mjerenje (run `43246164833`) je pokazalo oscilaciju: 10 od 27 kuća-dana ima
 * raspon > 0,5 K, max 2,76 K. Testovi ispod zaključavaju pravilo koje to
 * uklanja — i to tako da **ne** provjeravaju implementaciju, nego ponašanje:
 * koliko god formula odstupala, broj ostaje isti dok nema izmjerenog dokaza.
 */
describe('F4.5 resolveDailyFlow — jedan broj za dan', () => {
  const baseRecord = {
    proposedFlowTemp: 48,
    outcomeAt: null as Date | null,
    undershootC: null as number | null,
    nightUndershootC: null as number | null,
  };

  it('zapisani predlog važi bez obzira koliko formula odstupa', () => {
    // Ovo je srž mjerenja: formula daje 51,2, predlog je 48. Korisnik mora
    // vidjeti 48 — inače se broj mijenja iz ciklusa u ciklus.
    const result = resolveDailyFlow({
      record: { ...baseRecord },
      curveFlowC: 51.2,
    });

    expect(result.flowC).toBe(48);
    expect(result.source).toBe('DAILY_RECORD');
    expect(result.change).toBeNull();
  });

  it('odstupanje se i dalje MJERI, samo ne mijenja broj', () => {
    // Bez ovoga bi se izgubio podatak zašto formula i predlog nijesu isti —
    // a upravo taj podatak je bio predmet F4.5 mjerenja.
    const result = resolveDailyFlow({
      record: { ...baseRecord },
      curveFlowC: 51.2,
    });
    expect(result.formulaDriftC).toBeCloseTo(3.2, 5);
  });

  it('drift ne raste kroz dan — isti ulaz, isti izlaz', () => {
    // Pet uzastopnih pollinga sa različitom formulom (prognoza se popravlja).
    // Broj koji ide na kotao mora ostati isti; mijenja se samo drift.
    const flows = [51.2, 50.1, 49.4, 52.8, 47.9];
    const results = flows.map((curveFlowC) =>
      resolveDailyFlow({ record: { ...baseRecord }, curveFlowC }),
    );

    expect(results.map((r) => r.flowC)).toEqual([48, 48, 48, 48, 48]);
    // A drift je različit — dakle mjerenje nije izgubljeno.
    expect(new Set(results.map((r) => r.formulaDriftC)).size).toBe(5);
  });

  it('formula bez vremena ne ruši broj — predlog ostaje', () => {
    const result = resolveDailyFlow({
      record: { ...baseRecord },
      curveFlowC: null,
    });
    expect(result.flowC).toBe(48);
    expect(result.source).toBe('DAILY_RECORD');
    expect(result.formulaDriftC).toBeNull();
  });

  describe('dokaz je jedini razlog da broj ode gore', () => {
    it('noćni manjak podiže broj i to se imenuje', () => {
      const result = resolveDailyFlow({
        record: {
          ...baseRecord,
          outcomeAt: new Date('2026-11-12T03:20:00Z'),
          nightUndershootC: 1.4,
        },
        curveFlowC: 51,
      });

      expect(result.flowC).toBeGreaterThan(48);
      expect(result.change?.reason).toBe('NIGHT_UNDERSHOOT');
      expect(result.change?.measuredUndershootC).toBeCloseTo(1.4, 5);
    });

    it('manjak unutar tolerancije ne mijenja ništa', () => {
      // 0,1 K je unutar mjerne nesigurnosti; da to mijenja broj, broj bi se
      // mijenjao na svakom pollingu — tačno ono što je korisnik prijavio.
      const result = resolveDailyFlow({
        record: {
          ...baseRecord,
          outcomeAt: new Date('2026-11-12T03:20:00Z'),
          nightUndershootC: 0.1,
        },
        curveFlowC: 51,
      });

      expect(result.flowC).toBe(48);
      expect(result.change).toBeNull();
    });

    it('ishod koji NIJE obračunat nije dokaz nule', () => {
      // `outcomeAt == null` = „nije se još mjerilo", ne „izmjereno je 0".
      // Da se to pomiješa, manjak bi bio 0 i nikad ne bi podigao broj.
      const result = resolveDailyFlow({
        record: {
          ...baseRecord,
          outcomeAt: null,
          nightUndershootC: 2.5,
        },
        curveFlowC: 51,
      });

      expect(result.flowC).toBe(48);
      expect(result.change).toBeNull();
    });

    it('spuštanje usred dana nije dozvoljeno ni sa dokazom', () => {
      // Formula traži NIŽE od jutra; dokaz je manjak (traži više). Rezultat
      // mora ostati jutarnji ili gore — nikad dolje.
      const result = resolveDailyFlow({
        record: {
          ...baseRecord,
          outcomeAt: new Date('2026-11-12T03:20:00Z'),
          nightUndershootC: 1.2,
        },
        curveFlowC: 40,
      });

      expect(result.flowC).toBeGreaterThanOrEqual(48);
    });
  });

  describe('kad zapisa nema', () => {
    it('formula je jedini broj i to se otvoreno kaže', () => {
      const result = resolveDailyFlow({ record: null, curveFlowC: 49.5 });
      expect(result.flowC).toBe(49.5);
      // `CURVE`, ne `DAILY_RECORD`: ne smije se čitati kao „jutro je
      // potvrdilo formulu".
      expect(result.source).toBe('CURVE');
      expect(result.formulaDriftC).toBeNull();
    });

    it('nema ni zapisa ni formule — ne izmišlja se broj', () => {
      const result = resolveDailyFlow({ record: null, curveFlowC: null });
      expect(result.flowC).toBeNull();
      expect(result.source).toBe('NONE');
    });

    it('red bez predloga (preskočen dan) ne tvrdi nulu', () => {
      const result = resolveDailyFlow({
        record: { ...baseRecord, proposedFlowTemp: null },
        curveFlowC: 47,
      });
      expect(result.flowC).toBe(47);
      expect(result.source).toBe('CURVE');
    });
  });

  it('granica sistema se poštuje i kad predlog nije u njoj', () => {
    // Predlog zapisan prije nego je korisnik snizio granicu ne smije izaći.
    const result = resolveDailyFlow({
      record: { ...baseRecord, proposedFlowTemp: 60 },
      curveFlowC: null,
      ceilingC: 55,
    });
    expect(result.flowC).toBeLessThanOrEqual(55);
  });
});
