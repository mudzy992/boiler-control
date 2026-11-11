import {
  DAY_GAIN_CAP_C,
  DAY_GAIN_MIN_DAYS,
  DAY_GAIN_WINDOW_DAYS,
  applyDayGain,
  dayGains,
  estimateDayGain,
  type DayGainPoint,
} from '../day-gain';

/**
 * `u_day` (`17` §13 korak 7). Ono što se ovdje zaključava nije formula nego
 * **znak i granica**: dobitak spušta polaznu, a preveliki ostatak se odbija
 * umjesto da postane savjet.
 */

/** Model `y = s·x − c` sa `s = 1`, `c = 2`. */
const MODEL = { slopeS: 1, internalGainC: 2 };

function points(values: number[], startDay = 1): DayGainPoint[] {
  return values.map((gainC, index) => ({
    localDate: `2026-11-${String(startDay + index).padStart(2, '0')}`,
    gainC,
  }));
}

describe('dayGains', () => {
  it('dan sa manje predatog grijanja nosi pozitivan dobitak', () => {
    // predviđeno = 1·x − 2; za x = 20 → 18. Stvarno y = 16 znači 2 K dobitka.
    const [gain] = dayGains([{ localDate: '2026-11-01', x: 20, y: 16 }], MODEL);
    expect(gain.gainC).toBe(2);
  });

  it('prosječan dan daje nulu, a hladniji od modela negativan dobitak', () => {
    expect(
      dayGains([{ localDate: '2026-11-01', x: 20, y: 18 }], MODEL)[0].gainC,
    ).toBe(0);
    expect(
      dayGains([{ localDate: '2026-11-02', x: 20, y: 20 }], MODEL)[0].gainC,
    ).toBe(-2);
  });

  it('računa se nad svim danima, uključujući one koje je fit izbacio', () => {
    const gains = dayGains(
      [
        { localDate: '2026-11-01', x: 20, y: 18 },
        { localDate: '2026-11-02', x: 20, y: 11 },
      ],
      MODEL,
    );
    expect(gains).toHaveLength(2);
    expect(gains[1].gainC).toBe(7);
  });
});

describe('estimateDayGain', () => {
  it('medijana, ne prosjek — jedan rođendan ne pomjera odluku', () => {
    const estimate = estimateDayGain(points([0.2, 0.1, 0.3, 0.2, 0.1, 0.2, 2]));
    expect(estimate).toMatchObject({ uDayC: 0.2, days: 7 });
    // Rasipanje se ipak vidi — da se zna kad jedan dan nosi sve.
    expect(estimate?.spreadC).toBe(1.9);
  });

  it('gleda samo zadnjih 7 dana', () => {
    // Osam starih dana sa dobitkom 9 K i četiri nova sa 0,5 K. Prozor zadnjih
    // 7 dana je 3 stara + 4 nova; medijana je 0,5. Bez prozora medijana bi
    // bila 9 — stari dani bi pregazili nove.
    const old = points([9, 9, 9, 9, 9, 9, 9, 9], 1);
    const fresh = points([0.5, 0.5, 0.5, 0.5], 10);
    const estimate = estimateDayGain([...old, ...fresh]);

    expect(estimate).toMatchObject({ uDayC: 0.5, days: 7 });
  });

  it('ograničava na ±2 K i kaže da je ograničio', () => {
    const positive = estimateDayGain(points([5, 5, 5, 5]));
    expect(positive).toMatchObject({ uDayC: DAY_GAIN_CAP_C, capped: true });

    const negative = estimateDayGain(points([-8, -8, -8, -8]));
    expect(negative).toMatchObject({ uDayC: -DAY_GAIN_CAP_C, capped: true });
  });

  it('bez 4 dana nema procjene — `null`, ne nula', () => {
    expect(estimateDayGain(points([0.5, 0.5, 0.5]))).toBeNull();
    expect(estimateDayGain([])).toBeNull();
    expect(DAY_GAIN_MIN_DAYS).toBe(4);
  });

  it('zanemarivo mali dobitak se zaokružuje na nulu', () => {
    expect(estimateDayGain(points([0.01, 0.02, 0.01, 0.02]))?.uDayC).toBe(0);
  });

  it('sortira po datumu, ne po redoslijedu iz baze', () => {
    const shuffled = [
      { localDate: '2026-11-04', gainC: 1 },
      { localDate: '2026-11-01', gainC: 0 },
      { localDate: '2026-11-02', gainC: 0 },
      { localDate: '2026-11-03', gainC: 1 },
    ];
    const estimate = estimateDayGain(shuffled);
    // Medijana 4 vrijednosti 0,0,1,1 je 0,5.
    expect(estimate).toMatchObject({ uDayC: 0.5, days: 4 });
  });

  it('neuspjeli brojevi se preskaču', () => {
    const estimate = estimateDayGain([
      ...points([0.2, 0.2, 0.2, 0.2]),
      { localDate: '2026-11-09', gainC: Number.NaN },
    ]);
    expect(estimate).toMatchObject({ uDayC: 0.2, days: 4 });
  });

  it('prozor je 7 dana', () => {
    expect(DAY_GAIN_WINDOW_DAYS).toBe(7);
  });
});

describe('applyDayGain', () => {
  it('dobitak spušta polaznu', () => {
    expect(applyDayGain(44, 1.5)).toBe(42.5);
  });

  it('negativan dobitak (hladniji dan od modela) podiže polaznu', () => {
    expect(applyDayGain(44, -1)).toBe(45);
  });

  it('bez procjene ne mijenja ništa — nepoznato nije nula', () => {
    expect(applyDayGain(44, null)).toBe(44);
    expect(applyDayGain(44, undefined)).toBe(44);
    expect(applyDayGain(44, Number.NaN)).toBe(44);
  });
});
