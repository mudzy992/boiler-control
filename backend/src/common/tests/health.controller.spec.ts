/**
 * MAINT-2 — `/health` s opcionim Redis poljem.
 *
 * `HealthController` je dobio zavisnost na `RedisHealthService`, što mijenja
 * tijelo odgovora. Ovi testovi zaključavaju garanciju kompatibilnosti unazad:
 *
 *   bez `REDIS_URL`  -> tijelo IDENTIČNO kao prije ({ status, timestamp }),
 *                       NEMA `redis` ključa. Instalirane mobilne verzije i
 *                       postojeći potrošači ne vide nikakvu razliku.
 *   s `REDIS_URL`    -> dodaje se `redis` objekt.
 *
 * `status` ostaje `'ok'` i kad Redis nije dostupan: Redis je opciona
 * infrastruktura, aplikacija radi ispravno bez njega, pa njegovo gašenje ne
 * smije označiti aplikaciju nezdravom.
 *
 * Bootuje se SAMO HealthController + RedisHealthService, ne cijeli AppModule,
 * pa test ne treba bazu.
 */
import { createRequire } from 'node:module';

const req = createRequire(__filename);

/** Nest app nad HealthController-om, svjež po testu (servis pamti env stanje). */
async function createHealthApp() {
  const { Test } = req('@nestjs/testing');
  const { HealthController } = req('../health.controller');
  const { RedisHealthService } = req('../redis-health.service');

  const moduleRef = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [RedisHealthService],
  }).compile();

  const app = moduleRef.createNestApplication({ logger: false });
  await app.init();
  return app;
}

describe('MAINT-2: GET /health bez REDIS_URL (kompatibilnost unazad)', () => {
  const ORIGINAL = process.env.REDIS_URL;
  let app: { getHttpServer(): unknown; close(): Promise<void> };

  beforeAll(async () => {
    delete process.env.REDIS_URL;
    app = await createHealthApp();
  });

  afterAll(async () => {
    await app.close();
    if (ORIGINAL === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = ORIGINAL;
  });

  it('vraća tačno { status, timestamp } i NEMA redis ključa', async () => {
    const request = req('supertest');
    const response = await request(app.getHttpServer()).get('/health');

    expect(response.status).toBe(200);
    expect(Object.keys(response.body).sort()).toEqual(['status', 'timestamp']);
    expect(response.body).not.toHaveProperty('redis');
    expect(response.body.status).toBe('ok');
    expect(typeof response.body.timestamp).toBe('string');
  });
});

const describeWithRedis = process.env.REDIS_URL ? describe : describe.skip;

describeWithRedis('MAINT-2: GET /health s REDIS_URL', () => {
  let app: { getHttpServer(): unknown; close(): Promise<void> };

  beforeAll(async () => {
    app = await createHealthApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('dodaje redis.connected i zadržava status ok', async () => {
    const request = req('supertest');
    const response = await request(app.getHttpServer()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.redis).toBeDefined();
    expect(response.body.redis.connected).toBe(true);
    expect(response.body.redis.pong).toBe('PONG');
    // `enabled` se ne izlaže — suvišno je kad polje uopšte postoji.
    expect(response.body.redis).not.toHaveProperty('enabled');
  });
});
