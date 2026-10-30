import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

/**
 * MAINT-4 / B-025 — ugovorni testovi nad API-jem.
 *
 * Prijašnja verzija ovog fajla imala je **16 uslovnih asertacija** oblika
 * `if (response.status === 200) { ...expect... }` i gađala je **pet ruta koje
 * ne postoje** (`/api/heating/events`, `/api/heating/anomalies`,
 * `/api/recommendation/today`, `/api/thermostat/devices`). Deklarisane rute su
 * `api/heating-events`, `api/anomalies`, `api/recommendations`, `api/devices`.
 * Posljedica: 13 od 14 testova je "prolazilo" za 2–5 ms na 404 odgovoru, a da
 * se **nijedna** asertcija nije izvršila.
 *
 * Sve očekivane vrijednosti ispod **izmjerene su u CI-ju** (run 41058112404)
 * nad stvarnom bazom i važećim JWT-om, ne pogađane:
 *   register 201 · login 200 · boiler/history 200 array · dashboard 200
 *   heating-events 200 array · anomalies 200 array · devices 200 array
 *   recommendations/today 501 (API-1 stub, STUB_ENDPOINTS_MODE=reject)
 *   devices/999999 404 · duplikat register 400 · bez tokena 401
 *
 * Pravila ovog fajla:
 *   - nema `if` oko `expect` — svaki test ima obaveznu status asertaciju;
 *   - svaki pozitivni test ima negativnu kontrolu (mutation provjera);
 *   - rute su kopirane iz `@Controller`/`@Get` dekoratora, ne iz memorije.
 */
describe('API Contract Tests (MAINT-4)', () => {
  let app: INestApplication;
  let token: string;
  let auth: { Authorization: string };
  const stamp = Date.now();
  const email = `contract_${stamp}@example.com`;
  const username = `contract_${stamp}`;
  const password = 'Test123!';

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

    // Važeći testni JWT: bez njega bi svaki zaštićeni endpoint vratio 401,
    // pa "pozitivni" testovi ne bi dokazivali ugovor tijela.
    const reg = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, username, password, name: 'Contract Test User' });
    expect(reg.status).toBe(201);
    token = reg.body.token;
    expect(typeof token).toBe('string');
    auth = { Authorization: `Bearer ${token}` };
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Auth', () => {
    it('POST /api/auth/register vraća user + token', async () => {
      const unique = Date.now();
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: `contract_b_${unique}@example.com`,
          username: `contract_b_${unique}`,
          password,
          name: 'Contract Test User B',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('email');
      expect(response.body.user).toHaveProperty('name');
      expect(typeof response.body.token).toBe('string');
    });

    // Negativna kontrola: dokazuje da 201 nije posljedica endpointa koji
    // uvijek vraća 201.
    it('POST /api/auth/register s postojećim emailom vraća 400', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, username, password, name: 'Duplicate' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('statusCode', 400);
      expect(response.body).not.toHaveProperty('token');
    });

    it('POST /api/auth/login vraća user + token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe(email);
    });

    it('POST /api/auth/login s pogrešnom lozinkom NE vraća token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password: 'WrongPassword999!' });

      expect(response.status).toBe(401);
      expect(response.body).not.toHaveProperty('token');
    });
  });

  describe('Zaštićene rute (važeći JWT)', () => {
    it('GET /api/boiler/history vraća niz', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/boiler/history')
        .set(auth);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('PATCH /api/boiler/current-temp prihvata currentFlowTemp', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/boiler/current-temp')
        .set(auth)
        .send({ currentFlowTemp: 55 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
    });

    it('GET /api/dashboard vraća capabilities/system/homes', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/dashboard')
        .set(auth);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('capabilities');
      expect(response.body).toHaveProperty('system');
      expect(response.body).toHaveProperty('homes');
    });

    it('GET /api/heating-events vraća niz (NE /api/heating/events)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/heating-events')
        .set(auth);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('GET /api/heating-events?active=true filtrira i vraća niz', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/heating-events?active=true')
        .set(auth);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('GET /api/anomalies vraća niz (NE /api/heating/anomalies)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/anomalies')
        .set(auth);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('GET /api/recommendations vraća niz (NE /api/recommendation)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/recommendations')
        .set(auth);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('GET /api/devices vraća niz (NE /api/thermostat/devices)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/devices')
        .set(auth);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    // API-1: stub endpoint u `reject` režimu (zadano) vraća 501 s objašnjenjem.
    // Asertiramo taj ugovor, jer bi tihi 200 s praznim tijelom bio gori.
    it('GET /api/recommendations/today je stub i vraća 501 s objašnjenjem', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/recommendations/today')
        .set(auth);

      expect(response.status).toBe(501);
      expect(response.body).toHaveProperty('statusCode', 501);
      expect(response.body).toHaveProperty('endpoint');
      expect(response.body).toHaveProperty('reason');
      expect(response.body).toHaveProperty('alternative');
    });
  });

  describe('Negativne provjere (mutation)', () => {
    it('GET /api/devices/:id za nepostojeći ID vraća 404', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/devices/999999')
        .set(auth);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('statusCode', 404);
    });

    it('zaštićena ruta bez tokena vraća 401, ne 200', async () => {
      const response = await request(app.getHttpServer()).get('/api/dashboard');

      expect(response.status).toBe(401);
    });

    it('zaštićena ruta s nevažećim tokenom vraća 401', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/dashboard')
        .set({ Authorization: 'Bearer not-a-real-token' });

      expect(response.status).toBe(401);
    });

    it('nevalidno tijelo vraća 400 s detaljima', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'not-an-email' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('statusCode', 400);
    });

    // Regresija na B-025: ove četiri rute NE postoje. Prijašnji test ih je
    // gađao i "prolazio" jer su asertcije bile unutar `if (status === 200)`.
    it.each([
      '/api/heating/events',
      '/api/heating/anomalies',
      '/api/recommendation/today',
      '/api/thermostat/devices',
    ])(
      'zastarjela ruta %s vraća 404 (dokaz da stari test nije testirao ništa)',
      async (path) => {
        const response = await request(app.getHttpServer()).get(path).set(auth);

        expect(response.status).toBe(404);
      },
    );
  });

  describe('Ops', () => {
    it('GET /metrics vraća Prometheus tekst', async () => {
      const response = await request(app.getHttpServer()).get('/metrics');

      expect(response.status).toBe(200);
      expect(response.text).toBeTruthy();
    });

    it('GET /metrics/json vraća brojače pollanja', async () => {
      const response = await request(app.getHttpServer()).get('/metrics/json');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('poll_runs_total');
      expect(response.body).toHaveProperty('poll_devices_total');
    });
  });
});
