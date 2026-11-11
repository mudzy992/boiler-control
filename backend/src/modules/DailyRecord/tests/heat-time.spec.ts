import {
  MIN_HEAT_RATE_C_PER_H,
  MIN_RISE_C,
  T_MAX_MINUTES,
  flowForHeatTime,
  minutesToReach,
  type HeatTimeInput,
} from '../heat-time';

/**
 * `T_max` kao tvrdo ograničenje (`17` §8.6, `29`). Najslabija karika je
 * linearna pretpostavka `heatRate ∝ (F − R)`, pa se testira **smjer**:
 * viša polazna → kraće vrijeme, a potrebna polazna nikad ne smije biti niža od
 * one koja ne stigne na vrijeme.
 */

function input(overrides: Partial<HeatTimeInput> = {}): HeatTimeInput {
  return {
    riseC: 4,
    roomC: 20,
    // Izmjereno: soba je pri polaznoj 45 (i sobi 20) rasla 1,2 K/h.
    heatRateCPerHour: 1.2,
    measuredFlowC: 45,
    measuredRoomC: 20,
    ...overrides,
  };
}

describe('minutesToReach', () => {
  it('pri izmjerenoj polaznoj vraća izmjereno vrijeme', () => {
    // 4 K pri 1,2 K/h = 3,33 h = 200 min.
    expect(minutesToReach(input(), 45)).toBeCloseTo(200, 6);
  });

  it('viša polazna dogrijava brže, niža sporije', () => {
    const at50 = minutesToReach(input(), 50) as number;
    const at45 = minutesToReach(input(), 45) as number;
    const at40 = minutesToReach(input(), 40) as number;

    expect(at50).toBeLessThan(at45);
    expect(at40).toBeGreaterThan(at45);
    // Linearno po pogonskoj razlici: 30/25 puta brže pri 50 nego pri 45.
    expect(at50).toBeCloseTo((at45 * 25) / 30, 6);
  });

  it('dostignut cilj ne traje ništa', () => {
    expect(minutesToReach(input({ riseC: 0 }), 45)).toBe(0);
    expect(minutesToReach(input({ riseC: -2 }), 45)).toBe(0);
    expect(minutesToReach(input({ riseC: MIN_RISE_C / 2 }), 45)).toBe(0);
  });

  it('polazna ispod sobe ne grije — nema vremena koje se može izračunati', () => {
    expect(minutesToReach(input(), 19)).toBeNull();
    expect(minutesToReach(input(), 20)).toBeNull();
  });

  it('neupotrebljivo mjerenje daje `null`, ne izmišljeno vrijeme', () => {
    expect(
      minutesToReach(
        input({ heatRateCPerHour: MIN_HEAT_RATE_C_PER_H / 2 }),
        45,
      ),
    ).toBeNull();
    expect(
      minutesToReach(input({ heatRateCPerHour: Number.NaN }), 45),
    ).toBeNull();
    // Mjereno u uslovima bez pogonske razlike — nema osnova za preračun.
    expect(
      minutesToReach(input({ measuredFlowC: 21, measuredRoomC: 21 }), 45),
    ).toBeNull();
  });
});

describe('flowForHeatTime', () => {
  it('vraća polaznu koja stigne tačno u 120 min', () => {
    const required = flowForHeatTime(input()) as number;
    // neededRate = 4 / 2 h = 2 K/h; F = 20 + 25·2/1,2 = 61,67 °C.
    expect(required).toBeCloseTo(20 + (25 * 2) / 1.2, 6);
    // I ta polazna zaista stiže na vrijeme (u granici zaokruživanja).
    expect(minutesToReach(input(), required)).toBeCloseTo(T_MAX_MINUTES, 6);
  });

  it('veća rezerva vremena traži nižu polaznu', () => {
    const fast = flowForHeatTime(input(), 60) as number;
    const slow = flowForHeatTime(input(), 240) as number;
    expect(fast).toBeGreaterThan(slow);
  });

  it('bez potrebe za podizanjem vraća `null`', () => {
    expect(flowForHeatTime(input({ riseC: 0 }))).toBeNull();
    expect(flowForHeatTime(input({ riseC: MIN_RISE_C / 2 }))).toBeNull();
  });

  it('bez mjerenja vraća `null` — ne podiže se naslijepo', () => {
    expect(flowForHeatTime(input({ heatRateCPerHour: 0.01 }))).toBeNull();
    expect(
      flowForHeatTime(input({ measuredFlowC: 20, measuredRoomC: 20 })),
    ).toBeNull();
    expect(flowForHeatTime(input(), 0)).toBeNull();
  });

  it('prozor je 120 minuta, kako dokument traži', () => {
    expect(T_MAX_MINUTES).toBe(120);
  });
});
