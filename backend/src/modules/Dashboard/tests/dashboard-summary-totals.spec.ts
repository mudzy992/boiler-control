import { NotFoundException } from '@nestjs/common';

import { DashboardService } from '../dashboard.service';

/**
 * B1/B2/B3 kroz **pravi servis**, ne kroz čistu funkciju.
 *
 * `common/tests/heating-totals.spec.ts` dokazuje pravila sabiranja; ovaj fajl
 * dokazuje da ih `getHeatingSummary` **stvarno koristi** i da se odgovor
 * endpointa mijenja. Bez ovoga bi popravka mogla živjeti u modulu koji niko ne
 * zove.
 *
 * Šablon je iz `dashboard-heating-events.spec.ts` (lažna baza + pravi servis),
 * a **ne** iz `dashboard-query-http.spec.ts` — taj fajl mockuje cijeli servis,
 * pa bi prošao i sa nepopravljenim kodom.
 */

jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../../Boiler/boiler.service', () => ({
  BoilerService: class BoilerService {},
}));
jest.mock('../../Weather/weather.service', () => ({
  WeatherService: class WeatherService {},
}));

type FakeEvent = {
  id: number;
  deviceId: number;
  timestampStart: Date;
  timestampEnd: Date | null;
  roomCurrentTemp: number;
  roomTargetTemp: number;
  hvacAction: string;
  source: string;
};

function makeService(events: FakeEvent[], thermostatCount = 1) {
  const db = {
    thermostatDevice: {
      count: () => Promise.resolve(thermostatCount),
      findMany: () => Promise.resolve([]),
      findFirst: () => Promise.resolve(null),
    },
    heatingEvent: {
      findMany: () => Promise.resolve(events),
      findFirst: () => Promise.resolve(events[0] ?? null),
      count: () => Promise.resolve(events.length),
    },
    $transaction: async (operations: any[]) => Promise.all(operations),
  };
  return new DashboardService(db as any, {} as any, {} as any, {} as any, {} as any);
}

const at = (iso: string) => new Date(iso);

function ev(
  startIso: string,
  endIso: string | null,
  roomCurrentTemp = 21,
  roomTargetTemp = 22,
): FakeEvent {
  return {
    id: Math.floor(Math.random() * 1e9),
    deviceId: 1,
    timestampStart: at(startIso),
    timestampEnd: endIso ? at(endIso) : null,
    roomCurrentTemp,
    roomTargetTemp,
    hvacAction: 'heating',
    source: 'test',
  };
}

const query = {
  homeProfileId: 1,
  from: '2026-11-01T00:00:00Z',
  to: '2026-11-30T00:00:00Z',
  bucket: 'day',
} as any;

describe('B1 — avgIndoorTemp ne uključuje nulu kao temperaturu', () => {
  it('izostavlja red sa 0 °C i vraća koliko ih je izostavljeno', async () => {
    // 20 i 22 su stvarne temperature; 0 je senzor koji nije javio.
    const service = makeService([
      ev('2026-11-10T08:00:00Z', '2026-11-10T09:00:00Z', 20),
      ev('2026-11-10T10:00:00Z', '2026-11-10T11:00:00Z', 22),
      ev('2026-11-10T12:00:00Z', '2026-11-10T13:00:00Z', 0),
    ]);

    const result = await service.getHeatingSummary(7, query);

    // Prije popravke: (20 + 22 + 0) / 3 = 14,00 — tvrdnja da je u sobi 14 °C.
    expect(result.summary.avgIndoorTemp).toBe(21);
    expect(result.summary.excludedZeroTemp).toBe(1);
    // Ciklusi se broje svi — izostavljanje važi samo za prosjek temperature.
    expect(result.summary.totalCycles).toBe(3);
  });

  it('kad nema upotrebljive temperature, prosjek je `null`, a ne 0', async () => {
    const service = makeService([
      ev('2026-11-10T08:00:00Z', '2026-11-10T09:00:00Z', 0),
    ]);

    const result = await service.getHeatingSummary(7, query);

    expect(result.summary.avgIndoorTemp).toBeNull();
    expect(result.summary.excludedZeroTemp).toBe(1);
  });

  it('bucketi dijele isti imenilac za cilj i postignuto', async () => {
    const service = makeService([
      ev('2026-11-10T08:00:00Z', '2026-11-10T09:00:00Z', 21, 22),
      ev('2026-11-10T10:00:00Z', '2026-11-10T11:00:00Z', 0, 20),
    ]);

    const result = await service.getHeatingSummary(7, query);

    // Prije popravke: avgCurrent = (21+0)/2 = 10,5 uz avgTarget = 21 —
    // razlika od 10,5 K koja opisuje kvar senzora, a ne grijanje.
    expect(result.buckets).toHaveLength(1);
    expect(result.buckets[0].avgCurrentTemp).toBe(21);
    expect(result.buckets[0].avgTargetTemp).toBe(22);
    // Ciklusi i trajanje i dalje broje oba reda.
    expect(result.buckets[0].cycles).toBe(2);
    expect(result.buckets[0].totalDurationMin).toBe(120);
  });
});

describe('B2 — otvoren ciklus ne obara prosječno trajanje', () => {
  it('otvoren ciklus se broji u trajanje, do sada', async () => {
    const before = Date.now();
    const service = makeService([
      ev('2026-11-10T08:00:00Z', '2026-11-10T09:00:00Z'),
      // Otvoren, počeo 30 min prije testa.
      ev(new Date(before - 30 * 60_000).toISOString(), null),
    ]);

    const result = await service.getHeatingSummary(7, query);

    expect(result.summary.totalCycles).toBe(2);
    expect(result.summary.openCycles).toBe(1);
    // 60 min zatvoren + ~30 min otvoren = ~90 min → prosjek ~45 min.
    // Prije popravke: 60 / 2 = 30,00 min — prosjek pada zato što je mjerenje
    // palo usred grijanja.
    expect(result.summary.totalDurationMin).toBeGreaterThanOrEqual(89);
    expect(result.summary.avgDurationMin).toBeGreaterThanOrEqual(44.5);
    expect(result.summary.avgDurationMin).toBeLessThan(47);
  });
});

describe('B3 — dom bez termostata nije greška servera', () => {
  it('baca NotFoundException (404), a ne goli Error (500)', async () => {
    const service = makeService([], 0);

    // Prije popravke: goli `Error` → Nest ga prevodi u 500, pa korisnik vidi
    // „server error" umjesto „nema termostata".
    await expect(service.getHeatingSummary(7, query)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
