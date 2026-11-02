#!/usr/bin/env node
'use strict';

/**
 * MO2-14: inventory NativeBase imports and the JSX props used by each imported
 * component. This is a read-only audit helper; it never rewrites application
 * files. `--check` is the final migration guard and fails while imports remain.
 */

const fs = require('fs');
const path = require('path');
const parser = require('../../mobile/node_modules/@babel/parser');

const root = path.resolve(__dirname, '../..');
const mobileRoot = path.join(root, 'mobile');
const args = new Set(process.argv.slice(2));

if (args.has('--help')) {
  console.log(
    [
      'Usage:',
      '  node scripts/audit/mobile_nativebase_inventory.cjs',
      '  node scripts/audit/mobile_nativebase_inventory.cjs --json',
      '  node scripts/audit/mobile_nativebase_inventory.cjs --check',
      '',
      'Default output is a compact component/prop inventory. --json emits the',
      'full file inventory. --check exits 1 when a NativeBase import remains.',
    ].join('\n'),
  );
  process.exit(0);
}

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolute);
    return /\.[jt]sx?$/.test(entry.name) ? [absolute] : [];
  });
}

function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'loc' || key === 'start' || key === 'end') continue;
    if (Array.isArray(value)) {
      for (const child of value) walk(child, visit);
    } else {
      walk(value, visit);
    }
  }
}

function jsxName(node) {
  if (!node) return null;
  if (node.type === 'JSXIdentifier') return node.name;
  if (node.type === 'JSXMemberExpression') {
    return `${jsxName(node.object)}.${jsxName(node.property)}`;
  }
  return null;
}

const files = [...sourceFiles(path.join(mobileRoot, 'src'))];
if (fs.existsSync(path.join(mobileRoot, 'App.tsx'))) {
  files.push(path.join(mobileRoot, 'App.tsx'));
}

const inventory = [];
const components = new Map();

for (const file of files.sort()) {
  const source = fs.readFileSync(file, 'utf8');
  if (!source.includes('native-base')) continue;
  const ast = parser.parse(source, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
  });
  const imports = new Set();
  const importLines = [];
  walk(ast, (node) => {
    if (
      node.type === 'ImportDeclaration' &&
      node.source.type === 'StringLiteral' &&
      node.source.value === 'native-base'
    ) {
      importLines.push(node.loc.start.line);
      for (const specifier of node.specifiers) {
        if (specifier.type === 'ImportSpecifier') imports.add(specifier.local.name);
      }
    }
  });
  if (imports.size === 0) continue;

  const relative = path.relative(root, file);
  const usedProps = new Map();
  walk(ast, (node) => {
    if (node.type !== 'JSXOpeningElement') return;
    const name = jsxName(node.name);
    const rootName = name?.split('.')[0];
    if (!rootName || !imports.has(rootName)) return;
    if (!usedProps.has(name)) usedProps.set(name, new Set());
    const bucket = usedProps.get(name);
    if (!components.has(name)) components.set(name, new Set());
    const componentBucket = components.get(name);
    for (const attribute of node.attributes) {
      const prop =
        attribute.type === 'JSXAttribute'
          ? attribute.name.name
          : `{${attribute.type}}`;
      bucket.add(prop);
      componentBucket.add(prop);
    }
  });

  inventory.push({
    file: relative,
    lines: importLines,
    imports: [...imports].sort(),
    jsx: Object.fromEntries(
      [...usedProps].map(([name, props]) => [name, [...props].sort()]),
    ),
  });
}

const summary = Object.fromEntries(
  [...components]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, props]) => [name, [...props].sort()]),
);

if (args.has('--json')) {
  console.log(JSON.stringify({ files: inventory, components: summary }, null, 2));
} else {
  console.log(`NativeBase files: ${inventory.length}`);
  for (const entry of inventory) {
    console.log(`${entry.file}: ${entry.imports.join(', ')}`);
  }
  console.log('\nComponent props:');
  console.log(JSON.stringify(summary, null, 2));
}

if (args.has('--check') && inventory.length > 0) {
  console.error(`MO2-14 guard: ${inventory.length} NativeBase imports remain.`);
  process.exit(1);
}
