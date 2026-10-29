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
  function diagnostics(message) {
    // Emit only allowlisted diagnostics, never arbitrary test output or values.
    const text = String(message || '').replace(/\x1b\[[0-9;]*m/g, '');
    const hints = [];
    for (const code of new Set(text.match(/TS\d{4}/g) || [])) hints.push(code);
    for (const match of text.matchAll(/Cannot find module ['"]([^'"\r\n]+)['"]/g)) {
      if (/^[\w./@-]+$/.test(match[1])) hints.push(`missing module ${match[1]}`);
    }
    for (const kind of ['PrismaClientInitializationError', 'PrismaClientKnownRequestError', 'SyntaxError', 'TypeError', 'ReferenceError', 'Jest encountered an unexpected token', 'Exceeded timeout', 'Nest can\'t resolve dependencies']) {
      if (text.includes(kind)) hints.push(kind);
    }
    return [...new Set(hints)].slice(0, 4).join('; ');
  }
  for (const suite of result.testResults || []) {
    if (suite.status !== 'failed') continue;
    const failed = (suite.assertionResults || []).filter((test) => test.status === 'failed');
    const items = failed.length ? failed.map((test) => ({name: test.fullName, message: (test.failureMessages || []).join('\n')})) : [{name: 'Suite failed before tests ran', message: suite.message}];
    for (const item of items) {
      totalFailures++;
      if (emitted++ >= 8) continue;
      const suiteName = path.basename(suite.name || 'unknown');
      const detail = diagnostics(item.message);
      console.log(`::error title=Jest failure::${safe(`${suiteName}: ${item.name}${detail ? ` [${detail}]` : ''}`)}`);
    }
  }
  if (totalFailures > 8) console.log(`::notice::${totalFailures - 8} additional failed tests or suites omitted from annotations.`);
} catch (error) {
  console.log('::warning title=Jest report unavailable::The JSON result could not be read; inspect the original job log.');
  process.exit(1);
}
