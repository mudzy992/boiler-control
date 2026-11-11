import {
  DAY_REFERENCE_WEIGHT,
  EQUILIBRIUM_VERSION,
  SLOPE_CONSERVATIVE_MAX_DAYS,
  chooseSlope,
  equilibriumFlow,
  referenceOutdoorC,
} from '../equilibrium-flow';

/**
 * Testovi čuvaju tri stvari koje su ranije bile tihe greške:
 *
 * 1. `c` se **oduzima** (nekad se mjerio i nije koristio);
 * 2. `c` i `u_day` se ne oduzimaju dvaput;
 * 3. gornja granica CI-ja važi **samo dok je model mlad**.
 */

const TARGET = 21;

describe('referenceOutdoorC', () => {
  it('bez dnevnog maksimuma ostaje čista noć', () => {
    expect(referenceOutdoorC({ nightMinC: -5 })).toEqual({
      outdoorRefC: -5,
      source: 'NIGHT',
    });
  });

  it('sa dnevnim maksimumom pravi mješavinu 0,7 noć + 0,3 dan', () => {
    // 0,7·(−5) + 0,3·5 = −3,5 + 1,5 = −2
    expect(referenceOutdoorC({ nightMinC: -5, dayMaxC: 5 })).toEqual({
      outdoorRefC: -2,
      source: 'NIGHT_DAY_BLEND',
    });
    expect(DAY_REFERENCE_WEIGHT).toBe(0.3);
  });

  it('mješavina je toplija od noći kad je dan topliji — polazna pada', () => {
    const night = referenceOutdoorC({ nightMinC: -8 });
    const blend = referenceOutdoorC({ nightMinC: -8, dayMaxC: 4 });
    expect(blend.outdoorRefC!).toBeGreaterThan(night.outdoorRefC!);
  });

  it('bez noći nema ni reference, čak i kad dan postoji', () => {
    expect(referenceOutdoorC({ nightMinC: null, dayMaxC: 5 })).toEqual({
      outdoorRefC: null,
      source: null,
    });
  });

  it('težina se steže na 0..1 — neispravan ulaz ne pravi vanjsku izvan dana', () => {
    expect(
      referenceOutdoorC({ nightMinC: -5, dayMaxC: 5, dayWeight: 5 })
        .outdoorRefC,
    ).toBe(5);
    expect(
      referenceOutdoorC({ nightMinC: -5, dayMaxC: 5, dayWeight: -1 })
        .outdoorRefC,
    ).toBe(-5);
  });
});

describe('chooseSlope — starost modela', () => {
  it('mlad model koristi gornju granicu CI-ja', () => {
    expect(
      chooseSlope({ slopeS: 0.943, slopeCiHigh: 0.961, modelDays: 9 }),
    ).toEqual({ slope: 0.961, source: 'CI_HIGH' });
  });

  it('zreo model koristi tačku-procjenu', () => {
    expect(
      chooseSlope({
        slopeS: 0.943,
        slopeCiHigh: 0.961,
        modelDays: SLOPE_CONSERVATIVE_MAX_DAYS,
      }),
    ).toEqual({ slope: 0.943, source: 'POINT' });
  });

  it('nepoznat broj dana tretira se kao mlad — konzervativno', () => {
    expect(chooseSlope({ slopeS: 0.9, slopeCiHigh: 1.0 }).source).toBe(
      'CI_HIGH',
    );
  });

  it('granica niža od tačke se ne koristi (ne bi bila granica)', () => {
    expect(
      chooseSlope({ slopeS: 0.95, slopeCiHigh: 0.9, modelDays: 5 }),
    ).toEqual({ slope: 0.95, source: 'POINT' });
  });

  it('bez tačke-procjene nema nagiba, iako granica postoji', () => {
    expect(
      chooseSlope({ slopeS: null, slopeCiHigh: 1.0, modelDays: 5 }),
    ).toEqual({
      slope: null,
      source: null,
    });
  });
});

describe('equilibriumFlow — izraz', () => {
  const base = {
    targetRoomC: TARGET,
    nightMinC: -8,
    slopeS: 0.943,
    slopeCiHigh: 0.943,
    modelDays: 40,
  };

  it('c se oduzima: polazna je niža tačno za c', () => {
    const withoutC = equilibriumFlow({ ...base, internalGainC: null });
    const withC = equilibriumFlow({ ...base, internalGainC: 0.95 });

    expect(withoutC.flowC).not.toBeNull();
    expect(withC.flowC!).toBeCloseTo(withoutC.flowC! - 0.95, 6);
    expect(withC.internalGainAppliedC).toBe(0.95);
  });

  it('u_day se oduzima isto kao c, ali se broje odvojeno', () => {
    const withC = equilibriumFlow({ ...base, internalGainC: 0.95 });
    const withBoth = equilibriumFlow({
      ...base,
      internalGainC: 0.95,
      uDayC: 1.2,
    });

    expect(withBoth.flowC!).toBeCloseTo(withC.flowC! - 1.2, 6);
    expect(withBoth.internalGainAppliedC).toBe(0.95);
    expect(withBoth.dayGainAppliedC).toBe(1.2);
  });

  it('c i u_day se ne oduzimaju dvaput', () => {
    // Ručno izračunat izraz: 21 + 0,943·(21 − (−8)) − 0,95 − 1,2
    const expected = TARGET + 0.943 * (TARGET - -8) - 0.95 - 1.2;
    const result = equilibriumFlow({
      ...base,
      internalGainC: 0.95,
      uDayC: 1.2,
    });

    expect(result.flowC!).toBeCloseTo(expected, 9);
    expect(result.terms!.gainTermC).toBeCloseTo(-2.15, 9);
  });

  it('nepoznat c ne znači nula — ne oduzima se ništa', () => {
    const result = equilibriumFlow({ ...base, internalGainC: null });
    expect(result.internalGainAppliedC).toBe(0);
    expect(result.terms!.gainTermC).toBe(-0);
  });

  it('dnevna mješavina snižava polaznu na sunčan dan', () => {
    const nightOnly = equilibriumFlow({ ...base, dayMaxC: null });
    const withDay = equilibriumFlow({ ...base, dayMaxC: 4 });

    expect(withDay.flowC!).toBeLessThan(nightOnly.flowC!);
    expect(withDay.outdoorRefSource).toBe('NIGHT_DAY_BLEND');
    // 0,943 · 0,3 · (4 − (−8)) = 3,3948
    expect(nightOnly.flowC! - withDay.flowC!).toBeCloseTo(0.943 * 0.3 * 12, 9);
  });

  it('bez noći vraća null sa razlogom — kontroler tada drži prošlu', () => {
    const result = equilibriumFlow({ ...base, nightMinC: null });
    expect(result.flowC).toBeNull();
    expect(result.reasons).toEqual(['NO_NIGHT']);
    expect(result.terms).toBeNull();
  });

  it('bez nagiba vraća null sa razlogom', () => {
    const result = equilibriumFlow({
      ...base,
      slopeS: null,
      slopeCiHigh: null,
    });
    expect(result.flowC).toBeNull();
    expect(result.reasons).toEqual(['NO_SLOPE']);
  });

  it('oba razloga kad nema ni noći ni nagiba', () => {
    const result = equilibriumFlow({
      targetRoomC: TARGET,
      nightMinC: null,
      slopeS: null,
    });
    expect(result.reasons).toEqual(['NO_NIGHT', 'NO_SLOPE']);
  });

  it('mlad model ide više od zrelog, uz isti nagib', () => {
    const young = equilibriumFlow({ ...base, modelDays: 5 });
    const mature = equilibriumFlow({ ...base, modelDays: 40 });

    expect(young.slopeSource).toBe('CI_HIGH');
    expect(mature.slopeSource).toBe('POINT');
    // Sa istim CI-jem razlika je nula — ali izvor se vidi u zapisu.
    expect(young.flowC!).toBeCloseTo(mature.flowC!, 9);
  });

  it('verzija izraza postoji i mijenja se svjesno', () => {
    expect(EQUILIBRIUM_VERSION).toBe('equilibrium-1');
  });

  it('rezultat je determinističan — isti ulaz, isti broj', () => {
    const a = equilibriumFlow({ ...base, internalGainC: 0.9, uDayC: 0.3 });
    const b = equilibriumFlow({ ...base, internalGainC: 0.9, uDayC: 0.3 });
    expect(a).toEqual(b);
  });
});
