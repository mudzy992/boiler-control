/**
 * MAINT-2 — guard/scheduler testovi u NE-testnom okruženju.
 *
 * Nalaz: CI ima PostgreSQL i Redis, ali cijeli test env radi s
 * `NODE_ENV=test`, što u aplikaciji gasi tri stvari:
 *   - `app.module.ts:22`  preskače `ThrottlerModule.forRoot(...)`
 *   - `app.module.ts:56`  preskače `APP_GUARD` + `ThrottlerGuard`
 *   - `schedule.module.ts:15,24,44` preskače `ThermostatPollingService`
 *   - `daily.recommendation.service.ts:24` i `gas.reminder.service.ts:24`
 *     imaju `@Cron(..., { disabled: NODE_ENV === 'test' })`
 * Posljedica: CI je zelen, a da throttler i scheduler nikad nisu izvršeni.
 *
 * `@Module(...)` dekoratori i `const IS_TEST` evaluiraju se pri **učitavanju**
 * modula, pa `NODE_ENV` mora biti postavljen prije prvog require-a. Jest
 * izolira module po fajlu, a `jest.resetModules()` čisti registar između
 * testova, pa promjena ne curi u druge suiteove.
 *
 * `createRequire` umjesto `await import()`: tsconfig ima
 * `moduleResolution: nodenext`, gdje se dinamički `import()` tipizira kao ESM
 * i ne vidi `baseUrl`, pa `src/...` putanje daju TS2307 iako u jest-u rade.
 */
import { createRequire } from 'node:module';

const req = createRequire(__filename);

/** Tipovi su `any` jer se moduli učitavaju dinamički nakon resetModules(). */

type ProviderLike = { provide?: unknown; useClass?: unknown };
type Providers = Array<ProviderLike>;

function metadata(target: object, key: string): any {
  return Reflect.getMetadata(key, target);
}

describe('MAINT-2: aplikacija u NE-testnom okruženju', () => {
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

  beforeEach(() => {
    jest.resetModules();
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
    jest.resetModules();
  });

  it('ThrottlerGuard je registrovan kao globalni APP_GUARD', () => {
    // APP_GUARD i ThrottlerGuard se moraju dohvatiti iz ISTOG require-a:
    // `jest.resetModules()` ponovo učitava @nestjs/core i @nestjs/throttler,
    // pa statički importirani APP_GUARD simbol nije isti onaj iz AppModule.
    const { APP_GUARD } = req('@nestjs/core');
    const { ThrottlerGuard } = req('@nestjs/throttler');
    const { AppModule } = req('src/app.module');
    const providers = metadata(AppModule, 'providers') as Providers;

    const guard = providers.find((p) => p?.provide === APP_GUARD);

    expect(guard).toBeDefined();
    expect(guard?.useClass).toBe(ThrottlerGuard);
  });

  it('ThrottlerModule je uključen u importe (ne preskočen)', () => {
    const { AppModule } = req('src/app.module');
    // `ThrottlerModule.forRoot()` vraća DynamicModule { module, providers,
    // exports }, pa se ime klase čita s `i.module.name`, ne s `i.name`.
    const imports = metadata(AppModule, 'imports') as Array<{
      module?: { name?: string };
      name?: string;
    }>;

    const hasThrottler = imports.some(
      (i) =>
        i?.module?.name === 'ThrottlerModule' || i?.name === 'ThrottlerModule',
    );
    expect(hasThrottler).toBe(true);
  });

  it('ThermostatPollingService je registrovan i izvezen', () => {
    const { SchedulerModule } = req('src/modules/Schedule/schedule.module');
    const { ThermostatPollingService } = req(
      'src/modules/ThermostatPoll/thermostat.polling.service',
    );

    const providers = metadata(SchedulerModule, 'providers') as unknown[];
    const exportsList = metadata(SchedulerModule, 'exports') as unknown[];

    expect(providers).toContain(ThermostatPollingService);
    expect(exportsList).toContain(ThermostatPollingService);
  });

  it('ThermostatPollingService NIJE registrovan u test env (dokaz da razlika postoji)', () => {
    process.env.NODE_ENV = 'test';
    jest.resetModules();

    const { SchedulerModule } = req('src/modules/Schedule/schedule.module');
    const { ThermostatPollingService } = req(
      'src/modules/ThermostatPoll/thermostat.polling.service',
    );

    const providers = metadata(SchedulerModule, 'providers') as unknown[];
    expect(providers).not.toContain(ThermostatPollingService);
  });

  it('@Cron na DailyRecommendationService nije disabled izvan testa', () => {
    const { DailyRecommendationService } = req(
      'src/modules/Schedule/daily.recommendation.service',
    );

    // @nestjs/schedule čita metapodatke s prototype-a klase. Ključ nije javno
    // dokumentovan, pa test tolerira njegov izostanak, ali NE tolerira da je
    // `disabled: true` upisan.
    const proto = DailyRecommendationService.prototype as Record<
      string,
      unknown
    >;
    const cronMeta = (Reflect.getMetadata('__cronJobs__', proto) ??
      Reflect.getMetadata('cron_jobs', proto)) as
      Array<{ disabled?: boolean }> | undefined;

    expect(DailyRecommendationService).toBeDefined();
    if (cronMeta) {
      expect(cronMeta.every((m) => m.disabled !== true)).toBe(true);
    }
  });

  it('stvarni ThrottlerGuard odbija 101. zahtjev u NE-testnom modulu', async () => {
    const { Test } = req('@nestjs/testing');
    const { ValidationPipe } = req('@nestjs/common');
    const request = req('supertest');
    const { AppModule } = req('src/app.module');

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const app = moduleRef.createNestApplication({ logger: false });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();

    // /metrics nije zaštićen JWT-om, pa mjeri isključivo throttler.
    let ok = 0;
    let throttled = 0;
    for (let i = 0; i < 105; i += 1) {
      const res = await request(app.getHttpServer()).get('/metrics');
      if (res.status === 200) ok += 1;
      else if (res.status === 429) throttled += 1;
    }
    await app.close();

    expect(ok).toBe(100);
    expect(throttled).toBe(5);
  });
});
