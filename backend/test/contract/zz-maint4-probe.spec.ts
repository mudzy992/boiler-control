/**
 * MAINT-4 / B-025 — PRIVREMENA DIJAGNOSTIKA (ne ostaje u repo-u).
 *
 * `api-contract.spec.ts` ima 16 uslovnih asertacija (`if (status === 200) {...}`),
 * pa test "prolazi" i kad endpoint vrati 404. Prije nego napišem obavezne
 * asertcije, moram znati šta endpointi STVARNO vraćaju pod CI-jevom bazom i
 * važećim JWT-om. Lokalno nema PostgreSQL-a, pa se mjerenje radi ovdje.
 *
 * Rezultat ide u ::notice:: da se može pročitati iz check-run annotations.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('MAINT-4 dijagnostika: stvarni statusi ugovornih ruta', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('mjeri statuse ispravljenih ruta s važećim JWT-om', async () => {
    const stamp = Date.now();
    const reg = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `maint4_${stamp}@example.com`,
        username: `maint4_${stamp}`,
        password: 'Test123!',
        name: 'MAINT-4 Probe',
      });

    const token: string | undefined = reg.body?.token;
    const auth = token ? { Authorization: `Bearer ${token}` } : {};

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: `maint4_${stamp}@example.com`, password: 'Test123!' });

    const routes: Array<[string, string, string]> = [
      ['POST', '/api/auth/register', 'duplikat'],
      ['POST', '/api/auth/login', 'login'],
      ['GET', '/api/boiler/history', 'auth'],
      ['PATCH', '/api/boiler/current-temp', 'auth'],
      ['GET', '/api/dashboard', 'auth'],
      ['GET', '/api/heating-events', 'auth'],
      ['GET', '/api/heating-events?active=true', 'auth'],
      ['GET', '/api/anomalies', 'auth'],
      ['GET', '/api/recommendations/today', 'auth'],
      ['GET', '/api/recommendations', 'auth'],
      ['GET', '/api/devices', 'auth'],
      ['GET', '/api/devices/999999', 'auth'],
      ['GET', '/metrics', 'none'],
      ['GET', '/metrics/json', 'none'],
      // Stare (pogrešne) rute iz postojećeg testa — za poređenje.
      ['GET', '/api/heating/events', 'auth'],
      ['GET', '/api/heating/anomalies', 'auth'],
      ['GET', '/api/recommendation/today', 'auth'],
      ['GET', '/api/thermostat/devices', 'auth'],
    ];

    const lines: string[] = [];
    for (const [method, path, mode] of routes) {
      let res;
      if (method === 'POST' && path === '/api/auth/register') {
        res = await request(app.getHttpServer())
          .post(path)
          .send({
            email: `maint4_${stamp}@example.com`,
            username: `maint4_${stamp}`,
            password: 'Test123!',
            name: 'MAINT-4 Probe',
          });
      } else if (method === 'POST' && path === '/api/auth/login') {
        res = login;
      } else if (method === 'PATCH') {
        res = await request(app.getHttpServer())
          .patch(path)
          .set(auth)
          .send({ currentFlowTemp: 55 });
      } else {
        res = await request(app.getHttpServer()).get(path).set(auth);
      }
      const bodyType = Array.isArray(res.body)
        ? `array(${res.body.length})`
        : res.body && typeof res.body === 'object'
          ? Object.keys(res.body).slice(0, 6).join('|')
          : typeof res.body;
      lines.push(`${method} ${path} [${mode}] -> ${res.status} {${bodyType}}`);
    }

    lines.unshift(
      `register -> ${reg.status}`,
      `login -> ${login.status} token=${!!token}`,
    );

    console.log(`::notice title=MAINT-4 route probe::${lines.join(' ;; ')}`);

    // Dijagnostika: namjerno bez tvrdih asertcija, jer bez PostgreSQL-a
    // lokalno register ne može proći. Fajl se briše nakon mjerenja u CI.
    expect(lines.length).toBeGreaterThan(0);
  });
});
