import {
  BACKFILL_VERSION,
  DEGREE_DAY_BASE_C,
  MIN_OUTDOOR_SAMPLES_PER_DAY,
  reconstructDay,
  summarise,
  type BackfillInput,
  type BackfillEvent,
} from '../backfill-reconstruction';

/**
 * Backfill iz onoga što postoji (`20`, `21`).
 *
 * Testira se **šta smije biti upisano**, a ne da funkcija radi: backfill je
 * jedina operacija koja pravi redove za dane koji su već prošli, pa greška ovdje
 * nije prikaz nego lažan zapis u bazi — i to onaj koji poslije izgleda kao
 * mjerenje.
 *
 * Zato su najvažniji testovi negativni: dan bez izvora se **ne** upisuje,
 * `shadow*` ostaje prazno, polja koja traže seriju su u `missing`.
 */

const ZONE = 'Europe/Sarajevo';

function event(
  startedAt: string,
  endedAt: string | null,
  room = 21,
  target = 21,
): BackfillEvent {
  return {
    timestampStart: new Date(startedAt),
    timestampEnd: endedAt == null ? null : new Date(endedAt),
    roomCurrentTemp: room,
    roomTargetTemp: target,
  };
}

function input(overrides: Partial<BackfillInput> = {}): BackfillInput {
  return {
    localDate: '2026-03-10',
    zone: ZONE,
    events: [],
    boilerRows: [],
    gasReadings: [],
    recommendation: null,
    ...overrides,
  };
}

describe('reconstructDay — dan bez ijednog izvora', () => {
  it('vraća null: prazan dan se ne upisuje', () => {
    // Red bi tvrdio da je sistem radio i nije imao šta reći; to nije isto kao
    // „nemamo podatke" i ne smije se pojaviti u bazi.
    expect(reconstructDay(input())).toBeNull();
  });

  it('događaj iz drugog dana ne pravi red', () => {
    const row = reconstructDay(
      input({
        events: [event('2026-03-09T20:00:00Z', '2026-03-09T21:00:00Z')],
      }),
    );
    expect(row).toBeNull();
  });
});

describe('reconstructDay — ciklusi iz događaja', () => {
  it('broji samo zatvorene događaje, a trajanje uzima stvarno', () => {
    const row = reconstructDay(
      input({
        events: [
          event('2026-03-10T05:00:00Z', '2026-03-10T05:30:00Z'),
          event('2026-03-10T07:00:00Z', '2026-03-10T07:15:00Z'),
          // Otvoren događaj: nema trajanje, pa ne ulazi u broj ni u zbir.
          event('2026-03-10T09:00:00Z', null),
        ],
      }),
    );

    expect(row?.cycles).toBe(2);
    expect(row?.medianCycleMin).toBe(22.5);
    expect(row?.sources).toContain('HEATING_EVENT');
  });

  it('dutyPercent je udio dana, a ne udio ciklusa', () => {
    const row = reconstructDay(
      input({
        events: [event('2026-03-10T05:00:00Z', '2026-03-10T07:00:00Z')],
      }),
    );
    // 120 min / 1440 min = 8.33 %
    expect(row?.dutyPercent).toBeCloseTo(8.33, 2);
  });

  it('prebačaj i podbačaj se mjere prema cilju koji je tada bio', () => {
    const row = reconstructDay(
      input({
        events: [
          event('2026-03-10T05:00:00Z', '2026-03-10T06:00:00Z', 20.5, 22),
          event('2026-03-10T07:00:00Z', '2026-03-10T08:00:00Z', 22.6, 22),
        ],
      }),
    );
    expect(row?.undershootC).toBeCloseTo(1.5, 2);
    expect(row?.overshootC).toBeCloseTo(0.6, 2);
  });

  it('bez događaja ciklusi su u `missing`, a ne nula', () => {
    const row = reconstructDay(
      input({
        gasReadings: [
          { readingDate: new Date('2026-03-10T18:00:00Z'), consumption: 4.2 },
        ],
      }),
    );
    expect(row?.cycles).toBeNull();
    expect(row?.missing).toContain('cycles');
  });
});

describe('reconstructDay — polazna, plin i stepen-dan', () => {
  it('polazna je zadnje stvarno očitanje, a `flowSetSince` ostaje prazno', () => {
    const row = reconstructDay(
      input({
        boilerRows: [
          {
            createdAt: new Date('2026-03-10T04:00:00Z'),
            externalTemp: 2,
            suggestedFlowTemp: 50,
            actualFlowTemp: 44,
          },
          {
            createdAt: new Date('2026-03-10T18:00:00Z'),
            externalTemp: 9,
            suggestedFlowTemp: 40,
            actualFlowTemp: 41.5,
          },
        ],
      }),
    );

    expect(row?.flowSetC).toBe(41.5);
    // Vrijeme promjene nije poznato — upis zadnjeg očitanja kao „od tada" bila
    // bi tvrdnja koju podaci ne nose.
    expect(row?.flowSetSince).toBeNull();
    expect(row?.flowSetSource).toBe('UNKNOWN');
  });

  it('plin se sabira iz dnevnih očitanja, a izostaje bez njih', () => {
    const withGas = reconstructDay(
      input({
        gasReadings: [
          { readingDate: new Date('2026-03-10T08:00:00Z'), consumption: 4.5 },
          { readingDate: new Date('2026-03-10T19:00:00Z'), consumption: 1.5 },
        ],
      }),
    );
    expect(withGas?.gasM3).toBe(6);

    const noGas = reconstructDay(
      input({
        events: [event('2026-03-10T05:00:00Z', '2026-03-10T06:00:00Z')],
      }),
    );
    expect(noGas?.gasM3).toBeNull();
    expect(noGas?.missing).toContain('gasM3');
  });

  it('stepen-dan se računa samo kad ima dovoljno mjerenja vanjske temperature', () => {
    const few = reconstructDay(
      input({
        boilerRows: [
          {
            createdAt: new Date('2026-03-10T04:00:00Z'),
            externalTemp: 5,
            suggestedFlowTemp: 45,
            actualFlowTemp: 40,
          },
        ],
      }),
    );
    expect(few?.degreeDays).toBeNull();

    const enough = reconstructDay(
      input({
        boilerRows: Array.from(
          { length: MIN_OUTDOOR_SAMPLES_PER_DAY },
          (_, index) => ({
            createdAt: new Date(`2026-03-10T0${index % 10}:00:00Z`),
            externalTemp: 5,
            suggestedFlowTemp: 45,
            actualFlowTemp: 40,
          }),
        ),
      }),
    );
    expect(enough?.degreeDays).toBe(DEGREE_DAY_BASE_C - 5);
    expect(enough?.sources).toContain('DEGREE_DAYS_FROM_DEVICE');
  });

  it('topao dan daje stepen-dan nula, ne negativan', () => {
    const row = reconstructDay(
      input({
        boilerRows: Array.from({ length: MIN_OUTDOOR_SAMPLES_PER_DAY }, () => ({
          createdAt: new Date('2026-03-10T12:00:00Z'),
          externalTemp: 24,
          suggestedFlowTemp: 30,
          actualFlowTemp: 30,
        })),
      }),
    );
    expect(row?.degreeDays).toBe(0);
  });
});

describe('reconstructDay — šta backfill ne smije popuniti', () => {
  it('predlog dolazi iz stare preporuke i nosi oznaku izvora', () => {
    const row = reconstructDay(
      input({
        recommendation: {
          date: new Date('2026-03-10T05:10:00Z'),
          recommendedFlowTemp: 47.5,
        },
      }),
    );
    expect(row?.proposedFlowTemp).toBe(47.5);
    expect(row?.sources).toContain('RECOMMENDATION');
  });

  it('shadow, params, histereza i noćna polja su uvijek u `missing`', () => {
    const row = reconstructDay(
      input({
        events: [event('2026-03-10T05:00:00Z', '2026-03-10T07:00:00Z')],
        recommendation: {
          date: new Date('2026-03-10T05:10:00Z'),
          recommendedFlowTemp: 47.5,
        },
      }),
    );

    // Odluka koja tada nije donesena ne smije se upisati sada: to bi bio lažan
    // zapis o prošlosti, a ne backfill.
    expect(row?.missing).toEqual(
      expect.arrayContaining([
        'shadowFlowC',
        'shadowAction',
        'shadowReasons',
        'params',
        'hysteresisK',
        'heatRateCPerHour',
        'nightUndershootC',
      ]),
    );
    expect(row).not.toHaveProperty('shadowFlowC');
  });

  it('svaki red nosi verziju backfilla, da se poslije može razlikovati', () => {
    const row = reconstructDay(
      input({
        events: [event('2026-03-10T05:00:00Z', '2026-03-10T06:00:00Z')],
      }),
    );
    expect(row?.version).toBe(BACKFILL_VERSION);
  });
});

describe('summarise', () => {
  it('broji dane po izvoru i nedostajuća polja', () => {
    const rows = [
      reconstructDay(
        input({
          events: [event('2026-03-10T05:00:00Z', '2026-03-10T06:00:00Z')],
          gasReadings: [
            { readingDate: new Date('2026-03-10T18:00:00Z'), consumption: 3 },
          ],
        }),
      )!,
      reconstructDay(
        input({
          localDate: '2026-03-11',
          recommendation: {
            date: new Date('2026-03-11T05:10:00Z'),
            recommendedFlowTemp: 45,
          },
        }),
      )!,
    ];

    const summary = summarise(rows);
    expect(summary.days).toBe(2);
    expect(summary.withEvents).toBe(1);
    expect(summary.withGas).toBe(1);
    expect(summary.withProposal).toBe(1);
    expect(summary.withDegreeDays).toBe(0);
    expect(summary.totalMissing).toBeGreaterThan(0);
  });
});
