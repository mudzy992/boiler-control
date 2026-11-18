import {
  MAX_TV_METRICS,
  buildTvMetrics,
  buildTvOverview,
  describeFreshness,
  formatMetric,
  limitForTv,
  resolveGasConsumption,
} from '../analytics';

/**
 * TV analitika — šta se prikazuje i šta se odbija prikazati.
 *
 * Najvažnija tvrdnja: **nedostajuće mjerenje se ne pretvara u nulu**. TV koji
 * bi `null` prikazao kao `0 m³` izgledao bi najtačnije od svih klijenata, a bio
 * bi najgori — ista greška kao B1 (backend) i D2 (web).
 */

describe('formatiranje', () => {
  it('nedostajuće mjerenje je null, ne 0', () => {
    expect(formatMetric(undefined)).toBeNull();
    expect(formatMetric(null)).toBeNull();
    expect(formatMetric(NaN)).toBeNull();
    expect(formatMetric(Infinity)).toBeNull();
  });

  it('stvarna nula ostaje 0 — to je mjerenje', () => {
    expect(formatMetric(0)).toBe('0.0');
    expect(formatMetric(0, 2)).toBe('0.00');
  });
});

describe('potrošnja plina', () => {
  it('0 iz referentnog očitanja pobjeđuje totalGas (kvar kao D2)', () => {
    // `??` bi ovdje vratio `totalGas` jer je 0 „falsy" tretiran kao odsutan —
    // a 0 je mjerenje: u periodu nije potrošeno ništa.
    expect(
      resolveGasConsumption({ consumptionFromReferenceM3: 0, totalGas: 42 }),
    ).toBe(0);
  });

  it('bez referentnog očitanja koristi totalGas', () => {
    expect(resolveGasConsumption({ totalGas: 42 })).toBe(42);
  });

  it('nema nijednog → null', () => {
    expect(resolveGasConsumption({})).toBeNull();
  });
});

describe('metrike za TV', () => {
  it('metrike bez mjerenja IZOSTAJU, ne prikazuju se kao nula', () => {
    // Prazna kartica na TV-u nema legendu koja bi objasnila zašto je prazna.
    const metrics = buildTvMetrics({ totalGas: 12.5 });
    expect(metrics.map((m) => m.key)).toEqual(['consumption']);
  });

  it('prazan odgovor daje praznu listu, ne šest nula', () => {
    expect(buildTvMetrics(null)).toEqual([]);
    expect(buildTvMetrics({})).toEqual([]);
  });

  it('redoslijed: potrošnja, pa novac, pa tehnika', () => {
    const metrics = buildTvMetrics({
      consumptionFromReferenceM3: 10,
      costIncVat: 25,
      totalHeatingHours: 5,
      avgFlowTemp: 55,
      efficiency: { m3PerHour: 1.234 },
    });
    expect(metrics.map((m) => m.key)).toEqual([
      'consumption',
      'cost',
      'hours',
      'flow',
      'perHour',
    ]);
    expect(metrics[0].unit).toBe('m³');
    expect(metrics[0].value).toBe('10.00');
  });
});

describe('TV overview', () => {
  it('vraća četiri kartice u traženom redoslijedu i termostat sa ciljem', () => {
    const cards = buildTvOverview(
      { costIncVat: 81.25 },
      {
        system: {
          weather: { temp: 7.4 },
          boiler: { actualFlowTemp: 46 },
        },
        homes: [
          {
            thermostats: [
              { roomCurrentTemp: null, roomTargetTemp: 21 },
              { roomCurrentTemp: 20.5, roomTargetTemp: 22 },
            ],
          },
        ],
      },
    );

    expect(cards.map((card) => card.key)).toEqual([
      'outside',
      'thermostat',
      'flow',
      'cost',
    ]);
    expect(cards.map((card) => card.value)).toEqual([7.4, 20.5, 46, 81.25]);
    expect(cards[1].targetValue).toBe(22);
  });

  it('nedostajuće vrijednosti ostaju null, ne izmišljene nule', () => {
    const cards = buildTvOverview(null, null);
    expect(cards).toHaveLength(4);
    expect(cards.map((card) => card.value)).toEqual([null, null, null, null]);
    expect(cards[1].targetValue).toBeNull();
  });
});

describe('ograničenje za ekran', () => {
  it('prikazuje najviše MAX_TV_METRICS i kaže koliko je skriveno', () => {
    const many = Array.from({ length: MAX_TV_METRICS + 2 }, (_, i) => ({
      key: `m${i}`,
      label: `m${i}`,
      value: '1',
      unit: '',
    }));
    const { shown, hiddenCount } = limitForTv(many);
    expect(shown).toHaveLength(MAX_TV_METRICS);
    // „+2" je bolje od tišine: bez toga ekran izgleda kao da metrika nema.
    expect(hiddenCount).toBe(2);
  });

  it('kad sve stane, ništa nije skriveno', () => {
    const two = [{ key: 'a', label: 'a', value: '1', unit: '' }];
    expect(limitForTv(two)).toEqual({ shown: two, hiddenCount: 0 });
  });
});

describe('svježina podatka', () => {
  it('bez vremena osvježavanja stanje je nepoznato, ne svježe', () => {
    expect(describeFreshness(null)).toBe('unknown');
  });

  it('poslije 10 minuta podatak je star', () => {
    const now = 1_000_000_000_000;
    expect(describeFreshness(now - 60_000, now)).toBe('fresh');
    expect(describeFreshness(now - 11 * 60_000, now)).toBe('stale');
  });
});
