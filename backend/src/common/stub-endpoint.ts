import { HttpException, HttpStatus, Logger } from '@nestjs/common';

/**
 * API-1 (nalazi B-001, B-002, B-003): eksplicitni ugovor za stub endpointe.
 *
 * Problem koji ovo rješava: tri endpointa su vraćala prividno ispravan odgovor
 * za neimplementiranu funkcionalnost —
 *   - `POST /api/heating-events` → izmišljeni `Math.random()` ID, NIŠTA se ne
 *     upisuje u bazu (najgore: klijent misli da je zapis kreiran),
 *   - `GET /api/weather` → `{}`,
 *   - `GET /api/recommendations/today` → `[]`.
 *
 * `{}` i `[]` su **nerazlučivi od „nema podataka"**, pa klijent ne može znati
 * da li zaista nema preporuka za danas ili endpoint uopšte nije implementiran.
 * Zato se sada vraća `501 Not Implemented` s tijelom koje kaže zašto i, gdje
 * postoji, koja je stvarna ruta.
 *
 * Potrošači su verificirani prije promjene (kriterij prihvatanja API-1):
 * nijedan od ova tri endpointa nema pozivaoca ni u `frontend/` ni u `mobile/`.
 */

/**
 * Način rada stub endpointa.
 *
 * `reject` (zadano) → 501. `legacy` → staro stub ponašanje, isključivo kao
 * rollback put ako se pojavi nepoznat potrošač. Namjerno je env zastavica, a
 * ne konstanta: rollback mora biti moguć bez deploya novog koda.
 */
export type StubEndpointMode = 'reject' | 'legacy';

export const DEFAULT_STUB_ENDPOINT_MODE: StubEndpointMode = 'reject';

const logger = new Logger('StubEndpoint');

export function getStubEndpointMode(): StubEndpointMode {
  const raw = process.env.STUB_ENDPOINTS_MODE;

  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_STUB_ENDPOINT_MODE;
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === 'reject') return 'reject';
  if (normalized === 'legacy') return 'legacy';

  logger.warn(
    `STUB_ENDPOINTS_MODE ima neispravnu vrijednost "${raw}" — koristim zadano "${DEFAULT_STUB_ENDPOINT_MODE}".`,
  );
  return DEFAULT_STUB_ENDPOINT_MODE;
}

/** Tijelo 501 odgovora. Polja se smiju samo dodavati. */
export interface UnimplementedEndpointBody {
  statusCode: number;
  error: string;
  /** Npr. `POST /api/heating-events`. */
  endpoint: string;
  /**
   * Razlikuje razlog praznog/neuspjelog odgovora. Klijent ovo MORA čitati
   * umjesto da pogađa iz praznog payloada.
   */
  reason: 'stub-not-implemented';
  message: string;
  /** Stvarna ruta koja radi, ako postoji (npr. weather). */
  alternative?: string;
}

export class UnimplementedEndpointException extends HttpException {
  constructor(
    endpoint: string,
    options: { alternative?: string; message?: string } = {},
  ) {
    const body: UnimplementedEndpointBody = {
      statusCode: HttpStatus.NOT_IMPLEMENTED,
      error: 'Not Implemented',
      endpoint,
      reason: 'stub-not-implemented',
      message:
        options.message ??
        `Endpoint ${endpoint} je stub i nije implementiran. Prazan odgovor ne znaci "nema podataka".`,
      ...(options.alternative ? { alternative: options.alternative } : {}),
    };

    super(body, HttpStatus.NOT_IMPLEMENTED);
  }
}

/**
 * Baca 501 ako je stub režim aktivan; inače vraća `false` i pozivalac nastavlja
 * sa legacy ponašanjem.
 *
 * Vraća boolean (a ne baca bezuslovno) da bi rollback put bio eksplicitan i
 * testabilan, a ne skriven u try/catch.
 */
export function throwIfStubRejected(
  endpoint: string,
  options: { alternative?: string; message?: string } = {},
): boolean {
  if (getStubEndpointMode() === 'legacy') {
    return false;
  }
  throw new UnimplementedEndpointException(endpoint, options);
}
