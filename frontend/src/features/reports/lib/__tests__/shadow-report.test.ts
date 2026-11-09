import { describe, expect, it } from 'vitest';
import {
  isReportEmpty,
  reasonBreakdown,
  reportHeadline,
  verdictRank,
  verdictTone,
} from '../shadow-report';
import type { ShadowReportResponse } from '../../types';

/**
 * Shadow izvještaj kao **tvrdnja**, ne kao broj (`24` §6.5).
 *
 * Najvažnije što ovi testovi čuvaju: prazan izvještaj nije „0 razlika", a
 * razlika bez razloga nije ušteda. Ako UI pobrka ta dva, korisnik dobije
 * uvjerljiv broj koji ništa ne dokazuje.
 */

function report(
  overrides: Partial<ShadowReportResponse> = {},
): ShadowReportResponse {
  return {
    days: 21,
    evaluated: 21,
    pending: 0,
    withoutFormula: 0,
    differences: 4,
    lowered: 3,
    raised: 1,
    same: 17,
    changeSharePct: 19.0,
    byReason: [{ reason: 'UNDERSHOOT', days: 4 }],
    unexplained: [],
    maxAbsDeltaC: 2.5,
    meanAbsDeltaC: 1.2,
    blockedByModel: 0,
    explored: 2,
    firstDate: '2026-10-01',
    lastDate: '2026-10-21',
    verdict: 'READY',
    verdictNote: 'Dovoljno dana i sve razlike objašnjive.',
    ...overrides,
  };
}

describe('isReportEmpty', () => {
  it('nema zapisa ili nema izračunatih dana znači prazno', () => {
    expect(isReportEmpty(null)).toBe(true);
    expect(isReportEmpty(report({ days: 0 }))).toBe(true);
    expect(isReportEmpty(report({ evaluated: 0 }))).toBe(true);
  });

  it('izvještaj bez razlika nije prazan — to je nalaz', () => {
    // „Nema razlika" je tvrdnja o ponašanju; prazan spisak nije.
    expect(isReportEmpty(report({ differences: 0, byReason: [] }))).toBe(false);
  });
});

describe('reportHeadline', () => {
  it('bez izvještaja kaže da ga nema, ne nulu', () => {
    expect(reportHeadline(null)).toMatch(/Nema izvještaja/);
  });

  it('prazan period i neizračunat shadow imaju različite rečenice', () => {
    expect(reportHeadline(report({ days: 0 }))).toMatch(/nema zapisa/);
    expect(reportHeadline(report({ evaluated: 0 }))).toMatch(
      /nije izračunata/,
    );
  });

  it('inače prenosi presudu sa backenda, bez svog zaključka', () => {
    const value = report({ verdictNote: 'Konkretna rečenica sa brojem 21.' });
    expect(reportHeadline(value)).toBe('Konkretna rečenica sa brojem 21.');
  });
});

describe('verdictTone', () => {
  it('neobjašnjene razlike su greška, READY je uspjeh', () => {
    expect(verdictTone('UNEXPLAINED_DIFFERENCES')).toBe('error');
    expect(verdictTone('READY')).toBe('success');
    expect(verdictTone('NO_DIFFERENCES')).toBe('warning');
    expect(verdictTone('NOT_ENOUGH_DAYS')).toBe('neutral');
  });

  it('najvažnija presuda ima najmanji rang', () => {
    expect(verdictRank('UNEXPLAINED_DIFFERENCES')).toBe(0);
    expect(verdictRank('READY')).toBe(1);
  });
});

describe('reasonBreakdown', () => {
  it('udio je u danima sa razlikom, ne u svim danima', () => {
    const [first] = reasonBreakdown(
      report({
        differences: 4,
        byReason: [{ reason: 'UNDERSHOOT', days: 2 }],
      }),
    );
    // 2/4 = 50%, a ne 2/21 = 10%.
    expect(first.sharePct).toBe(50);
  });

  it('sortira po broju dana, pa po nazivu razloga', () => {
    const entries = reasonBreakdown(
      report({
        differences: 6,
        byReason: [
          { reason: 'DWELL', days: 1 },
          { reason: 'UNDERSHOOT', days: 3 },
          { reason: 'NIGHT_FLOOR', days: 2 },
        ],
      }),
    );
    expect(entries.map((entry) => entry.reason)).toEqual([
      'UNDERSHOOT',
      'NIGHT_FLOOR',
      'DWELL',
    ]);
  });

  it('bez razlika nema razloga — ne dijeli se nulom', () => {
    expect(
      reasonBreakdown(report({ differences: 0, byReason: [{ reason: 'X', days: 0 }] })),
    ).toEqual([]);
  });
});
