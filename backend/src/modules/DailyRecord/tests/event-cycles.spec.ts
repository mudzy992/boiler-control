import { fillCyclesFromEvents } from '../event-cycles';
import { cyclesFromEvents } from '../day-outcome';

/**
 * Ciklusi u historiji (`F13`, treći krug).
 *
 * Korisnik je i poslije prve popravke vidio crtice u koloni „Ciklusi" za
 * 2026-11-09 i 2026-11-10, iako su oba dana imala paljenja. Uzrok nije bio
 * prikaz nego **prozor pisca**: `DailyOutcomeService` popunjava samo
 * `OUTCOME_LOOKBACK_DAYS = 7` dana unazad, a tabela prikazuje 20. Za starije
 * dane `cycles` je zato zauvijek ostajao `null`, a `HeatingEvent` redovi su
 * postojali cijelo vrijeme — od prve verzije aplikacije.
 *
 * Ovi testovi čuvaju tri stvari:
 *  1. ciklusi se popunjavaju iz događaja kad ih red nema;
 *  2. **već upisan broj se ne dira** (serija uzoraka ima prednost, jer mjeri i
 *     rad i cikluse iz istog izvora);
 *  3. ciklus koji prelazi ponoć pripada danu u kojem je počeo.
 */

const ZONE = 'Europe/Sarajevo';

function startsAt(iso: string): Date {
  return new Date(iso);
}

describe('F13: ciklusi iz događaja za dane koje obračun nije stigao', () => {
  it('dan bez `cycles` dobija broj ciklusa iz događaja', () => {
    const [filled] = fillCyclesFromEvents(
      [{ localDate: '2026-11-09', cycles: null, medianCycleMin: null }],
      [
        {
          startedAt: startsAt('2026-11-09T05:00:00Z'),
          endedAt: startsAt('2026-11-09T05:40:00Z'),
        },
        {
          startedAt: startsAt('2026-11-09T08:00:00Z'),
          endedAt: startsAt('2026-11-09T08:30:00Z'),
        },
      ],
      ZONE,
    );

    expect(filled.cycles).toBe(2);
    expect(filled.source).toBe('EVENTS');
    // Medijana je 35 min (30 i 40), pa je mjerenje — ne crtica.
    expect(filled.medianCycleMin).toBe(35);
  });

  it('ciklus koji traje pripada danu početka, ne završetka', () => {
    const [filled] = fillCyclesFromEvents(
      [{ localDate: '2026-11-09', cycles: null, medianCycleMin: null }],
      // 23:40 UTC = 00:40 po lokalnom vremenu (CET, +1) — dakle 10. 11.
      [
        {
          startedAt: startsAt('2026-11-09T22:30:00Z'),
          endedAt: startsAt('2026-11-09T23:20:00Z'),
        },
      ],
      ZONE,
    );

    // 22:30 UTC je 23:30 lokalno → 9. 11. Ostaje na 9. 11.
    expect(filled.cycles).toBe(1);
    expect(filled.source).toBe('EVENTS');
  });

  it('broj koji je već upisala serija uzoraka se NE prepisuje', () => {
    const [filled] = fillCyclesFromEvents(
      [{ localDate: '2026-11-09', cycles: 4, medianCycleMin: 22 }],
      [
        {
          startedAt: startsAt('2026-11-09T05:00:00Z'),
          endedAt: startsAt('2026-11-09T05:40:00Z'),
        },
        {
          startedAt: startsAt('2026-11-09T08:00:00Z'),
          endedAt: startsAt('2026-11-09T08:30:00Z'),
        },
        {
          startedAt: startsAt('2026-11-09T12:00:00Z'),
          endedAt: startsAt('2026-11-09T12:30:00Z'),
        },
      ],
      ZONE,
    );

    expect(filled.cycles).toBe(4);
    expect(filled.medianCycleMin).toBe(22);
    expect(filled.source).toBe('RECORDED');
  });

  it('dan bez ijednog događaja ostaje crtica — nula se ne izmišlja', () => {
    const [filled] = fillCyclesFromEvents(
      [{ localDate: '2026-11-08', cycles: null, medianCycleMin: null }],
      [
        {
          startedAt: startsAt('2026-11-09T05:00:00Z'),
          endedAt: startsAt('2026-11-09T05:40:00Z'),
        },
      ],
      ZONE,
    );

    expect(filled.cycles).toBeNull();
    expect(filled.medianCycleMin).toBeNull();
  });

  it('nezavršen ciklus je broj, ali ne i medijana', () => {
    const [filled] = fillCyclesFromEvents(
      [{ localDate: '2026-11-10', cycles: null, medianCycleMin: null }],
      [{ startedAt: startsAt('2026-11-10T04:00:00Z'), endedAt: null }],
      ZONE,
    );

    expect(filled.cycles).toBe(1);
    expect(filled.medianCycleMin).toBeNull();
  });

  it('ciklus kraći od 5 min ne ulazi u medijanu (isti prag kao obračun)', () => {
    const events = [
      {
        startedAt: startsAt('2026-11-10T04:00:00Z'),
        endedAt: startsAt('2026-11-10T04:02:00Z'),
      },
      {
        startedAt: startsAt('2026-11-10T06:00:00Z'),
        endedAt: startsAt('2026-11-10T06:44:00Z'),
      },
    ];
    const [filled] = fillCyclesFromEvents(
      [{ localDate: '2026-11-10', cycles: null, medianCycleMin: null }],
      events,
      ZONE,
    );

    expect(filled.cycles).toBe(2);
    expect(filled.medianCycleMin).toBe(44);
    // Isti rezultat kao funkcija koju koristi obračun — bez druge istine.
    expect(filled.medianCycleMin).toBe(
      cyclesFromEvents('2026-11-10', events, ZONE).medianCycleMin,
    );
  });

  it('prazan skup događaja vraća redove netaknute', () => {
    const rows = [
      { localDate: '2026-11-01', cycles: 3, medianCycleMin: 20 },
      { localDate: '2026-11-02', cycles: null, medianCycleMin: null },
    ];

    const filled = fillCyclesFromEvents(rows, [], ZONE);

    expect(filled.map((row) => row.cycles)).toEqual([3, null]);
  });
});
