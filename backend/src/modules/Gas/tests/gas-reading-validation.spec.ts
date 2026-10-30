import 'reflect-metadata';
import { ArgumentMetadata, ValidationPipe } from '@nestjs/common';
import { CreateGasReadingDto } from '../dto/create-gas-reading.dto';
import { UpdateGasReferenceDto } from '../dto/update-gas-reference.dto';

/**
 * FEAT-7 — B-015 i B-016 kroz STVARNU konfiguraciju globalnog pipe-a.
 *
 * Konfiguracija je doslovno prepisana iz `main.ts:29-38`; bez
 * `enableImplicitConversion` ovi testovi ne bi dokazivali ništa, jer upravo ta
 * opcija uzrokuje da class-transformer primijeni `Boolean('false')` prije
 * `@Transform` dekoratora.
 *
 * Ovdje nema baze ni Nest aplikacije — pipe radi na čistom DTO-u, pa je test
 * brz i determinističan.
 */

// `main.ts:29-38`.
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});

const bodyMeta: ArgumentMetadata = {
  type: 'body',
  metatype: undefined,
  data: '',
};

// `ArgumentMetadata.metatype` je `Type<any> | undefined`, pa parametar mora
// biti tog tipa — `unknown` daje TS2322.
type DtoClass = NonNullable<ArgumentMetadata['metatype']>;

async function runPipe(metatype: DtoClass, value: unknown) {
  return pipe.transform(value, { ...bodyMeta, metatype });
}

/** Vraća `{ ok, value }` ili `{ ok: false, messages }`. */
async function attempt(metatype: DtoClass, value: unknown) {
  try {
    const result = await runPipe(metatype, value);
    return { ok: true, value: result };
  } catch (e) {
    const err = e as { response?: { message?: string[] | string } };
    const message = err.response?.message;
    return {
      ok: false,
      messages: Array.isArray(message) ? message : [String(message)],
    };
  }
}

describe('Gas DTO validacija kroz globalni pipe (FEAT-7)', () => {
  const ENV_KEY = 'GAS_STRICT_VALIDATION';
  const original = process.env[ENV_KEY];

  beforeEach(() => {
    delete process.env[ENV_KEY]; // zadano = strogo
  });

  afterAll(() => {
    if (original === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = original;
  });

  describe('UpdateGasReferenceDto (B-015)', () => {
    it('pravi boolean prolazi — oba klijenta šalju upravo to', () => {
      // `frontend/src/services/api.ts:168`, `mobile/src/services/api/client.ts:170`
      return Promise.all([
        expect(
          runPipe(UpdateGasReferenceDto, { isReference: true }),
        ).resolves.toMatchObject({ isReference: true }),
        expect(
          runPipe(UpdateGasReferenceDto, { isReference: false }),
        ).resolves.toMatchObject({ isReference: false }),
      ]);
    });

    it('string "false" je FALSE — stari kod je davao true', async () => {
      const r = await attempt(UpdateGasReferenceDto, { isReference: 'false' });
      expect(r.ok).toBe(true);
      expect((r.value as UpdateGasReferenceDto).isReference).toBe(false);
    });

    it('string "true" je true (zadržano staro ponašanje)', async () => {
      const r = await attempt(UpdateGasReferenceDto, { isReference: 'true' });
      expect(r.ok).toBe(true);
      expect((r.value as UpdateGasReferenceDto).isReference).toBe(true);
    });

    it.each(['1', '0', 'yes', 'možda', '', 1, 0, null])(
      'nevalidan ulaz %p daje 400, ne tiho true/false',
      async (input) => {
        const r = await attempt(UpdateGasReferenceDto, { isReference: input });
        expect(r.ok).toBe(false);
      },
    );

    it('nedostajuće polje daje 400 (polje je obavezno)', async () => {
      const r = await attempt(UpdateGasReferenceDto, {});
      expect(r.ok).toBe(false);
    });

    it('rollback: GAS_STRICT_VALIDATION=off vraća staro (pogrešno) ponašanje', async () => {
      process.env[ENV_KEY] = 'off';
      // Dokaz da rollback put zaista postoji i da je doslovno staro ponašanje:
      // `'false'` opet postaje true. Ovo NIJE poželjno ponašanje, nego
      // sigurnosni ventil za deploy bez novog koda.
      const r = await attempt(UpdateGasReferenceDto, { isReference: 'false' });
      expect(r.ok).toBe(true);
      expect((r.value as UpdateGasReferenceDto).isReference).toBe(true);
    });
  });

  describe('CreateGasReadingDto (B-016)', () => {
    const valid = {
      counterValue: '12345.67',
      readingDate: '2023-10-27T10:00:00Z',
    };

    it('numerički string prolazi — multipart ga tako šalje', async () => {
      const r = await attempt(CreateGasReadingDto, valid);
      expect(r.ok).toBe(true);
      expect((r.value as CreateGasReadingDto).counterValue).toBe(12345.67);
    });

    it('pravi broj prolazi', async () => {
      const r = await attempt(CreateGasReadingDto, {
        ...valid,
        counterValue: 12345.67,
      });
      expect(r.ok).toBe(true);
      expect((r.value as CreateGasReadingDto).counterValue).toBe(12345.67);
    });

    it('nula je dozvoljena (resetovanje brojila)', async () => {
      const r = await attempt(CreateGasReadingDto, {
        ...valid,
        counterValue: '0',
      });
      expect(r.ok).toBe(true);
      expect((r.value as CreateGasReadingDto).counterValue).toBe(0);
    });

    it('prazan string daje 400 — stari kod je upisivao 0 m3', async () => {
      for (const empty of ['', '   ']) {
        const r = await attempt(CreateGasReadingDto, {
          ...valid,
          counterValue: empty,
        });
        expect(r.ok).toBe(false);
      }
    });

    it('negativan broj daje 400 — nije bilo @Min(0)', async () => {
      for (const neg of ['-5', -5, '-0.01']) {
        const r = await attempt(CreateGasReadingDto, {
          ...valid,
          counterValue: neg,
        });
        expect(r.ok).toBe(false);
      }
    });

    it.each(['abc', '12abc', 'NaN', null, undefined, true])(
      'nevalidan counterValue %p daje 400',
      async (input) => {
        const r = await attempt(CreateGasReadingDto, {
          ...valid,
          counterValue: input,
        });
        expect(r.ok).toBe(false);
      },
    );

    it('nevalidan readingDate daje 400', async () => {
      const r = await attempt(CreateGasReadingDto, {
        counterValue: '100',
        readingDate: 'nije-datum',
      });
      expect(r.ok).toBe(false);
    });

    it('markAsReference se strogo parsira (dijelio je B-015 mehanizam)', async () => {
      const rFalse = await attempt(CreateGasReadingDto, {
        ...valid,
        markAsReference: 'false',
      });
      expect(rFalse.ok).toBe(true);
      expect((rFalse.value as CreateGasReadingDto).markAsReference).toBe(false);

      const rBad = await attempt(CreateGasReadingDto, {
        ...valid,
        markAsReference: 'možda',
      });
      expect(rBad.ok).toBe(false);
    });

    it('rollback: GAS_STRICT_VALIDATION=off opet guta prazan string kao 0', async () => {
      process.env[ENV_KEY] = 'off';
      const r = await attempt(CreateGasReadingDto, {
        ...valid,
        counterValue: '',
      });
      expect(r.ok).toBe(true);
      expect((r.value as CreateGasReadingDto).counterValue).toBe(0);
    });
  });
});
