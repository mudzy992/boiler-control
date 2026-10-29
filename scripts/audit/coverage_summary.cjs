#!/usr/bin/env node
/* Report only aggregate Jest coverage metrics; no source paths or captured output. */
'use strict';
const fs = require('node:fs');
if (process.argv.includes('--help')) {
  console.log('Upotreba: node scripts/audit/coverage_summary.cjs <coverage-summary.json>\nIspisuje samo ukupne brojeve/pokriće Jest json-summary izvještaja kao GitHub anotaciju; bez putanja po fajlovima i sirovih test logova.');
  process.exit(0);
}
if (process.argv.length !== 3) { console.error('Potrebna je putanja do Jest json-summary izvještaja; pogledajte --help.'); process.exit(2); }
try {
  const report = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const total = report.total;
  const metrics = ['statements','branches','functions','lines'];
  const pieces = metrics.map(key => {
    const item = total?.[key];
    if (!item || !Number.isInteger(item.total) || !Number.isInteger(item.covered) || item.total < 0 || item.covered < 0 || item.covered > item.total || typeof item.pct !== 'number' || !Number.isFinite(item.pct) || item.pct < 0 || item.pct > 100) throw new Error('invalid');
    return `${key} ${item.covered}/${item.total} (${item.pct}%)`;
  });
  const groups = Object.fromEntries(['backend_source','generated','backend_test','other'].map(name => [name, {files:0, metrics:Object.fromEntries(metrics.map(k=>[k,{covered:0,total:0}]))}]));
  for (const [filename, entry] of Object.entries(report)) {
    if (filename === 'total') continue;
    const normalized = filename.replace(/\\/g, '/');
    const name = normalized.includes('/backend/src/generated/') ? 'generated' : normalized.includes('/backend/src/') ? 'backend_source' : normalized.includes('/backend/test/') ? 'backend_test' : 'other';
    const group = groups[name];
    group.files++;
    for (const key of metrics) {
      const item = entry?.[key];
      if (!item || !Number.isInteger(item.total) || !Number.isInteger(item.covered) || item.total < 0 || item.covered < 0 || item.covered > item.total) throw new Error('invalid');
      group.metrics[key].covered += item.covered;
      group.metrics[key].total += item.total;
    }
  }
  for (const key of metrics) {
    if (Object.values(groups).reduce((sum, g) => sum + g.metrics[key].total, 0) !== total[key].total || Object.values(groups).reduce((sum, g) => sum + g.metrics[key].covered, 0) !== total[key].covered) throw new Error('inconsistent');
  }
  console.log(`::notice title=Jest coverage aggregate::${pieces.join('; ')}. This is configured Jest coverage, not proof of semantic coverage or e2e.`);
  for (const [name, group] of Object.entries(groups)) {
    const summary = metrics.map(key => {
      const {covered, total} = group.metrics[key];
      return `${key} ${covered}/${total} (${total ? (covered*100/total).toFixed(2) : 'n/a'}%)`;
    });
    console.log(`::notice title=Jest coverage group::${name}: ${group.files} files; ${summary.join('; ')}.`);
  }
} catch {
  console.log('::error title=Jest coverage unavailable::Aggregate coverage summary was unavailable or malformed; no raw output emitted.');
  process.exitCode = 1;
}
