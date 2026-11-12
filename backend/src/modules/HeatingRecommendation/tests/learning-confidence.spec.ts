import {
  CONFIDENCE_HALF_SAMPLES,
  CONFIDENCE_MAX,
  CONFIDENCE_MIN,
  CONFIDENCE_NEGLIGIBLE,
  RESIDUAL_SCALE_C,
  intervalConfidence,
} from '../learning-confidence';

/**
 * F5.3 — `confidence` prestaje biti monotona.
 *
 * Test zaključava **ponašanje koje je nekad bilo pokvareno**, ne formulu:
 * stara implementacija je bila pokretni prosjek sa fiksnim prirastom 0,1, čija
 * je fiksna tačka 0,1 — pa je `confidence` poslije 320 uzoraka još bio 0,1000.
 * Zato prvi test ide do 320 uzoraka: kratak niz bi prošao i sa starom formulom.
 */
describe('F5.3 intervalConfidence', () => {
  describe('stara greška ne može se vratiti', () => {
    it('raste sa brojem uzoraka — 320 uzoraka nije 0,1', () => {
      // Isti niz kao u mjerenju koje je otkrilo grešku: 0,1 na svakom koraku.
      const at = (n: number) =>
        intervalConfidence({ samples: n, residualStd: 0 }).confidence;

      expect(at(1)).toBeGreaterThan(0.05);
      expect(at(10)).toBeCloseTo(0.5, 4); // tačno pola na N_HALF
      expect(at(320)).toBeGreaterThan(0.96);
      // Stroga monotonija: više uzoraka nikad ne daje manje pouzdanja.
      let previous = -1;
      for (const n of [1, 2, 5, 10, 20, 40, 80, 160, 320]) {
        const value = at(n);
        expect(value).toBeGreaterThan(previous);
        previous = value;
      }
    });

    it('nikad ne izlazi iz 0..1', () => {
      for (const samples of [0, 1, 10, 1e6]) {
        for (const residualStd of [0, 0.5, 2, 10, null]) {
          const value = intervalConfidence({ samples, residualStd }).confidence;
          expect(value).toBeGreaterThanOrEqual(CONFIDENCE_MIN);
          expect(value).toBeLessThanOrEqual(CONFIDENCE_MAX);
        }
      }
    });
  });

  describe('drugi član: slaganje uzoraka', () => {
    it('veliko odstupanje obara sigurnost na nulu, ne na malu vrijednost', () => {
      // Ključna razlika od stare formule: model koji ne objašnjava uzorke ne
      // smije izgledati „skoro pouzdano" kroz 35 % health score-a.
      const result = intervalConfidence({ samples: 500, residualStd: 4 });
      expect(result.confidence).toBe(0);
      expect(result.reason).toBe('NO_AGREEMENT');
      // Količina dokaza je velika — pad dolazi isključivo od neslaganja.
      expect(result.evidencePart).toBeGreaterThan(0.9);
      expect(result.agreementPart).toBe(0);
    });

    it('nepoznat ostatak se ne tumači kao savršeno slaganje', () => {
      const unknown = intervalConfidence({ samples: 100, residualStd: null });
      expect(unknown.confidence).toBe(0);
      expect(unknown.reason).toBe('NO_AGREEMENT');
    });

    it('pola skale odstupanja daje pola slaganja', () => {
      const result = intervalConfidence({
        samples: CONFIDENCE_HALF_SAMPLES,
        residualStd: RESIDUAL_SCALE_C / 2,
      });
      expect(result.agreementPart).toBeCloseTo(0.5, 4);
      expect(result.confidence).toBeCloseTo(0.25, 4); // 0,5 · 0,5
    });
  });

  describe('razlozi su imenovani', () => {
    it('bez uzoraka nema osnova — i to se kaže, a ne pogađa', () => {
      for (const samples of [0, -3, null, undefined, Number.NaN]) {
        const result = intervalConfidence({ samples, residualStd: 0 });
        expect(result.confidence).toBe(0);
        expect(result.reason).toBe('NO_SAMPLES');
      }
    });

    it('uzorci + slaganje daju OK', () => {
      expect(intervalConfidence({ samples: 20, residualStd: 0.5 }).reason).toBe(
        'OK',
      );
    });
  });

  describe('pragovi su izvedeni, ne izmišljeni', () => {
    it('N_HALF daje pola, i to je jedina veza sa brojem uzoraka', () => {
      const result = intervalConfidence({
        samples: CONFIDENCE_HALF_SAMPLES,
        residualStd: 0,
      });
      expect(result.evidencePart).toBeCloseTo(0.5, 6);
    });

    it('ispod granice zanemarljivosti offset praktično ne djeluje', () => {
      // 1 uzorak sa savršenim slaganjem: 1/11 ≈ 0,0909 < 0,1.
      const result = intervalConfidence({ samples: 1, residualStd: 0 });
      expect(result.confidence).toBeLessThan(CONFIDENCE_NEGLIGIBLE);
    });
  });
});
