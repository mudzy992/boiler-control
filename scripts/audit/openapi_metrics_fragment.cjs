#!/usr/bin/env node
/* SEC-6: OpenAPI fragment from actual MetricsController decorators, without Prisma. */
'use strict';
const path = require('node:path');
const fs = require('node:fs');

if (process.argv.includes('--help')) {
  console.log(
    'Upotreba: node scripts/audit/openapi_metrics_fragment.cjs [--write]\n' +
      'Generise OpenAPI fragment za MetricsController koristeci stvarne dekoratore\n' +
      'i src/openapi.config.ts, ali bez AppModule/Prisma baze. Bez --write ispisuje\n' +
      'fragment; sa --write mijenja samo /metrics* putanje i metrics-token security\n' +
      'shemu u contracts/openapi.json. CI i dalje koristi puni backend\n' +
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
require(path.join(root, 'backend/node_modules/ts-node/register/transpile-only'));
const { Test } = require(path.join(root, 'backend/node_modules/@nestjs/testing'));
const { MetricsController } = require(path.join(root, 'backend/src/common/metrics.controller.ts'));
const { MetricsService } = require(path.join(root, 'backend/src/common/metrics.service.ts'));
const { ReportingService } = require(path.join(root, 'backend/src/common/reporting.service.ts'));
const { MetricsAuthGuard } = require(path.join(root, 'backend/src/common/metrics-auth.guard.ts'));
const { createOpenApiDocument, serializeOpenApiDocument } = require(path.join(root, 'backend/src/openapi.config.ts'));

async function main() {
  const moduleRef = await Test.createTestingModule({
    controllers: [MetricsController],
    providers: [MetricsService, ReportingService, MetricsAuthGuard],
  }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  await app.init();
  try {
    const doc = createOpenApiDocument(app);
    const paths = {};
    for (const [key, value] of Object.entries(doc.paths || {})) {
      if (key === '/metrics' || key.startsWith('/metrics/')) paths[key] = value;
    }
    if (Object.keys(paths).length !== 4) {
      throw new Error('Ocekivane su tacno 4 /metrics* putanje');
    }
    const scheme = doc.components?.securitySchemes?.['metrics-token'];
    if (!scheme) throw new Error('Nedostaje metrics-token security shema');
    if (!write) {
      process.stdout.write(
        serializeOpenApiDocument({
          paths,
          components: { securitySchemes: { 'metrics-token': scheme } },
        }),
      );
      return;
    }
    const contractPath = path.join(root, 'contracts/openapi.json');
    const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
    for (const [key, value] of Object.entries(paths)) contract.paths[key] = value;
    contract.components = contract.components || {};
    contract.components.securitySchemes = contract.components.securitySchemes || {};
    contract.components.securitySchemes['metrics-token'] = scheme;
    fs.writeFileSync(contractPath, serializeOpenApiDocument(contract));
    console.log('Azurirane /metrics* putanje i metrics-token shema u contracts/openapi.json');
  } finally {
    await app.close();
  }
}
main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
