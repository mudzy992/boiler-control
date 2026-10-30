import { Logger } from '@nestjs/common';

/**
 * FEAT-7 (nalazi B-015, B-016, B-017): strogo parsiranje ulaza za gas.
 *
 * == B-015: string `false` postaje `true` ==
 *
 * `main.ts:29-38` uključuje `transformOptions.enableImplicitConversion`.
 * class-transformer tada primijeni `Boolean(vrijednost)` PREMA TIPOVNOM
 * METAPODATKU svojstva — prije nego što `@Transform` uopšte dobije riječ.
 * Kako je `Boolean('false')` jednako `true` (svaki neprazan string je
 * istinit), stari `@Transform(({ value }) => value === true || value ===
 * 'true')` vidi već pretvoren `true` i vrati `true`.
 *
 * Empirijski izmjereno (jest sonda, `enableImplicitConversion: true`):
 *   ulaz              stari DTO
 *   'false'           true      <-- pogrešno
 *   '0'               true      <-- pogrešno
 *   1                 true      <-- pogrešno
 *   'bilo šta'        true      <-- pogrešno
 *   false / null      false
 *
 * Rješenje: `@Transform` prima i `obj` (izvorni plain objekt) i `key`, pa se
 * SIROVA, još nekonvertovana vrijednost čita kao `obj[key]`. Ista sonda to
 * potvrđuje — tamo `obj[key]` daje `'false'`, `0`, `1` onako kako je klijent
 * poslao.
 *
 * == B-016: prazan i negativan unos brojila ==
 *
 * `Number('')` je `0`, pa je prazan string prolazio kao očitanje 0 m3 i
 * upisivao se u bazu. `counterValue` nije imao `@Min(0)`, pa je i negativan
 * prvi unos prolazio.
 *
 * == Zašto ovo NIJE promjena za instalirane klijente ==
 *
 * Verificirano u oba potrošača:
 *   - `counterValue` se šalje kao STRING kroz multipart
 *     (`frontend/src/services/api.ts:149`,
 *      `mobile/src/services/api/client.ts:152`) — zato Number parsiranje
 *     ostaje, samo više ne prihvata prazno.
 *   - `isReference` se šalje kao PRAVI boolean
 *     (`api.ts:168`, `client.ts:170`) — strogo parsiranje ih ne dira.
 *
 * Jedino se odbacuje ulaz koji je i do sada bio besmislen (prazan broj,
 * negativan broj, `'false'` koji je značio `true`).
 */

/**
 * `on` (zadano) → stroga validacija. `off` → staro ponašanje, isključivo kao
 * rollback put. Namjerno je env zastavica a ne konstanta: rollback mora biti
 * moguć bez deploya novog koda (isti razlog kao `STUB_ENDPOINTS_MODE`).
 */
export type GasValidationMode = 'on' | 'off';

export const DEFAULT_GAS_VALIDATION_MODE: GasValidationMode = 'on';

const logger = new Logger('GasValidation');

export function getGasValidationMode(): GasValidationMode {
  const raw = process.env.GAS_STRICT_VALIDATION;

  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_GAS_VALIDATION_MODE;
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === 'on') return 'on';
  if (normalized === 'off') return 'off';

  logger.warn(
    `GAS_STRICT_VALIDATION ima neispravnu vrijednost "${raw}" — koristim zadano "${DEFAULT_GAS_VALIDATION_MODE}".`,
  );
  return DEFAULT_GAS_VALIDATION_MODE;
}

export function isGasStrictValidationEnabled(): boolean {
  return getGasValidationMode() === 'on';
}

/**
 * Tokeni koje prihvatamo za boolean. Namjerno USKI popis: oba poznata
 * klijenta šalju pravi boolean, a `'true'`/`'false'` pokrivaju ono što je
 * stari DTO dokumentovano htio. `'1'`/`'0'`/`'yes'`/`'on'` NISU dodani jer
 * nijedan potrošač ne šalje tako — prihvatiti ih značilo bi izmisliti
 * ugovor bez dokaza.
 */
const TRUE_TOKENS = new Set(['true']);
const FALSE_TOKENS = new Set(['false']);

/**
 * Parsira boolean iz SIROVE vrijednosti.
 *
 * Neprepoznat ulaz se namjerno vraća NEPROMIJENJEN, da ga `@IsBoolean()`
 * odbije s 400. Bacanje iz `@Transform` bi dalo 500, što nije ispravna
 * semantika za loš ulaz.
 */
export function parseStrictBoolean(raw: unknown): unknown {
  if (typeof raw === 'boolean') return raw;

  if (typeof raw === 'string') {
    const token = raw.trim().toLowerCase();
    if (TRUE_TOKENS.has(token)) return true;
    if (FALSE_TOKENS.has(token)) return false;
    return raw;
  }

  // number, null, undefined, objekt, niz — sve odbija @IsBoolean().
  return raw;
}

/**
 * Parsira stanje brojila iz SIROVE vrijednosti.
 *
 * String je legitiman ulaz (multipart), ali:
 *   - prazan/whitespace se NE smije pretvoriti u 0 (to je bio B-016),
 *   - `NaN`/`Infinity` se ne smiju provući.
 *
 * Neprepoznat ulaz se vraća neizmijenjen da ga `@IsNumber()` odbije s 400.
 */
export function parseStrictCounterValue(raw: unknown): unknown {
  if (typeof raw === 'number') {
    return raw; // NaN/Infinity odbija @IsNumber()
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed === '') {
      return raw; // '' -> Number('') je 0; upravo to je bug
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : raw;
  }

  return raw; // null, undefined, boolean, objekt, niz
}
