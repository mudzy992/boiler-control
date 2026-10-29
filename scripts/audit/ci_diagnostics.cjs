#!/usr/bin/env node
// Publish structured diagnostics only; never print source snippets or error values.
const fs = require('node:fs');
const path = require('node:path');
if (process.argv.includes('--help')) {
  console.log('Usage: node scripts/audit/ci_diagnostics.cjs <eslint|tsc> <result-file>');
  process.exit(0);
}
const [mode, filename] = process.argv.slice(2);
const escape = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
try {
  const input = fs.readFileSync(filename, 'utf8');
  let records = [];
  if (mode === 'eslint') {
    for (const file of JSON.parse(input)) {
      for (const m of file.messages) {
        if (m.severity !== 2) continue;
        const relative = path.relative(process.cwd(), file.filePath);
        if (!/^[\w./-]+$/.test(relative)) continue;
        const rule = typeof m.ruleId === 'string' && /^[\w@/-]+$/.test(m.ruleId) ? m.ruleId : 'parse-error';
        records.push(`${relative}:${Number(m.line) || 0} ${rule}`);
      }
    }
  } else if (mode === 'tsc') {
    for (const line of input.split('\n')) {
      const match = line.match(/^([\w./-]+)\((\d+),(\d+)\): error (TS\d+):/);
      if (match) records.push(`${match[1]}:${match[2]}:${match[3]} ${match[4]}`);
    }
  } else throw new Error('Unsupported mode');
  console.log(`::notice title=CI diagnostics::${escape(`${mode}: ${records.length} reported errors`)}`);
  for (const record of records.slice(0, 8)) console.log(`::error title=CI diagnostic::${escape(record)}`);
  if (records.length > 8) console.log(`::notice::${records.length - 8} additional diagnostics omitted.`);
} catch {
  console.log('::warning title=CI diagnostics::Could not parse diagnostics.');
  process.exitCode = 1;
}
