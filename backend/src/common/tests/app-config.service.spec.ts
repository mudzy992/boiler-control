import { Test, TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppConfigService } from '../app-config.service';
import { AppConfigController } from '../app-config.controller';

/**
 * MO2-2: version gate.
 *
 * Fokus je na fail-safe ponašanju — endpoint koji baca ili vrati glupost
 * zaključao bi korisnike van aplikacije, pa neispravan env mora biti
 * bezopasan, a ne fatalan.
 */
describe('AppConfigService (MO2-2 version gate)', () => {
  let service: AppConfigService;
  const ENV_KEYS = [
    'APP_VERSION_GATE_ENABLED',
    'MOBILE_MIN_SUPPORTED_VERSION',
    'MOBILE_LATEST_VERSION',
  ];
  let saved: Record<string, string | undefined>;

  beforeEach(async () => {
    saved = {};
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [AppConfigService],
    }).compile();

    service = module.get<AppConfigService>(AppConfigService);
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  describe('zadano stanje (bez env varijabli)', () => {
    it('gate je uključen i ne blokira postojeće instalacije (min = 1.0.0)', () => {
      const config = service.getAppConfig();

      expect(config.versionGateEnabled).toBe(true);
      // 1.0.0 je verzija koja je stvarno kod korisnika (app.json), pa gate
      // ovdje ne smije nikoga zaključati.
      expect(config.minSupportedVersion).toBe('1.0.0');
      expect(config.latestVersion).toBe('2.0.0');
    });
  });

  describe('env override', () => {
    it('prihvata ispravne semver vrijednosti', () => {
      process.env.MOBILE_MIN_SUPPORTED_VERSION = '2.1.0';
      process.env.MOBILE_LATEST_VERSION = '2.3.4';

      const config = service.getAppConfig();

      expect(config.minSupportedVersion).toBe('2.1.0');
      expect(config.latestVersion).toBe('2.3.4');
    });

    it('trim-uje vrijednosti iz env-a', () => {
      process.env.MOBILE_MIN_SUPPORTED_VERSION = '  2.1.0  ';

      expect(service.getAppConfig().minSupportedVersion).toBe('2.1.0');
    });
  });

  describe('kill switch', () => {
    it.each([
      ['false', false],
      ['FALSE', false],
      ['0', false],
      ['true', true],
      ['1', true],
    ])('APP_VERSION_GATE_ENABLED="%s" -> %s', (raw, expected) => {
      process.env.APP_VERSION_GATE_ENABLED = raw;

      expect(service.getAppConfig().versionGateEnabled).toBe(expected);
    });

    it('kad je gate isključen, min je 0.0.0 ČAK I ako env traži više', () => {
      process.env.APP_VERSION_GATE_ENABLED = 'false';
      process.env.MOBILE_MIN_SUPPORTED_VERSION = '9.9.9';

      const config = service.getAppConfig();

      expect(config.versionGateEnabled).toBe(false);
      expect(config.minSupportedVersion).toBe('0.0.0');
      // latest ostaje informativan i kad je gate ugašen
      expect(config.latestVersion).toBe('2.0.0');
    });

    it('neispravna vrijednost flag-a ne gasi gate (fail-safe na true)', () => {
      process.env.APP_VERSION_GATE_ENABLED = 'mozda';

      expect(service.getAppConfig().versionGateEnabled).toBe(true);
    });
  });

  describe('fail-safe na neispravan env', () => {
    it.each([['abc'], ['1.2'], ['1.2.3.4'], ['v1.2.3'], ['1.2.3-beta'], ['']])(
      'MOBILE_MIN_SUPPORTED_VERSION="%s" -> vraća zadano 1.0.0',
      (raw) => {
        process.env.MOBILE_MIN_SUPPORTED_VERSION = raw;

        const config = service.getAppConfig();

        expect(config.minSupportedVersion).toBe('1.0.0');
        expect(config.versionGateEnabled).toBe(true);
      },
    );

    it('neispravan latest ne utječe na min', () => {
      process.env.MOBILE_LATEST_VERSION = 'nije-verzija';
      process.env.MOBILE_MIN_SUPPORTED_VERSION = '2.0.0';

      const config = service.getAppConfig();

      expect(config.minSupportedVersion).toBe('2.0.0');
      expect(config.latestVersion).toBe('2.0.0');
    });
  });

  describe('SEC-4: authRefreshEnabled', () => {
    it('zadano je false dok je AUTH_COOKIE_REFRESH_ENABLED off', () => {
      delete process.env.AUTH_COOKIE_REFRESH_ENABLED;
      const config = new AppConfigService().getAppConfig();
      expect(config.authRefreshEnabled).toBe(false);
    });

    it('postaje true kad je zastavica uključena', () => {
      process.env.AUTH_COOKIE_REFRESH_ENABLED = 'on';
      const config = new AppConfigService().getAppConfig();
      expect(config.authRefreshEnabled).toBe(true);
    });

    it('neispravna vrijednost zastavice ostaje false (fail-safe)', () => {
      process.env.AUTH_COOKIE_REFRESH_ENABLED = 'mozda';
      const config = new AppConfigService().getAppConfig();
      expect(config.authRefreshEnabled).toBe(false);
    });

    it('polje je prisutno i kad je version gate isključen (klijenti ga uvijek čitaju)', () => {
      process.env.APP_VERSION_GATE_ENABLED = 'false';
      delete process.env.AUTH_COOKIE_REFRESH_ENABLED;
      const config = new AppConfigService().getAppConfig();
      expect(config.versionGateEnabled).toBe(false);
      expect(config.authRefreshEnabled).toBe(false);
    });
  });

  it('servis nikad ne baca', () => {
    process.env.MOBILE_MIN_SUPPORTED_VERSION = '💥';
    process.env.APP_VERSION_GATE_ENABLED = '💥';

    expect(() => service.getAppConfig()).not.toThrow();
  });
});

describe('AppConfigController (MO2-2)', () => {
  it('vraća tačno ono što servis vrati, bez transformacije', async () => {
    const stub = {
      minSupportedVersion: '1.2.3',
      latestVersion: '2.0.0',
      versionGateEnabled: true,
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppConfigController],
      providers: [
        { provide: AppConfigService, useValue: { getAppConfig: () => stub } },
      ],
    }).compile();

    const controller = module.get<AppConfigController>(AppConfigController);

    expect(controller.getConfig()).toEqual(stub);
  });
});

describe('GET /api/app/config (MO2-2 ugovor rute)', () => {
  let app: INestApplication;
  const ENV_KEYS = [
    'APP_VERSION_GATE_ENABLED',
    'MOBILE_MIN_SUPPORTED_VERSION',
    'MOBILE_LATEST_VERSION',
  ];

  beforeAll(async () => {
    for (const key of ENV_KEYS) delete process.env[key];

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AppConfigController],
      providers: [AppConfigService],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('ruta je registrovana i javna — 200 bez Authorization headera', async () => {
    const res = await request(app.getHttpServer()).get('/api/app/config');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      minSupportedVersion: '1.0.0',
      latestVersion: '2.0.0',
      versionGateEnabled: true,
      // SEC-4: novo polje; zadano false jer je zastavica off
      authRefreshEnabled: false,
    });
  });

  it('prefiks je dio ugovora: /app/config (bez "api") vraca 404', async () => {
    const res = await request(app.getHttpServer()).get('/app/config');

    expect(res.status).toBe(404);
  });
});
