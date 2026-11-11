import {
  FLOW_MAX_C,
  FLOW_MIN_C,
  MAX_DAILY_CHANGE_K,
  NIGHT_COMPARABLE_TOLERANCE_K,
  NIGHT_MARGIN_K,
  applyHardBounds,
  nightFloorFrom,
  type NightEvidence,
} from '../flow-bounds';
import { UNDERSHOOT_TOLERANCE_K } from '../day-outcome';

/**
 * Tvrde granice (`17` §8.2, §8.4). Testovi čuvaju **redoslijed**: raspon →
 * noćni minimum → dnevna promjena → ponovno raspon i pod. Ako se taj redoslijed
 * promijeni, dnevna promjena bi mogla spustiti predlog ispod noćnog minimuma —
 * a to je jedina stvar koja ovdje ne smije da se dogodi.
 */

describe('applyHardBounds — raspon', () => {
  it('iznad 55 se reže na 55 uz razlog RANGE', () => {
    expect(
      applyHardBounds({ candidateC: 60, previousC: null, nightFloorC: null }),
    ).toEqual({
      flowC: 55,
      reasons: ['RANGE'],
    });
  });

  it('ispod 30 se reže na 30 uz razlog RANGE', () => {
    expect(
      applyHardBounds({ candidateC: 20, previousC: null, nightFloorC: null }),
    ).toEqual({
      flowC: 30,
      reasons: ['RANGE'],
    });
  });

  it('granice same prolaze nepromijenjene i bez razloga', () => {
    expect(
      applyHardBounds({
        candidateC: FLOW_MIN_C,
        previousC: null,
        nightFloorC: null,
      }),
    ).toEqual({
      flowC: FLOW_MIN_C,
      reasons: [],
    });
    expect(
      applyHardBounds({
        candidateC: FLOW_MAX_C,
        previousC: null,
        nightFloorC: null,
      }),
    ).toEqual({
      flowC: FLOW_MAX_C,
      reasons: [],
    });
  });

  it('vrijednost unutar granica i bez historije prolazi netaknuta', () => {
    expect(
      applyHardBounds({ candidateC: 41.5, previousC: null, nightFloorC: null }),
    ).toEqual({
      flowC: 41.5,
      reasons: [],
    });
  });
});

describe('applyHardBounds — noćni minimum', () => {
  it('podigne predlog na izmjereni noćni minimum', () => {
    expect(
      applyHardBounds({ candidateC: 40, previousC: null, nightFloorC: 44 }),
    ).toEqual({
      flowC: 44,
      reasons: ['NIGHT_FLOOR'],
    });
  });

  it('ne spušta predlog koji je već iznad minimuma', () => {
    expect(
      applyHardBounds({ candidateC: 48, previousC: null, nightFloorC: 44 }),
    ).toEqual({
      flowC: 48,
      reasons: [],
    });
  });

  it('minimum koji izlazi iz raspona se reže na 55 i prijavljuje da noć nije pokrivena', () => {
    // Dokaz traži 58, a kotao ne ide preko 55: bira se fizička granica, ali se
    // prekršaj imenuje — inače bi se čitalo kao da je noć pokrivena.
    expect(
      applyHardBounds({ candidateC: 40, previousC: null, nightFloorC: 58 }),
    ).toEqual({
      flowC: 55,
      reasons: ['NIGHT_FLOOR', 'SYSTEM_MAX'],
    });
  });

  it('bez dokaza (null) nema razloga NIGHT_FLOOR', () => {
    expect(
      applyHardBounds({ candidateC: 40, previousC: null, nightFloorC: null }),
    ).toEqual({
      flowC: 40,
      reasons: [],
    });
  });
});

describe('applyHardBounds — granica sistema', () => {
  it('granica sistema sužava raspon i nikad ga ne širi', () => {
    expect(
      applyHardBounds({
        candidateC: 50,
        previousC: null,
        nightFloorC: null,
        systemMaxC: 40,
      }),
    ).toEqual({ flowC: 40, reasons: ['RANGE'] });

    // 60 kao granica sistema ne smije proširiti zaključanih 55.
    expect(
      applyHardBounds({
        candidateC: 52,
        previousC: null,
        nightFloorC: null,
        systemMaxC: 60,
      }),
    ).toEqual({ flowC: 52, reasons: [] });
  });

  it('dnevna granica ne smije podići vrijednost iznad granice sistema', () => {
    // Prethodna 45, odluka 40, granica sistema 40. Dnevna granica bi htjela 43
    // (45 − 2), ali granica sistema to ne dopušta — pa se ništa nije ni
    // promijenilo i razloga nema.
    expect(
      applyHardBounds({
        candidateC: 40,
        previousC: 45,
        nightFloorC: null,
        systemMaxC: 40,
      }),
    ).toEqual({ flowC: 40, reasons: [] });

    // Kad je granica sistema 41, dnevna granica stvarno mijenja odluku.
    expect(
      applyHardBounds({
        candidateC: 40,
        previousC: 45,
        nightFloorC: null,
        systemMaxC: 41,
      }),
    ).toEqual({ flowC: 41, reasons: ['DAILY_CHANGE'] });
  });

  it('kad je noćni minimum iznad granice sistema, bira se granica sistema', () => {
    expect(
      applyHardBounds({
        candidateC: 35,
        previousC: null,
        nightFloorC: 47,
        systemMaxC: 40,
      }),
    ).toEqual({ flowC: 40, reasons: ['NIGHT_FLOOR', 'SYSTEM_MAX'] });
  });
});

describe('applyHardBounds — dnevna promjena', () => {
  it('rast je ograničen na +2 K dnevno', () => {
    expect(
      applyHardBounds({ candidateC: 50, previousC: 40, nightFloorC: null }),
    ).toEqual({
      flowC: 42,
      reasons: ['DAILY_CHANGE'],
    });
  });

  it('pad je ograničen na −2 K dnevno', () => {
    expect(
      applyHardBounds({ candidateC: 40, previousC: 50, nightFloorC: null }),
    ).toEqual({
      flowC: 48,
      reasons: ['DAILY_CHANGE'],
    });
  });

  it('promjena od tačno 2 K prolazi bez razloga', () => {
    expect(
      applyHardBounds({
        candidateC: 40 + MAX_DAILY_CHANGE_K,
        previousC: 40,
        nightFloorC: null,
      }),
    ).toEqual({ flowC: 42, reasons: [] });
  });

  it('promjena se ne primjenjuje kad prethodna polazna nije poznata', () => {
    expect(
      applyHardBounds({ candidateC: 52, previousC: null, nightFloorC: null }),
    ).toEqual({
      flowC: 52,
      reasons: [],
    });
  });
});

describe('applyHardBounds — redoslijed pravila', () => {
  it('dnevna promjena ne smije spustiti predlog ispod noćnog minimuma', () => {
    // Prethodna 40, odluka 36, dokaz kaže da je 40 bilo prenisko uz +1,0 → 41.
    // Dnevna promjena bi 41 spustila na 42? Ne: 41 je iznad 40 − 2, pa ostaje.
    const result = applyHardBounds({
      candidateC: 36,
      previousC: 40,
      nightFloorC: 41,
    });
    expect(result.flowC).toBe(41);
    expect(result.reasons).toContain('NIGHT_FLOOR');
    expect(result.reasons).not.toContain('DAILY_CHANGE');
  });

  it('kad se pravila sukobe, minimum pobjeduje dnevnu granicu', () => {
    // Prethodna 40 → dozvoljeno [38, 42]; minimum je 44. Sigurnost ima
    // prednost: 44, uz oba razloga, jer je dnevna granica prekršena svjesno.
    const result = applyHardBounds({
      candidateC: 36,
      previousC: 40,
      nightFloorC: 44,
    });
    expect(result.flowC).toBe(44);
    expect(result.reasons).toEqual(['NIGHT_FLOOR', 'DAILY_CHANGE']);
  });

  it('nekonačan broj se odbija, a ne propušta na kotao', () => {
    expect(() =>
      applyHardBounds({
        candidateC: Number.NaN,
        previousC: null,
        nightFloorC: null,
      }),
    ).toThrow(/candidateC/);
    expect(() =>
      applyHardBounds({
        candidateC: 40,
        previousC: Number.POSITIVE_INFINITY,
        nightFloorC: null,
      }),
    ).toThrow(/previousC/);
    expect(() =>
      applyHardBounds({
        candidateC: 40,
        previousC: null,
        nightFloorC: Number.NaN,
      }),
    ).toThrow(/nightFloorC/);
  });

  it('rezultat je uvijek unutar raspona, bez obzira na ulaz', () => {
    for (const candidateC of [-40, 0, 29.9, 30, 41.3, 55, 55.1, 90]) {
      for (const previousC of [null, 30, 45, 55, 70]) {
        for (const nightFloorC of [null, 20, 30, 44, 55, 80]) {
          const result = applyHardBounds({
            candidateC,
            previousC,
            nightFloorC,
          });
          expect(Number.isFinite(result.flowC)).toBe(true);
          expect(result.flowC).toBeGreaterThanOrEqual(FLOW_MIN_C);
          expect(result.flowC).toBeLessThanOrEqual(FLOW_MAX_C);
          if (nightFloorC != null && nightFloorC <= FLOW_MAX_C) {
            expect(result.flowC).toBeGreaterThanOrEqual(
              Math.max(FLOW_MIN_C, nightFloorC),
            );
          }
        }
      }
    }
  });
});

describe('nightFloorFrom — dokaz iz mjerenja', () => {
  const night = (
    flowC: number,
    nightMinOutdoorC: number,
    nightUndershootC: number | null,
  ): NightEvidence => ({ flowC, nightMinOutdoorC, nightUndershootC });

  it('bez prognoze nema granice', () => {
    expect(
      nightFloorFrom({ evidence: [night(44, -2, 2)], forecastNightMinC: null }),
    ).toEqual({
      floorC: null,
      basis: 'NO_FORECAST',
      worstFailingFlowC: null,
      comparableNights: 0,
    });
  });

  it('bez poredljivih noći nema granice — praznina se ne popunjava nagađanjem', () => {
    const result = nightFloorFrom({
      evidence: [night(44, -10, 3), night(46, 8, 4)],
      forecastNightMinC: 0,
    });
    expect(result.floorC).toBeNull();
    expect(result.basis).toBe('NO_EVIDENCE');
    expect(result.comparableNights).toBe(0);
  });

  it('noć bez mjerenja manjka nije dokaz', () => {
    const result = nightFloorFrom({
      evidence: [night(44, 0, null)],
      forecastNightMinC: 0,
    });
    expect(result.floorC).toBeNull();
    expect(result.basis).toBe('NO_EVIDENCE');
  });

  it('noć u kojoj je bilo dovoljno toplo ne podiže granicu', () => {
    const result = nightFloorFrom({
      evidence: [night(42, 0, 0), night(40, 1, UNDERSHOOT_TOLERANCE_K)],
      forecastNightMinC: 0,
    });
    expect(result.floorC).toBeNull();
    expect(result.basis).toBe('NO_FAILURE');
    expect(result.comparableNights).toBe(2);
  });

  it('podbačaj veći od 1,0 K podiže granicu na polaznu + 1,0', () => {
    const result = nightFloorFrom({
      evidence: [night(44, 0, 1.6)],
      forecastNightMinC: 0,
    });
    expect(result.floorC).toBe(45);
    expect(result.basis).toBe('RAISED_FROM_FAILURE');
    expect(result.worstFailingFlowC).toBe(44);
    expect(result.comparableNights).toBe(1);
  });

  it('uzima najvišu polaznu koja je podbacila, ne najnižu', () => {
    const result = nightFloorFrom({
      evidence: [night(40, 0, 2), night(48, 1, 1.5), night(44, 0, 3)],
      forecastNightMinC: 0,
    });
    expect(result.worstFailingFlowC).toBe(48);
    expect(result.floorC).toBe(49);
  });

  it('granica se ne penje iznad 55 — javlja AT_LIMIT', () => {
    const result = nightFloorFrom({
      evidence: [night(FLOW_MAX_C, 0, 2)],
      forecastNightMinC: 0,
    });
    expect(result.floorC).toBe(FLOW_MAX_C);
    expect(result.basis).toBe('AT_LIMIT');
  });

  it('poredljivost je uključiva na granici ±2 K', () => {
    const result = nightFloorFrom({
      evidence: [night(44, -2, 2), night(44, 2, 2)],
      forecastNightMinC: 0,
    });
    expect(result.comparableNights).toBe(2);
    expect(result.floorC).toBe(45);
  });

  it('tolerancija i margina se mogu zadati, ali su podrazumijevane vrijednosti te koje se koriste', () => {
    expect(NIGHT_COMPARABLE_TOLERANCE_K).toBe(2);
    expect(NIGHT_MARGIN_K).toBe(1);

    const result = nightFloorFrom({
      evidence: [night(44, -3, 2)],
      forecastNightMinC: 0,
      toleranceK: 3,
      marginK: 1.5,
    });
    expect(result.comparableNights).toBe(1);
    expect(result.floorC).toBe(45.5);
  });
});
