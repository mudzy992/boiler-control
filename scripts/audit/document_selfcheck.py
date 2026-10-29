#!/usr/bin/env python3
"""Provjera minimalnih Markdown markera audita, bez semantičke evaluacije."""
from __future__ import annotations
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
AUDIT = ROOT / 'docs/audit/backend'
FILES = [f'{i:02d}-{name}.md' for i, name in enumerate([
    'inventory', 'api-catalog', 'data-model', 'findings', 'weather',
    'formulas', 'redis-workers', 'security', 'improvements-backlog',
    'implementation-plan'], start=1)]
REQUIRED = ['Ozbiljnost:', 'Pouzdanost:', 'Gdje:', 'Dokaz:',
            'Preporuka:', 'Kako provjeriti', 'Trud:', 'Zavisnosti:']
PLAN_MARKERS = ['**Cilj/fajlovi:**', '**Migracija/rollback, flag:**',
                '**Testovi:**', '**Skripte:**', '**Prihvat/trud/kompatibilnost/zavisnosti:**']

def run():
    issues = []
    for name in FILES:
        if not (AUDIT / name).is_file():
            issues.append(f'nedostaje dokument {name}')
    counts = {}
    for name in FILES:
        path = AUDIT / name
        if not path.is_file():
            continue
        text = path.read_text(encoding='utf-8')
        if not re.search(r'^## Otvorena pitanja[^\n]*$', text, re.M):
            issues.append(f'{name}: nedostaje naslov otvorenih pitanja')
        matches = list(re.finditer(r'^### \[([^]]+)\].*$', text, re.M))
        counts[name] = len(matches)
        for match in matches:
            next_heading = re.search(r'^#{2,3} ', text[match.end():], re.M)
            end = match.end() + next_heading.start() if next_heading else len(text)
            block = text[match.start():end]
            missing = [marker for marker in REQUIRED if marker not in block]
            if missing:
                issues.append(f'{name} [{match.group(1)}]: nedostaju {", ".join(missing)}')
    plan = AUDIT / '10-implementation-plan.md'
    steps = 0
    if plan.is_file():
        text = plan.read_text(encoding='utf-8')
        matches = list(re.finditer(r'^### (\d+\.\d+\w*)\b[^\n]*', text, re.M))
        steps = len(matches)
        for match in matches:
            next_heading = re.search(r'^#{2,3} ', text[match.end():], re.M)
            end = match.end() + next_heading.start() if next_heading else len(text)
            block = text[match.start():end]
            missing = [marker for marker in PLAN_MARKERS if marker not in block]
            if missing:
                issues.append(f'plan {match.group(1)}: nedostaju {", ".join(missing)}')
    return {'documents_expected': len(FILES), 'findings_by_document': counts,
            'plan_steps': steps, 'issues': issues,
            'limitation': 'Provjerava samo oznake i naslove; ne potvrđuje tačnost, sadržaj, testove, sve putanje ili odsustvo tajni.'}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--json', action='store_true', help='Ispiši strukturirani sažetak.')
    args = parser.parse_args()
    result = run()
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"Dokumenata očekivano: {result['documents_expected']}; nalaza: {sum(result['findings_by_document'].values())}; plan koraka: {result['plan_steps']}; formalnih praznina: {len(result['issues'])}.")
        for issue in result['issues']:
            print('-', issue)
        print(result['limitation'])
    return 1 if result['issues'] else 0

if __name__ == '__main__':
    raise SystemExit(main())
