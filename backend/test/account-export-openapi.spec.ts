jest.mock('../src/prisma/prisma.service', () => ({
  PrismaService: class {},
}));
jest.mock('../src/modules/Auth/dto/auth-response.dto', () => ({
  AuthUserWithTimestampsDto: class {},
  LoginResponseDto: class {},
  MessageResponseDto: class {},
  RegisterResponseDto: class {},
}));

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AuthController } from '../src/modules/Auth/auth.controller';
import { AuthService } from '../src/modules/Auth/auth.service';
import { RefreshTokenService } from '../src/modules/Auth/refresh-token.service';
import { AccountExportService } from '../src/modules/Auth/account-export.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtAuthGuard } from '../src/modules/Auth/jwt-auth.guard';
import {
  createOpenApiDocument,
  serializeOpenApiDocument,
} from '../src/openapi.config';

const exportPayload = {
  format: 'boiler-control.account-export',
  version: 1,
  generatedAt: '2026-11-02T12:00:00.000Z',
  account: { id: 42 },
  collections: {},
};
const accountExportMock = {
  exportAccount: jest.fn().mockResolvedValue(exportPayload),
};

describe('PRIV-1A account export HTTP and OpenAPI contract', () => {
  let app: INestApplication;
  let document: ReturnType<typeof createOpenApiDocument>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: {} },
        { provide: RefreshTokenService, useValue: {} },
        { provide: AccountExportService, useValue: accountExportMock },
        { provide: PrismaService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => {
            getRequest: () => { user?: { userId: number } };
          };
        }) => {
          const request = context.switchToHttp().getRequest();
          request.user = { userId: 42 };
          return true;
        },
      })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
    document = createOpenApiDocument(app);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('uses only the JWT user and returns no-store attachment JSON', async () => {
    const response = await request(app.getHttpServer()).get('/api/auth/export');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['content-disposition']).toBe(
      'attachment; filename="account-export-v1.json"',
    );
    expect(response.body).toEqual(exportPayload);
    expect(accountExportMock.exportAccount).toHaveBeenCalledWith(42);
  });

  it('publishes the bounded versioned response and every collection name', () => {
    const operation = document.paths?.['/api/auth/export']?.get;
    expect(operation?.responses?.['200']).toBeDefined();
    expect(operation?.responses?.['413']).toBeDefined();

    const schemas = (document.components?.schemas ?? {}) as Record<
      string,
      { properties: Record<string, unknown> }
    >;
    expect(Object.keys(schemas.AccountExportResponseDto.properties)).toEqual([
      'format',
      'version',
      'generatedAt',
      'account',
      'collections',
    ]);
    expect(
      Object.keys(schemas.AccountExportCollectionsDto.properties).sort(),
    ).toEqual(
      [
        'homeProfiles',
        'heatingIntervalLearnings',
        'thermostatDevices',
        'thermostatPrograms',
        'heatingEvents',
        'recommendations',
        'boilerHistories',
        'gasReadings',
        'gasPriceHistory',
        'notifications',
        'notificationPreferences',
        'devices',
        'sessions',
      ].sort(),
    );
  });

  it('matches the committed additive Auth export fragment', () => {
    const committedText = readFileSync(
      join(__dirname, '../../contracts/openapi.json'),
      'utf8',
    );
    const committed = JSON.parse(committedText) as {
      paths: Record<string, unknown>;
      components: { schemas: Record<string, unknown> };
    };
    expect(committed.paths['/api/auth/export']).toEqual(
      document.paths?.['/api/auth/export'],
    );
    for (const name of [
      'AccountExportResponseDto',
      'AccountExportCollectionsDto',
    ]) {
      expect(committed.components.schemas[name]).toEqual(
        document.components?.schemas?.[name],
      );
    }
    expect(committedText).toBe(
      serializeOpenApiDocument(JSON.parse(committedText)),
    );
  });
});
