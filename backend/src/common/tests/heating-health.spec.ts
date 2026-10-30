import {
  HEALTH_WEIGHTS,
  HEALTH_NO_DATA_SCORE,
  SHORT_CYCLE_MINUTES,
  SHORT_CYCLE_COUNT_THRESHOLD,
  LONG_CYCLE_MINUTES,
  TARGET_SHORTFALL_WARN_C,
  TARGET_OVERSHOOT_WARN_C,
  THERMOSTAT_FRESH_MINUTES,
  clampScore,
  computeWeightedHealthScore,
  buildHealthWarnings,
  computeThermostatFreshnessScore,
  type HealthComponent,
  type HealthEventInput,
} from '../heating-health';

/**
 * FE2-14 (FE-010): health score i pravila upozorenja preseljeni u backend.
 *
 * Logika je namjerno čista (bez Prisma/DI) da se može testirati bez baze —
 * lokalno nema postgres-a, pa bi test nad servisom ovdje uopšte ne prolazio.
 */

function event(overrides: Partial<HealthEventInput> = {}): HealthEventInput {
  return {
    durationMinutes: 45,
    targetTemp: 21,
    currentTemp: 21,
    isAnomaly: false,
    ...overrides,
  };
}

describe('clampScore', () => {
  it('ograničava na [0, 100]', () => {
    expect(clampScore(-5)).toBe(0);
    expect(clampScore(0)).toBe(0);
    expect(clampScore(100)).toBe(100);
    expect(clampScore(180)).toBe(100);
  });

  it('vraća 0 za NaN/Infinity umjesto da propagira NaN u score', () => {
    expect(clampScore(Number.NaN)).toBe(0);
    expect(clampScore(Number.POSITIVE_INFINITY)).toBe(100);
    expect(clampScore(Number.NEGATIVE_INFINITY)).toBe(0);
  });
});

describe('computeWeightedHealthScore', () => {
  it('bez ijedne komponente vraća zadani score (nema podataka)', () => {
    expect(computeWeightedHealthScore([])).toBe(HEALTH_NO_DATA_SCORE);
    expect(HEALTH_NO_DATA_SCORE).toBe(50);
  });

  it('jedna komponenta daje svoj score bez obzira na ponder', () => {
    const components: HealthComponent[] = [
      { key: 'anomalyRate', score: 80, weight: HEALTH_WEIGHTS.anomalyRate },
    ];
    expect(computeWeightedHealthScore(components)).toBe(80);
  });

  it('ponderisani prosjek se računa po ponderima, ne aritmetički', () => {
    // 100×35 + 0×25 + 0×25 + 0×15 = 3500; ukupni ponder 100 → 35.
    // Aritmetički prosjek bi bio 25, pa test razlikuje ta dva.
    const components: HealthComponent[] = [
      { key: 'learningConfidence', score: 100, weight: 35 },
      { key: 'flowDelta', score: 0, weight: 25 },
      { key: 'thermostatFreshness', score: 0, weight: 25 },
      { key: 'anomalyRate', score: 0, weight: 15 },
    ];
    expect(computeWeightedHealthScore(components)).toBe(35);
  });

  it('zaokružuje na cijeli broj', () => {
    const components: HealthComponent[] = [
      { key: 'learningConfidence', score: 100, weight: 1 },
      { key: 'flowDelta', score: 0, weight: 2 },
    ];
    // 100/3 = 33.333...
    expect(computeWeightedHealthScore(components)).toBe(33);
  });

  it('ponderi su dokumentovane vrijednosti preuzete iz mobilnog koda', () => {
    expect(HEALTH_WEIGHTS).toEqual({
      learningConfidence: 35,
      flowDelta: 25,
      thermostatFreshness: 25,
      anomalyRate: 15,
    });
    const total = Object.values(HEALTH_WEIGHTS).reduce((s, w) => s + w, 0);
    expect(total).toBe(100);
  });
});

describe('buildHealthWarnings', () => {
  it('bez događaja nema upozorenja', () => {
    expect(buildHealthWarnings([])).toEqual([]);
  });

  it('kratki ciklusi: upozorenje tek od praga (strogo >=)', () => {
    const short = event({ durationMinutes: SHORT_CYCLE_MINUTES - 1 });
    const under = Array.from(
      { length: SHORT_CYCLE_COUNT_THRESHOLD - 1 },
      () => short,
    );
    const atThreshold = Array.from(
      { length: SHORT_CYCLE_COUNT_THRESHOLD },
      () => short,
    );

    expect(buildHealthWarnings(under).map((w) => w.type)).not.toContain(
      'shortCycles',
    );
    expect(buildHealthWarnings(atThreshold).map((w) => w.type)).toContain(
      'shortCycles',
    );
  });

  it('ciklus tačno na pragu NIJE kratak (strogo manje)', () => {
    const atLimit = Array.from({ length: SHORT_CYCLE_COUNT_THRESHOLD }, () =>
      event({ durationMinutes: SHORT_CYCLE_MINUTES }),
    );
    expect(buildHealthWarnings(atLimit).map((w) => w.type)).not.toContain(
      'shortCycles',
    );
  });

  it('shortfall se pali kad prostorija ZAOSTAJE za ciljem', () => {
    const events = [event({ targetTemp: 22, currentTemp: 20 })]; // razlika 2 > 1.5
    const warnings = buildHealthWarnings(events);
    const w = warnings.find((x) => x.type === 'targetShortfall');

    expect(w).toBeDefined();
    expect(w?.level).toBe('warning');
    expect(w?.message).toContain('2.0');
  });

  it('overshoot se pali kad prostorija PRELAZI cilj', () => {
    const events = [event({ targetTemp: 20, currentTemp: 22 })]; // razlika 2 > 1.5
    const warnings = buildHealthWarnings(events);
    const w = warnings.find((x) => x.type === 'targetOvershoot');

    expect(w).toBeDefined();
    expect(w?.level).toBe('warning');
    // Ključno: shortfall i overshoot su odvojeni, pa se ne smije paliti oba.
    expect(warnings.find((x) => x.type === 'targetShortfall')).toBeUndefined();
  });

  it('kad je temperatura tačno na cilju, ne pali se nijedno od ta dva', () => {
    const warnings = buildHealthWarnings([
      event({ targetTemp: 21, currentTemp: 21 }),
    ]);
    expect(warnings.map((w) => w.type)).not.toContain('targetShortfall');
    expect(warnings.map((w) => w.type)).not.toContain('targetOvershoot');
  });

  it('prag je dokumentovana vrijednost 1.5 °C za oba smjera', () => {
    expect(TARGET_SHORTFALL_WARN_C).toBe(1.5);
    expect(TARGET_OVERSHOOT_WARN_C).toBe(1.5);
  });

  it('dugi ciklusi su info, ne warning', () => {
    const warnings = buildHealthWarnings([
      event({ durationMinutes: LONG_CYCLE_MINUTES + 1 }),
    ]);
    const w = warnings.find((x) => x.type === 'longCycles');

    expect(w).toBeDefined();
    expect(w?.level).toBe('info');
  });

  it('anomalije su error', () => {
    const warnings = buildHealthWarnings([event({ isAnomaly: true })]);
    const w = warnings.find((x) => x.type === 'anomalies');

    expect(w).toBeDefined();
    expect(w?.level).toBe('error');
  });

  it('pragovi ciklusa su dokumentovane vrijednosti', () => {
    expect(SHORT_CYCLE_MINUTES).toBe(20);
    expect(SHORT_CYCLE_COUNT_THRESHOLD).toBe(3);
    expect(LONG_CYCLE_MINUTES).toBe(90);
  });
});

describe('computeThermostatFreshnessScore', () => {
  const now = Date.parse('2026-10-30T12:00:00.000Z');

  it('svi svježi uređaji daju 100', () => {
    const fresh = new Date(now - 5 * 60000);
    expect(computeThermostatFreshnessScore([fresh, fresh], now)).toBe(100);
  });

  it('polovina svježih daje 50', () => {
    const fresh = new Date(now - 5 * 60000);
    const stale = new Date(now - 60 * 60000);
    expect(computeThermostatFreshnessScore([fresh, stale], now)).toBe(50);
  });

  it('uređaj tačno na granici je još svjež (<=)', () => {
    const atLimit = new Date(now - THERMOSTAT_FRESH_MINUTES * 60000);
    expect(computeThermostatFreshnessScore([atLimit], now)).toBe(100);
  });

  it('null i neispravan datum se broje kao nesvježi, ne kao greška', () => {
    expect(computeThermostatFreshnessScore([null, undefined], now)).toBe(0);
    expect(computeThermostatFreshnessScore(['nije-datum'], now)).toBe(0);
  });

  it('prazan niz vraća 0', () => {
    expect(computeThermostatFreshnessScore([], now)).toBe(0);
  });

  it('prihvata i ISO string i Date', () => {
    const iso = new Date(now - 60000).toISOString();
    const date = new Date(now - 60000);
    expect(computeThermostatFreshnessScore([iso], now)).toBe(100);
    expect(computeThermostatFreshnessScore([date], now)).toBe(100);
  });
});
