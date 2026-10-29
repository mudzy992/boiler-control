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
  const total = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).total;
  const pieces = ['statements','branches','functions','lines'].map(key => {
    const item = total?.[key];
    if (!item || !Number.isInteger(item.total) || !Number.isInteger(item.covered) || item.total < 0 || item.covered < 0 || item.covered > item.total || typeof item.pct !== 'number' || !Number.isFinite(item.pct) || item.pct < 0 || item.pct > 100) throw new Error('invalid');
    return `${key} ${item.covered}/${item.total} (${item.pct}%)`;
  });
  console.log(`::notice title=Jest coverage aggregate::${pieces.join('; ')}. This is configured Jest coverage, not proof of semantic coverage or e2e.`);
} catch {
  console.log('::error title=Jest coverage unavailable::Aggregate coverage summary was unavailable or malformed; no raw output emitted.');
  process.exitCode = 1;
}
