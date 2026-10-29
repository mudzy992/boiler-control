#!/usr/bin/env node
/* Summarise npm audit JSON without printing environment, raw logs or registry content. */
'use strict';
const fs = require('node:fs');
if (process.argv.includes('--help')) {
  console.log('Upotreba: node scripts/audit/npm_audit_summary.cjs <npm-audit.json>\nČita postojeći npm audit JSON i ispisuje samo zbir, sigurne nazive paketa, ozbiljnost, da li su direktni i GHSA identifikatore. Ne pokreće npm, ne mijenja pakete i ne ispisuje tajne ni sirove logove.');
  process.exit(0);
}
if (process.argv.length !== 3) { console.error('Potrebna je putanja do npm audit JSON-a; pogledajte --help.'); process.exit(2); }
try {
  const report=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
  if (report.error || !report.metadata?.vulnerabilities || !report.vulnerabilities || typeof report.vulnerabilities !== 'object') throw new Error('invalid');
  const counts={};
  for (const key of ['info','low','moderate','high','critical','total']) {
    const value=report.metadata.vulnerabilities[key];
    if (!Number.isInteger(value) || value<0) throw new Error('invalid');
    counts[key]=value;
  }
  const packages=Object.entries(report.vulnerabilities).map(([name,entry])=>{
    if (!/^(?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/i.test(name) || !['info','low','moderate','high','critical'].includes(entry.severity) || typeof entry.isDirect !== 'boolean' || !Array.isArray(entry.via)) throw new Error('invalid');
    const advisories=[...new Set(entry.via.filter(x=>x && typeof x==='object').map(x=>(String(x.url||'').match(/\/advisories\/(GHSA-[a-z0-9-]+)$/i)||[])[1]).filter(Boolean))].sort();
    return {name,severity:entry.severity,direct:entry.isDirect,advisories};
  }).sort((a,b)=>a.name.localeCompare(b.name));
  console.log(JSON.stringify({scope:'npm audit reported packages; severity is advisory metadata, exploitability not established',counts,packages},null,2));
} catch { console.error('Nije moguće obraditi npm audit JSON; sirovi izlaz nije ispisan.'); process.exitCode=1; }
