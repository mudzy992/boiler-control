import {
  DEFAULT_GAS_VALIDATION_MODE,
  getGasValidationMode,
  isGasStrictValidationEnabled,
  parseStrictBoolean,
  parseStrictCounterValue,
} from '../gas-input';

/**
 * FEAT-7 — čiste funkcije i env zastavica za strogo parsiranje gas ulaza.
 *
 * Ovo je najniži sloj provjere: parsiranje bez Nest pipe-a. Ponašanje kroz
 * stvarni ValidationPipe dokazuje `modules/Gas/tests/gas-reading-validation.spec.ts`.
 */
describe('gas-input (FEAT-7)', () => {
  const ENV_KEY = 'GAS_STRICT_VALIDATION';
  const original = process.env[ENV_KEY];

  afterEach(() => {
    if (original === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = original;
    }
  });

  describe('zastavica GAS_STRICT_VALIDATION', () => {
    it('zadano je "on" (stroga validacija uključenа)', () => {
      delete process.env[ENV_KEY];
      expect(DEFAULT_GAS_VALIDATION_MODE).toBe('on');
      expect(getGasValidationMode()).toBe('on');
      expect(isGasStrictValidationEnabled()).toBe(true);
    });

    it('prazan string se tretira kao zadano, ne kao "off"', () => {
      process.env[ENV_KEY] = '   ';
      expect(getGasValidationMode()).toBe('on');
    });

    it('prihvata on/off neosjetljivo na velika slova i razmake', () => {
      for (const v of ['on', 'ON', ' On ']) {
        process.env[ENV_KEY] = v;
        expect(getGasValidationMode()).toBe('on');
      }
      for (const v of ['off', 'OFF', ' Off ']) {
        process.env[ENV_KEY] = v;
        expect(getGasValidationMode()).toBe('off');
        expect(isGasStrictValidationEnabled()).toBe(false);
      }
    });

    it('neispravna vrijednost pada na zadano (rollback put ostaje dostupan)', () => {
      for (const v of ['maybe', '0', '1', 'true', 'enabled']) {
        process.env[ENV_KEY] = v;
        expect(getGasValidationMode()).toBe('on');
      }
    });
  });

  describe('parseStrictBoolean (B-015)', () => {
    it('pravi boolean prolazi nepromijenjen', () => {
      expect(parseStrictBoolean(true)).toBe(true);
      expect(parseStrictBoolean(false)).toBe(false);
    });

    it('string "false" je false — ovo je bio B-015', () => {
      // Stari kod: `Boolean('false')` === true, pa je @Transform vraćao true.
      expect(parseStrictBoolean('false')).toBe(false);
      expect(parseStrictBoolean('FALSE')).toBe(false);
      expect(parseStrictBoolean('  false  ')).toBe(false);
    });

    it('string "true" je true', () => {
      expect(parseStrictBoolean('true')).toBe(true);
      expect(parseStrictBoolean('TRUE')).toBe(true);
      expect(parseStrictBoolean(' true ')).toBe(true);
    });

    it('neprepoznat ulaz se vraća NEPROMIJENJEN da ga @IsBoolean odbije s 400', () => {
      // Bacanje iz @Transform bi dalo 500, što nije ispravna semantika.
      expect(parseStrictBoolean('1')).toBe('1');
      expect(parseStrictBoolean('0')).toBe('0');
      expect(parseStrictBoolean('yes')).toBe('yes');
      expect(parseStrictBoolean('možda')).toBe('možda');
      expect(parseStrictBoolean(1)).toBe(1);
      expect(parseStrictBoolean(0)).toBe(0);
      expect(parseStrictBoolean(null)).toBeNull();
      expect(parseStrictBoolean(undefined)).toBeUndefined();
      const obj = { a: 1 };
      expect(parseStrictBoolean(obj)).toBe(obj);
    });
  });

  describe('parseStrictCounterValue (B-016)', () => {
    it('broj prolazi nepromijenjen', () => {
      expect(parseStrictCounterValue(12345.67)).toBe(12345.67);
      expect(parseStrictCounterValue(0)).toBe(0);
    });

    it('numerički string se parsira — multipart ga šalje kao string', () => {
      // `frontend/src/services/api.ts:149` i
      // `mobile/src/services/api/client.ts:152` rade
      // `form.append('counterValue', String(v))`.
      expect(parseStrictCounterValue('12345.67')).toBe(12345.67);
      expect(parseStrictCounterValue(' 12345.67 ')).toBe(12345.67);
      expect(parseStrictCounterValue('0')).toBe(0);
    });

    it('prazan string se NE pretvara u 0 — ovo je bio B-016', () => {
      // `Number('')` === 0, pa je prazan unos prolazio kao očitanje 0 m3.
      expect(parseStrictCounterValue('')).toBe('');
      expect(parseStrictCounterValue('   ')).toBe('   ');
    });

    it('nenumerički i beskonačni ulazi se vraćaju da ih @IsNumber odbije', () => {
      expect(parseStrictCounterValue('abc')).toBe('abc');
      expect(parseStrictCounterValue('12abc')).toBe('12abc');
      expect(parseStrictCounterValue(NaN)).toBeNaN();
      expect(parseStrictCounterValue(Infinity)).toBe(Infinity);
      expect(parseStrictCounterValue(null)).toBeNull();
      expect(parseStrictCounterValue(undefined)).toBeUndefined();
      expect(parseStrictCounterValue(true)).toBe(true);
    });
  });
});
