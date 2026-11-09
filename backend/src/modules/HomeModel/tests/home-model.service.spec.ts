jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class {},
}));

import {
  HomeModelService,
  aggregateByLocalDay,
  pickPrimaryDevice,
} from '../home-model.service';
import { OBSERVATIONS_PER_DAY } from '../daily-balance';

const ZONE = 'Europe/Sarajevo';
const TARGET = 21;

describe('grupisanje serije po lokalnom danu', () => {
  const sample = (over: Record<string, unknown> = {}) => ({
    at: new Date('2026-11-01T10:00:00Z'),
    roomTempC: 21,
    targetTempC: 21,
    isHeating: true,
    outdoorTempC: 3,
    flowSetC: 48,
    ...over,
  });

  it('dan se lomi po zoni kuće, ne po UTC', () => {
    // 23:30 UTC 01.11. je 00:30 02.11. u Sarajevu (zima, UTC+1).
    const aggregates = aggregateByLocalDay(
      [
        sample({ at: new Date('2026-11-01T22:00:00Z') }),
        sample({ at: new Date('2026-11-01T23:30:00Z') }),
      ],
      ZONE,
      '2026-11-03',
    );

    expect(aggregates.map((day) => day.localDate)).toEqual([
      '2026-11-01',
      '2026-11-02',
    ]);
    expect(aggregates[1].samples).toBe(1);
  });

  it('današnji dan se ne broji — nije završen', () => {
    const aggregates = aggregateByLocalDay(
      [
        sample({ at: new Date('2026-11-01T10:00:00Z') }),
        sample({ at: new Date('2026-11-02T10:00:00Z') }),
      ],
      ZONE,
      '2026-11-02',
    );

    expect(aggregates.map((day) => day.localDate)).toEqual(['2026-11-01']);
  });

  it('uzorak bez sobne ne ulazi u `samples`, ali vanjska se broji', () => {
    const [day] = aggregateByLocalDay(
      [
        sample(),
        sample({ roomTempC: null, isHeating: false }),
      ],
      ZONE,
      '2026-11-02',
    );

    expect(day.samples).toBe(1);
    expect(day.outdoorSamples).toBe(2);
    expect(day.heatingSamples).toBe(1);
  });

  it('par je samo uzorak sa i polaznom i sobnom', () => {
    const [day] = aggregateByLocalDay(
      [
        sample({ flowSetC: 48, roomTempC: 20 }),
        sample({ flowSetC: null, roomTempC: 21 }),
      ],
      ZONE,
      '2026-11-02',
    );

    expect(day.heatingSamples).toBe(2);
    expect(day.heatingPairs).toBe(1);
    expect(day.flowMinusRoomSum).toBe(28);
  });

  it('cilj sobe je medijana dana', () => {
    const [day] = aggregateByLocalDay(
      [
        sample({ targetTempC: 20 }),
        sample({ targetTempC: 22 }),
        sample({ targetTempC: 21 }),
      ],
      ZONE,
      '2026-11-02',
    );

    expect(day.targetRoomC).toBe(21);
  });
});

/**
 * Kuća sa POZNATIM parametrima, ista fizika kao `scripts/audit/learning_sim.cjs`:
 *
 *   C·dT/dτ = k1·(T_flow − T_r)·[grijanje] − k2·(T_r − T_out) + q_int
 *
 * Cilj ovog testa je prihvatni kriterij iz `17` §11: na kući sa poznatim
 * nagibom procjena mora pasti unutar ±0,1.
 */
function simulateHouse(options: {
  days: number;
  C: number;
  k1: number;
  k2: number;
  qInt?: number;
}): Array<{
  at: Date;
  roomTempC: number;
  targetTempC: number;
  isHeating: boolean;
  outdoorTempC: number;
  flowSetC: number;
}> {
  const { days, C, k1, k2 } = options;
  const qInt = options.qInt ?? 200;
  const aPerHour = (k1 / C) * 3600;
  const bPerHour = (k2 / C) * 3600;
  const uPerHour = (qInt / C) * 3600;

  let state = 20261108;
  const random = () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
  const gauss = () => {
    const u = Math.max(random(), 1e-9);
    const v = random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  const outdoorAt = (dayIndex: number, minuteOfDay: number) => {
    const phase = (2 * Math.PI * dayIndex) / 45;
    const dailyMean = 1.5 + 5.5 * Math.cos(phase);
    const t = (minuteOfDay - 310) / 1440;
    return dailyMean + 2 * Math.cos(2 * Math.PI * t) + 0.15 * gauss();
  };

  const formulaFlow = (min: number, max: number) => {
    const ext = Math.max(-15, Math.min(10, 0.7 * min + 0.3 * max));
    let base: number;
    if (ext >= 10) base = 45;
    else if (ext <= -15) base = 56;
    else base = 51 - 0.3 * ext;
    return Math.max(30, Math.min(55, base));
  };

  const observations: ReturnType<typeof simulateHouse> = [];
  let room = TARGET - 0.5;
  let heating = false;

  const start = Date.UTC(2026, 9, 1, 0, 0, 0); // 01.10.2026

  for (let day = 0; day < days; day++) {
    let outdoorMin = Infinity;
    let outdoorMax = -Infinity;
    for (let minute = 0; minute < 1440; minute += 5) {
      const value = outdoorAt(day, minute);
      outdoorMin = Math.min(outdoorMin, value);
      outdoorMax = Math.max(outdoorMax, value);
    }
    const flow = formulaFlow(outdoorMin, outdoorMax);

    for (let minute = 0; minute < 1440; minute++) {
      const outdoor = outdoorAt(day, minute);
      // Histereza 1,0 K cijela ispod cilja; senzor zaokružen na 0,5 °C.
      const sensor = Math.round(room * 2) / 2;
      if (heating && sensor >= TARGET) heating = false;
      else if (!heating && sensor <= TARGET - 1) heating = true;

      const deltaRoom =
        (heating ? aPerHour * (flow - room) : 0) - bPerHour * (room - outdoor) + uPerHour;
      room += deltaRoom / 60;

      if (minute % 5 === 0) {
        const at = new Date(start + (day * 1440 + minute) * 60_000);
        observations.push({
          at,
          roomTempC: Math.round(room * 2) / 2,
          targetTempC: TARGET,
          isHeating: heating,
          outdoorTempC: outdoor,
          flowSetC: flow,
        });
      }
    }
  }

  return observations;
}

function setup(observations: unknown[], existingModel: unknown = null) {
  const upserts: any[] = [];
  const prisma = {
    homeProfile: {
      findUnique: jest.fn().mockResolvedValue({
        id: 10,
        weatherTimezone: ZONE,
        user: { timezone: null },
      }),
    },
    thermostatObservation: { findMany: jest.fn().mockResolvedValue(observations) },
    homeModel: {
      findUnique: jest.fn().mockResolvedValue(existingModel),
      upsert: jest.fn(async (args: any) => {
        upserts.push(args);
        return args;
      }),
    },
  };
  const service = new HomeModelService(prisma as any);
  return { service, prisma, upserts };
}

const NOW = new Date('2026-11-05T03:00:00Z');

describe('fit modela kuće', () => {
  it('na kući sa poznatim nagibom procjena padne unutar ±0,1 (§11)', async () => {
    // medium: C=6 MJ/K, k1=212, k2=200 -> s = k2/k1 = 0,943
    const observations = simulateHouse({
      days: 30,
      C: 6e6,
      k1: 212,
      k2: 200,
    });
    const { service, upserts } = setup(observations);

    const result = await service.fitHome(10, NOW);

    expect(result.state).toBe('TRACKING');
    expect(result.slope).not.toBeNull();
    expect(Math.abs((result.slope ?? 0) - 200 / 212)).toBeLessThanOrEqual(0.1);
    expect(upserts[0].update.slopeS).toBeCloseTo(result.slope as number, 10);
    expect(upserts[0].update.state).toBe('TRACKING');
    expect(upserts[0].update.modelVersion).toBe('model-1');
    expect(upserts[0].update.lastFitAt).toEqual(NOW);
  });

  it('druga kuća (lakša konstrukcija) daje manji nagib', async () => {
    // light: C=4 MJ/K, k1=212, k2=160 -> s = 0,755
    const observations = simulateHouse({
      days: 30,
      C: 4e6,
      k1: 212,
      k2: 160,
    });
    const { service } = setup(observations);

    const result = await service.fitHome(10, NOW);

    expect(result.state).toBe('TRACKING');
    expect(Math.abs((result.slope ?? 0) - 160 / 212)).toBeLessThanOrEqual(0.1);
  });

  it('bez podataka: COLD_START, bez ijednog broja', async () => {
    const { service, upserts } = setup([]);

    const result = await service.fitHome(10, NOW);

    expect(result.state).toBe('COLD_START');
    expect(result.slope).toBeNull();
    expect(upserts[0].update.slopeS).toBeUndefined();
    expect(upserts[0].update.reason).toContain('NOT_ENOUGH_DAYS');
  });

  it('DEGRADED ne prepisuje postojeću procjenu', async () => {
    const { service, upserts } = setup([], { slopeS: 0.77 });

    const result = await service.fitHome(10, NOW);

    expect(result.state).toBe('DEGRADED');
    // Ključno: nijedno mjerno polje se ne dira, pa stara procjena preživi.
    expect(upserts[0].update).not.toHaveProperty('slopeS');
    expect(upserts[0].update).not.toHaveProperty('slopeCiLow');
    expect(upserts[0].update).not.toHaveProperty('internalGainC');
    expect(upserts[0].update.lastFitAt).toBeUndefined();
    expect(upserts[0].update.lastAttemptAt).toEqual(NOW);
  });

  it('uz nagib pamti i `u_day` — dnevni dobitak iz istog fita', async () => {
    // Konstantni dobici u simulaciji: fit ih upija u `c`, pa `u_day` mora biti
    // blizu nule. Da nije, dobitak bi se brojao dvaput — i polazna bi padala
    // bez razloga.
    const observations = simulateHouse({
      days: 30,
      C: 6e6,
      k1: 212,
      k2: 200,
    });
    const { service, upserts } = setup(observations);

    await service.fitHome(10, NOW);

    const update = upserts[0].update;
    expect(typeof update.uDayC).toBe('number');
    expect(Math.abs(update.uDayC)).toBeLessThanOrEqual(2);
    expect(Math.abs(update.uDayC)).toBeLessThan(0.5);
    expect(update.uDayDays).toBeGreaterThanOrEqual(4);
    expect(update.uDayAt).toEqual(NOW);
  });

  it('kad fita nema, `u_day` se ne dira — stara procjena nije nova', async () => {
    const observations = simulateHouse({
      days: 3,
      C: 6e6,
      k1: 212,
      k2: 200,
    });
    const { service, upserts } = setup(observations);

    await service.fitHome(10, NOW);

    expect(upserts[0].update.uDayC).toBeUndefined();
    expect(upserts[0].update.uDayAt).toBeUndefined();
  });

  it('dani koji ne prolaze filter ostaju u `daysEvaluated`, sa razlogom', async () => {
    // Samo 3 dana — dovoljno za agregaciju, premalo za fit.
    const observations = simulateHouse({
      days: 3,
      C: 6e6,
      k1: 212,
      k2: 200,
    });
    const { service, upserts } = setup(observations);

    const result = await service.fitHome(10, NOW);

    expect(result.daysEvaluated).toBeGreaterThanOrEqual(3);
    expect(result.days).toBeLessThan(8);
    expect(upserts[0].update.days).toBeLessThan(8);
    expect(result.state).toBe('COLD_START');
  });

  it('traži seriju u prozoru od 60 dana', async () => {
    const { service, prisma } = setup([]);
    await service.fitHome(10, NOW);

    const args = prisma.thermostatObservation.findMany.mock.calls[0][0];
    const from = args.where.at.gte as Date;
    const days = (NOW.getTime() - from.getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(60);
    expect(args.where.homeProfileId).toBe(10);
  });

  it('kuća sa dva termostata: fit koristi samo primarni uređaj', async () => {
    const primary = simulateHouse({
      days: 30,
      C: 6e6,
      k1: 212,
      k2: 200,
    }).map((row) => ({ ...row, deviceId: 1 }));

    // Drugi termostat u drugoj sobi: malo uzoraka, drugačija soba.
    const secondary = primary
      .slice(0, 20)
      .map((row) => ({ ...row, deviceId: 2, roomTempC: 14, flowSetC: 30 }));

    const { service, upserts } = setup([...primary, ...secondary]);

    const result = await service.fitHome(10, NOW);

    expect(result.state).toBe('TRACKING');
    expect(Math.abs((result.slope ?? 0) - 200 / 212)).toBeLessThanOrEqual(0.1);
    expect(upserts[0].update.sourceDeviceId).toBe(1);
  });

  it('kuća koja ne postoji je greška, ne tihi preskok', async () => {
    const { service, prisma } = setup([]);
    prisma.homeProfile.findUnique.mockResolvedValue(null);

    await expect(service.fitHome(999, NOW)).rejects.toThrow(
      'HomeProfile 999 ne postoji',
    );
  });

  it('dnevni zapis ima najviše 288 uzoraka i to je pokrivenost', () => {
    const observations = simulateHouse({
      days: 2,
      C: 6e6,
      k1: 212,
      k2: 200,
    });
    const aggregates = aggregateByLocalDay(
      observations,
      ZONE,
      '2026-10-03',
    );
    for (const day of aggregates) {
      expect(day.samples).toBeLessThanOrEqual(OBSERVATIONS_PER_DAY);
    }
  });
});

describe('primarni uređaj', () => {
  const row = (deviceId: number | undefined) => ({
    deviceId,
    at: new Date('2026-11-01T10:00:00Z'),
    roomTempC: 21,
    targetTempC: 21,
    isHeating: true,
    outdoorTempC: 3,
    flowSetC: 48,
  });

  it('uzima uređaj sa najviše uzoraka', () => {
    expect(
      pickPrimaryDevice([row(2), row(1), row(1)]),
    ).toBe(1);
  });

  it('kod izjednačenja uzima manji id — determinizam', () => {
    expect(pickPrimaryDevice([row(7), row(3)])).toBe(3);
    expect(pickPrimaryDevice([row(3), row(7)])).toBe(3);
  });

  it('bez uređaja nema primarnog', () => {
    expect(pickPrimaryDevice([row(undefined)])).toBeNull();
    expect(pickPrimaryDevice([])).toBeNull();
  });
});
