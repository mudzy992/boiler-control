jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class {},
}));
jest.mock('../../Heating/engine/flow-temperature.engine', () => ({
  FlowTemperatureEngine: { calculate: jest.fn() },
}));

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FlowTemperatureEngine } from '../../Heating/engine/flow-temperature.engine';
import type { FlowTempResult } from '../../Heating/engine/types';
import { HeatingRecommendationService } from '../heating.recommendation.service';

/**
 * F4.6 — **jedan pisac po redu.**
 *
 * Do F4.6 ovaj fajl je provjeravao da servis **piše** `Recommendation` red i
 * snimak motora u njemu. To je bio FE2-10. F4.6 je tu odluku obrnuo, i to s
 * razlogom koji je izmjeren, ne pretpostavljen:
 *
 *   `DailyRecordWriter` upisuje jutarnji predlog u `DailyRecord` **i**
 *   `Recommendation` u istoj transakciji, a ovaj servis je `Recommendation`
 *   **prepisivao krivinom** na svakom događaju grijanja. Klijent čita
 *   `Recommendation`, pa je vidio krivu, a ne predlog.
 *
 *   Mjerenje prije izmjene (run `43282265347`, 60 dana): **15 od 54** dana se
 *   razlikuje više od 0,5 K, najviše **3,74 K**.
 *
 * Zato testovi sada provjeravaju **odsustvo** pisanja, a ne prisustvo. To je
 * namjerno: „ne piše" je nova invarijanta, a test koji bi samo obrisan ne bi
 * spriječio da se pisanje vrati kroz neku buduću izmjenu.
 */
const engineResult: FlowTempResult = {
  baseCurveTemp: 51.123456,
  weightedExternalTemp: -2.5,
  appliedOffsets: { home: 0.25, interval: -0.5, events: 0.125 },
  finalTemp: 50.998456,
  confidence: 0.72,
};
const engineCalculate = Reflect.get(
  FlowTemperatureEngine,
  'calculate',
) as jest.Mock;

function makeService(prisma: unknown): HeatingRecommendationService {
  const recommendationWeather = {
    getV2WeatherInput: jest.fn().mockResolvedValue(null),
  };
  return Reflect.construct(HeatingRecommendationService, [
    prisma,
    recommendationWeather,
  ]);
}

/** Prisma mock koji bilježi svaki poziv na `recommendation`. */
function recordingPrisma() {
  const rec = {
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 1 }),
    update: jest.fn().mockResolvedValue({ id: 1 }),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
  };
  const prisma = {
    thermostatDevice: {
      // Servis zove `findUnique` sa `include` (zona kuće, v. F5.2).
      findUnique: jest.fn().mockResolvedValue({
        id: 1,
        userId: 7,
        homeProfile: {
          id: 3,
          floorArea: 150,
          learningOffset: 0,
          learningConfidence: 0.5,
          location: 'Visoko',
          timezone: 'Europe/Sarajevo',
          // `getOrCreateIntervalLearning` čita ovaj niz i, kad ključ ne
          // postoji, gura novi zapis u njega — pa mora biti niz, ne undefined.
          intervalLearnings: [],
          user: { timezone: 'Europe/Sarajevo' },
        },
      }),
    },
    heatingIntervalLearning: {
      findUnique: jest.fn().mockResolvedValue({
        id: 1,
        key: 'weekday_morning',
        samples: 8,
        offset: 0.5,
        confidence: 0.5,
        avgReachTimeMin: 30,
        p90OvershootC: 0.2,
        avgOvershoot: 0.4,
      }),
      create: jest.fn().mockResolvedValue({ id: 2 }),
      update: jest.fn().mockResolvedValue({ id: 1 }),
      // F5.3: učenje se upisuje kroz `updateMany` (jedan upis za sve kolone).
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    weatherCache: { findFirst: jest.fn().mockResolvedValue(null) },
    heatingEvent: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    recommendation: rec,
  };
  return { prisma, rec };
}

/*
 * Završen događaj (`timestampEnd` postoji): učenje intervala se ažurira **samo**
 * za završene cikluse (`heating.recommendation.service.ts`, „3️⃣ Update interval
 * learning if event ended"). Bez `timestampEnd` bi test „učenje ostaje" mjerio
 * granu koja se ne izvršava i bio zelen a da ništa ne dokazuje.
 */
const event = {
  userId: 7,
  deviceId: 1,
  timestampStart: new Date('2026-11-02T06:20:00.000Z'),
  timestampEnd: new Date('2026-11-02T06:50:00.000Z'),
  roomCurrentTemp: 22.4,
  roomTargetTemp: 22,
  boilerFlowTemp: 50,
};

describe('F4.6 HeatingRecommendationService — ne piše Recommendation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-11-02T07:00:00.000Z'));
    engineCalculate.mockReturnValue(engineResult);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('ne upisuje i ne prepisuje preporuku koju klijenti čitaju', async () => {
    const { prisma, rec } = recordingPrisma();
    const service = makeService(prisma);

    await service.processHeatingEvent(event);

    // Nijedan upis. `findFirst` je dozvoljen (čitanje), ali ne smije ni on:
    // ako servis čita red, sljedeća izmjena će ga i pisati.
    expect(rec.create).not.toHaveBeenCalled();
    expect(rec.update).not.toHaveBeenCalled();
    expect(rec.updateMany).not.toHaveBeenCalled();
    expect(rec.findFirst).not.toHaveBeenCalled();
  });

  it('učenje intervala ostaje — to je jedini vlasnik tog reda', async () => {
    // F4.6 gasi pisanje **preporuke**, ne učenje. Bez učenja nema F5.3/F5.4,
    // pa bi gašenje svega bilo mnogo gore od problema koji se rješava.
    const { prisma } = recordingPrisma();
    const service = makeService(prisma);

    await service.processHeatingEvent(event);

    const touched =
      prisma.heatingIntervalLearning.updateMany.mock.calls.length +
      prisma.heatingIntervalLearning.update.mock.calls.length +
      prisma.heatingIntervalLearning.create.mock.calls.length;
    expect(touched).toBeGreaterThan(0);
  });

  it('ne računa predlog — motor se ne poziva', async () => {
    // Ako servis ne piše preporuku, nema razloga ni da računa broj. Poziv
    // motora bi bio trošak bez korisnika, a i mjesto gdje bi se pisanje lako
    // vratilo.
    const { prisma } = recordingPrisma();
    const service = makeService(prisma);

    await service.processHeatingEvent(event);

    expect(engineCalculate).not.toHaveBeenCalled();
  });

  it('izvor: ni jedan pisac Recommendation van writer-a', () => {
    // Statička provjera uz ponašajnu: `grep` mora naći tačno jedan write site
    // u cijelom backendu. Bez ovoga bi se pisanje moglo vratiti u ovaj servis
    // a da ponašajni test i dalje prolazi (npr. u grani koja se ne izvršava).
    const service = readFileSync(
      join(__dirname, '../heating.recommendation.service.ts'),
      'utf8',
    );
    expect(service).not.toContain('recommendation.create');
    expect(service).not.toContain('recommendation.update');

    const writer = readFileSync(
      join(__dirname, '../../DailyRecord/daily-record.writer.ts'),
      'utf8',
    );
    expect(writer).toContain('tx.recommendation.create');
  });
});
