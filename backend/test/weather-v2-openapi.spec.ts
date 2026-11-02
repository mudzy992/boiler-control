jest.mock('../src/prisma/prisma.service', () => ({
  PrismaService: class {},
}));

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { WeatherController } from '../src/modules/Weather/weather.controller';
import { WeatherService } from '../src/modules/Weather/weather.service';
import { WeatherV2Service } from '../src/modules/Weather/weather-v2.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtAuthGuard } from '../src/modules/Auth/jwt-auth.guard';

describe('weather v2 additive OpenAPI contract', () => {
  let app: INestApplication;
  let document: ReturnType<typeof SwaggerModule.createDocument>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [WeatherController],
      providers: [
        { provide: WeatherService, useValue: {} },
        { provide: WeatherV2Service, useValue: {} },
        { provide: PrismaService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
    document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('contract-test').setVersion('1').build(),
    );
  });

  afterAll(async () => {
    await app?.close();
  });

  it('adds v2 routes without removing legacy weather routes', () => {
    expect(document.paths?.['/api/weather']?.get).toBeDefined();
    expect(
      document.paths?.['/api/weather/current/{homeProfileId}']?.get,
    ).toBeDefined();
    expect(
      document.paths?.['/api/weather/v2/current/{homeProfileId}']?.get,
    ).toBeDefined();
    expect(
      document.paths?.['/api/weather/v2/locations/{homeProfileId}']?.get,
    ).toBeDefined();
    expect(
      document.paths?.['/api/weather/v2/locations/{homeProfileId}/confirm']
        ?.post,
    ).toBeDefined();
    expect(document.paths?.['/api/weather']?.get?.requestBody).toBeUndefined();
  });

  it('publishes current/hourly/daily timestamps and nullable value schemas', () => {
    const schemas = (document.components?.schemas ?? {}) as Record<
      string,
      { properties: Record<string, unknown> }
    >;
    const response = schemas.WeatherV2ResponseDto;
    const current = schemas.WeatherCurrentV2Dto;
    const hour = schemas.WeatherHourV2Dto;
    const day = schemas.WeatherDayV2Dto;

    expect(response.properties).toMatchObject({
      version: { enum: [2] },
      fetchedAt: { type: 'string', format: 'date-time' },
      ageSeconds: { type: 'number' },
      freshness: { enum: ['fresh', 'stale'] },
      currentHidden: { type: 'boolean' },
    });
    expect(current.properties.temperatureC).toMatchObject({
      type: 'number',
      nullable: true,
    });
    expect(current.properties.isDay).toMatchObject({
      type: 'boolean',
      nullable: true,
    });
    expect(hour.properties.at).toMatchObject({
      type: 'string',
      format: 'date-time',
    });
    expect(day.properties.date).toMatchObject({
      type: 'string',
      format: 'date',
    });
    expect(day.properties.sunrise).toMatchObject({
      type: 'string',
      format: 'date-time',
      nullable: true,
    });
  });

  it('keeps the committed Weather contract equal to the runtime Swagger fragment', () => {
    const committed = JSON.parse(
      readFileSync(join(__dirname, '../../contracts/openapi.json'), 'utf8'),
    ) as {
      paths: Record<string, unknown>;
      components: { schemas: Record<string, unknown> };
    };

    for (const [path, operations] of Object.entries(document.paths ?? {})) {
      expect(committed.paths[path]).toEqual(operations);
    }
    for (const [name, schema] of Object.entries(
      document.components?.schemas ?? {},
    )) {
      expect(committed.components.schemas[name]).toEqual(schema);
    }
  });
});
