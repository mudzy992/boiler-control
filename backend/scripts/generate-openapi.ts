import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { writeFileSync, mkdirSync, readFileSync, mkdtempSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { AppModule } from '../src/app.module';
import {
  createOpenApiDocument,
  serializeOpenApiDocument,
} from '../src/openapi.config';

/**
 * API-2: generator OpenAPI ugovora.
 *
 * Pokreće stvarnu Nest aplikaciju (bez `listen`) i izvlači dokument iz
 * dekoratora kontrolera i DTO-ova — istom konfiguracijom koju `main.ts`
 * koristi za `/api/docs`, pa komitovani artefakt ne može driftati od onoga
 * što server servira.
 *
 * Izlaz je deterministički (ključevi sortirani, v. `serializeOpenApiDocument`),
 * što je preduslov za CI diff: bez toga bi promjena redoslijeda ruta u modulu
 * davala lažni diff.
 *
 * Upotreba:
 *   npm run openapi:generate            # piše u ../contracts/openapi.json
 *   npm run openapi:generate -- --check # ne piše; exit 1 ako se razlikuje
 */

const logger = new Logger('openapi:generate');

function repoRoot(): string {
  // backend/scripts/generate-openapi.ts -> korijen monorepo-a.
  // `__dirname`, ne `import.meta.url`: tsconfig ima `module: nodenext` ali
  // `package.json` nema `"type"`, pa se ovo kompajlira u CJS gdje `import.meta`
  // ne postoji.
  return resolve(__dirname, '..', '..');
}

function defaultOutputPath(): string {
  return resolve(repoRoot(), 'contracts', 'openapi.json');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check');

  // `FileStorageService` u konstruktoru odmah kreira direktorije ispod
  // `UPLOAD_ROOT_PATH`, whose default je `/usr/src/app/uploads` (Docker
  // putanja) — bez ovoga instanciranje padne s EACCES izvan kontejnera.
  // Generator ne dira fajlove, pa je privremeni direktorij dovoljan.
  // Postavlja se samo ako nije vec zadano, da ne pregazi stvarnu konfiguraciju.
  if (!process.env.UPLOAD_ROOT_PATH) {
    process.env.UPLOAD_ROOT_PATH = mkdtempSync(join(tmpdir(), 'openapi-'));
  }

  // Aplikacija se instancira ali ne sluša. PrismaService.$connect() je
  // no-op u sandboxu gdje klijent nije generisan; u CI je pravi.
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
  });

  let exitCode = 0;
  try {
    const document = createOpenApiDocument(app);
    const serialized = serializeOpenApiDocument(document);

    const paths = Object.keys(document.paths ?? {});
    const operations = paths.reduce(
      (sum, p) => sum + Object.keys(document.paths?.[p] ?? {}).length,
      0,
    );

    logger.log(
      `Generisano: ${paths.length} putanja, ${operations} operacija, ` +
        `${Object.keys(document.components?.schemas ?? {}).length} šema.`,
    );

    const out = defaultOutputPath();

    if (checkOnly) {
      let current = '';
      try {
        current = readFileSync(out, 'utf8');
      } catch {
        logger.error(`Artefakt ne postoji: ${out}`);
        process.exitCode = 1;
        return;
      }
      if (current !== serialized) {
        logger.error(
          'OpenAPI ugovor se razlikuje od komitovanog artefakta. ' +
            'Pokreni `npm run openapi:generate` i komituj razliku.',
        );
        process.exitCode = 1;
        return;
      }
      logger.log('Ugovor je usklađen s komitovanim artefaktom.');
      return;
    }

    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, serialized, 'utf8');
    logger.log(`Zapisano: ${out}`);
  } catch (error) {
    logger.error(error instanceof Error ? error.stack : String(error));
    exitCode = 1;
  } finally {
    await app.close();
  }

  process.exitCode = exitCode;
}

void main();
