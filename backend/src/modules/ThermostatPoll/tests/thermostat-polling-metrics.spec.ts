import { ThermostatPollingService } from '../thermostat.polling.service';
import { MetricsService } from '../../../common/metrics.service';

// Servis ove module uvozi kao vrijednosti; bez mock-a bi se povukao cijeli
// Prisma/provider lanac.
jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../../Notification/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));
jest.mock('../../Boiler/boiler.service', () => ({
  BoilerService: class BoilerService {},
}));
jest.mock('../../HeatingRecommendation/heating.recommendation.service', () => ({
  HeatingRecommendationService: class HeatingRecommendationService {},
}));
// `MetricsService` je NAMJERNO stvaran: test tvrdi nazive i vrijednosti metrika.

type FakeDevice = {
  id: number;
  userId: number;
  deviceId: string;
  lastSnapshotAt: Date | null;
  roomCurrentTemp?: number | null;
  roomTargetTemp?: number | null;
};

type Harness = {
  service: ThermostatPollingService;
  metrics: MetricsService;
  snapshotCalls: string[];
};

/**
 * Lažna baza/adapter. `snapshotFor` vraća snapshot po `deviceId`, ili baca, ili
 * vraća `null` — tako se pokrivaju sve izlazne putanje `pollDevice`.
 */
function makeHarness(options: {
  devices?: FakeDevice[];
  listingError?: boolean;
  snapshotFor?: (deviceId: string) => unknown;
}): Harness {
  const { devices = [], listingError = false } = options;
  const snapshotFor =
    options.snapshotFor ??
    (() => ({ currentTemp: 20, targetTemp: 22, powerOn: false }));

  const snapshotCalls: string[] = [];

  const db = {
    thermostatDevice: {
      findMany: () => {
        if (listingError) {
          return Promise.reject(new Error('synthetic listing failure'));
        }
        return Promise.resolve(devices);
      },
      updateMany: () => Promise.resolve({ count: 1 }),
    },
    heatingEvent: {
      findFirst: () => Promise.resolve(null),
      create: () => Promise.resolve({ id: 1 }),
      update: () => Promise.resolve({ id: 1 }),
    },
  };

  const adapter = {
    fetchSnapshot: (deviceId: string) => {
      snapshotCalls.push(deviceId);
      return Promise.resolve(snapshotFor(deviceId));
    },
  };

  const boiler = {
    calculateFlowTemp: () => Promise.resolve({ flowTemp: 45 }),
  };

  const metrics = new MetricsService();

  const service = new ThermostatPollingService(
    db as any,
    adapter as any,
    boiler as any,
    {} as any,
    {} as any,
    metrics,
  );

  return { service, metrics, snapshotCalls };
}

const device = (id: number, over: Partial<FakeDevice> = {}): FakeDevice => ({
  id,
  userId: id,
  deviceId: `dev-${id}`,
  lastSnapshotAt: null,
  ...over,
});

/** Brojači uređaja kao običan objekt, radi čitljivih asertacija. */
function deviceCounters(m: MetricsService) {
  const all = m.getMetrics();
  return {
    total: all.poll_devices_total,
    success: all.poll_devices_success,
    failed: all.poll_devices_failed,
    skipped: all.poll_devices_skipped,
    no_snapshot: all.poll_devices_no_snapshot,
    incomplete: all.poll_devices_incomplete,
  };
}

describe('B-023: poll ciklus ne smije prijaviti uspjeh kad nijedan uređaj nije obrađen', () => {
  it('dva uređaja koja bace → 2 failed, 0 success', async () => {
    const { service, metrics } = makeHarness({
      devices: [device(1), device(2)],
      snapshotFor: () => {
        throw new Error('synthetic device failure');
      },
    });

    await service.pollAll();

    expect(deviceCounters(metrics)).toEqual({
      total: 2,
      success: 0,
      failed: 2,
      skipped: 0,
      no_snapshot: 0,
      incomplete: 0,
    });

    // Ciklus je tehnički završio, ali to NIJE uspješna obrada — upravo ta
    // razlika je bila B-023.
    const all = metrics.getMetrics();
    expect(all.poll_runs_total).toBe(1);
    expect(all.poll_runs_success).toBe(1);
    expect(all.poll_runs_failed).toBe(0);
  });

  it('miješani ishod: drugi uređaj se i dalje obrađuje', async () => {
    const { service, metrics, snapshotCalls } = makeHarness({
      devices: [device(1), device(2)],
      snapshotFor: (id) => {
        if (id === 'dev-1') throw new Error('synthetic device failure');
        return { currentTemp: 20, targetTemp: 22, powerOn: false };
      },
    });

    await service.pollAll();

    expect(deviceCounters(metrics)).toEqual({
      total: 2,
      success: 1,
      failed: 1,
      skipped: 0,
      no_snapshot: 0,
      incomplete: 0,
    });
    // Izolacija grešaka među uređajima mora ostati.
    expect(snapshotCalls).toEqual(['dev-1', 'dev-2']);
  });

  it('adaptivni skip se broji kao skipped i NE zove adapter', async () => {
    const { service, metrics, snapshotCalls } = makeHarness({
      devices: [device(1, { lastSnapshotAt: new Date() })],
    });

    await service.pollAll();

    expect(deviceCounters(metrics).skipped).toBe(1);
    expect(deviceCounters(metrics).success).toBe(0);
    expect(snapshotCalls).toHaveLength(0);
  });

  it('adapter bez snapshot-a → no_snapshot, ne success', async () => {
    const { service, metrics } = makeHarness({
      devices: [device(1)],
      snapshotFor: () => null,
    });

    await service.pollAll();

    expect(deviceCounters(metrics)).toMatchObject({
      total: 1,
      success: 0,
      no_snapshot: 1,
    });
  });

  it('snapshot bez temperatura → incomplete, ne success', async () => {
    const { service, metrics } = makeHarness({
      devices: [device(1)],
      snapshotFor: () => ({
        currentTemp: null,
        targetTemp: null,
        powerOn: true,
      }),
    });

    await service.pollAll();

    expect(deviceCounters(metrics)).toMatchObject({
      total: 1,
      success: 0,
      incomplete: 1,
    });
  });

  it('prazna lista: ciklus završava, ali nema obrađenih uređaja', async () => {
    const { service, metrics } = makeHarness({ devices: [] });

    await service.pollAll();

    const all = metrics.getMetrics();
    expect(all.poll_runs_total).toBe(1);
    expect(all.poll_runs_success).toBe(1);
    expect(all.poll_devices_total).toBe(0);
    expect(all.poll_devices_success).toBe(0);
  });

  it('greška listanja → poll_runs_failed, bez brojača uređaja', async () => {
    const { service, metrics } = makeHarness({
      devices: [device(1)],
      listingError: true,
    });

    await service.pollAll();

    const all = metrics.getMetrics();
    expect(all.poll_runs_total).toBe(1);
    expect(all.poll_runs_failed).toBe(1);
    expect(all.poll_runs_success).toBe(0);
    expect(all.poll_devices_total).toBe(0);
  });
});

describe('B-023: svježina posljednjeg valjanog snapshot-a', () => {
  it('gauge ostaje 0 dok nijedan uređaj nije uspješno obrađen', async () => {
    const { service, metrics } = makeHarness({
      devices: [device(1), device(2)],
      snapshotFor: () => {
        throw new Error('synthetic device failure');
      },
    });

    await service.pollAll();

    expect(metrics.getMetrics().poll_last_success_timestamp_seconds).toBe(0);
  });

  it('gauge se postavlja kad barem jedan uređaj uspije', async () => {
    const before = Math.floor(Date.now() / 1000);
    const { service, metrics } = makeHarness({ devices: [device(1)] });

    await service.pollAll();

    const value = metrics.getMetrics().poll_last_success_timestamp_seconds;
    expect(value).toBeGreaterThanOrEqual(before);
    expect(value).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
  });
});

describe('B-023: ugovor metrika', () => {
  it('stare metrike ostaju izvezene (Grafana panel ih koristi)', async () => {
    const { service, metrics } = makeHarness({ devices: [device(1)] });
    await service.pollAll();

    const text = metrics.exportPrometheus();
    for (const name of [
      'poll_runs_total',
      'poll_runs_success',
      'poll_runs_failed',
    ]) {
      expect(text).toContain(`# TYPE ${name} counter`);
      expect(text).toMatch(new RegExp(`^${name} \\d+$`, 'm'));
    }
  });

  it('nove metrike su izvezene s HELP/TYPE i vrijednošću', async () => {
    const { service, metrics } = makeHarness({ devices: [device(1)] });
    await service.pollAll();

    const text = metrics.exportPrometheus();
    for (const name of [
      'poll_devices_total',
      'poll_devices_success',
      'poll_devices_failed',
      'poll_devices_skipped',
      'poll_devices_no_snapshot',
      'poll_devices_incomplete',
    ]) {
      expect(text).toContain(`# TYPE ${name} counter`);
      expect(text).toMatch(new RegExp(`^${name} \\d+$`, 'm'));
    }
    expect(text).toContain('# TYPE poll_last_success_timestamp_seconds gauge');
    expect(text).toMatch(/^poll_last_success_timestamp_seconds \d+$/m);
  });

  it('nema user/device ID labela (bez PII)', async () => {
    const { service, metrics } = makeHarness({
      devices: [device(1), device(2)],
    });
    await service.pollAll();

    const pollLines = metrics
      .exportPrometheus()
      .split('\n')
      .filter((l) => l.startsWith('poll_'));

    expect(pollLines.length).toBeGreaterThan(0);
    for (const line of pollLines) {
      expect(line).not.toMatch(/\{[^}]*\}/);
      expect(line).not.toContain('dev-');
    }
  });
});
