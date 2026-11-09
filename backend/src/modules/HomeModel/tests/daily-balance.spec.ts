import {
  MIN_DAYS_FOR_FIT,
  OBSERVATIONS_PER_DAY,
  buildDayRow,
  fitDailyBalance,
  type DayAggregate,
  type DayRow,
} from '../daily-balance';

const TARGET = 21;

function day(over: Partial<DayAggregate> = {}): DayAggregate {
  const samples = over.samples ?? OBSERVATIONS_PER_DAY;
  return {
    localDate: '2026-11-01',
    samples,
    heatingSamples: Math.round(samples * 0.5),
    heatingPairs: Math.round(samples * 0.5),
    flowMinusRoomSum: Math.round(samples * 0.5) * (48 - 21),
    roomSum: samples * 21,
    outdoorSum: samples * 1,
    outdoorSamples: samples,
    targetRoomC: TARGET,
    ...over,
  };
}

describe('jedan dan -> jedan red regresije', () => {
  it('y je udio grijanja puta prosječna razlika (polazna − soba)', () => {
    const result = buildDayRow(
      day({
        samples: 288,
        heatingSamples: 144,
        heatingPairs: 144,
        flowMinusRoomSum: 144 * (50 - 21),
        roomSum: 288 * 21,
        outdoorSum: 288 * 1,
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.duty).toBeCloseTo(0.5, 6);
    expect(result.row.x).toBeCloseTo(20, 6);
    expect(result.row.y).toBeCloseTo(0.5 * 29, 6);
  });

  it('polazna promijenjena usred dana ulazi ponderisano, ne kao jedna vrijednost', () => {
    // Pola dana 50 °C, pola 40 °C — prosjek razlike je 24, ne 29 ni 19.
    const result = buildDayRow(
      day({
        heatingSamples: 144,
        heatingPairs: 144,
        flowMinusRoomSum: 72 * (50 - 21) + 72 * (40 - 21),
        roomSum: 288 * 21,
        outdoorSum: 288 * 1,
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.y).toBeCloseTo(0.5 * 24, 6);
  });

  describe('filtri odbacuju dan i kažu zašto', () => {
    const cases: Array<[string, Partial<DayAggregate>, string]> = [
      ['nepotpun dan', { samples: 200 }, 'INCOMPLETE'],
      ['bez vanjske', { outdoorSamples: 0 }, 'NO_OUTDOOR'],
      ['bez grijanja', { heatingSamples: 0, heatingPairs: 0 }, 'NO_HEATING'],
      [
        'polazna nepoznata na >10 % uzoraka',
        { heatingSamples: 100, heatingPairs: 80 },
        'FLOW_MISSING',
      ],
      ['grijanje cijeli dan', { heatingSamples: 287, heatingPairs: 287 }, 'DUTY'],
      ['bez grijanja (2 %)', { heatingSamples: 5, heatingPairs: 5 }, 'DUTY'],
      ['slab signal', { outdoorSum: 288 * 18 }, 'WEAK_SIGNAL'],
      ['nije u ravnoteži', { roomSum: 288 * 24 }, 'NOT_IN_BALANCE'],
      ['bez cilja', { targetRoomC: null }, 'NO_TARGET'],
    ];

    it.each(cases)('%s', (_label, over, expected) => {
      const result = buildDayRow(day(over));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(expected);
    });
  });
});

/** Dani sa poznatim s i c, uz šum — ono što bi stvarna kuća dala. */
function syntheticRows(
  count: number,
  slope: number,
  internalGain: number,
  noise = 0.15,
  seed = 7,
): DayRow[] {
  let state = seed;
  const random = () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
  const rows: DayRow[] = [];
  for (let index = 0; index < count; index++) {
    // x se kreće kroz dane (vrijeme se mijenja), y slijedi bilans.
    const x = 12 + index * 0.4;
    const y = slope * x - internalGain + (random() - 0.5) * 2 * noise;
    rows.push({
      localDate: `2026-11-${String(index + 1).padStart(2, '0')}`,
      x,
      y,
      duty: 0.5,
      roomMeanC: 21,
      outdoorMeanC: 21 - x,
    });
  }
  return rows;
}

describe('fit dnevnog bilansa', () => {
  it('nalazi nagib i interval koji ga sadrži', () => {
    const result = fitDailyBalance(syntheticRows(25, 0.8, 0.9));

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.slope).toBeCloseTo(0.8, 1);
    expect(result.ciLow).toBeLessThanOrEqual(result.slope);
    expect(result.ciHigh).toBeGreaterThanOrEqual(result.slope);
    expect(result.ciHigh - result.ciLow).toBeLessThan(0.2);
    expect(result.internalGainC).toBeCloseTo(0.9, 0);
  });

  it('isti ulaz daje isti interval — procjena je reproducibilna', () => {
    const rows = syntheticRows(20, 0.7, 0.8);
    const first = fitDailyBalance(rows);
    const second = fitDailyBalance(rows);
    expect(first).toEqual(second);
  });

  it('jedan divlji dan (otvoren prozor, gosti) ne pomjera nagib', () => {
    const rows = syntheticRows(25, 0.8, 0.9);
    const clean = fitDailyBalance(rows);
    const dirty = fitDailyBalance([
      ...rows,
      {
        localDate: '2026-12-24',
        x: 18,
        y: 40, // nemoguć dan
        duty: 0.9,
        roomMeanC: 21,
        outdoorMeanC: 3,
      },
    ]);

    expect(clean.status).toBe('ok');
    expect(dirty.status).toBe('ok');
    if (clean.status !== 'ok' || dirty.status !== 'ok') return;
    expect(Math.abs(dirty.slope - clean.slope)).toBeLessThan(0.02);
    expect(dirty.days).toBe(25); // divlji dan je odbačen
  });

  it('premalo dana: nema procjene, ne nula', () => {
    const result = fitDailyBalance(syntheticRows(MIN_DAYS_FOR_FIT - 1, 0.8, 0.9));
    expect(result.status).toBe('insufficient');
    if (result.status !== 'insufficient') return;
    expect(result.days).toBe(MIN_DAYS_FOR_FIT - 1);
  });

  it('nagib izvan fizičkih granica se ODBIJA, ne steže', () => {
    const result = fitDailyBalance(syntheticRows(25, 2.4, 0.9));
    expect(result.status).toBe('rejected');
    if (result.status !== 'rejected') return;
    expect(result.reason).toBe('SLOPE_OUT_OF_BOUNDS');
    expect(result.slope).toBeCloseTo(2.4, 1);
  });

  it('bez varijacije u x nema nagiba', () => {
    const rows = syntheticRows(15, 0.8, 0.9).map((row) => ({ ...row, x: 15 }));
    const result = fitDailyBalance(rows);
    expect(result.status).toBe('rejected');
    if (result.status !== 'rejected') return;
    expect(result.reason).toBe('NO_X_VARIANCE');
  });

  it('nagib 0,2–1,5 je prihvaćen na obje granice', () => {
    for (const slope of [0.25, 0.5, 1.0, 1.4]) {
      const result = fitDailyBalance(syntheticRows(25, slope, 0.9));
      expect(result.status).toBe('ok');
      if (result.status !== 'ok') continue;
      expect(result.slope).toBeCloseTo(slope, 1);
    }
  });
});
