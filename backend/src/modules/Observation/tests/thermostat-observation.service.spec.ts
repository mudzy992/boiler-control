jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class {},
}));

import {
  ThermostatObservationService,
  finiteOrNull,
} from '../thermostat-observation.service';

function setup(options: { violationOnce?: boolean } = {}) {
  const rows: any[] = [];
  let violations = options.violationOnce ? 1 : 0;

  const prisma = {
    thermostatObservation: {
      create: jest.fn(async ({ data }: any) => {
        if (violations > 0) {
          violations -= 1;
          const error = new Error('Unique constraint failed') as Error & {
            code: string;
          };
          error.code = 'P2002';
          throw error;
        }
        rows.push(data);
        return data;
      }),
    },
  };

  const service = new ThermostatObservationService(prisma as any);
  return { service, prisma, rows };
}

const sample = (over: Record<string, unknown> = {}) => ({
  deviceId: 1,
  homeProfileId: 10,
  now: new Date('2026-11-09T06:03:47Z'),
  roomTempC: 20.5,
  targetTempC: 22,
  isHeating: true,
  outdoorTempC: -3,
  flowSetC: 48,
  ...over,
});

describe('vremenska serija', () => {
  it('prvo očitanje u bucketu se upisuje, sa početkom bucketa kao `at`', async () => {
    const { service, rows } = setup();
    const result = await service.record(sample());

    expect(result).toBe('created');
    expect(rows).toHaveLength(1);
    expect(rows[0].at.toISOString()).toBe('2026-11-09T06:00:00.000Z');
    expect(rows[0]).toMatchObject({
      deviceId: 1,
      homeProfileId: 10,
      roomTempC: 20.5,
      targetTempC: 22,
      isHeating: true,
      outdoorTempC: -3,
      flowSetC: 48,
      source: 'TUYA',
    });
  });

  it('isDue: novi bucket je dužan, isti nije', async () => {
    const { service } = setup();
    expect(service.isDue(1, new Date('2026-11-09T06:03:00Z'))).toBe(true);

    await service.record(sample());
    expect(service.isDue(1, new Date('2026-11-09T06:04:00Z'))).toBe(false);
    expect(service.isDue(1, new Date('2026-11-09T06:05:00Z'))).toBe(true);
    // Drugi uređaj ima svoj bucket.
    expect(service.isDue(2, new Date('2026-11-09T06:04:00Z'))).toBe(true);
  });

  it('drugi poziv u istom bucketu ne dira bazu', async () => {
    const { service, prisma } = setup();
    await service.record(sample());
    const second = await service.record(
      sample({ now: new Date('2026-11-09T06:04:59Z') }),
    );

    expect(second).toBe('skipped');
    expect(prisma.thermostatObservation.create).toHaveBeenCalledTimes(1);
  });

  it('novi bucket poslije pet minuta se upisuje', async () => {
    const { service, rows } = setup();
    await service.record(sample());
    const second = await service.record(
      sample({ now: new Date('2026-11-09T06:05:00Z') }),
    );

    expect(second).toBe('created');
    expect(rows).toHaveLength(2);
    expect(rows[1].at.toISOString()).toBe('2026-11-09T06:05:00.000Z');
  });

  it('bucket koji je već u bazi (restart, drugi proces) nije greška', async () => {
    const { service, rows } = setup({ violationOnce: true });
    const result = await service.record(sample());

    expect(result).toBe('exists');
    expect(rows).toHaveLength(0);
    // Bucket se pamti i poslije `exists`, pa se ne pokušava svake minute.
    expect(await service.record(sample())).toBe('skipped');
  });

  it('prava greška se NE pamti kao obrađen bucket — pokušava se ponovo', async () => {
    const { service, prisma } = setup();
    prisma.thermostatObservation.create.mockRejectedValueOnce(
      new Error('veza s bazom je pala'),
    );

    await expect(service.record(sample())).rejects.toThrow(
      'veza s bazom je pala',
    );

    // Isti bucket, ali pošto prvi upis nije prošao, drugi pokušaj ide u bazu.
    const retry = await service.record(
      sample({ now: new Date('2026-11-09T06:04:30Z') }),
    );
    expect(retry).toBe('created');
  });

  it('uređaji se prate neovisno', async () => {
    const { service, rows } = setup();
    await service.record(sample());
    await service.record(sample({ deviceId: 2 }));
    const again = await service.record(sample());

    expect(again).toBe('skipped');
    expect(rows.map((row) => row.deviceId)).toEqual([1, 2]);
  });

  it('zaboravljen uređaj se ponovo upisuje u isti bucket (samo za test/brisanje)', async () => {
    const { service } = setup();
    await service.record(sample());
    service.forgetDevice(1);
    // Ponovni pokušaj ide u bazu i tamo pada na unique indeksu — što je i
    // jedina prava garancija; mapa je samo optimizacija.
    expect(await service.record(sample())).toBe('created');
  });
});

describe('nula nije mjerenje', () => {
  it('nedostajuće vrijednosti ostaju null, ne 0', async () => {
    const { service, rows } = setup();
    await service.record(
      sample({
        roomTempC: null,
        targetTempC: null,
        outdoorTempC: null,
        flowSetC: null,
      }),
    );

    expect(rows[0]).toMatchObject({
      roomTempC: null,
      targetTempC: null,
      outdoorTempC: null,
      flowSetC: null,
    });
  });

  it('nesmislen broj postaje null', async () => {
    const { service, rows } = setup();
    await service.record(
      sample({ roomTempC: Number.NaN, outdoorTempC: Infinity }),
    );

    expect(rows[0].roomTempC).toBeNull();
    expect(rows[0].outdoorTempC).toBeNull();
  });

  it('finiteOrNull propušta samo konačne brojeve (i nulu)', () => {
    expect(finiteOrNull(0)).toBe(0);
    expect(finiteOrNull(-3.5)).toBe(-3.5);
    expect(finiteOrNull(null)).toBeNull();
    expect(finiteOrNull(undefined)).toBeNull();
    expect(finiteOrNull(Number.NaN)).toBeNull();
    expect(finiteOrNull(Number.POSITIVE_INFINITY)).toBeNull();
  });
});
