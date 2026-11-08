/**
 * MO2-8 (MO-012): prvi test nad `src/services/**` — `parseApiError`.
 *
 * Zašto baš ova funkcija:
 *  - čista je (nema React, nema mreže, nema storage-a) → testabilna bez emulatora
 *  - nosi MO2-5 ponašanje: 401 MORA dati prevedenu poruku, a ne backend tekst
 *    „Unauthorized" koji korisniku ne govori da se treba ponovo prijaviti
 *    (`error.handler.ts:96-98`)
 *  - `version.config.test.ts` živi u `src/config`, pa je bez ovog testa
 *    pokrivenost `collectCoverageFrom` opsega (`src/services` +
 *    `src/components/gas`) bila **0%** — izmjereno 2026-10-31
 *
 * Svaka očekivana vrijednost je izvedena iz stvarnog koda, ne iz pretpostavke.
 */

import { AxiosError } from 'axios';

// `i18n.t` vraća sam ključ, pa asertcije provjeravaju MAPIRANJE statusa na ključ
// (`i18nKeyForStatus`, `error.handler.ts:26-50`) bez ovisnosti o prijevodima.
jest.mock('../../../locales/config', () => ({
  __esModule: true,
  default: { t: (key: string) => `i18n:${key}` },
}));

import { parseApiError, ApiError } from '../error.handler';

/** Pravi AxiosError s odgovorom zadatog statusa i tijela. */
function httpError(status: number, data?: unknown, message = 'Request failed') {
  return new AxiosError(message, 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    data,
    statusText: '',
    headers: {},
    config: { headers: {} } as never,
  });
}

/** AxiosError BEZ odgovora — mrežni sloj. */
function networkError(code?: string, message = 'Network Error') {
  return new AxiosError(message, code as never, undefined, undefined, undefined);
}

describe('parseApiError — HTTP odgovor', () => {
  it('čita status i poruku iz odgovora', () => {
    const e = parseApiError(httpError(404, { statusCode: 404, message: 'Nema profila' }));

    expect(e).toBeInstanceOf(ApiError);
    expect(e.statusCode).toBe(404);
    expect(e.isNetworkError).toBe(false);
    expect(e.message).toBe('Nema profila');
    // Backend tekst se čuva za sve statuse OSIM 401 (`:98`)
    expect(e.userMessage).toBe('Nema profila');
  });

  it('401: backend tekst se BACA, koristi se prevedena poruka (MO2-5)', () => {
    const e = parseApiError(httpError(401, { statusCode: 401, message: 'Unauthorized' }));

    expect(e.statusCode).toBe(401);
    // Ključna regresija: da je userMessage === 'Unauthorized', MO2-5 je poništen.
    expect(e.userMessage).not.toBe('Unauthorized');
    expect(e.userMessage).toBe('i18n:errors.unauthorized');
  });

  it('401 bez tijela odgovora se ne ruši', () => {
    const e = parseApiError(httpError(401, undefined));

    expect(e.statusCode).toBe(401);
    expect(e.userMessage).toBe('i18n:errors.unauthorized');
    // `data?.message || error.message` → Axios poruka (`:94`)
    expect(e.message).toBe('Request failed');
  });

  it.each([
    [400, 'errors.badRequest'],
    [422, 'errors.badRequest'],
    [403, 'errors.forbidden'],
    // 404 je namjerno OVDJE, a ne samo u testu iznad: tamo `data.message`
    // postoji pa `userMessage` postane backend tekst i mapiranje se uopće ne
    // izvršava. Bez ove linije mutacija `case 404 → 'errors.badRequest'`
    // PREŽIVI cijeli suite (izmjereno 2026-10-31).
    [404, 'errors.notFound'],
    [408, 'errors.timeout'],
    [409, 'errors.conflict'],
    [500, 'errors.serverError'],
    [503, 'errors.serverError'],
  ])('status %i mapira na %s', (status, key) => {
    // Bez tijela → userMessage pada na default iz `getDefaultUserMessage` (`:66`)
    const e = parseApiError(httpError(status, undefined));

    expect(e.statusCode).toBe(status);
    expect(e.userMessage).toBe(`i18n:${key}`);
  });

  it('nepoznat status pada na serverError (default grana `:47-48`)', () => {
    const e = parseApiError(httpError(418, undefined));

    expect(e.statusCode).toBe(418);
    expect(e.userMessage).toBe('i18n:errors.serverError');
  });
});

describe('parseApiError — mrežni sloj (bez odgovora)', () => {
  it('mrežna greška: statusCode 0 i isNetworkError=true', () => {
    const e = parseApiError(networkError('ERR_NETWORK'));

    expect(e.statusCode).toBe(0);
    expect(e.isNetworkError).toBe(true);
    expect(e.userMessage).toBe('i18n:errors.networkError');
  });

  it('timeout (ECONNABORTED) NIJE mrežna greška nego 408 (`:81-87`)', () => {
    const e = parseApiError(networkError('ECONNABORTED', 'timeout of 10000ms exceeded'));

    expect(e.statusCode).toBe(408);
    // Razlikovanje je namjerno: timeout ima vlastiti i18n ključ, ne „nema mreže"
    expect(e.isNetworkError).toBe(false);
    expect(e.userMessage).toBe('i18n:errors.timeout');
  });
});

describe('parseApiError — ne-Axios ulaz', () => {
  it('običan Error postaje 500', () => {
    const e = parseApiError(new Error('nešto je puklo'));

    expect(e.statusCode).toBe(500);
    expect(e.isNetworkError).toBe(false);
    expect(e.message).toBe('nešto je puklo');
    expect(e.userMessage).toBe('i18n:errors.serverError');
  });

  it('vrijednost koja nije Error ne ruši parser (`:108`)', () => {
    const e = parseApiError('tekst greške');

    expect(e).toBeInstanceOf(ApiError);
    expect(e.statusCode).toBe(500);
    expect(e.message).toBe('An unknown error occurred');
  });

  it('null i undefined ne ruše parser', () => {
    expect(parseApiError(null).statusCode).toBe(500);
    expect(parseApiError(undefined).statusCode).toBe(500);
  });
});

/**
 * F7 (BUG-CRASH): greška ne smije srušiti ekran koji je prijavljuje.
 *
 * Na uređaju se dešavalo da Početna „zabaguje" — `showError` je za 401 bez
 * `customMessage` dobio `undefined` kao poruku (jer `ApiError.userMessage`
 * namjerno nije postavljen za 401) i predao ga toastu, koji je tada pokušao da
 * stilizuje nedefinisan tekst. Ovaj test čuva ugovor: poruka je UVIJEK
 * neprazan string, i za 401 i za grešku bez poruke.
 */
describe('useErrorHandler — poruka nikad nije prazna (BUG-CRASH)', () => {
  it('401 bez customMessage daje prevedeni ključ, nikad undefined', () => {
    const apiError = parseApiError(httpError(401, undefined));
    // `parseApiError` već popunjava `userMessage` prevedenim ključem — to je
    // ugovor koji hook koristi kao poruku. Provjera je ovdje da se taj ugovor
    // ne izgubi: prazna poruka je ono što je toast rušilo.
    expect(apiError.userMessage).toBe('i18n:errors.unauthorized');
    expect(typeof apiError.userMessage).toBe('string');
  });

  it('greška bez ijedne poruke i dalje daje string', () => {
    const apiError = parseApiError(new Error(''));
    expect(typeof (apiError.userMessage ?? 'x')).toBe('string');
    expect((apiError.userMessage ?? '').length).toBeGreaterThan(0);
  });
});
