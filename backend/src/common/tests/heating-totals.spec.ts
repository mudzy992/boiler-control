import {
  addEventToBucket,
  cycleDurationMin,
  emptyBucket,
  heatingTotals,
  isPlausibleRoomTemp,
  MIN_PLAUSIBLE_ROOM_C,
  type HeatingEventLike,
} from '../heating-totals';

/**
 * B1/B2 (audit analitike, §1.3 i §1.4) — dva kvara koja su mijenjala broj na
 * ekranu, oba izmjerena prije popravke:
 *
 *   B2 **otvoren ciklus** — `totalCycles` ga je brojao, trajanje ne. Mjerenje
 *      poslije faze A (`43841582208`): 1 otvoren od 67 → prosječno trajanje
 *      palo 223,06 → 219,73 min **bez promjene stvarnog trajanja**. Kvar je
 *      strukturni: prosjek pada svaki put kad se mjeri dok grijanje traje.
 *
 *   B1 **nula kao temperatura** — `roomCurrentTemp = 0` ulazi u prosjek kao
 *      stvarna 0 °C. Mjerenje: 1 red od 66 → prikaz 20,31 umjesto 20,62 °C.
 *
 * Testovi su namjerno na ČISTOJ funkciji: `now` je parametar, pa trajanje
 * otvorenog ciklusa ne zavisi od trenutka izvršavanja.
 */

const NOW = new Date('2026-11-16T12:00:00.000Z');

function event(
  startIso: string,
  endIso: string | null,
  roomCurrentTemp = 21,
  roomTargetTemp = 22,
): HeatingEventLike {
  return {
    timestampStart: new Date(startIso),
    timestampEnd: endIso ? new Date(endIso) : null,
    roomCurrentTemp,
    roomTargetTemp,
  };
}

describe('B2 — otvoren ciklus ne obara prosječno trajanje', () => {
  it('otvoren ciklus se mjeri do `now`, a ne odbacuje', () => {
    // Dva zatvorena (60 i 30 min) + jedan otvoren koji traje 10 min.
    const events = [
      event('2026-11-16T08:00:00.000Z', '2026-11-16T09:00:00.000Z'),
      event('2026-11-16T09:30:00.000Z', '2026-11-16T10:00:00.000Z'),
      event('2026-11-16T11:50:00.000Z', null),
    ];

    const totals = heatingTotals(events, NOW);

    // 100 min ukupno / 3 ciklusa = 33,33 min.
    // Prije popravke: 90 / 3 = 30,00 min — otvoren ciklus u imeniocu, ne u brojniku.
    expect(totals.totalCycles).toBe(3);
    expect(totals.openCycles).toBe(1);
    expect(totals.totalDurationMin).toBe(100);
    expect(totals.avgDurationMin).toBe(33.33);
  });

  it('prosjek je isti prije i poslije zatvaranja ciklusa (nema skoka)', () => {
    const closed = [
      event('2026-11-16T08:00:00.000Z', '2026-11-16T09:00:00.000Z'),
      event('2026-11-16T11:50:00.000Z', '2026-11-16T12:00:00.000Z'),
    ];
    // Isti događaji, ali drugi je još otvoren — u trenutku `NOW` traje 10 min.
    const stillOpen = [
      event('2026-11-16T08:00:00.000Z', '2026-11-16T09:00:00.000Z'),
      event('2026-11-16T11:50:00.000Z', null),
    ];

    // Ovo je suština kvara: prije popravke su ova dva davala 30,00 i 60,00.
    expect(heatingTotals(stillOpen, NOW).avgDurationMin).toBe(
      heatingTotals(closed, NOW).avgDurationMin,
    );
    expect(heatingTotals(stillOpen, NOW).avgDurationMin).toBe(35);
  });

  it('ciklus čiji je kraj prije početka (sat unazad) traje 0, ne negativno', () => {
    expect(
      cycleDurationMin(
        event('2026-11-16T12:00:00.000Z', '2026-11-16T11:00:00.000Z'),
        NOW,
      ),
    ).toBe(0);
  });

  it('prazan niz daje nule, ne NaN', () => {
    const totals = heatingTotals([], NOW);
    expect(totals.totalCycles).toBe(0);
    expect(totals.avgDurationMin).toBe(0);
    // Prazan raspon NIJE isto što i „ima događaja bez mjerenja": `0` je
    // postojeći ugovor i razlučiv je po `totalCycles`. `null` važi samo kad
    // događaji postoje a nijedan nema upotrebljivu temperaturu.
    expect(totals.avgIndoorTemp).toBe(0);
  });
});

describe('B1 — nula u sobnoj temperaturi nije mjerenje', () => {
  it('nula se izostavlja iz prosjeka i broji se', () => {
    const events = [
      event('2026-11-16T08:00:00.000Z', '2026-11-16T09:00:00.000Z', 20),
      event('2026-11-16T09:30:00.000Z', '2026-11-16T10:00:00.000Z', 22),
      event('2026-11-16T10:30:00.000Z', '2026-11-16T11:00:00.000Z', 0),
    ];

    const totals = heatingTotals(events, NOW);

    // Prije popravke: (20 + 22 + 0) / 3 = 14,00 °C — tvrdnja da je u sobi 14 °C.
    expect(totals.avgIndoorTemp).toBe(21);
    expect(totals.excludedZeroTemp).toBe(1);
    // Ciklusi se broje svi: izostavljanje je samo za prosjek temperature.
    expect(totals.totalCycles).toBe(3);
  });

  it('kad nijedna temperatura nije upotrebljiva, prosjek je `null`, ne 0', () => {
    const events = [
      event('2026-11-16T08:00:00.000Z', '2026-11-16T09:00:00.000Z', 0),
      event('2026-11-16T09:30:00.000Z', '2026-11-16T10:00:00.000Z', 0),
    ];

    const totals = heatingTotals(events, NOW);

    // `0` bi rekao „prosjek je 0 °C"; `null` kaže „nema mjerenja".
    expect(totals.avgIndoorTemp).toBeNull();
    expect(totals.excludedZeroTemp).toBe(2);
  });

  it('granica je imenovana, a ne „sve osim nule"', () => {
    expect(MIN_PLAUSIBLE_ROOM_C).toBe(5);
    expect(isPlausibleRoomTemp(4.9)).toBe(false);
    expect(isPlausibleRoomTemp(5)).toBe(true);
    expect(isPlausibleRoomTemp(Number.NaN)).toBe(false);
    expect(isPlausibleRoomTemp(null)).toBe(false);
  });
});

describe('Bucketi — cilj i postignuto iz istog skupa redova', () => {
  it('red bez upotrebljive temperature izlazi iz OBA prosjeka', () => {
    const bucket = emptyBucket();
    addEventToBucket(bucket, event('2026-11-16T08:00:00.000Z', '2026-11-16T09:00:00.000Z', 21, 22), NOW);
    addEventToBucket(bucket, event('2026-11-16T09:00:00.000Z', '2026-11-16T10:00:00.000Z', 0, 20), NOW);

    // Prije popravke: avgCurrent = (21+0)/2 = 10,5 uz avgTarget = 21.
    // Razlika „cilj vs postignuto" bila bi 10,5 K — kvar senzora, ne grijanja.
    expect(bucket.tempCount).toBe(1);
    expect(bucket.currentSum).toBe(21);
    expect(bucket.targetSum).toBe(22);
    // Ciklusi i trajanje se i dalje broje za oba reda.
    expect(bucket.cycles).toBe(2);
    expect(bucket.durationMin).toBe(120);
  });
});
