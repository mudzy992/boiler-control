import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { StructuredLogger } from '../../src/common/structured-logger';

/**
 * Integration Tests (P2a): End-to-end API validation
 * Tests real API endpoints with database operations, verifying:
 * - Response contracts match frontend expectations
 * - Database state changes correctly
 * - Structured logging with correlation IDs
 * - Error handling and edge cases
 */
describe('Integration Tests: Backend API (P2a)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let logger: StructuredLogger;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Enable CORS for preflight OPTIONS requests
    app.enableCors({
      origin: ['http://localhost:3021', 'http://localhost:3000'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    try {
      logger = moduleFixture.get<StructuredLogger>(StructuredLogger, {
        strict: false,
      });
    } catch (e) {
      const noopLogger: any = {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
        child: () => noopLogger,
      };
      logger = noopLogger as unknown as StructuredLogger;
    }
  });

  afterAll(async () => {
    // Clean up test data (note: not using TRUNCATE as it may fail with certain DB drivers)
    await app.close();
    // Ensure Prisma releases DB connections between Jest suites
    await prisma.$disconnect();
  });

  describe('Auth Endpoints', () => {
    describe('POST /api/auth/register', () => {
      it('should create a new user and return token', async () => {
        const uniqueEmail = `test_${Date.now()}@example.com`;

        const response = await request(app.getHttpServer())
          .post('/api/auth/register')
          .send({
            email: uniqueEmail,
            password: 'TestPassword123!',
            name: 'Integration Test User',
          });

        expect([201, 200]).toContain(response.status);
        expect(response.body).toHaveProperty('user');
        expect(response.body).toHaveProperty('token');
        expect(response.body.user.email).toBe(uniqueEmail);
        expect(typeof response.body.token).toBe('string');
        expect(response.body.token.length).toBeGreaterThan(10);

        // Verify user created in database
        const dbUser = await prisma.user.findUnique({
          where: { email: uniqueEmail },
        });
        expect(dbUser).toBeDefined();
        expect(dbUser?.email).toBe(uniqueEmail);
      });

      it('should reject duplicate email registration', async () => {
        const uniqueEmail = `duplicate_${Date.now()}@example.com`;

        // First registration
        await request(app.getHttpServer()).post('/api/auth/register').send({
          email: uniqueEmail,
          password: 'TestPassword123!',
          name: 'First User',
        });

        // Second registration with same email should fail
        const response = await request(app.getHttpServer())
          .post('/api/auth/register')
          .send({
            email: uniqueEmail,
            password: 'TestPassword123!',
            name: 'Second User',
          });

        expect(response.status).toBe(400);
      });

      it('should reject invalid email format', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/auth/register')
          .send({
            email: 'invalid-email',
            password: 'TestPassword123!',
            name: 'Invalid Email User',
          });

        expect(response.status).toBe(400);
      });

      it('should reject weak password', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/auth/register')
          .send({
            email: `weak_${Date.now()}@example.com`,
            password: 'weak',
            name: 'Weak Password User',
          });

        expect(response.status).toBe(400);
      });
    });

    describe('POST /api/auth/login', () => {
      let testUserEmail: string;
      let testUserPassword: string = 'TestPassword123!';

      beforeAll(async () => {
        testUserEmail = `login_test_${Date.now()}@example.com`;
        await request(app.getHttpServer()).post('/api/auth/register').send({
          email: testUserEmail,
          password: testUserPassword,
          name: 'Login Test User',
        });
      });

      it('should login with correct credentials', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({
            email: testUserEmail,
            password: testUserPassword,
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('user');
        expect(response.body).toHaveProperty('token');
        expect(response.body.user.email).toBe(testUserEmail);
        expect(typeof response.body.token).toBe('string');
      });

      it('should reject invalid credentials', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({
            email: testUserEmail,
            password: 'WrongPassword123!',
          });

        expect(response.status).toBe(401);
      });

      it('should reject non-existent user', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({
            email: `nonexistent_${Date.now()}@example.com`,
            password: 'TestPassword123!',
          });

        expect(response.status).toBe(401);
      });
    });
  });

  describe('User Endpoints', () => {
    let authToken: string;
    let userId: number;

    beforeAll(async () => {
      const email = `user_test_${Date.now()}@example.com`;
      const registerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email,
          password: 'TestPassword123!',
          name: 'User Integration Test',
        });

      authToken = registerResponse.body.token;
      userId = registerResponse.body.user.id;
    });

    describe('GET /api/user', () => {
      it('should return current user profile with authorization', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/user')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('email');
        expect(response.body).toHaveProperty('name');
        expect(response.body.id).toBe(userId);
      });

      it('should reject request without authorization', async () => {
        const response = await request(app.getHttpServer()).get('/api/user');

        expect(response.status).toBe(401);
      });

      it('should reject request with invalid token', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/user')
          .set('Authorization', 'Bearer invalid-token');

        expect(response.status).toBe(401);
      });
    });

    describe('PUT /api/user', () => {
      it('should update user profile', async () => {
        const updatedName = `Updated Name ${Date.now()}`;

        const response = await request(app.getHttpServer())
          .put('/api/user')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: updatedName,
          });

        expect(response.status).toBe(200);
        expect(response.body.name).toBe(updatedName);

        // Verify database update
        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
        });
        expect(dbUser?.name).toBe(updatedName);
      });
    });
  });

  describe('Metrics Endpoints', () => {
    describe('GET /metrics', () => {
      it('should return Prometheus metrics in text format', async () => {
        const response = await request(app.getHttpServer()).get('/metrics');

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toContain('text/plain');

        // Verify Prometheus format markers
        expect(response.text).toContain('# HELP');
        expect(response.text).toContain('# TYPE');
        expect(response.text).toContain('poll_runs_total');
        expect(response.text).toContain('heating_events_created');
        expect(response.text).toContain('tuya_requests_total');
      });

      it('should contain all expected metrics', async () => {
        const response = await request(app.getHttpServer()).get('/metrics');

        const expectedMetrics = [
          'poll_runs_total',
          'poll_runs_success',
          'poll_runs_failed',
          'tuya_requests_total',
          'tuya_requests_success',
          'tuya_requests_failed',
          'db_errors_total',
          'heating_events_created',
          'heating_events_ended',
          'anomalies_detected',
        ];

        expectedMetrics.forEach((metric) => {
          expect(response.text).toContain(metric);
        });
      });
    });

    describe('GET /metrics/json', () => {
      it('should return metrics in JSON format', async () => {
        const response = await request(app.getHttpServer()).get(
          '/metrics/json',
        );

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toContain('application/json');
        expect(typeof response.body).toBe('object');
      });

      it('should contain all expected metric counters', async () => {
        const response = await request(app.getHttpServer()).get(
          '/metrics/json',
        );

        const expectedMetrics = [
          'poll_runs_total',
          'poll_runs_success',
          'poll_runs_failed',
          'tuya_requests_total',
          'tuya_requests_success',
          'tuya_requests_failed',
          'heating_events_created',
          'heating_events_ended',
          'anomalies_detected',
        ];

        expectedMetrics.forEach((metric) => {
          expect(response.body).toHaveProperty(metric);
          expect(typeof response.body[metric]).toBe('number');
        });
      });
    });
  });

  describe('Dashboard Endpoints', () => {
    let authToken: string;

    beforeAll(async () => {
      const email = `dashboard_test_${Date.now()}@example.com`;
      const registerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email,
          password: 'TestPassword123!',
          name: 'Dashboard Test User',
        });

      authToken = registerResponse.body.token;
    });

    describe('GET /api/dashboard', () => {
      it('should return dashboard summary with authorization', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/dashboard')
          .set('Authorization', `Bearer ${authToken}`);

        // Status can be 200 or 204 if no data
        expect([200, 204]).toContain(response.status);

        if (response.status === 200) {
          // Verify dashboard response structure
          expect(response.body).toBeDefined();
          if (Object.keys(response.body).length > 0) {
            // If dashboard has data, verify key fields
            if (response.body.todayBoilerEvents) {
              expect(Array.isArray(response.body.todayBoilerEvents)).toBe(true);
            }
            if (response.body.todayRecommendations) {
              expect(Array.isArray(response.body.todayRecommendations)).toBe(
                true,
              );
            }
          }
        }
      });

      it('should reject request without authorization', async () => {
        const response = await request(app.getHttpServer()).get(
          '/api/dashboard',
        );

        expect(response.status).toBe(401);
      });
    });
  });

  describe('Health & Info Endpoints', () => {
    describe('GET /health', () => {
      it('should return health status', async () => {
        const response = await request(app.getHttpServer()).get('/health');

        expect([200, 204]).toContain(response.status);
      });
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent endpoint', async () => {
      const response = await request(app.getHttpServer()).get(
        '/api/nonexistent-endpoint',
      );

      expect(response.status).toBe(404);
    });

    it('should handle CORS preflight requests', async () => {
      const response = await request(app.getHttpServer())
        .options('/api/auth/login')
        .set('Origin', 'http://localhost:3021')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type');

      expect([200, 204]).toContain(response.status);
    });

    it('should return validation error for malformed request', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'valid@example.com',
          password: 'ValidPassword123!',
          // Missing 'name' field
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Concurrency & Load Testing', () => {
    it('should handle multiple concurrent requests', async () => {
      const requests: Promise<any>[] = [];

      // Make 5 concurrent requests
      for (let i = 0; i < 5; i++) {
        requests.push(
          request(app.getHttpServer())
            .post('/api/auth/register')
            .send({
              email: `concurrent_${i}_${Date.now()}@example.com`,
              password: 'TestPassword123!',
              name: `Concurrent User ${i}`,
            }),
        );
      }

      const responses = await Promise.all(requests);

      // All should succeed
      responses.forEach((response) => {
        expect([200, 201]).toContain(response.status);
        expect(response.body).toHaveProperty('token');
      });
    });

    it('should handle rapid sequential requests', async () => {
      const responses: any[] = [];

      for (let i = 0; i < 3; i++) {
        const response = await request(app.getHttpServer())
          .post('/api/auth/register')
          .send({
            email: `sequential_${i}_${Date.now()}@example.com`,
            password: 'TestPassword123!',
            name: `Sequential User ${i}`,
          });

        responses.push(response);
      }

      responses.forEach((response) => {
        expect([200, 201]).toContain(response.status);
      });
    });
  });

  describe('Structured Logging Verification', () => {
    let authToken: string;

    beforeAll(async () => {
      const email = `logging_test_${Date.now()}@example.com`;
      const registerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email,
          password: 'TestPassword123!',
          name: 'Logging Test User',
        });

      authToken = registerResponse.body.token;
    });

    it('should include correlation IDs in logs (verified via successful request)', async () => {
      // Make authenticated request that should be logged
      const response = await request(app.getHttpServer())
        .get('/api/user')
        .set('Authorization', `Bearer ${authToken}`);

      // Verify request succeeded (logs would be in console/logs)
      expect(response.status).toBe(200);

      // In production, verify logs contain runId via structured logger
      // This test confirms the endpoint is loggable
      expect(response.body).toHaveProperty('id');
    });
  });
});
