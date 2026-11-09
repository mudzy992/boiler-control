jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class {},
}));

import {
  DEFAULT_TARGET_ROOM_C,
  ProposalShadowService,
  SHADOW_VERSION,
} from '../proposal-shadow.service';

/**
 * Shadow odluka smije pisati samo `shadow*` kolone i `HomeModel.shortCycleFloorC`.
 * Testovi čuvaju upravo to: predlog se ne dira ni kad kontroler ima drugačiju
 * vrijednost, a odluka se ne donosi kad nema osnova.
 */

const DAY = '2026-11-07';
const YESTERDAY = '2026-11-06';
const NOW = new Date('2026-11-07T05:10:00Z');

interface Setup {
  record?: Record<string, unknown> | null;
  home?: Record<string, unknown> | null;
  model?: Record<string, unknown> | null;
  previous?: Record<string, unknown> | null;
  outcome?: Record<string, unknown> | null;
  changed?: Record<string, unknown> | null;
  nightFloor?: Record<string, unknown>;
}

function setup(options: Setup = {}) {
  const prisma = {
    dailyRecord: {
      findFirst: jest.fn((args: { where: Record<string, any> }) => {
        const where = args.where;
        if (where.outcomeAt) return Promise.resolve(options.outcome ?? null);
        const proposed = where.proposedFlowTemp;
        if (proposed && typeof proposed.not === 'number') {
          return Promise.resolve(options.changed ?? null);
        }
        if (proposed && proposed.not === null) {
          return Promise.resolve(options.previous ?? null);
        }
        return Promise.resolve(
          options.record === undefined
            ? {
                id: 1,
                proposedFlowTemp: 45,
                nightMinC: -3,
                shadowAt: null,
              }
            : options.record,
        );
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    homeProfile: {
      findUnique: jest.fn().mockResolvedValue(
        options.home === undefined
          ? {
              targetMorningTemp: 21,
              targetDayTemp: 22,
              boilerCatalogId: 'vaillant-ecotec-plus-vuw',
            }
          : options.home,
      ),
    },
    homeModel: {
      findUnique: jest.fn().mockResolvedValue(
        options.model === undefined
          ? { state: 'TRACKING', slopeCiHigh: 0.96, shortCycleFloorC: null }
          : options.model,
      ),
      update: jest.fn().mockResolvedValue({}),
    },
  };

  const outcomes = {
    nightFloorFor: jest.fn().mockResolvedValue(
      options.nightFloor ?? { floorC: null, basis: 'NO_FAILURE', comparableNights: 3 },
    ),
  };

  const service = new ProposalShadowService(prisma as never, outcomes as never);
  return { service, prisma, outcomes };
}

const comfortableOutcome = {
  localDate: YESTERDAY,
  undershootC: 0.2,
  overshootC: 0.1,
  nightUndershootC: 0.1,
  medianCycleMin: 40,
};

describe('ProposalShadowService — kada se ne odlučuje', () => {
  it('bez dnevnog zapisa nema shadow odluke', async () => {
    const { service, prisma } = setup({ record: null });
    const result = await service.evaluate(10, DAY, NOW);
    expect(result.status).toBe('NO_RECORD');
    expect(prisma.dailyRecord.updateMany).not.toHaveBeenCalled();
  });

  it('ako je odluka već zapisana, ne piše se ponovo', async () => {
    const { service, prisma } = setup({
      record: { id: 1, proposedFlowTemp: 45, nightMinC: -3, shadowAt: NOW },
    });
    const result = await service.evaluate(10, DAY, NOW);
    expect(result.status).toBe('ALREADY_DONE');
    expect(prisma.dailyRecord.updateMany).not.toHaveBeenCalled();
  });

  it('bez modela drži prošlu polaznu i ne spušta', async () => {
    const { service } = setup({
      model: { state: 'COLD_START', slopeCiHigh: null, shortCycleFloorC: null },
      previous: { localDate: YESTERDAY, proposedFlowTemp: 45 },
      outcome: comfortableOutcome,
    });

    const result = await service.evaluate(10, DAY, NOW);
    expect(result.decision?.flowC).toBe(45);
    expect(result.decision?.action).toBe('HOLD');
    expect(result.decision?.reasons).toEqual(['NO_MODEL']);
  });

  it('DEGRADED model drži prošlu polaznu', async () => {
    const { service } = setup({
      model: { state: 'DEGRADED', slopeCiHigh: 0.5, shortCycleFloorC: null },
      previous: { localDate: YESTERDAY, proposedFlowTemp: 45 },
      outcome: comfortableOutcome,
    });

    const result = await service.evaluate(10, DAY, NOW);
    expect(result.decision?.flowC).toBe(45);
    expect(result.decision?.reasons).toEqual(['DEGRADED']);
  });

  it('bez prognoze noći kontroler ne računa ravnotežnu polaznu', async () => {
    const { service, outcomes } = setup({
      record: { id: 1, proposedFlowTemp: 45, nightMinC: null, shadowAt: null },
      previous: { localDate: YESTERDAY, proposedFlowTemp: 45 },
      outcome: comfortableOutcome,
    });

    const result = await service.evaluate(10, DAY, NOW);
    expect(outcomes.nightFloorFor).not.toHaveBeenCalled();
    expect(result.decision?.flowC).toBe(45);
    expect(result.decision?.reasons).toEqual(['NO_MODEL']);
  });
});

describe('ProposalShadowService — odluka', () => {
  it('udoban dan spušta jedan korak i piše samo shadow kolone', async () => {
    const { service, prisma } = setup({
      previous: { localDate: YESTERDAY, proposedFlowTemp: 45 },
      outcome: comfortableOutcome,
      changed: { localDate: '2026-10-30' },
    });

    const result = await service.evaluate(10, DAY, NOW);

    // Baza: 21 + 0,96·(21 − (−3)) = 44,04. Spuštanje bi dalo 44, ali ispod
    // baze se ne ide, pa odluka staje tačno na bazi.
    expect(result.decision?.flowC).toBeCloseTo(44.04, 6);
    expect(result.decision?.action).toBe('LOWER');

    expect(prisma.dailyRecord.updateMany).toHaveBeenCalledTimes(1);
    const call = prisma.dailyRecord.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ homeProfileId: 10, localDate: DAY, shadowAt: null });
    expect(call.data).toMatchObject({
      shadowFlowC: 44.04,
      shadowAction: 'LOWER',
      shadowAt: NOW,
      shadowVersion: SHADOW_VERSION,
    });
    expect(Object.keys(call.data).sort()).toEqual([
      'shadowAction',
      'shadowAt',
      'shadowFlowC',
      'shadowReasons',
      'shadowVersion',
    ]);
  });

  it('noćni minimum ulazi u shadow odluku i vidi se u razlozima', async () => {
    const { service } = setup({
      previous: { localDate: YESTERDAY, proposedFlowTemp: 45 },
      outcome: comfortableOutcome,
      changed: { localDate: '2026-10-30' },
      nightFloor: { floorC: 47, basis: 'RAISED_FROM_FAILURE', comparableNights: 2 },
    });

    const result = await service.evaluate(10, DAY, NOW);
    expect(result.decision?.flowC).toBe(47);
    expect(result.decision?.bounds).toContain('NIGHT_FLOOR');
  });

  it('cilj dolazi iz profila, a bez njega se koristi dokumentovani default', async () => {
    const { service } = setup({
      home: {
        targetMorningTemp: null,
        targetDayTemp: null,
        boilerCatalogId: 'vaillant-ecotec-plus-vuw',
      },
      previous: { localDate: YESTERDAY, proposedFlowTemp: 45 },
      outcome: comfortableOutcome,
      changed: { localDate: '2026-10-30' },
    });

    const result = await service.evaluate(10, DAY, NOW);
    // 21 + 0,96·24 = 44,04 — isti broj kao sa targetMorningTemp 21. Vrijednost
    // se ne zaokružuje: i današnji predlog nosi decimale (npr. 49,74).
    expect(result.decision?.flowC).toBeCloseTo(44.04, 6);
    expect(DEFAULT_TARGET_ROOM_C).toBe(21);
  });
});

describe('ProposalShadowService — dnevni dobitak (`u_day`)', () => {
  const fitted = { state: 'TRACKING', slopeCiHigh: 0.96, shortCycleFloorC: null };

  /**
   * Bez prošlog predloga odluka je **tačno** ravnotežna polazna (korak
   * spuštanja se ne primjenjuje), pa se `u_day` vidi bez posrednika. Ihsod
   * mora postojati — bez njega kontroler ne odlučuje.
   */
  const arrange = (model: Record<string, unknown>) =>
    setup({
      model,
      home: {
        targetMorningTemp: 21,
        targetDayTemp: 22,
        boilerCatalogId: 'vaillant-ecotec-plus-vuw',
      },
      previous: null,
      outcome: comfortableOutcome,
      changed: null,
    });

  it('dan sa dobitkom traži nižu polaznu — za isti dan, ista noć', async () => {
    // Bez dobitka: 21 + 0,96·(21 − (−3)) = 44,04.
    const without = await arrange({ ...fitted, uDayC: null }).service.evaluate(
      10,
      DAY,
      NOW,
    );

    // Sa 2 K dobitka (sunce, gosti): 42,04.
    const sunny = await arrange({ ...fitted, uDayC: 2 }).service.evaluate(
      10,
      DAY,
      NOW,
    );

    expect(without.decision?.flowC).toBeCloseTo(44.04, 2);
    expect(sunny.decision?.flowC).toBeCloseTo(42.04, 2);
    expect(
      (without.decision!.flowC ?? 0) - (sunny.decision!.flowC ?? 0),
    ).toBeCloseTo(2, 2);
  });

  it('negativan dobitak (hladniji dan od modela) podiže polaznu', async () => {
    const colder = await arrange({ ...fitted, uDayC: -1.5 }).service.evaluate(
      10,
      DAY,
      NOW,
    );

    // 44,04 + 1,5 = 45,54.
    expect(colder.decision?.flowC).toBeCloseTo(45.54, 2);
  });

  it('korak spuštanja i dalje ograničava dnevnu promjenu — dobitak ne preskače ±2 K', async () => {
    // Prošla polazna 45, dobitak 2 K: ravnotežna je 42,04, ali dnevna granica
    // dozvoljava najviše 2 K niže, a korak je 1 K — pa odluka ne pada na 42.
    const { service } = setup({
      model: { ...fitted, uDayC: 2 },
      home: {
        targetMorningTemp: 21,
        targetDayTemp: 22,
        boilerCatalogId: 'vaillant-ecotec-plus-vuw',
      },
      previous: { localDate: YESTERDAY, proposedFlowTemp: 45 },
      outcome: comfortableOutcome,
      changed: { localDate: '2026-10-30' },
    });

    const result = await service.evaluate(10, DAY, NOW);
    expect(result.decision?.flowC).toBe(44);
  });

  it('bez procjene (`uDayC` nedefinisan) ponašanje je kao prije koraka 7', async () => {
    const missing = await arrange(fitted).service.evaluate(10, DAY, NOW);
    expect(missing.decision?.flowC).toBeCloseTo(44.04, 2);
  });
});

describe('ProposalShadowService — model bojlera iz kataloga', () => {
  it('bez odabranog modela nema snižavanja — samo objašnjenje', async () => {
    const { service } = setup({
      home: { targetMorningTemp: 21, targetDayTemp: 22, boilerCatalogId: null },
      previous: { localDate: YESTERDAY, proposedFlowTemp: 45 },
      outcome: comfortableOutcome,
      changed: { localDate: '2026-10-30' },
    });

    const result = await service.evaluate(10, DAY, NOW);
    expect(result.decision?.flowC).toBe(45);
    expect(result.decision?.action).toBe('HOLD');
    expect(result.decision?.reasons).toEqual(['MODEL_UNVERIFIED']);
  });

  it('nepotvrđen model iz kataloga takođe blokira snižavanje', async () => {
    const { service } = setup({
      home: {
        targetMorningTemp: 21,
        targetDayTemp: 22,
        boilerCatalogId: 'vaillant-ecotec-pro',
      },
      previous: { localDate: YESTERDAY, proposedFlowTemp: 45 },
      outcome: comfortableOutcome,
      changed: { localDate: '2026-10-30' },
    });

    const result = await service.evaluate(10, DAY, NOW);
    expect(result.decision?.flowC).toBe(45);
    expect(result.decision?.reasons).toEqual(['MODEL_UNVERIFIED']);
  });

  it('potvrđen model sa odvojenim krugovima dozvoljava snižavanje', async () => {
    const { service } = setup({
      previous: { localDate: YESTERDAY, proposedFlowTemp: 45 },
      outcome: comfortableOutcome,
      changed: { localDate: '2026-10-30' },
    });

    const result = await service.evaluate(10, DAY, NOW);
    expect(result.decision?.reasons).toEqual(['COMFORT_HOLD']);
    expect(result.decision?.action).toBe('LOWER');
  });
});

describe('ProposalShadowService — maksimum sistema', () => {
  it('najviša polazna iz profila ograničava odluku i ravnotežnu vrijednost', async () => {
    const { service } = setup({
      home: {
        targetMorningTemp: 21,
        targetDayTemp: 22,
        maxHeatingFlowC: 40,
        boilerCatalogId: 'vaillant-ecotec-plus-vuw',
      },
      previous: { localDate: YESTERDAY, proposedFlowTemp: 45 },
      outcome: comfortableOutcome,
      changed: { localDate: '2026-10-30' },
    });

    // Baza bi bila 44,04, ali sistem dozvoljava najviše 40 (npr. podno grijanje).
    const result = await service.evaluate(10, DAY, NOW);
    expect(result.decision?.flowC).toBe(40);
  });

  it('bez maksimuma u profilu ostaje granica kotla', async () => {
    const { service } = setup({
      home: {
        targetMorningTemp: 21,
        targetDayTemp: 22,
        maxHeatingFlowC: null,
        boilerCatalogId: 'vaillant-ecotec-plus-vuw',
      },
      previous: { localDate: YESTERDAY, proposedFlowTemp: 45 },
      outcome: comfortableOutcome,
      changed: { localDate: '2026-10-30' },
    });

    const result = await service.evaluate(10, DAY, NOW);
    expect(result.decision?.flowC).toBeLessThanOrEqual(55);
  });
});

describe('ProposalShadowService — granica iz kratkih ciklusa', () => {
  it('kratki ciklusi se pamte u HomeModel i podižu odluku', async () => {
    const { service, prisma } = setup({
      previous: { localDate: YESTERDAY, proposedFlowTemp: 49 },
      outcome: { ...comfortableOutcome, medianCycleMin: 4 },
      changed: { localDate: '2026-10-30' },
    });

    const result = await service.evaluate(10, DAY, NOW);

    expect(prisma.homeModel.update).toHaveBeenCalledWith({
      where: { homeProfileId: 10 },
      data: { shortCycleFloorC: 50, shortCycleFloorAt: NOW },
    });
    expect(result.decision?.flowC).toBe(50);
    expect(result.decision?.reasons).toEqual(['SHORT_CYCLES']);
  });

  it('zapamćena granica se ne obara ni kad novi dan nema kratkih ciklusa', async () => {
    const { service } = setup({
      model: { state: 'TRACKING', slopeCiHigh: 0.96, shortCycleFloorC: 50 },
      previous: { localDate: YESTERDAY, proposedFlowTemp: 50 },
      outcome: comfortableOutcome,
      changed: { localDate: '2026-10-30' },
    });

    const result = await service.evaluate(10, DAY, NOW);
    // Spuštanje bi dalo 49, ali granica iz kratkih ciklusa je 50.
    expect(result.decision?.flowC).toBe(50);
  });

  it('granica starija od 30 dana više ne drži polaznu — i briše se iz modela', async () => {
    const longAgo = new Date(NOW.getTime() - 31 * 24 * 60 * 60 * 1000);
    const { service, prisma } = setup({
      model: {
        state: 'TRACKING',
        slopeCiHigh: 0.96,
        shortCycleFloorC: 50,
        shortCycleFloorAt: longAgo,
      },
      previous: { localDate: YESTERDAY, proposedFlowTemp: 50 },
      outcome: comfortableOutcome,
      changed: { localDate: '2026-10-30' },
    });

    const result = await service.evaluate(10, DAY, NOW);

    // Bez istekle granice spuštanje je dozvoljeno: 50 − 1 = 49.
    expect(result.decision?.flowC).toBe(49);
    expect(prisma.homeModel.update).toHaveBeenCalledWith({
      where: { homeProfileId: 10 },
      data: { shortCycleFloorC: null, shortCycleFloorAt: null },
    });
  });

  it('svježa granica se još primjenjuje, sa datumom u modelu', async () => {
    const recent = new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000);
    const { service, prisma } = setup({
      model: {
        state: 'TRACKING',
        slopeCiHigh: 0.96,
        shortCycleFloorC: 50,
        shortCycleFloorAt: recent,
      },
      previous: { localDate: YESTERDAY, proposedFlowTemp: 50 },
      outcome: comfortableOutcome,
      changed: { localDate: '2026-10-30' },
    });

    const result = await service.evaluate(10, DAY, NOW);

    expect(result.decision?.flowC).toBe(50);
    expect(prisma.homeModel.update).not.toHaveBeenCalled();
  });

  it('kad istekne granica, novi kratki ciklusi je odmah vraćaju', async () => {
    const longAgo = new Date(NOW.getTime() - 40 * 24 * 60 * 60 * 1000);
    const { service, prisma } = setup({
      model: {
        state: 'TRACKING',
        slopeCiHigh: 0.96,
        shortCycleFloorC: 50,
        shortCycleFloorAt: longAgo,
      },
      previous: { localDate: YESTERDAY, proposedFlowTemp: 49 },
      outcome: { ...comfortableOutcome, medianCycleMin: 4 },
      changed: { localDate: '2026-10-30' },
    });

    const result = await service.evaluate(10, DAY, NOW);

    expect(prisma.homeModel.update).toHaveBeenCalledTimes(1);
    expect(prisma.homeModel.update).toHaveBeenCalledWith({
      where: { homeProfileId: 10 },
      data: { shortCycleFloorC: 50, shortCycleFloorAt: NOW },
    });
    expect(result.decision?.flowC).toBe(50);
  });

  it('ishod od drugog dana se ne pripisuje prošlom predlogu', async () => {
    const { service, prisma } = setup({
      previous: { localDate: YESTERDAY, proposedFlowTemp: 49 },
      outcome: { ...comfortableOutcome, localDate: '2026-11-04', medianCycleMin: 3 },
      changed: { localDate: '2026-10-30' },
    });

    await service.evaluate(10, DAY, NOW);
    expect(prisma.homeModel.update).not.toHaveBeenCalled();
  });
});
