import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  DEFAULT_STUB_ENDPOINT_MODE,
  UnimplementedEndpointException,
  getStubEndpointMode,
  throwIfStubRejected,
} from '../stub-endpoint';
import { JwtAuthGuard } from '../../modules/Auth/jwt-auth.guard';
import { HeatingController } from '../../modules/Heating/heating.controller';
import { HeatingService } from '../../modules/Heating/heating.service';
import { WeatherController } from '../../modules/Weather/weather.controller';
import { WeatherService } from '../../modules/Weather/weather.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RecommendationsController } from '../../modules/HeatingRecommendation/recommendations.controller';
import { HeatingRecommendationService } from '../../modules/HeatingRecommendation/heating.recommendation.service';

// `src/prisma/generated/prisma/client` se generise sa `prisma generate`, sto
// nije dostupno u CI/sandboxu (binaries.prisma.sh nije dostupan). Mock
// sprecava da se pravi `prisma.service.ts` uopste ucita — isti obrazac kao u
// `test/unit/notifications-mark-as-read.spec.ts`.
jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

// `src/generated/prisma/` nastaje sa `npm run generate:prisma` (CI to radi,
// workflow linija 67), ali u ovom sandboxu `prisma generate` pada jer
// binaries.prisma.sh nije dostupan. Lanac
// recommendations.controller -> heating.recommendation.service ->
// flow-temperature.engine -> profile.strategy importuje Prisma enumove, pa bez
// ovog mocka suite ne moze da se ucita.
//
// Namjerno RELATIVNA putanja: `moduleNameMapper` (`^src/(.*)$`) preslikava
// `src/...` specifiere i rezolucija padne prije nego `{ virtual: true }` stupi
// na snagu, dok se relativni speciferi mockuju normalno.
//
// `ProfileStrategy` se u ovom testu nikad ne instancira — stub handler baci 501
// prije nego sto dotakne recommendation service.
jest.mock('../../modules/Heating/strategies/profile.strategy', () => ({
  ProfileStrategy: class ProfileStrategy {},
}));

/**
 * API-1 contract test (nalazi B-001, B-002, B-003).
 *
 * Ugovor koji se ovdje zakucava: stub endpoint MORA vratiti
 * `501 Not Implemented` s tijelom koje eksplicitno kaže da je razlog
 * neimplementiranost — jer su stari odgovori `{}` i `[]` bili nerazlučivi od
 * „nema podataka".
 */
const ENV_KEY = 'STUB_ENDPOINTS_MODE';

describe('stub-endpoint (API-1)', () => {
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env[ENV_KEY];
    delete process.env[ENV_KEY];
  });

  afterEach(() => {
    if (saved === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = saved;
  });

  describe('getStubEndpointMode', () => {
    it('zadano je reject', () => {
      expect(DEFAULT_STUB_ENDPOINT_MODE).toBe('reject');
      expect(getStubEndpointMode()).toBe('reject');
    });

    it.each([
      ['reject', 'reject'],
      ['legacy', 'legacy'],
      ['LEGACY', 'legacy'],
      ['  legacy  ', 'legacy'],
    ])('"%s" -> %s', (raw, expected) => {
      process.env[ENV_KEY] = raw;
      expect(getStubEndpointMode()).toBe(expected);
    });

    it('neispravna vrijednost pada na zadano (fail-safe, ne gasi zastititu)', () => {
      process.env[ENV_KEY] = 'mozda';
      expect(getStubEndpointMode()).toBe('reject');
    });
  });

  describe('throwIfStubRejected', () => {
    it('u reject režimu baca 501 s ugovorenim tijelom', () => {
      let caught: unknown;
      try {
        throwIfStubRejected('GET /api/proba');
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(UnimplementedEndpointException);
      const exc = caught as UnimplementedEndpointException;
      expect(exc.getStatus()).toBe(HttpStatus.NOT_IMPLEMENTED);
      expect(exc.getResponse()).toEqual({
        statusCode: 501,
        error: 'Not Implemented',
        endpoint: 'GET /api/proba',
        reason: 'stub-not-implemented',
        message:
          'Endpoint GET /api/proba je stub i nije implementiran. Prazan odgovor ne znaci "nema podataka".',
      });
    });

    it('alternative se pojavljuje samo kad je zadana', () => {
      const withoutAlt = new UnimplementedEndpointException('GET /x');
      expect(withoutAlt.getResponse()).not.toHaveProperty('alternative');

      const withAlt = new UnimplementedEndpointException('GET /x', {
        alternative: 'GET /y',
      });
      expect(withAlt.getResponse()).toMatchObject({ alternative: 'GET /y' });
    });

    it('u legacy režimu NE baca (rollback put radi)', () => {
      process.env[ENV_KEY] = 'legacy';
      expect(throwIfStubRejected('GET /api/proba')).toBe(false);
    });
  });
});

describe('HTTP ugovor stub endpointa (API-1)', () => {
  let app: INestApplication;
  let saved: string | undefined;

  beforeAll(async () => {
    saved = process.env[ENV_KEY];

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [
        HeatingController,
        WeatherController,
        RecommendationsController,
      ],
      providers: [
        {
          provide: HeatingService,
          useValue: { getHeatingEvents: () => Promise.resolve([]) },
        },
        { provide: WeatherService, useValue: {} },
        { provide: PrismaService, useValue: {} },
        {
          provide: HeatingRecommendationService,
          useValue: { getRecommendations: () => Promise.resolve([]) },
        },
      ],
    })
      // Guard ovisi o Prismi; za contract test auth nije predmet provjere.
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    if (saved === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = saved;
  });

  afterEach(() => {
    delete process.env[ENV_KEY];
  });

  const stubs = [
    {
      label: 'POST /api/heating-events (B-001)',
      method: 'post' as const,
      path: '/api/heating-events',
      endpoint: 'POST /api/heating-events',
      body: {
        deviceId: 1,
        roomCurrentTemp: 21,
        roomTargetTemp: 22,
        roomFlowTemp: 45,
      },
    },
    {
      label: 'GET /api/weather (B-002)',
      method: 'get' as const,
      path: '/api/weather',
      endpoint: 'GET /api/weather',
    },
    {
      label: 'GET /api/recommendations/today (B-003)',
      method: 'get' as const,
      path: '/api/recommendations/today',
      endpoint: 'GET /api/recommendations/today',
    },
  ];

  it.each(stubs)(
    '$label -> 501 s reason=stub-not-implemented',
    async (stub) => {
      const res =
        stub.method === 'post'
          ? await request(app.getHttpServer()).post(stub.path).send(stub.body)
          : await request(app.getHttpServer()).get(stub.path);

      expect(res.status).toBe(HttpStatus.NOT_IMPLEMENTED);
      expect(res.body.reason).toBe('stub-not-implemented');
      expect(res.body.endpoint).toBe(stub.endpoint);
      expect(res.body.error).toBe('Not Implemented');
    },
  );

  it('B-001 ne vraca vise izmisljeni ID (stari stub je lagao)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/heating-events')
      .send({
        deviceId: 1,
        roomCurrentTemp: 21,
        roomTargetTemp: 22,
        roomFlowTemp: 45,
      });

    expect(res.body.id).toBeUndefined();
    expect(res.body.deviceId).toBeUndefined();
  });

  it('weather i recommendations nude stvarnu alternativnu rutu', async () => {
    const weather = await request(app.getHttpServer()).get('/api/weather');
    expect(weather.body.alternative).toBe(
      'GET /api/weather/current/{homeProfileId}',
    );

    const recs = await request(app.getHttpServer()).get(
      '/api/recommendations/today',
    );
    expect(recs.body.alternative).toBe('GET /api/recommendations');
  });

  describe('legacy rollback (STUB_ENDPOINTS_MODE=legacy)', () => {
    it('GET /api/weather vraca stari {} ', async () => {
      process.env[ENV_KEY] = 'legacy';
      const res = await request(app.getHttpServer()).get('/api/weather');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({});
    });

    it('GET /api/recommendations/today vraca stari []', async () => {
      process.env[ENV_KEY] = 'legacy';
      const res = await request(app.getHttpServer()).get(
        '/api/recommendations/today',
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });
});
