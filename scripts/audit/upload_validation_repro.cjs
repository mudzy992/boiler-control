#!/usr/bin/env node
/* Offline file-storage audit using synthetic bytes and a disposable temp directory. */
'use strict';
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
const assert = require('node:assert/strict');
if (process.argv.includes('--help')) {
  console.log('Upotreba: node scripts/audit/upload_validation_repro.cjs\nIzolovano provjerava stvarni FileStorageService na sintetičkim bajtovima u privremenom direktoriju koji potom briše. Ne pokreće HTTP/guard, bazu, mrežu ni produkcijski storage. Potrebne backend npm zavisnosti.');
  process.exit(0);
}
if (process.argv.length !== 2) { console.error('Nepoznat argument; koristite --help'); process.exit(2); }
const root = path.resolve(__dirname, '../..');
process.env.TS_NODE_PROJECT = path.join(root, 'backend/tsconfig.json');
require(path.join(root, 'backend/node_modules/ts-node/register/transpile-only'));
const { FileStorageService, PDF_MAX_SIZE_BYTES } = require(path.join(root, 'backend/src/common/file-storage.service.ts'));
async function main() {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'boiler-upload-audit-'));
  process.env.UPLOAD_ROOT_PATH = tmp;
  try {
    const service = new FileStorageService();
    const buffer = Buffer.from('synthetic non-PDF content', 'utf8');
    const file = { buffer, mimetype: 'application/pdf', size: buffer.length, originalname: '../example.pdf' };
    const saved = await service.storeGasInvoicePdf(1, file);
    assert.deepEqual(await fs.readFile(path.join(tmp, saved.relativePath)), buffer);
    assert.equal(saved.originalName, 'example.pdf');
    const statuses = {};
    for (const [name, operation] of [
      ['disallowed_mime', () => service.storeGasInvoicePdf(1, { ...file, mimetype: 'text/plain' })],
      ['oversized_metadata', () => service.storeGasInvoicePdf(1, { ...file, size: PDF_MAX_SIZE_BYTES + 1 })],
      ['parent_traversal', () => service.deleteFile('../outside')],
    ]) {
      try { await operation(); statuses[name] = 'accepted'; }
      catch (error) { statuses[name] = error.getStatus?.() ?? 'unknown'; }
      assert.equal(statuses[name], 400);
    }
    console.log(JSON.stringify({scope: 'actual FileStorageService, synthetic bytes, temporary local storage; no HTTP, guard, DB or production files', nonPdfWithPdfMimeStored: true, originalNameSanitized: true, rejected: statuses}, null, 2));
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}
main().catch(() => { console.error('Reprodukcija nije uspjela; provjerite zavisnosti i dozvole privremenog direktorija.'); process.exitCode = 1; });
