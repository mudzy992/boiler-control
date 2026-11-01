#!/usr/bin/env node
/* FE2-10: OpenAPI fragment from recommendation decorators, without Prisma/AppModule. */
'use strict';
const path = require('node:path');
const fs = require('node:fs');

if (process.argv.includes('--help')) {
  console.log(
    'Upotreba: node scripts/audit/openapi_recommendation_fragment.cjs [--write]\n' +
      'Generise OpenAPI fragment za GET /api/recommendations i FE2-10 breakdown\n' +
      'DTO šeme koristeći stvarne dekoratore, ali bez AppModule/Prisma baze.\n' +
      'Bez --write ispisuje fragment; sa --write mijenja samo /api/recommendations\n' +
      'putanju i Recommendation* / DashboardStoredRecommendationDto šeme u\n' +
      'contracts/openapi.json. CI i dalje koristi puni backend\n' +
      '`npm run openapi:generate -- --check` kao mjerodavnu provjeru.',
  );
  process.exit(0);
}
const write = process.argv.includes('--write');
if (process.argv.length > 3 || (process.argv.length === 3 && !write)) {
  console.error('Nepoznat argument; koristite --help');
  process.exit(2);
}

const root = path.resolve(__dirname, '../..');
process.env.TS_NODE_PROJECT = path.join(root, 'backend/tsconfig.json');
const Module = require('node:module');
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  const from = parent?.filename || '';
  if (
    from.endsWith(path.join('HeatingRecommendation', 'recommendations.controller.ts')) &&
    request === './heating.recommendation.service'
  ) {
    return { HeatingRecommendationService: class HeatingRecommendationService {} };
  }
  if (
    from.endsWith(path.join('HeatingRecommendation', 'recommendations.controller.ts')) &&
    request === '../Auth/jwt-auth.guard'
  ) {
    return { JwtAuthGuard: class JwtAuthGuard {} };
  }
  return originalLoad.call(this, request, parent, isMain);
};
require(path.join(root, 'backend/node_modules/ts-node/register/transpile-only'));
const { Test } = require(path.join(root, 'backend/node_modules/@nestjs/testing'));
const { RecommendationsController } = require(path.join(root, 'backend/src/modules/HeatingRecommendation/recommendations.controller.ts'));
const { DashboardStoredRecommendationDto } = require(path.join(root, 'backend/src/modules/Dashboard/dto/dashboard-response.dto.ts'));
const { createOpenApiDocument, serializeOpenApiDocument } = require(path.join(root, 'backend/src/openapi.config.ts'));

const SCHEMA_NAMES = [
  'RecommendationAppliedOffsetsDto',
  'RecommendationBreakdownDto',
  'RecommendationResponseDto',
  'DashboardStoredRecommendationDto',
];

async function main() {
  const serviceToken = Reflect.getMetadata('design:paramtypes', RecommendationsController)[0];
  const moduleRef = await Test.createTestingModule({
    controllers: [RecommendationsController],
    providers: [{ provide: serviceToken, useValue: {} }],
  }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  await app.init();
  try {
    const doc = createOpenApiDocument(app, [DashboardStoredRecommendationDto]);
    const route = doc.paths?.['/api/recommendations'];
    if (!route) throw new Error('Nedostaje /api/recommendations putanja');
    const schemas = {};
    for (const name of SCHEMA_NAMES) {
      const schema = doc.components?.schemas?.[name];
      if (!schema) throw new Error(`Nedostaje OpenAPI šema: ${name}`);
      schemas[name] = schema;
    }
    if (!write) {
      process.stdout.write(
        serializeOpenApiDocument({
          paths: { '/api/recommendations': route },
          components: { schemas },
        }),
      );
      return;
    }
    const contractPath = path.join(root, 'contracts/openapi.json');
    const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
    contract.paths['/api/recommendations'] = route;
    contract.components = contract.components || {};
    contract.components.schemas = contract.components.schemas || {};
    for (const [name, schema] of Object.entries(schemas)) {
      contract.components.schemas[name] = schema;
    }
    fs.writeFileSync(contractPath, serializeOpenApiDocument(contract));
    console.log('Ažurirani /api/recommendations i FE2-10 breakdown šeme u contracts/openapi.json');
  } finally {
    await app.close();
  }
}
main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
