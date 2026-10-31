#!/usr/bin/env node
/* FEAT-6: OpenAPI fragment iz stvarnih Dashboard dekoratora, bez Prisma baze. */
'use strict';
const path = require('node:path');
const Module = require('node:module');
const fs = require('node:fs');

if (process.argv.includes('--help')) {
  console.log(
    'Upotreba: node scripts/audit/openapi_dashboard_fragment.cjs [--write]\n' +
      'Generise OpenAPI fragment za DashboardController koristeci stvarne DTO/dekoratore\n' +
      'i src/openapi.config.ts, ali sa stubovanim DashboardService/JwtAuthGuard/Prisma.\n' +
      'Bez --write ispisuje fragment; sa --write mijenja samo /api/dashboard/export\n' +
      'i pripadajuce Dashboard seme u contracts/openapi.json. CI i dalje koristi\n' +
      'puni backend `npm run openapi:generate -- --check` kao mjerodavnu provjeru.',
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
const original = Module._load;
Module._load = function (request, parent, isMain) {
  const from = parent?.filename || '';
  if (
    from.endsWith(path.join('Dashboard', 'dashboard.controller.ts')) &&
    request === './dashboard.service'
  ) {
    return { DashboardService: class DashboardService {} };
  }
  if (
    from.endsWith(path.join('Dashboard', 'dashboard.controller.ts')) &&
    request === '../Auth/jwt-auth.guard'
  ) {
    return { JwtAuthGuard: class JwtAuthGuard {} };
  }
  return original.call(this, request, parent, isMain);
};
require(path.join(root, 'backend/node_modules/ts-node/register/transpile-only'));
const { Test } = require(path.join(root, 'backend/node_modules/@nestjs/testing'));
const { DashboardController } = require(path.join(root, 'backend/src/modules/Dashboard/dashboard.controller.ts'));
const { createOpenApiDocument, serializeOpenApiDocument } = require(path.join(root, 'backend/src/openapi.config.ts'));

async function main() {
  // Isti stub token koji je kontroler dobio kroz Module._load hook.
  const serviceToken = Reflect.getMetadata('design:paramtypes', DashboardController)[0];
  const moduleRef = await Test.createTestingModule({
    controllers: [DashboardController],
    providers: [{ provide: serviceToken, useValue: {} }],
  }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  await app.init();
  try {
    const doc = createOpenApiDocument(app);
    const exportPath = doc.paths['/api/dashboard/export'];
    if (!exportPath) throw new Error('Nedostaje /api/dashboard/export');
    const schemas = doc.components?.schemas ?? {};
    if (!write) {
      process.stdout.write(serializeOpenApiDocument({ paths: { '/api/dashboard/export': exportPath }, components: { schemas } }));
      return;
    }
    const contractPath = path.join(root, 'contracts/openapi.json');
    const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
    contract.paths['/api/dashboard/export'] = exportPath;
    contract.components = contract.components || {};
    contract.components.schemas = contract.components.schemas || {};
    for (const [name, schema] of Object.entries(schemas)) {
      if (name.startsWith('Dashboard')) contract.components.schemas[name] = schema;
    }
    fs.writeFileSync(contractPath, serializeOpenApiDocument(contract));
    console.log('Azuriran /api/dashboard/export i Dashboard seme u contracts/openapi.json');
  } finally {
    await app.close();
  }
}
main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
