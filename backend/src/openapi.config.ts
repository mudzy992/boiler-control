import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { INestApplication, Type } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';

/**
 * API-2: jedinstveni izvor istine za OpenAPI konfiguraciju.
 *
 * Prije ovoga `DocumentBuilder` je bio inline u `main.ts`, pa bi svaki
 * generator specifikacije morao duplicirati postavke — a duplikat neizbježno
 * drifta od onoga što server stvarno servira na `/api/docs`. Sada i `main.ts`
 * i `scripts/generate-openapi.ts` zovu iste funkcije, pa je komitovani
 * artefakt garantovano jednak runtime specifikaciji.
 */

export const OPENAPI_TITLE = 'Boiler Control API';
export const OPENAPI_DESCRIPTION =
  'Ugovor Boiler Control API-ja. Ovaj dokument je generisan iz dekoratora ' +
  'kontrolera i DTO-ova; ne uređuje se ručno. Regenerisati sa ' +
  '`npm run openapi:generate`.';
export const OPENAPI_VERSION = '1.0';

export function buildOpenApiConfig() {
  return new DocumentBuilder()
    .setTitle(OPENAPI_TITLE)
    .setDescription(OPENAPI_DESCRIPTION)
    .setVersion(OPENAPI_VERSION)
    .addBearerAuth()
    .build();
}

/**
 * Građi OpenAPI dokument iz instancirane aplikacije.
 *
 * `extraModels` postoji jer DTO-ovi koji se koriste samo kao union članovi ili
 * preko `@ApiExtraModels` inače ne bi ušli u `components.schemas`, pa
 * generisani klijentski tipovi ne bi bili potpuni.
 */
export function createOpenApiDocument(
  app: INestApplication,
  extraModels: Type<unknown>[] = [],
): OpenAPIObject {
  return SwaggerModule.createDocument(app, buildOpenApiConfig(), {
    extraModels,
  });
}

/**
 * Stabilna serializacija za diff u CI.
 *
 * Ključevi se sortiraju rekurzivno da bi artefakt bio byte-identičan između
 * pokretanja — bez toga bi promjena redoslijeda ruta u modulu proizvodila
 * lažni diff i CI provjera ugovora bi bila beskorisna.
 */
export function serializeOpenApiDocument(doc: OpenAPIObject): string {
  return JSON.stringify(sortDeep(doc), null, 2) + '\n';
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortDeep);
  }
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      out[key] = sortDeep(source[key]);
    }
    return out;
  }
  return value;
}
