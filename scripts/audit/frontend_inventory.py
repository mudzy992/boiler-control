#!/usr/bin/env python3
"""Read-only inventar frontend-a: da li svaki fajl stranica/komponenti i svaka ruta ima red u 01-inventory.md."""
from __future__ import annotations
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FE = ROOT / 'frontend/src'
INVENTORY = ROOT / 'docs/audit/frontend/01-inventory.md'


def run():
    pages = sorted(p.name for p in (FE / 'pages').glob('*.tsx'))
    components = sorted(p.name for p in (FE / 'components').glob('*.tsx'))
    app_src = (FE / 'App.tsx').read_text(encoding='utf-8')
    routes = sorted(set(re.findall(r'path="([^"]+)"', app_src)))
    inv = INVENTORY.read_text(encoding='utf-8') if INVENTORY.is_file() else ''
    missing_pages = [p for p in pages if p not in inv]
    missing_components = [c for c in components if c not in inv]
    missing_routes = [r for r in routes if f'`{r}`' not in inv and f"| {r} |" not in inv]
    finding_count = len(re.findall(r'^### \[FE-\d+\]', inv, re.M))
    result = {
        'pages': len(pages),
        'components': len(components),
        'routes': len(routes),
        'missing_pages_in_inventory': missing_pages,
        'missing_components_in_inventory': missing_components,
        'missing_routes_in_inventory': missing_routes,
        'inventory_finding_headers': finding_count,
        'limitation': 'Poklapanje imena nije semantička potvrda potpunosti opisa.',
    }
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--json', action='store_true', help='Ispiši strukturirani sažetak.')
    args = parser.parse_args()
    result = run()
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        ok = not (result['missing_pages_in_inventory'] or result['missing_components_in_inventory']
                  or result['missing_routes_in_inventory'])
        print(f"Stranica: {result['pages']}; komponenti: {result['components']}; ruta: {result['routes']}; "
              f"nedostaju u inventaru: "
              f"stranice={result['missing_pages_in_inventory']}, komponente={result['missing_components_in_inventory']}, "
              f"rute={result['missing_routes_in_inventory']}; "
              f"{'OK' if ok else 'NEUSPJEŠNO'}")
        print(result['limitation'])
    return 0 if ok else 1


if __name__ == '__main__':
    raise SystemExit(main())
