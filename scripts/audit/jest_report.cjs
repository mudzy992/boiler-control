#!/usr/bin/env node
/** Report Jest counts and failing test names without echoing logs or values. */
const fs = require('node:fs');
const path = require('node:path');

if (process.argv.includes('--help')) {
  console.log('Usage: node scripts/audit/jest_report.cjs <jest-result.json>');
  console.log('Prints GitHub annotations with counts and failed test names; no raw failure messages.');
  process.exit(0);
}

const filename = process.argv[2];
if (!filename) {
  console.error('Missing Jest JSON result; use --help.');
  process.exit(2);
}

function safe(value) {
  return String(value).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

try {
  const result = JSON.parse(fs.readFileSync(filename, 'utf8'));
  const summary = `Jest: suites ${result.numPassedTestSuites} passed, ${result.numFailedTestSuites} failed; tests ${result.numPassedTests} passed, ${result.numFailedTests} failed, ${result.numPendingTests} pending.`;
  console.log(`::notice title=Jest summary::${safe(summary)}`);
  let emitted = 0;
  let totalFailures = 0;
  for (const suite of result.testResults || []) {
    if (suite.status !== 'failed') continue;
    const failed = (suite.assertionResults || []).filter((test) => test.status === 'failed');
    const items = failed.length ? failed.map((test) => test.fullName) : ['Suite failed before tests ran'];
    for (const name of items) {
      totalFailures++;
      if (emitted++ >= 8) continue;
      // The suite filename and test names are defined in repository test sources.
      const suiteName = path.basename(suite.name || 'unknown');
      console.log(`::error title=Jest failure::${safe(`${suiteName}: ${name}`)}`);
    }
  }
  if (totalFailures > 8) console.log(`::notice::${totalFailures - 8} additional failed tests or suites omitted from annotations.`);
} catch (error) {
  console.log('::warning title=Jest report unavailable::The JSON result could not be read; inspect the original job log.');
  process.exit(1);
}
