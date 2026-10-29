#!/usr/bin/env python3
"""Provjera minimalnih Markdown markera frontend audita, bez semantičke evaluacije."""
from __future__ import annotations
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
AUDIT = ROOT / 'docs/audit/frontend'
FILES = [
    '01-inventory.md',
    '02-architecture-findings.md',
    '03-security-build.md',
    '04-ux-quality.md',
    '05-backend-plan-integration.md',
    '06-improvements-backlog.md',
    '07-implementation-plan.md',
]
REQUIRED = ['Ozbiljnost:', 'Pouzdanost:', 'Gdje:', 'Dokaz:',
            'Preporuka:', 'Kako provjeriti', 'Trud:', 'Zavisnosti:']
PLAN_MARKERS = ['**Cilj/fajlovi:**', '**Migracija/rollback, flag:**',
                '**Testovi:**', '**Skripte:**', '**Prihvat/trud/kompatibilnost/zavisnosti:**']
FINDING_DOCS = ['02-architecture-findings.md', '03-security-build.md', '04-ux-quality.md']


def finding_blocks(text: str):
    for match in re.finditer(r'^### \[([^]]+)\].*$', text, re.M):
        next_heading = re.search(r'^#{2,3} ', text[match.end():], re.M)
        end = match.end() + next_heading.start() if next_heading else len(text)
        yield match, text[match.start():end]


def run():
    issues = []
    for name in FILES:
        if not (AUDIT / name).is_file():
            issues.append(f'nedostaje dokument {name}')
    counts = {}
    finding_ids = []
    for name in FILES:
        path = AUDIT / name
        if not path.is_file():
            continue
        text = path.read_text(encoding='utf-8')
        if not re.search(r'^## Otvorena pitanja[^\n]*$', text, re.M):
            issues.append(f'{name}: nedostaje naslov otvorenih pitanja')
        matches = list(re.finditer(r'^### \[([^]]+)\].*$', text, re.M))
        counts[name] = len(matches)
        for match, block in finding_blocks(text):
            finding_ids.append(match.group(1))
            if name in FINDING_DOCS:
                missing = [m for m in REQUIRED if m not in block]
                if missing:
                    issues.append(f'{name} [{match.group(1)}]: nedostaju {", ".join(missing)}')
            else:
                # nalazi izvan tri dokumenta s formatom nalaza moraju bar imati pouzdanost
                if 'Pouzdanost' not in block:
                    issues.append(f'{name} [{match.group(1)}]: nedostaje oznaka pouzdanosti')
    plan = AUDIT / '07-implementation-plan.md'
    steps = 0
    plan_ids = set()
    if plan.is_file():
        text = plan.read_text(encoding='utf-8')
        matches = list(re.finditer(r'^### (\d+\.\d+\w*)\b[^\n]*', text, re.M))
        steps = len(matches)
        for match in matches:
            next_heading = re.search(r'^#{2,3} ', text[match.end():], re.M)
            end = match.end() + next_heading.start() if next_heading else len(text)
            block = text[match.start():end]
            missing = [m for m in PLAN_MARKERS if m not in block]
            if missing:
                issues.append(f'plan {match.group(1)}: nedostaju {", ".join(missing)}')
        for m in re.finditer(r'\bFE2-\d+\b', text):
            plan_ids.add(m.group(0))
    backlog = AUDIT / '06-improvements-backlog.md'
    backlog_ids = set()
    if backlog.is_file():
        for m in re.finditer(r'^\| (FE2-\d+) \|', backlog.read_text(encoding='utf-8'), re.M):
            backlog_ids.add(m.group(1))
    if backlog_ids:
        if backlog_ids != plan_ids:
            issues.append(f'crosswalk: backlog {sorted(backlog_ids ^ plan_ids)} ne poklapa plan {sorted(plan_ids)}')
    return {
        'documents_expected': len(FILES),
        'findings_by_document': counts,
        'finding_ids': sorted(finding_ids),
        'plan_steps': steps,
        'backlog_ids': sorted(backlog_ids),
        'issues': issues,
        'limitation': 'Provjerava samo oznake i naslove; ne potvrđuje tačnost, sadržaj, testove, sve putanje ili odsustvo tajni.',
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--json', action='store_true', help='Ispiši strukturirani sažetak.')
    args = parser.parse_args()
    result = run()
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"Dokumenata očekivano: {result['documents_expected']}; nalaza: {sum(result['findings_by_document'].values())}; plan koraka: {result['plan_steps']}; backlog stavki: {len(result['backlog_ids'])}; formalnih praznina: {len(result['issues'])}.")
        for issue in result['issues']:
            print('-', issue)
        print(result['limitation'])
    return 1 if result['issues'] else 0


if __name__ == '__main__':
    raise SystemExit(main())
