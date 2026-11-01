import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * PERF-1 contract guard: the accepted heating index must stay aligned across
 * Prisma schema, SQL migration and the synthetic benchmark candidate.
 * The weather candidate is measured but intentionally not migrated yet.
 */
const backendRoot = join(__dirname, '../..');
const repoRoot = join(backendRoot, '..');
const schema = readFileSync(join(backendRoot, 'prisma/schema.prisma'), 'utf8');
const migrationDir = join(
  backendRoot,
  'prisma/migrations/20261101000000_perf1_heating_event_device_timestamp',
);
const migration = readFileSync(join(migrationDir, 'migration.sql'), 'utf8');
const benchmark = readFileSync(
  join(repoRoot, 'scripts/audit/perf1_index_benchmark.cjs'),
  'utf8',
);

function modelBlock(name: string): string {
  const match = schema.match(new RegExp(`model ${name} \\{[\\s\\S]*?\\n\\}`));
  expect(match).not.toBeNull();
  return match![0];
}

describe('PERF-1 index contract', () => {
  it('keeps the legacy deviceId index and adds the composite descending index', () => {
    const heating = modelBlock('HeatingEvent');
    expect(heating).toContain('@@index([deviceId])');
    expect(heating).toContain(
      '@@index([deviceId, timestampStart(sort: Desc)])',
    );
  });

  it('does not migrate the deferred weather candidate', () => {
    const weather = modelBlock('WeatherCache');
    expect(weather).not.toContain('@@index');
    expect(migration).not.toContain('WeatherCache');
    expect(migration).not.toMatch(/CREATE INDEX[^;]*WeatherCache/i);
  });

  it('matches the migration SQL to the accepted Prisma index', () => {
    expect(migration).toContain(
      'CREATE INDEX "HeatingEvent_deviceId_timestampStart_idx"',
    );
    expect(migration).toContain(
      'ON "HeatingEvent"("deviceId", "timestampStart" DESC)',
    );
    expect(migration).toContain(
      'DROP INDEX IF EXISTS "HeatingEvent_deviceId_timestampStart_idx"',
    );
    expect(migration).not.toMatch(/DROP INDEX[^;]*HeatingEvent_deviceId_fkey/i);
  });

  it('keeps the benchmark candidate aligned with the migration', () => {
    expect(benchmark).toContain(
      "name: 'HeatingEvent_deviceId_timestampStart_idx'",
    );
    expect(benchmark).toContain(
      'columns: \'"deviceId", "timestampStart" DESC\'',
    );
    expect(benchmark).toContain(
      'weatherIndexRecommended: weatherNormal.eligible',
    );
    expect(benchmark).toContain('weatherStressOnlyIsNotSufficient: true');
  });

  it('keeps disposable-CI and local-buffer measurement guards', () => {
    expect(benchmark).toContain("env.AUDIT_DISPOSABLE_POSTGRES === '1'");
    expect(benchmark).toContain("env.NODE_ENV === 'test'");
    expect(benchmark).toContain("Number(node['Local Hit Blocks'] || 0)");
    expect(benchmark).toContain("Number(node['Local Read Blocks'] || 0)");
    expect(benchmark).toContain(
      'sharedHitBlocks + sharedReadBlocks + localHitBlocks + localReadBlocks',
    );
  });

  it('has exactly one PERF-1 migration directory', () => {
    const dirs = readdirSync(join(backendRoot, 'prisma/migrations')).filter(
      (name) => name.includes('perf1'),
    );
    expect(dirs).toEqual([
      '20261101000000_perf1_heating_event_device_timestamp',
    ]);
  });
});
