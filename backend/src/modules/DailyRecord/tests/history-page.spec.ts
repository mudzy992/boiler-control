import fs from 'fs';
import path from 'path';

import { applyPageCycles } from '../history-page';
import { buildDailyHistory, OUTCOME_VERSION_EVENTS, type DailyRecordInput } from '../daily-history';

/**
 * Historija: ciklusi za dane koje obračun nije stigao (`F13`, treći krug).
 *
 * Korisnikova snimka je pokazala crtice za 2026-11-09 i 2026-11-10 u koloni
 * „Ciklusi". Prva popravka (ciklusi iz `HeatingEvent`) je bila ispravna, ali
 * **nedovoljna**: `DailyOutcomeService` popunjava samo 7 dana unazad, a tabela
 * prikazuje 20. Za starije dane `cycles` je zauvijek ostajao `null`.
 *
 * Ovi testovi provjeravaju sastavljanje strane koje radi u servisu — bez baze,
 * jer `PrismaService` u ovom okruženju nije generisan.
 */

const ZONE = 'Europe/Sarajevo';

function row(overrides: Partial<DailyRecordInput> = {}): DailyRecordInput {
  return {
    localDate: '2026-11-09',
    proposedFlowTemp: 49.8,
    proposedAt: new Date('2026-11-09T05:00:00Z'),
    cycles: null,
    medianCycleMin: null,
    dutyPercent: null,
    overshootC: null,
    undershootC: null,
    flowSetC: null,
    flowSetSource: null,
    gasM3: null,
    degreeDays: null,
    nightUndershootC: null,
    hysteresisK: null,
    heatRateCPerHour: null,
    shadowFlowC: null,
    shadowAction: null,
    modelVersion: null,
    outcomeVersion: null,
    outcomeAt: null,
    ...overrides,
  };
}

describe('F13: strana historije dobija cikluse iz događaja', () => {
  it('red bez ciklusa dobija broj, a red sa ciklusima ostaje netaknut', () => {
    const page = applyPageCycles(
      [
        row({ localDate: '2026-11-09', cycles: null }),
        row({ localDate: '2026-11-10', cycles: 3, medianCycleMin: 25 }),
      ],
      [
        {
          startedAt: new Date('2026-11-09T07:00:00Z'),
          endedAt: new Date('2026-11-09T07:50:00Z'),
        },
        {
          startedAt: new Date('2026-11-09T10:00:00Z'),
          endedAt: new Date('2026-11-09T10:40:00Z'),
        },
      ],
      ZONE,
    );

    expect(page.rows[0].cycles).toBe(2);
    expect(page.rows[1].cycles).toBe(3);
    expect(page.filledFromEvents.has('2026-11-09')).toBe(true);
    expect(page.filledFromEvents.has('2026-11-10')).toBe(false);
  });

  it('ciklusi iz događaja ne popunjavaju `dutyPercent` (to nije mjereno)', () => {
    const page = applyPageCycles(
      [row({ localDate: '2026-11-09', cycles: null })],
      [
        {
          startedAt: new Date('2026-11-09T07:00:00Z'),
          endedAt: new Date('2026-11-09T07:50:00Z'),
        },
      ],
      ZONE,
    );

    expect(page.rows[0].cycles).toBe(1);
    // Nula bi tvrdila da je rad izmjeren i da iznosi 0 %.
    expect(page.rows[0].dutyPercent).toBeNull();
  });

  it('dan bez događaja ostaje crtica — „0 ciklusa" se ne izmišlja', () => {
    const page = applyPageCycles([row({ localDate: '2026-11-08' })], [], ZONE);

    expect(page.rows[0].cycles).toBeNull();
    expect(page.filledFromEvents.size).toBe(0);
  });

  it('izvor ciklusa je vidljiv: SERVIS i TABELA koriste istu oznaku', () => {
    /*
     * Ako se oznaka razlikuje, `cyclesSource` u historiji nikad ne bi bio
     * `EVENTS` — red bi izgledao kao puno mjerenje. Poredi se sa **izvorom**
     * `daily-outcome.service.ts`, a ne sa importom: taj servis uvlači
     * `PrismaService`, pa bi test tražio generisan klijent.
     */
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'daily-outcome.service.ts'),
      'utf8',
    );
    const match = /OUTCOME_VERSION_EVENTS = '([^']+)'/.exec(source);
    expect(match?.[1]).toBe(OUTCOME_VERSION_EVENTS);
  });

  it('`cyclesSource` je EVENTS za red sa oznakom, SERIES za pun red, NONE za crticu', () => {
    const history = buildDailyHistory([
      row({ localDate: '2026-11-08', cycles: null }),
      row({
        localDate: '2026-11-09',
        cycles: 2,
        outcomeVersion: OUTCOME_VERSION_EVENTS,
      }),
      row({ localDate: '2026-11-10', cycles: 4, outcomeVersion: 'outcome-1' }),
    ]);

    expect(history.rows.map((r) => r.cyclesSource)).toEqual([
      'NONE',
      'EVENTS',
      'SERIES',
    ]);
  });
});
