import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  OVERSHOOT_MAX_CORRECTION_C,
  OVERSHOOT_MIN_SAMPLES,
  OVERSHOOT_PERCENTILE,
  OVERSHOOT_WEIGHT,
  estimateOvershootCorrection,
  nextPercentile,
  overshootCorrectionFrom,
  percentile,
} from '../overshoot-learning';

/**
 * F5.4 — premašivanje se uči jednom.
 *
 * Test zaključava **dvije stvari**, i druga je važnija:
 *
 *  1. percentil je ispravna mjera repa (prosjek nije);
 *  2. premašivanje **ne ulazi dvaput**. Stara linija je glasila
 *     `offset + avgOvershoot * 0.5`, gdje su `offset` i `avgOvershoot` bili
 *     pokretni prosjeci **istog** mjerenja — isti broj 1,5 puta.
 */
describe('F5.4 overshoot-learning', () => {
  describe('percentil kao mjera repa', () => {
    it('dva ekstremna dana ne pomjeraju medijanu ni p90 mnogo', () => {
      // 25 mirnih dana po 0,1 K i 2 dana po 5 K (rođendan, otvoren prozor).
      const samples = [...Array.from({ length: 25 }, () => 0.1), 5, 5];
      const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
      const p90 = percentile(samples, OVERSHOOT_PERCENTILE);

      // Prosjek je 0,46 K — polazna bi se spuštala zbog dva dana.
      expect(mean).toBeCloseTo(0.46, 2);
      // 90. percentil je 0,1 K: tipičan dan, rep se ne pretvara u pravilo.
      expect(p90).toBeCloseTo(0.1, 4);
    });

    it('kad rep stvarno postoji, p90 ga vidi', () => {
      // Pola dana 0,1 K, pola 2,5 K — to je sistematsko premašivanje.
      const samples = [
        ...Array.from({ length: 10 }, () => 0.1),
        ...Array.from({ length: 10 }, () => 2.5),
      ];
      expect(percentile(samples, 90)).toBeGreaterThan(2.2);
    });

    it('interpolira linearno kao mjerne skripte', () => {
      expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90)).toBeCloseTo(
        9.1,
        9,
      );
    });
  });

  describe('korekcija ima znak i granicu', () => {
    it('premašivanje spušta polaznu (pozitivna korekcija)', () => {
      const result = estimateOvershootCorrection({
        samples: Array.from({ length: 10 }, () => 1.0),
      });
      expect(result.correctionC).toBeCloseTo(1.0 * OVERSHOOT_WEIGHT, 6);
      expect(result.reason).toBe('OK');
    });

    it('ne prelazi dnevni korak — veća korekcija ne bi bila izvršiva', () => {
      const result = estimateOvershootCorrection({
        samples: Array.from({ length: 10 }, () => 8),
      });
      expect(result.correctionC).toBe(OVERSHOOT_MAX_CORRECTION_C);
      expect(result.capped).toBe(true);
    });

    it('podbačaj se ne pretvara u podizanje kroz ovaj put', () => {
      // Svi uzorci negativni (kuća je bila hladna): nema premašivanja.
      const result = estimateOvershootCorrection({
        samples: [-2, -1, -0.5, -1.5, -1],
      });
      expect(result.correctionC).toBe(0);
      expect(result.reason).toBe('OK'); // izmjereno, ne „nema podataka"
    });

    it('bez dovoljno uzoraka vraća null, ne nulu', () => {
      const result = estimateOvershootCorrection({
        samples: [1, 2],
      });
      expect(result.correctionC).toBeNull();
      expect(result.reason).toBe('NO_SAMPLES');
      expect(OVERSHOOT_MIN_SAMPLES).toBe(5);
    });
  });

  describe('dvostruko sabiranje se ne može vratiti', () => {
    it('red bez percentila ne dobija korekciju — stara vrijednost se ne vraća', () => {
      // Ovo je jedini pozivalac u strategiji. Red prije F5.4 nema percentil;
      // da se vratio `avgOvershoot`, korekcija bi bila 2 K i premašivanje bi
      // ponovo ušlo dvaput (jednom kroz `offset`).
      expect(overshootCorrectionFrom(null)).toBeNull();
      expect(overshootCorrectionFrom(undefined)).toBeNull();
    });

    it('korekcija iz zapisanog percentila poštuje istu težinu i granicu', () => {
      expect(overshootCorrectionFrom(1.2)).toBeCloseTo(
        1.2 * OVERSHOOT_WEIGHT,
        6,
      );
      expect(overshootCorrectionFrom(99)).toBe(OVERSHOOT_MAX_CORRECTION_C);
      expect(overshootCorrectionFrom(-3)).toBe(0);
    });

    it('nema zavisnosti od avgOvershoot u izrazu', () => {
      const source = readFileSync(
        join(__dirname, '../../Heating/strategies/full.strategy.ts'),
        'utf8',
      );
      // Strategija smije pominjati `avgOvershoot` samo u komentaru — ako se
      // vrati u kod, ovo pada.
      const code = source
        .split('\n')
        .filter((line) => !line.trim().startsWith('//'))
        .join('\n');
      expect(code).not.toContain('avgOvershoot');
      expect(code).toContain('overshootCorrectionFrom');
    });
  });

  describe('tekući percentil', () => {
    it('ispod praga se ne mijenja — percentil od dva uzorka je maksimum', () => {
      expect(
        nextPercentile({ previousP90: 0.4, samples: 3, newSample: 9 }),
      ).toBe(0.4);
      expect(
        nextPercentile({ previousP90: null, samples: 1, newSample: 9 }),
      ).toBeNull();
    });

    it('rep podiže brže nego što pada', () => {
      const up = nextPercentile({ previousP90: 1, samples: 20, newSample: 3 });
      const down = nextPercentile({
        previousP90: 3,
        samples: 20,
        newSample: 1,
      });
      expect(up).toBeCloseTo(2, 6); // pola razlike gore
      expect(down).toBeCloseTo(2.8, 6); // desetina razlike dolje
      // Tip je `number | null` (nema uzoraka ⇒ nema broja), pa se sužava prije
      // aritmetike — inače `tsc` pada na TS18047 iako je vrijednost broj.
      expect(up).not.toBeNull();
      expect(down).not.toBeNull();
      expect((up as number) - 1).toBeGreaterThan(3 - (down as number));
    });

    it('prvi uzorak poslije praga postavlja vrijednost', () => {
      expect(
        nextPercentile({ previousP90: null, samples: 5, newSample: 1.4 }),
      ).toBe(1.4);
    });
  });
});
