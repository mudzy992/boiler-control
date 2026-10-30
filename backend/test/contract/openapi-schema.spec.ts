import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * FE2-8 — ugovorni testovi nad `contracts/openapi.json`.
 *
 * Postojeći `api-contract.spec.ts` (P1e) bootuje AppModule i provjerava
 * runtime tijela odgovora; `grep -c openapi` nad njim daje 0, dakle sâm
 * ugovor ne provjerava. Ovi testovi popunjavaju tu rupu i čuvaju šeme
 * koje su izvedene iz stvarnog koda servisa (commits 515ed22, 1c8e6a1).
 *
 * Test je namjerno STATIČAN — čita JSON i ne treba bazu, pa ostaje
 * determinističan i ne ovisi o `prisma migrate deploy`.
 *
 * Svako očekivanje ovdje odgovara verificiranom ponašanju:
 *   auth      -> src/modules/Auth/auth.service.ts
 *   gas       -> src/modules/Gas/gas.reading.service.ts
 *   dashboard -> src/modules/Dashboard/dashboard.service.ts
 */

type Schema = {
  type?: string;
  format?: string;
  nullable?: boolean;
  properties?: Record<string, unknown>;
  items?: unknown;
  required?: string[];
  enum?: unknown[];
  oneOf?: unknown[];
};

type Operation = {
  responses?: Record<
    string,
    { content?: Record<string, { schema?: unknown }> }
  >;
  requestBody?: { content?: Record<string, { schema?: unknown }> };
};

describe('OpenAPI contract schemas (FE2-8)', () => {
  const contractPath = join(__dirname, '../../../contracts/openapi.json');
  let doc: {
    paths: Record<string, Record<string, Operation>>;
    components: { schemas: Record<string, Schema> };
  };
  let raw: string;
  let schemas: Record<string, Schema>;

  beforeAll(() => {
    raw = readFileSync(contractPath, 'utf8');
    doc = JSON.parse(raw);
    schemas = doc.components.schemas;
  });

  /** Šema na koju ukazuje `$ref` odgovora, ili null ako odgovor nije tipiziran. */
  function responseRef(
    path: string,
    method: string,
    status: string,
  ): string | null {
    const op = doc.paths[path]?.[method];
    const schema = op?.responses?.[status]?.content?.['application/json']
      ?.schema as { $ref?: string } | undefined;
    if (!schema?.$ref) return null;
    return schema.$ref.replace('#/components/schemas/', '');
  }

  function propsOf(name: string): string[] {
    return Object.keys(schemas[name]?.properties ?? {});
  }

  describe('strukturna ispravnost ugovora', () => {
    it('nema visećih $ref (regresija na ApiExtraModels bug)', () => {
      // Prva verzija dashboard DTO-ova imala je 48 definicija a 50 referenci:
      // DashboardLiveRecommendationDto i DashboardStoredRecommendationDto su
      // se pojavljivale samo kao $ref stringovi unutar `oneOf`, pa ih
      // @nestjs/swagger nije registrovao. Bez @ApiExtraModels codegen bi ih
      // preveo u `never`.
      const defined = new Set(Object.keys(schemas));
      const referenced = new Set(
        Array.from(
          raw.matchAll(/#\/components\/schemas\/([A-Za-z0-9_]+)/g),
        ).map((m) => m[1]),
      );
      const dangling = [...referenced].filter((r) => !defined.has(r));
      expect(dangling).toEqual([]);
    });

    it('nijedna šema ODGOVORA nije prazna (posljedica nestalog Swagger plugina)', () => {
      // `nest-cli.json` nema Swagger plugina, pa DTO samo s class-validator
      // dekoratorima izlazi kao {"properties":{},"type":"object"}. API-2b je
      // to ispravio za ODGOVORE; ulazni DTO-ovi su i dalje prazni i to je
      // poznato stanje iz API-2, pa je ovdje eksplicitno zabilježeno umjesto
      // da se tiho prešuti.
      const empty = Object.entries(schemas)
        .filter(
          ([, s]) =>
            s.type === 'object' && Object.keys(s.properties ?? {}).length === 0,
        )
        .map(([n]) => n);

      const responsesBlob = JSON.stringify(
        Object.values(doc.paths).flatMap((ops) =>
          Object.values(ops)
            .filter(
              (op): op is Operation => typeof op === 'object' && op !== null,
            )
            .map((op) => op.responses ?? {}),
        ),
      );

      const emptyInResponses = empty.filter((n) =>
        responsesBlob.includes(`#/components/schemas/${n}`),
      );
      expect(emptyInResponses).toEqual([]);

      // Prazne su ISKLJUČIVO ulazne šeme. Ako se ovdje pojavi nova stavka,
      // ili je dodan response DTO bez @ApiProperty, ili je ulazni DTO dobio
      // šemu pa ga treba skinuti s popisa.
      //
      // `UpdateGasReferenceDto` je skinut s ovog popisa u FEAT-7: dobio je
      // `@ApiProperty` kad mu je ispravljan B-015, pa više nije prazan.
      expect(empty.sort()).toEqual([
        'ChangePasswordDto',
        'CreateHomeProfileDto',
        'LoginDto',
        'RegisterDeviceDTO',
        'RegisterDto',
        'UpdateHeatingAnomalyDto',
        'UpdateHomeProfileDto',
        'UploadInvoiceDto',
      ]);
    });
  });

  describe('auth — izvedeno iz auth.service.ts', () => {
    it('POST /api/auth/login [200] -> LoginResponseDto s user i token', () => {
      expect(responseRef('/api/auth/login', 'post', '200')).toBe(
        'LoginResponseDto',
      );
      expect(propsOf('LoginResponseDto').sort()).toEqual(['token', 'user']);
    });

    it('POST /api/auth/register je 201, ne 200 (Nest bez @HttpCode)', () => {
      // register nema @HttpCode, pa Nest vraća 201. @ApiOkResponse bi lagao.
      expect(responseRef('/api/auth/register', 'post', '201')).toBe(
        'RegisterResponseDto',
      );
      expect(responseRef('/api/auth/register', 'post', '200')).toBeNull();
      expect(propsOf('RegisterResponseDto').sort()).toEqual(['token', 'user']);
    });

    it('GET /api/auth/me [200] -> AuthUserWithTimestampsDto', () => {
      expect(responseRef('/api/auth/me', 'get', '200')).toBe(
        'AuthUserWithTimestampsDto',
      );
    });

    it('POST /api/auth/change-password [200] -> MessageResponseDto', () => {
      expect(responseRef('/api/auth/change-password', 'post', '200')).toBe(
        'MessageResponseDto',
      );
      expect(propsOf('MessageResponseDto')).toEqual(['message']);
    });

    it('login i register NAMJERNO imaju različit user shape', () => {
      // login() select-uje 11 polja (bez createdAt/updatedAt), register() 13.
      // FE-016 je upozoravao da UI ne smije pretpostaviti jedan oblik.
      const login = schemas['LoginResponseDto'].properties?.['user'] as {
        $ref?: string;
      };
      const register = schemas['RegisterResponseDto'].properties?.['user'] as {
        $ref?: string;
      };
      expect(login.$ref).toBe('#/components/schemas/AuthUserDto');
      expect(register.$ref).toBe(
        '#/components/schemas/AuthUserWithTimestampsDto',
      );

      const plain = propsOf('AuthUserDto');
      const withTs = propsOf('AuthUserWithTimestampsDto');
      expect(plain).toHaveLength(11);
      expect(withTs).toHaveLength(13);
      expect(plain).not.toContain('createdAt');
      expect(plain).not.toContain('updatedAt');
      expect(withTs).toContain('createdAt');
      expect(withTs).toContain('updatedAt');
    });

    it('plan je union iz schema.prisma enum UserPlan', () => {
      const plan = schemas['AuthUserDto'].properties?.['plan'] as Schema;
      expect(plan.enum).toEqual(['FREE', 'PRO', 'ENTERPRISE']);
    });
  });

  describe('gas — izvedeno iz gas.reading.service.ts', () => {
    const EXPECTED = [
      'consumption',
      'counterValue',
      'createdAt',
      'hasInvoicePdf',
      'hasMeterImage',
      'id',
      'invoiceGasPriceExVat',
      'invoiceUploadedAt',
      'isInvoiceReference',
      'readingDate',
      'referenceMonth',
      'userId',
    ];

    it('GasReadingResponseDto tačno prati mapGasReading() (12 polja)', () => {
      expect(propsOf('GasReadingResponseDto').sort()).toEqual(EXPECTED);
    });

    it('ne izlaže sirove putanje fajlova', () => {
      // mapGasReading() vraća izvedene booleane (!!path), ne meterImagePath.
      const props = propsOf('GasReadingResponseDto');
      expect(props).not.toContain('meterImagePath');
      expect(props).not.toContain('invoicePdfPath');
    });

    it('GET /api/gas/readings [200] je NIZ GasReadingResponseDto', () => {
      const schema = doc.paths['/api/gas/readings'].get.responses?.['200']
        ?.content?.['application/json']?.schema as {
        type?: string;
        items?: { $ref?: string };
      };
      expect(schema.type).toBe('array');
      expect(schema.items?.$ref).toBe(
        '#/components/schemas/GasReadingResponseDto',
      );
    });

    it('GET /api/gas/latest [200] je nullable (getLatest vraća `| null`)', () => {
      const schema = doc.paths['/api/gas/latest'].get.responses?.['200']
        ?.content?.['application/json']?.schema as {
        oneOf?: Array<{ $ref?: string; type?: string }>;
      };
      const refs = (schema.oneOf ?? []).map((o) => o.$ref ?? o.type);
      expect(refs).toContain('#/components/schemas/GasReadingResponseDto');
      expect(refs).toContain('null');
    });

    it('GET /api/gas/analysis [200] -> GasAnalysisResponseDto', () => {
      expect(responseRef('/api/gas/analysis', 'get', '200')).toBe(
        'GasAnalysisResponseDto',
      );
      expect(propsOf('GasAnalysisPeriodDto')).toEqual(['from', 'mode', 'to']);
      // period.from/to su nullable zbog ranog returna kad nema podataka.
      // @ApiProperty({...DATE_TIME, nullable:true}) se u ugovoru preslikava
      // kao {type:'string', format:'date-time', nullable:true} — ne kao
      // oneOf, pa se provjerava upravo to.
      const period = schemas['GasAnalysisPeriodDto'];
      for (const field of ['from', 'to']) {
        const def = period.properties?.[field] as Schema;
        expect(def.type).toBe('string');
        expect(def.format).toBe('date-time');
        expect(def.nullable).toBe(true);
      }
      // `mode` je union doslovno iz getEfficiencyAnalysis() (l.376).
      const mode = period.properties?.['mode'] as Schema;
      expect(mode.enum).toEqual([
        'explicit',
        'reference_to_current',
        'last_30_days',
      ]);
    });

    it('POST /api/gas/reading je 201', () => {
      expect(responseRef('/api/gas/reading', 'post', '201')).toBe(
        'GasReadingResponseDto',
      );
    });

    it('DOKUMENTOVANI IZUZETAK: DELETE /api/gas/reading/{id} nema šemu', () => {
      // gas.reading.service.ts:130 vraća sirovi prisma.gasReading.delete(),
      // NE mapGasReading(). Dodijeliti GasReadingResponseDto bi bila laž, a
      // ruta trenutno izlaže interne meterImagePath/invoicePdfPath koje
      // ostale gas rute skrivaju. Ispravak pripada zasebnom koraku.
      const schema =
        doc.paths['/api/gas/reading/{id}'].delete.responses?.['200']?.content;
      expect(schema).toBeUndefined();
    });
  });

  describe('dashboard — izvedeno iz dashboard.service.ts', () => {
    it('GET /api/dashboard [200] -> DashboardResponseDto', () => {
      expect(responseRef('/api/dashboard', 'get', '200')).toBe(
        'DashboardResponseDto',
      );
      expect(propsOf('DashboardResponseDto').sort()).toEqual([
        'capabilities',
        'homes',
        'system',
      ]);
    });

    it('system.boiler je opcionalan jer ga anonimna grana nema', () => {
      // getDashboard() anonimna grana (l.37) nema ključ `boiler`;
      // autentificirana (l.161) ga ima.
      const system = schemas['DashboardSystemDto'];
      expect(propsOf('DashboardSystemDto').sort()).toEqual([
        'boiler',
        'recommendation',
        'weather',
      ]);
      expect(system.required ?? []).not.toContain('boiler');
    });

    it('recommendation je oneOf oba stvarna oblika i oba su definisana', () => {
      const rec = schemas['DashboardSystemDto'].properties?.[
        'recommendation'
      ] as Schema;
      const refs = (rec.oneOf ?? []).map(
        (o) => (o as { $ref?: string }).$ref ?? '',
      );
      expect(refs).toContain(
        '#/components/schemas/DashboardLiveRecommendationDto',
      );
      expect(refs).toContain(
        '#/components/schemas/DashboardStoredRecommendationDto',
      );
      // Upravo su ove dvije šeme nedostajale u prvoj verziji.
      expect(schemas['DashboardLiveRecommendationDto']).toBeDefined();
      expect(schemas['DashboardStoredRecommendationDto']).toBeDefined();
      expect(propsOf('DashboardLiveRecommendationDto').sort()).toEqual([
        'date',
        'recommendedFlowTemp',
        'source',
      ]);
    });

    it('GET /api/dashboard/heating-status [200] je NIZ (Promise.all)', () => {
      const schema = doc.paths['/api/dashboard/heating-status'].get.responses?.[
        '200'
      ]?.content?.['application/json']?.schema as {
        type?: string;
        items?: { $ref?: string };
      };
      expect(schema.type).toBe('array');
      expect(schema.items?.$ref).toBe(
        '#/components/schemas/DashboardHeatingStatusDto',
      );
    });

    it('GET /api/dashboard/heating-events [200] ima data i meta', () => {
      expect(responseRef('/api/dashboard/heating-events', 'get', '200')).toBe(
        'DashboardHeatingEventsResponseDto',
      );
      expect(propsOf('DashboardHeatingEventsResponseDto').sort()).toEqual([
        'data',
        'meta',
      ]);
      expect(propsOf('DashboardHeatingEventsMetaDto').sort()).toEqual([
        'limit',
        'page',
        'total',
      ]);
    });

    it('GET /api/dashboard/heating-summary [200] ima summary i buckets', () => {
      expect(responseRef('/api/dashboard/heating-summary', 'get', '200')).toBe(
        'DashboardHeatingSummaryResponseDto',
      );
      expect(propsOf('DashboardHeatingSummaryResponseDto').sort()).toEqual([
        'buckets',
        'summary',
      ]);
      expect(propsOf('DashboardHeatingSummaryDto').sort()).toEqual([
        'avgDurationMin',
        'avgIndoorTemp',
        'totalCycles',
        'totalDurationMin',
      ]);
    });

    it('typo `curretTempThermostat` je zaključan u ugovoru', () => {
      // Postoji u izvornom kodu (dashboard.service.ts:261 i :143) i frontend
      // ga čita pod tim imenom. Preimenovanje bi tiho slomilo FE, pa je
      // namjerno zadržan i ovdje fiksiran kao dio wire ugovora.
      expect(propsOf('DashboardHeatingEventDto')).toContain(
        'curretTempThermostat',
      );
      expect(propsOf('DashboardRecentHeatingEventDto')).toContain(
        'curretTempThermostat',
      );
    });

    it('DashboardWeatherDto ima 9 nullable polja (transformWeather ?? null)', () => {
      const weather = schemas['DashboardWeatherDto'];
      expect(propsOf('DashboardWeatherDto')).toHaveLength(9);
      for (const def of Object.values(weather.properties ?? {})) {
        expect((def as Schema).nullable).toBe(true);
      }
    });

    it('rute bez izvedenog shape-a ostaju netipizirane (iskreno, ne izmišljeno)', () => {
      // Za heating-stats, learning-trends i export nisam izveo shape iz
      // servisa. Anotacija bez izvora bi bila izmišljotina, pa ostaju prazne.
      for (const p of [
        '/api/dashboard/heating-stats',
        '/api/dashboard/learning-trends',
        '/api/dashboard/export',
      ]) {
        const content = doc.paths[p].get.responses?.['200']?.content;
        expect(content).toBeUndefined();
      }
    });
  });

  describe('pokriće ruta koje frontend stvarno konzumira', () => {
    it('sve auth/gas/dashboard rute iz api.ts imaju tipiziran odgovor, osim dokumentovanih izuzetaka', () => {
      const typed: Array<[string, string, string]> = [
        ['/api/auth/login', 'post', '200'],
        ['/api/auth/register', 'post', '201'],
        ['/api/auth/me', 'get', '200'],
        ['/api/auth/change-password', 'post', '200'],
        ['/api/gas/readings', 'get', '200'],
        ['/api/gas/latest', 'get', '200'],
        ['/api/gas/analysis', 'get', '200'],
        ['/api/gas/reading', 'post', '201'],
        ['/api/gas/reading/{id}/reference', 'patch', '200'],
        ['/api/gas/reading/{id}/meter-image', 'post', '201'],
        ['/api/gas/reading/{id}/invoice', 'post', '201'],
        ['/api/gas/reading/{id}/invoice', 'delete', '200'],
        ['/api/dashboard', 'get', '200'],
        ['/api/dashboard/heating-events', 'get', '200'],
        ['/api/dashboard/heating-status', 'get', '200'],
        ['/api/dashboard/heating-summary', 'get', '200'],
      ];

      const missing = typed
        .filter(([p, m, s]) => {
          const op = doc.paths[p]?.[m];
          if (!op) return true;
          if (m === 'get' && p === '/api/gas/readings') {
            const sch = op.responses?.[s]?.content?.['application/json']
              ?.schema as { items?: { $ref?: string } };
            return !sch?.items?.$ref;
          }
          if (m === 'get' && p === '/api/gas/latest') {
            const sch = op.responses?.[s]?.content?.['application/json']
              ?.schema as { oneOf?: unknown[] };
            return !sch?.oneOf?.length;
          }
          return !op.responses?.[s]?.content?.['application/json']?.schema;
        })
        .map(([p, m, s]) => `${m.toUpperCase()} ${p} [${s}]`);

      expect(missing).toEqual([]);
    });
  });
});
