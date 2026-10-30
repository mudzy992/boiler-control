import { DashboardService } from '../dashboard.service';

// `dashboard.service.ts` uvozi ova tri kao vrijednosti; bez mock-a bi jest
// povukao Prisma kodogen lanac.
jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../../Boiler/boiler.service', () => ({
  BoilerService: class BoilerService {},
}));
jest.mock('../../Weather/weather.service', () => ({
  WeatherService: class WeatherService {},
}));

type FakeDevice = {
  id: number;
  userId: number;
  roomCurrentTemp: number | null;
  roomTargetTemp: number | null;
};

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

type Lookup = { op: string; where: any };

/**
 * Lažna baza koja STVARNO poštuje `id: { in: [...] }` i `homeProfile.userId`,
 * jer ispravka B-019 ovisi o oba. Bilježi svaki upit da test može tvrditi
 * "nema lookupa" i "tačno jedan upit".
 */
function makeFakeDb(devices: FakeDevice[], events: FakeEvent[]) {
  const lookups: Lookup[] = [];

  const db = {
    thermostatDevice: {
      count: ({ where }: any) => {
        lookups.push({ op: 'thermostatDevice.count', where });
        const uid = where?.homeProfile?.userId;
        return Promise.resolve(devices.filter((d) => d.userId === uid).length);
      },
      findFirst: ({ where }: any) => {
        lookups.push({ op: 'thermostatDevice.findFirst', where });
        return Promise.resolve(devices.find((d) => d.id === where?.id) ?? null);
      },
      findMany: ({ where }: any) => {
        lookups.push({ op: 'thermostatDevice.findMany', where });
        let out = [...devices];
        if (where?.id?.in) {
          out = out.filter((d) => where.id.in.includes(d.id));
        }
        if (where?.homeProfile?.userId !== undefined) {
          out = out.filter((d) => d.userId === where.homeProfile.userId);
        }
        return Promise.resolve(out);
      },
    },
    heatingEvent: {
      findMany: () => Promise.resolve(events),
      findFirst: () => Promise.resolve(events[0] ?? null),
      count: () => Promise.resolve(events.length),
    },
    $transaction: async (operations: any) => Promise.all(operations),
  };

  const service = new DashboardService(
    db as any,
    {} as any,
    {} as any,
    {} as any,
  );

  const deviceLookups = () =>
    lookups.filter((l) => l.op.startsWith('thermostatDevice.find'));

  return { service, lookups, deviceLookups };
}

const at = (iso: string) => new Date(iso);

const baseQuery = {
  homeProfileId: 1,
  from: '2026-01-01T00:00:00Z',
  to: '2026-01-03T00:00:00Z',
} as any;

function eventOn(deviceId: number, id: number, iso: string): FakeEvent {
  return {
    id,
    deviceId,
    timestampStart: at(iso),
    timestampEnd: null,
    roomCurrentTemp: 19,
    roomTargetTemp: 21,
    hvacAction: 'heating',
    source: 'test',
  };
}

describe('B-019: heating-events mapira temperaturu po uređaju', () => {
  const devices: FakeDevice[] = [
    { id: 11, userId: 1, roomCurrentTemp: 25, roomTargetTemp: 26 },
    { id: 22, userId: 1, roomCurrentTemp: 18, roomTargetTemp: 19 },
  ];
  const events = [
    eventOn(11, 1, '2026-01-01T10:00:00Z'),
    eventOn(22, 2, '2026-01-02T10:00:00Z'),
  ];

  it('svaki događaj dobija temperaturu SVOG uređaja, ne prvog', async () => {
    const { service } = makeFakeDb(devices, events);
    const res = await service.getHeatingEvents(1, baseQuery);

    const byDevice = new Map<number, any>(
      res.data.map((d: any): [number, any] => [d.deviceId, d]),
    );

    // Prije ispravke oba reda su nosila 25/26 (uređaj iz `events[0]`).
    expect(byDevice.get(11).curretTempThermostat).toBe(25);
    expect(byDevice.get(11).targetTempThermostat).toBe(26);
    expect(byDevice.get(22).curretTempThermostat).toBe(18);
    expect(byDevice.get(22).targetTempThermostat).toBe(19);
  });

  it('radi TAČNO JEDAN upit za uređaje, ne po jedan po događaju', async () => {
    const { service, deviceLookups } = makeFakeDb(devices, events);
    await service.getHeatingEvents(1, baseQuery);

    expect(deviceLookups()).toHaveLength(1);
    // Upit mora biti vlasnički filtriran.
    expect(deviceLookups()[0].where.homeProfile.userId).toBe(1);
    expect(deviceLookups()[0].where.id.in.sort()).toEqual([11, 22]);
  });

  it('prazna stranica NE radi lookup uređaja', async () => {
    const { service, deviceLookups } = makeFakeDb(devices, []);
    const res = await service.getHeatingEvents(1, baseQuery);

    expect(res.data).toHaveLength(0);
    // Prije ispravke `if (thermostatDeviceIds)` je bio true i za prazan niz,
    // pa je išao upit s `id: undefined`.
    expect(deviceLookups()).toHaveLength(0);
  });

  it('uređaj drugog korisnika ne otkriva svoju temperaturu', async () => {
    const mixed: FakeDevice[] = [
      { id: 11, userId: 1, roomCurrentTemp: 25, roomTargetTemp: 26 },
      { id: 22, userId: 2, roomCurrentTemp: 30, roomTargetTemp: 31 },
    ];
    const { service } = makeFakeDb(mixed, events);
    const res = await service.getHeatingEvents(1, baseQuery);

    const byDevice = new Map<number, any>(
      res.data.map((d: any): [number, any] => [d.deviceId, d]),
    );
    expect(byDevice.get(11).curretTempThermostat).toBe(25);
    // Tuđi uređaj mora biti null, a ne 30.
    expect(byDevice.get(22).curretTempThermostat).toBeNull();
    expect(byDevice.get(22).targetTempThermostat).toBeNull();
  });

  it('termostat bez izmjerenih vrijednosti daje null, ne undefined', async () => {
    const noTemps: FakeDevice[] = [
      { id: 11, userId: 1, roomCurrentTemp: null, roomTargetTemp: null },
    ];
    const { service } = makeFakeDb(noTemps, [
      eventOn(11, 1, '2026-01-01T10:00:00Z'),
    ]);
    const res = await service.getHeatingEvents(1, baseQuery);

    expect(res.data[0].curretTempThermostat).toBeNull();
    expect(res.data[0].targetTempThermostat).toBeNull();
  });

  it('legacy nazivi polja (uključujući typo) ostaju u odgovoru', async () => {
    const { service } = makeFakeDb(devices, events);
    const res = await service.getHeatingEvents(1, baseQuery);

    // FE2-8 zaključava typo u ugovoru; ne smije nestati.
    expect(Object.keys(res.data[0])).toEqual(
      expect.arrayContaining(['curretTempThermostat', 'targetTempThermostat']),
    );
  });
});
