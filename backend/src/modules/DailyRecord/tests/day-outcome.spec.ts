import {
  MIN_TRANSITIONS_FOR_HYSTERESIS,
  UNDERSHOOT_TOLERANCE_K,
  computeDayOutcome,
  type OutcomeSample,
} from '../day-outcome';
import {
  MIN_DAY_COVERAGE_RATIO,
  OBSERVATIONS_PER_DAY,
} from '../../HomeModel/daily-balance';

/**
 * Mjerni podaci dana (`17` §9). Testovi ne provjeravaju „da li funkcija radi"
 * nego **definicije**: šta je ciklus, šta noć, šta podbačaj. Ako se one
 * promijene, promijeniće se i brojevi koje kontroler dobija.
 */

const ZONE = 'Europe/Sarajevo';
const DAY = '2026-11-07';
const PREVIOUS = '2026-11-06';

/** Sarajevo je u novembru UTC+1, pa je lokalno 00:00 = 23:00Z prethodnog dana. */
function localInstant(localDate: string, hour: number, minute = 0): Date {
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return new Date(`${localDate}T${hh}:${mm}:00+01:00`);
}

interface SampleOptions {
  isHeating?: boolean;
  outdoorTempC?: number | null;
  flowSetC?: number | null;
}

function sample(
  localDate: string,
  hour: number,
  minute: number,
  roomTempC: number | null,
  targetTempC: number | null,
  options: SampleOptions = {},
): OutcomeSample {
  return {
    at: localInstant(localDate, hour, minute),
    roomTempC,
    targetTempC,
    isHeating: options.isHeating ?? false,
    outdoorTempC: options.outdoorTempC ?? null,
    flowSetC: options.flowSetC ?? null,
  };
}

/**
 * Pun dan: 288 uzoraka na 5 min. `override` mijenja pojedini uzorak po indeksu
 * (`0` = 00:00, `287` = 23:55), tako da svaki test pomjera samo ono što mjeri.
 */
function fullDay(
  localDate: string,
  override: (
    index: number,
    hour: number,
    minute: number,
  ) => Partial<Omit<OutcomeSample, 'at'>> = () => ({}),
): OutcomeSample[] {
  const samples: OutcomeSample[] = [];
  for (let index = 0; index < OBSERVATIONS_PER_DAY; index++) {
    const totalMinutes = index * 5;
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    const changed = override(index, hour, minute);
    samples.push({
      at: localInstant(localDate, hour, minute),
      roomTempC: changed.roomTempC === undefined ? 21 : changed.roomTempC,
      targetTempC: changed.targetTempC === undefined ? 21 : changed.targetTempC,
      isHeating: changed.isHeating ?? false,
      outdoorTempC: changed.outdoorTempC === undefined ? 5 : changed.outdoorTempC,
      flowSetC: changed.flowSetC === undefined ? 45 : changed.flowSetC,
    });
  }
  return samples;
}

function indexOf(hour: number, minute = 0): number {
  return (hour * 60 + minute) / 5;
}

function expectOk(result: ReturnType<typeof computeDayOutcome>) {
  if (!result.ok) {
    throw new Error(`Očekivan obračun, dobijeno ${result.reason}`);
  }
  return result.outcome;
}

describe('computeDayOutcome — odbijanje nepotpunog dana', () => {
  it('dan sa manje od 80% uzoraka je INCOMPLETE, ne nula', () => {
    const samples = fullDay(DAY).slice(0, 200);
    expect(samples.length).toBeLessThan(
      MIN_DAY_COVERAGE_RATIO * OBSERVATIONS_PER_DAY,
    );

    const result = computeDayOutcome(DAY, samples, ZONE);
    expect(result).toMatchObject({ ok: false, reason: 'INCOMPLETE' });
  });

  it('288 uzoraka bez ijedne sobne temperature je NO_ROOM', () => {
    const samples = fullDay(DAY, () => ({ roomTempC: null }));
    const result = computeDayOutcome(DAY, samples, ZONE);
    expect(result).toMatchObject({ ok: false, reason: 'NO_ROOM' });
  });

  it('uzorci drugog dana ne ulaze u obračun ovog', () => {
    const other = fullDay(PREVIOUS, () => ({ isHeating: true }));
    const result = computeDayOutcome(DAY, other, ZONE);
    expect(result).toMatchObject({ ok: false, reason: 'INCOMPLETE' });
  });
});

describe('computeDayOutcome — ciklusi i duty', () => {
  it('jedan blok grijanja 06:00–08:00 je jedan ciklus od 120 min', () => {
    const samples = fullDay(DAY, (index) =>
      index >= indexOf(6) && index <= indexOf(8) ? { isHeating: true } : {},
    );

    const outcome = expectOk(computeDayOutcome(DAY, samples, ZONE));
    expect(outcome.cycles).toBe(1);
    // 25 uzoraka od 06:00 do 08:00; svaki pokriva svojih 5 min, pa ciklus
    // traje 06:00 → 08:05, tj. 125 min.
    expect(outcome.medianCycleMin).toBe(125);
    expect(outcome.heatingSamples).toBe(25);
    expect(outcome.dutyPercent).toBeCloseTo((25 / 288) * 100, 6);
  });

  it('dva ciklusa: medijana je stvarna medijana, ne prosjek', () => {
    // 06:00–06:30 (7 uzoraka = 35 min) i 12:00–14:00 (25 uzoraka = 125 min);
    // medijana dva ciklusa je njihov prosjek: 80 min.
    const samples = fullDay(DAY, (index) => {
      const short = index >= indexOf(6) && index <= indexOf(6, 30);
      const long = index >= indexOf(12) && index <= indexOf(14);
      return short || long ? { isHeating: true } : {};
    });

    const outcome = expectOk(computeDayOutcome(DAY, samples, ZONE));
    expect(outcome.cycles).toBe(2);
    expect(outcome.medianCycleMin).toBe(80);
  });

  it('ciklus od jednog uzorka se broji ali ne ulazi u medijanu trajanja', () => {
    const samples = fullDay(DAY, (index) =>
      index === indexOf(9) ? { isHeating: true } : {},
    );

    const outcome = expectOk(computeDayOutcome(DAY, samples, ZONE));
    expect(outcome.cycles).toBe(1);
    expect(outcome.medianCycleMin).toBeNull();
  });

  it('ciklus koji prelazi ponoć je odsječen na granici dana', () => {
    // Grijanje 23:00–23:55 je 60 min unutar dana; ono što bi se nastavilo
    // poslije ponoći pripada sljedećem danu i ovdje se ne vidi.
    const samples = fullDay(DAY, (index) =>
      index >= indexOf(23) ? { isHeating: true } : {},
    );

    const outcome = expectOk(computeDayOutcome(DAY, samples, ZONE));
    expect(outcome.cycles).toBe(1);
    expect(outcome.medianCycleMin).toBe(60);
  });
});

describe('computeDayOutcome — podbačaj i prebačaj', () => {
  it('podbačaj je najveći manjak ispod uzorkovanog cilja', () => {
    const samples = fullDay(DAY, (index) =>
      index === indexOf(3) ? { roomTempC: 19.5, targetTempC: 21 } : {},
    );

    const outcome = expectOk(computeDayOutcome(DAY, samples, ZONE));
    expect(outcome.undershootC).toBeCloseTo(1.5, 6);
    expect(outcome.comfortOk).toBe(false);
  });

  it('podbačaj tačno na toleranciji je još uvijek udoban', () => {
    const samples = fullDay(DAY, (index) =>
      index === indexOf(3) ? { roomTempC: 21 - UNDERSHOOT_TOLERANCE_K } : {},
    );

    const outcome = expectOk(computeDayOutcome(DAY, samples, ZONE));
    expect(outcome.undershootC).toBeCloseTo(UNDERSHOOT_TOLERANCE_K, 6);
    expect(outcome.comfortOk).toBe(true);
  });

  it('cilj je uzorkovan: kuća na 20 °C sa ciljem 20 nije podbacila', () => {
    const samples = fullDay(DAY, () => ({ roomTempC: 20, targetTempC: 20 }));

    const outcome = expectOk(computeDayOutcome(DAY, samples, ZONE));
    expect(outcome.undershootC).toBe(0);
    expect(outcome.overshootC).toBe(0);
  });

  it('prebačaj iznad cilja se mjeri odvojeno od podbačaja', () => {
    const samples = fullDay(DAY, (index) =>
      index === indexOf(15) ? { roomTempC: 22.4 } : {},
    );

    const outcome = expectOk(computeDayOutcome(DAY, samples, ZONE));
    expect(outcome.overshootC).toBeCloseTo(1.4, 6);
    expect(outcome.undershootC).toBe(0);
  });
});

describe('computeDayOutcome — noćni prozor', () => {
  it('noć je 22:00 prethodnog dana → 06:00 ovog, ne 22:00 ovog dana', () => {
    const samples = [
      ...fullDay(PREVIOUS, (index) =>
        index === indexOf(21, 55)
          ? { roomTempC: 15, targetTempC: 21 } // 21:55 — još nije noć
          : {},
      ),
      ...fullDay(DAY, (index) => {
        if (index === indexOf(6)) return { roomTempC: 15, targetTempC: 21 }; // 06:00 — više nije noć
        if (index === indexOf(22)) return { roomTempC: 16, targetTempC: 21 }; // 22:00 — sljedeća noć
        return {};
      }),
    ];

    const outcome = expectOk(computeDayOutcome(DAY, samples, ZONE));
    // Nijedan od tri velika manjka nije u prozoru, pa noć nema podbačaja.
    expect(outcome.nightUndershootC).toBe(0);
  });

  it('manjak u prozoru se mjeri, i to najveći', () => {
    const samples = [
      ...fullDay(PREVIOUS, (index) =>
        index === indexOf(22) ? { roomTempC: 19, targetTempC: 21 } : {},
      ),
      ...fullDay(DAY, (index) =>
        index === indexOf(5, 55) ? { roomTempC: 18.7, targetTempC: 21 } : {},
      ),
    ];

    const outcome = expectOk(computeDayOutcome(DAY, samples, ZONE));
    expect(outcome.nightUndershootC).toBeCloseTo(2.3, 6);
  });

  it('noćni minimum vanjske je minimum prozora, ne dana', () => {
    const samples = [
      ...fullDay(PREVIOUS, (index) =>
        index === indexOf(12)
          ? { outdoorTempC: -12 } // podne prethodnog dana, nije noć
          : index === indexOf(23)
            ? { outdoorTempC: -4 }
            : {},
      ),
      ...fullDay(DAY, (index) =>
        index === indexOf(5) ? { outdoorTempC: -6 } : {},
      ),
    ];

    const outcome = expectOk(computeDayOutcome(DAY, samples, ZONE));
    expect(outcome.nightMinOutdoorC).toBe(-6);
  });

  it('bez mjerenja noću noćni podbačaj je null, a ne nula', () => {
    const samples = fullDay(DAY, (index) =>
      index * 5 < 360
        ? { roomTempC: null, targetTempC: null, flowSetC: null, outdoorTempC: null }
        : {},
    );

    const outcome = expectOk(computeDayOutcome(DAY, samples, ZONE));
    expect(outcome.nightUndershootC).toBeNull();
    expect(outcome.nightMinOutdoorC).toBeNull();
    expect(outcome.nightFlowC).toBeNull();
  });

  it('noćna polazna je najčešća u prozoru', () => {
    const samples = [
      ...fullDay(PREVIOUS, (index) =>
        index >= indexOf(22) ? { flowSetC: 42 } : {},
      ),
      ...fullDay(DAY, (index) => (index * 5 < 360 ? { flowSetC: 47 } : {})),
    ];

    // Prozor: 24 uzorka sa 42 (22:00–23:55) i 72 sa 47 (00:00–05:55).
    const outcome = expectOk(computeDayOutcome(DAY, samples, ZONE));
    expect(outcome.nightFlowC).toBe(47);
  });

  it('izjednačene polazne: uzima se kasnija, jer ona nosi kraj noći', () => {
    const samples = [
      ...fullDay(PREVIOUS, (index) =>
        index >= indexOf(22) ? { flowSetC: 50 } : {},
      ),
      ...fullDay(DAY, (index) =>
        // 00:00–02:00 sa 44, ostatak noći bez polazne → 24 prema 24.
        index * 5 < 120 ? { flowSetC: 44 } : { flowSetC: null },
      ),
    ];

    const outcome = expectOk(computeDayOutcome(DAY, samples, ZONE));
    expect(outcome.nightFlowC).toBe(44);
  });
});

describe('computeDayOutcome — izmjerena histereza', () => {
  it('banda je median(T_off − T_on) na prelazima', () => {
    // Tri prelaza, svaki na susjednim uzorcima: 20,0 → 20,9 / 20,0 → 21,0 /
    // 20,0 → 20,8.
    const onAt = [indexOf(7), indexOf(11), indexOf(15)];
    const offRooms = new Map([
      [indexOf(7) + 1, 20.9],
      [indexOf(11) + 1, 21.0],
      [indexOf(15) + 1, 20.8],
    ]);

    const samples = fullDay(DAY, (index) => {
      if (onAt.includes(index)) {
        return { isHeating: true, roomTempC: 20, targetTempC: 21 };
      }
      const offRoom = offRooms.get(index);
      if (offRoom != null) {
        return { isHeating: false, roomTempC: offRoom };
      }
      return {};
    });

    const outcome = expectOk(computeDayOutcome(DAY, samples, ZONE));
    expect(outcome.hysteresisK).toBeCloseTo(0.9, 6);
    // Medijana od (21−20), (21−20), (21−20) = 1,0.
    expect(outcome.hysteresisAsymmetryK).toBeCloseTo(1.0, 6);
  });

  it('jedan prelaz nije mjera — histereza ostaje null', () => {
    const samples = fullDay(DAY, (index) => {
      if (index === indexOf(7)) return { isHeating: true, roomTempC: 20 };
      if (index === indexOf(7) + 1) return { isHeating: false, roomTempC: 21 };
      return {};
    });

    const outcome = expectOk(computeDayOutcome(DAY, samples, ZONE));
    expect(MIN_TRANSITIONS_FOR_HYSTERESIS).toBe(2);
    expect(outcome.hysteresisK).toBeNull();
    expect(outcome.cycles).toBe(1);
  });

  it('prelaz bez cilja ne daje asimetriju, ali daje bandu', () => {
    const samples = fullDay(DAY, (index) => {
      if (index === indexOf(7) || index === indexOf(11)) {
        return { isHeating: true, roomTempC: 20, targetTempC: null };
      }
      if (index === indexOf(7) + 1 || index === indexOf(11) + 1) {
        return { isHeating: false, roomTempC: 21 };
      }
      return {};
    });

    const outcome = expectOk(computeDayOutcome(DAY, samples, ZONE));
    expect(outcome.hysteresisK).toBe(1);
    expect(outcome.hysteresisAsymmetryK).toBeNull();
  });
});
