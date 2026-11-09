import {
  SHADOW_EQUAL_TOLERANCE_C,
  SHADOW_MIN_DAYS,
  compareShadowDay,
  parseReasons,
  shadowReport,
  type ShadowRow,
} from '../shadow-report';

/**
 * Shadow instrumentacija (`24` §6.5). Testira se ono što odlučuje da li se
 * odluka pušta korisniku: da razlika **bez razloga** bude prepoznata i da
 * nedostatak podatka ne izgleda kao neslaganje.
 */

const DAY = '2026-11-01';

function row(overrides: Partial<ShadowRow> = {}): ShadowRow {
  return {
    localDate: DAY,
    proposedFlowTemp: 45,
    shadowFlowC: 45,
    shadowAction: 'HOLD',
    shadowReasons: '',
    shadowVersion: 'shadow-1',
    shadowAt: new Date('2026-11-01T06:00:00Z'),
    ...overrides,
  };
}

/** `n` dana sa istom polaznom; koristi se za prag dana. */
function series(days: number, overrides: Partial<ShadowRow> = {}): ShadowRow[] {
  return Array.from({ length: days }, (_, index) =>
    row({
      localDate: `2026-11-${String(index + 1).padStart(2, '0')}`,
      ...overrides,
    }),
  );
}

describe('parseReasons', () => {
  it('dijeli po `+` i odbacuje prazno', () => {
    expect(parseReasons('COMFORT_HOLD+NIGHT_FLOOR')).toEqual([
      'COMFORT_HOLD',
      'NIGHT_FLOOR',
    ]);
    expect(parseReasons('')).toEqual([]);
    expect(parseReasons(null)).toEqual([]);
    expect(parseReasons('STEADY++')).toEqual(['STEADY']);
  });
});

describe('compareShadowDay', () => {
  it('spuštanje je negativna razlika', () => {
    const comparison = compareShadowDay(
      row({ shadowFlowC: 41, shadowReasons: 'COMFORT_HOLD' }),
    );
    expect(comparison).toMatchObject({
      direction: 'LOWER',
      deltaC: -4,
      formulaC: 45,
      decisionC: 41,
      explained: true,
    });
  });

  it('podizanje je pozitivna razlika', () => {
    expect(
      compareShadowDay(row({ shadowFlowC: 46.5, shadowReasons: 'UNDERSHOOT' })),
    ).toMatchObject({ direction: 'HIGHER', deltaC: 1.5, explained: true });
  });

  it('razlika samo od zaokruživanja nije razlika', () => {
    const comparison = compareShadowDay(
      row({ shadowFlowC: 45 + SHADOW_EQUAL_TOLERANCE_C }),
    );
    expect(comparison).toMatchObject({ direction: 'SAME', deltaC: 0 });
    // Isti dan ne traži razlog.
    expect(comparison?.explained).toBe(true);
  });

  it('razlika bez razloga je neobjašnjena — to je greška, ne ušteda', () => {
    const comparison = compareShadowDay(row({ shadowFlowC: 41, shadowReasons: '' }));
    expect(comparison).toMatchObject({ direction: 'LOWER', explained: false });
  });

  it('bez formule, bez odluke ili bez shadow upisa nema poređenja', () => {
    expect(compareShadowDay(row({ proposedFlowTemp: null }))).toBeNull();
    expect(compareShadowDay(row({ shadowFlowC: null }))).toBeNull();
    expect(
      compareShadowDay(row({ shadowFlowC: null, shadowAt: null })),
    ).toBeNull();
  });
});

describe('shadowReport — brojevi', () => {
  it('broji dane, razlike, smjer i udio', () => {
    const report = shadowReport([
      row({ localDate: '2026-11-01' }),
      row({ localDate: '2026-11-02', shadowFlowC: 41, shadowReasons: 'COMFORT_HOLD' }),
      row({ localDate: '2026-11-03', shadowFlowC: 47, shadowReasons: 'UNDERSHOOT' }),
      row({ localDate: '2026-11-04', shadowFlowC: 41, shadowReasons: 'COMFORT_HOLD+DWELL' }),
    ]);

    expect(report).toMatchObject({
      days: 4,
      evaluated: 4,
      pending: 0,
      differences: 3,
      lowered: 2,
      raised: 1,
      same: 1,
      changeSharePct: 75,
      maxAbsDeltaC: 4,
      // |−4| + |2| + |−4| = 10, kroz 3 dana sa razlikom → 3,3
      meanAbsDeltaC: 3.3,
    });
    expect(report.byReason).toEqual([
      { reason: 'COMFORT_HOLD', days: 2 },
      { reason: 'DWELL', days: 1 },
      { reason: 'UNDERSHOOT', days: 1 },
    ]);
  });

  it('razlog se broji jednom po danu, ne po pojavljivanju', () => {
    const report = shadowReport([
      row({ shadowFlowC: 41, shadowReasons: 'DWELL+DWELL' }),
    ]);
    expect(report.byReason).toEqual([{ reason: 'DWELL', days: 1 }]);
  });

  it('dani bez shadow upisa i bez formule ne ulaze u razlike', () => {
    const report = shadowReport([
      row({ localDate: '2026-11-01' }),
      row({ localDate: '2026-11-02', shadowAt: null, shadowFlowC: null, shadowReasons: null }),
      row({ localDate: '2026-11-03', proposedFlowTemp: null, shadowFlowC: 41 }),
    ]);

    expect(report).toMatchObject({
      days: 3,
      evaluated: 2,
      pending: 1,
      withoutFormula: 1,
      differences: 0,
    });
  });

  it('prazan period ne baca grešku i nema datume', () => {
    const report = shadowReport([]);
    expect(report).toMatchObject({
      days: 0,
      evaluated: 0,
      differences: 0,
      changeSharePct: 0,
      maxAbsDeltaC: 0,
      meanAbsDeltaC: 0,
      firstDate: null,
      lastDate: null,
      verdict: 'NO_DATA',
    });
  });

  it('sortira po datumu bez obzira na redoslijed iz baze', () => {
    const report = shadowReport([
      row({ localDate: '2026-11-05' }),
      row({ localDate: '2026-11-02' }),
      row({ localDate: '2026-11-09' }),
    ]);
    expect(report.firstDate).toBe('2026-11-02');
    expect(report.lastDate).toBe('2026-11-09');
  });

  it('broji dane u kojima je model bojlera blokirao savjet', () => {
    const report = shadowReport([
      row({ localDate: '2026-11-01', shadowFlowC: 45, shadowReasons: 'MODEL_UNVERIFIED' }),
      row({ localDate: '2026-11-02', shadowFlowC: 45, shadowReasons: 'MODEL_UNVERIFIED' }),
      row({ localDate: '2026-11-03' }),
    ]);
    expect(report.blockedByModel).toBe(0);
    expect(
      shadowReport([
        row({ localDate: '2026-11-01', shadowFlowC: 43, shadowReasons: 'MODEL_UNVERIFIED' }),
      ]).blockedByModel,
    ).toBe(1);
  });
});

describe('shadowReport — presuda', () => {
  it('neobjašnjena razlika blokira i kad je dana dovoljno', () => {
    const rows = series(SHADOW_MIN_DAYS + 5);
    rows[3] = row({ localDate: rows[3].localDate, shadowFlowC: 41, shadowReasons: '' });

    const report = shadowReport(rows);
    expect(report.evaluated).toBeGreaterThanOrEqual(SHADOW_MIN_DAYS);
    expect(report.verdict).toBe('UNEXPLAINED_DIFFERENCES');
    expect(report.unexplained).toHaveLength(1);
    expect(report.unexplained[0].localDate).toBe(rows[3].localDate);
    expect(report.verdictNote).toMatch(/greška/);
  });

  it('neobjašnjena razlika ima prioritet nad prekratkim periodom', () => {
    const report = shadowReport([
      row({ shadowFlowC: 41, shadowReasons: '' }),
    ]);
    expect(report.verdict).toBe('UNEXPLAINED_DIFFERENCES');
  });

  it('prekratak period, iako su sve razlike objašnjene', () => {
    const report = shadowReport([
      row({ localDate: '2026-11-01', shadowFlowC: 41, shadowReasons: 'COMFORT_HOLD' }),
    ]);
    expect(report.verdict).toBe('NOT_ENOUGH_DAYS');
    expect(report.verdictNote).toContain(`1 od ${SHADOW_MIN_DAYS}`);
  });

  it('dovoljno dana bez ijedne razlike — nema učinka, nije spremno', () => {
    const report = shadowReport(series(SHADOW_MIN_DAYS));
    expect(report.verdict).toBe('NO_DIFFERENCES');
    expect(report.differences).toBe(0);
  });

  it('dovoljno dana i sve razlike objašnjene — spremno', () => {
    const rows = series(SHADOW_MIN_DAYS);
    rows[0] = row({ localDate: rows[0].localDate, shadowFlowC: 41, shadowReasons: 'COMFORT_HOLD' });

    const report = shadowReport(rows);
    expect(report.verdict).toBe('READY');
    expect(report.differences).toBe(1);
    expect(report.unexplained).toEqual([]);
    expect(report.verdictNote).toMatch(/uslov za puštanje/i);
  });

  it('bez podataka presuda je NO_DATA, ne „spremno"', () => {
    expect(shadowReport([]).verdict).toBe('NO_DATA');
  });
});
