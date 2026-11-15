import {
  BACKFILL_VERSION,
  DEGREE_DAY_BASE_C,
  MIN_OUTDOOR_SAMPLES_PER_DAY,
  reconstructDay,
  summarise,
  completionFields,
  summariseCompletion,
  buildCompletionUpdate,
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

/**
 * §10.45 — dopuna `gasM3`/`degreeDays` na postojećem redu.
 *
 * Izmjereno: 7 dana (09.–15.11.) ima izvor a polje je prazno, jer live writer
 * ta polja ne upisuje. Dopuna ih vraća bez diranja ostalih polja.
 *
 * Testovi su napisani tako da padnu na **najgorem** ishodu, ne na lakšem:
 * tiho prepisivanje postojeće vrijednosti i upis `null`-a.
 */
describe('completionFields — dopuna samo praznih polja', () => {
  const nothing = { gasM3: null, degreeDays: null };

  it('popunjava oba kad su oba prazna', () => {
    expect(
      completionFields(nothing, { gasM3: 6.64, degreeDays: 12.31 }),
    ).toEqual({ gasM3: 6.64, degreeDays: 12.31 });
  });

  it('NIKAD ne prepisuje postojeću vrijednost', () => {
    const patch = completionFields(
      { gasM3: 5.6, degreeDays: 11.2 },
      { gasM3: 9.9, degreeDays: 3.3 },
    );
    // Bitno je da je prazan objekat, a ne „ista vrijednost": prazan objekat
    // znači da se red ne dira uopšte.
    expect(patch).toEqual({});
  });

  it('popunjava samo polje koje je prazno, drugo ostavlja na miru', () => {
    const patch = completionFields(
      { gasM3: 5.6, degreeDays: null },
      { gasM3: 9.9, degreeDays: 3.3 },
    );
    expect(patch).toEqual({ degreeDays: 3.3 });
    expect(patch).not.toHaveProperty('gasM3');
  });

  it('NIKAD ne upisuje null — prazno ostaje prazno', () => {
    expect(
      completionFields(nothing, { gasM3: null, degreeDays: null }),
    ).toEqual({});
  });

  it('null iz rekonstrukcije ne popunjava polje koje ima vrijednost', () => {
    expect(
      completionFields(
        { gasM3: null, degreeDays: 11 },
        { gasM3: null, degreeDays: null },
      ),
    ).toEqual({});
  });

  it('nula je vrijednost, ne praznina', () => {
    // Stepen-dan 0 je legitiman (topao dan). Ako se 0 tretira kao prazno,
    // polje bi se popunjavalo ponovo svakog dana.
    expect(
      completionFields(
        { gasM3: null, degreeDays: null },
        { gasM3: 0, degreeDays: 0 },
      ),
    ).toEqual({ gasM3: 0, degreeDays: 0 });
    expect(
      completionFields(
        { gasM3: 0, degreeDays: 0 },
        { gasM3: 4, degreeDays: 4 },
      ),
    ).toEqual({});
  });
});

describe('summariseCompletion — brojevi prije upisa', () => {
  it('broji redove, polja i parove odvojeno', () => {
    const summary = summariseCompletion([
      {
        existing: { gasM3: null, degreeDays: null },
        reconstructed: { gasM3: 1, degreeDays: 2 },
      },
      {
        existing: { gasM3: 5, degreeDays: null },
        reconstructed: { gasM3: 9, degreeDays: 2 },
      },
      {
        existing: { gasM3: 5, degreeDays: 1 },
        reconstructed: { gasM3: 9, degreeDays: 2 },
      },
      {
        existing: { gasM3: null, degreeDays: null },
        reconstructed: { gasM3: null, degreeDays: null },
      },
    ]);
    // Red 1: oba. Red 2: samo stepen-dan. Red 3 i 4: ništa.
    expect(summary).toEqual({ rows: 2, gas: 1, degreeDays: 2, both: 1 });
  });

  it('prazan ulaz daje nule, ne deljenje nulom', () => {
    expect(summariseCompletion([])).toEqual({
      rows: 0,
      gas: 0,
      degreeDays: 0,
      both: 0,
    });
  });
});

/**
 * §10.45 — SQL za dopunu, provjeren BEZ baze.
 *
 * Prva verzija upisa je uz svaku vrijednost dodavala i `values.push(null)`
 * „da indeksi ostanu poravnati". Postgres takav upit odbija
 * (`bind message supplies N parameters, but prepared statement requires M`),
 * a greška se bez baze ne vidi i obara **cijelu** transakciju dopune.
 *
 * Zato se ovdje broji: broj parametara mora biti **tačno** najveći `$n`.
 */
describe('buildCompletionUpdate — SQL bez viska parametara', () => {
  const maxPlaceholder = (text: string): number => {
    const found = [...text.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]));
    return found.length === 0 ? 0 : Math.max(...found);
  };

  it('oba polja: dva parametra, dva placeholder-a, oba uslova IS NULL', () => {
    const update = buildCompletionUpdate({ gasM3: 6.64, degreeDays: 12.31 })!;
    expect(update.params).toEqual([6.64, 12.31]);
    // `sets` je niz; zarez dodaje pozivalac pri `join(', ')`. Test tvrdi
    // elemente, ne spojeni string — inače bi provjeravao tuđi format.
    expect(update.sets).toEqual(['"gasM3" = $1', '"degreeDays" = $2']);
    expect(update.sets.join(', ')).toBe('"gasM3" = $1, "degreeDays" = $2');
    expect(update.where).toEqual(['"gasM3" IS NULL', '"degreeDays" IS NULL']);
    expect(maxPlaceholder(update.sets.join(' '))).toBe(update.params.length);
  });

  it('samo plin: JEDAN parametar (ne dva) i placeholder $1', () => {
    const update = buildCompletionUpdate({ gasM3: 5.6 })!;
    expect(update.params).toEqual([5.6]);
    expect(update.sets).toEqual(['"gasM3" = $1']);
    // Ovo je test koji pada na `push(null)` verziji: tada bi params.length bio 2.
    expect(update.params.length).toBe(maxPlaceholder(update.sets.join(' ')));
  });

  it('samo stepen-dan: jedan parametar, i on je $1 a ne $2', () => {
    const update = buildCompletionUpdate({ degreeDays: 11 })!;
    expect(update.params).toEqual([11]);
    expect(update.sets).toEqual(['"degreeDays" = $1']);
    expect(update.params.length).toBe(maxPlaceholder(update.sets.join(' ')));
  });

  it('prazan patch nema upit — ni UPDATE sa SET prazno', () => {
    expect(buildCompletionUpdate({})).toBeNull();
  });

  it('null se ne upisuje — nema ni parametra ni placeholdera', () => {
    expect(buildCompletionUpdate({ gasM3: null, degreeDays: null })).toBeNull();
    const onlyDegree = buildCompletionUpdate({ gasM3: null, degreeDays: 3 })!;
    expect(onlyDegree.params).toEqual([3]);
    expect(onlyDegree.where).toEqual(['"degreeDays" IS NULL']);
  });

  it('nula se upisuje kao vrijednost', () => {
    const update = buildCompletionUpdate({ gasM3: 0, degreeDays: 0 })!;
    expect(update.params).toEqual([0, 0]);
  });
});
