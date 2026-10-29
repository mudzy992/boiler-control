#!/usr/bin/env python3
"""Read-only backend inventory and documentation marker comparison."""
from __future__ import annotations
import argparse
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / 'backend'


def tracked(pattern: str) -> list[str]:
    result = subprocess.run(['git', 'ls-files', '--', pattern], cwd=ROOT, check=True, text=True, capture_output=True)
    return [line for line in result.stdout.splitlines() if (ROOT / line).is_file()]


def inventory() -> dict:
    sources = tracked('backend/src/*.ts')
    tests = [p for p in tracked('backend/*') if p.endswith('.spec.ts')]
    modules = sorted({p.split('/')[3] for p in sources if p.startswith('backend/src/modules/') and len(p.split('/')) > 4})
    common = sorted(p for p in sources if p.startswith('backend/src/common/') and '/tests/' not in p)
    routes = []
    jobs = []
    pattern = re.compile(r'^\s*@(Get|Post|Put|Patch|Delete|Options|Head|All)\s*\(')
    job_pattern = re.compile(r'^\s*@(Cron|Interval|Timeout)\s*\(')
    for filename in sources:
        for number, line in enumerate((ROOT / filename).read_text(encoding='utf-8').splitlines(), 1):
            match = pattern.match(line)
            if match and filename.endswith('.controller.ts'):
                routes.append({'marker': f'{filename}:{number}', 'verb': match.group(1).upper()})
            match = job_pattern.match(line)
            if match:
                jobs.append({'marker': f'{filename}:{number}', 'kind': match.group(1)})
    models = []
    schema = BACKEND / 'prisma/schema.prisma'
    for number, line in enumerate(schema.read_text(encoding='utf-8').splitlines(), 1):
        match = re.match(r'^(model|enum)\s+(\w+)\s*\{', line)
        if match:
            models.append({'kind': match.group(1), 'name': match.group(2), 'line': number})
    return {'modules': modules, 'common_files': common, 'routes': routes, 'jobs': jobs, 'schema_definitions': models, 'test_files': tests}


def markers(path: Path, prefix: str) -> set[str]:
    if not path.exists():
        return set()
    return set(re.findall(r'<!--\s*' + re.escape(prefix) + r':([^\n]*?)\s*-->', path.read_text(encoding='utf-8')))


def route_row_check(path: Path, expected: set[str]) -> tuple[int, list[str]]:
    """Provjeri oblik označenih tabela, ne semantiku, guardove ili autoritet."""
    rows: dict[str, list[str]] = {}
    errors: list[str] = []
    if not path.exists():
        return 0, ['API katalog ne postoji']
    for line in path.read_text(encoding='utf-8').splitlines():
        match = re.search(r'<!--\s*route:([^\n]*?)\s*-->', line)
        if not match:
            continue
        marker = match.group(1)
        if marker in rows:
            errors.append(f'dupli red {marker}')
        cells = [cell.strip() for cell in line.strip().strip('|').split('|')]
        rows[marker] = cells
        if len(cells) != 8 or any(not cell for cell in cells):
            errors.append(f'neispravan broj/prazne kolone {marker}')
    errors.extend(f'nedostaje red {m}' for m in sorted(expected - rows.keys()))
    errors.extend(f'nepoznat red {m}' for m in sorted(rows.keys() - expected))
    return len(rows), errors


def main() -> int:
    parser = argparse.ArgumentParser(description='List tracked backend modules, common files, route decorators, cron decorators and Prisma definitions, or compare audit markers. No code or database writes.')
    parser.add_argument('--json', action='store_true', help='Print machine-readable source inventory instead of checking documentation markers.')
    args = parser.parse_args()
    data = inventory()
    if args.json:
        print(json.dumps(data, ensure_ascii=False, indent=2))
        return 0
    checks = [
        ('module', set(data['modules']), ROOT / 'docs/audit/backend/01-inventory.md', 'module'),
        ('common', set(data['common_files']), ROOT / 'docs/audit/backend/01-inventory.md', 'common'),
        ('route decorator', {r['marker'] for r in data['routes']}, ROOT / 'docs/audit/backend/02-api-catalog.md', 'route'),
        ('schema definition', {f"{m['kind']}:{m['name']}" for m in data['schema_definitions']}, ROOT / 'docs/audit/backend/03-data-model.md', 'schema'),
    ]
    ok = True
    for name, expected, file, prefix in checks:
        present = markers(file, prefix)
        missing, extra = sorted(expected - present), sorted(present - expected)
        print(f'{name}: source={len(expected)}, ima_marker={len(expected & present)}, nedostaje={len(missing)}, višak={len(extra)}')
        for item in missing:
            print(f'  NEDOSTAJE {item}')
        for item in extra:
            print(f'  VIŠAK {item}')
        ok &= not missing and not extra
    route_count, row_errors = route_row_check(
        ROOT / 'docs/audit/backend/02-api-catalog.md', {r['marker'] for r in data['routes']}
    )
    print(f'API redovi: {route_count}, formalnih grešaka={len(row_errors)}')
    for error in row_errors:
        print(f'  {error}')
    ok &= not row_errors
    print('Napomena: regex provjerava samo markere i neprazne kolone, ne ispravnost opisa, dinamičke rute niti registraciju kontrolera.')
    return 0 if ok else 1


if __name__ == '__main__':
    raise SystemExit(main())
