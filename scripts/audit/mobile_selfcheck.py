#!/usr/bin/env python3
"""Provjera minimalnih Markdown markera mobilnog audita, bez semantičke evaluacije."""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
AUDIT = ROOT / 'docs/audit/mobile'
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
        nxt = re.search(r'^#{2,3} ', text[match.end():], re.M)
        end = match.end() + nxt.start() if nxt else len(text)
        yield match, text[match.start():end]


def run() -> dict:
    issues = []
    for name in FILES:
        if not (AUDIT / name).is_file():
            issues.append(f'nedostaje dokument {name}')

    counts: dict[str, int] = {}
    finding_ids: list[str] = []
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
            elif 'Pouzdanost' not in block:
                issues.append(f'{name} [{match.group(1)}]: nedostaje oznaka pouzdanosti')

    plan = AUDIT / '07-implementation-plan.md'
    steps = 0
    plan_ids: set[str] = set()
    if plan.is_file():
        text = plan.read_text(encoding='utf-8')
        matches = list(re.finditer(r'^### (\d+\.\d+\w*)\b[^\n]*', text, re.M))
        steps = len(matches)
        for match in matches:
            nxt = re.search(r'^#{2,3} ', text[match.end():], re.M)
            end = match.end() + nxt.start() if nxt else len(text)
            block = text[match.start():end]
            missing = [m for m in PLAN_MARKERS if m not in block]
            if missing:
                issues.append(f'plan {match.group(1)}: nedostaju {", ".join(missing)}')
        plan_ids = set(re.findall(r'\bMO2-\d+\b', text))

    backlog = AUDIT / '06-improvements-backlog.md'
    backlog_ids: set[str] = set()
    if backlog.is_file():
        backlog_ids = set(re.findall(r'^\| (MO2-\d+) \|', backlog.read_text(encoding='utf-8'), re.M))
    if backlog_ids and backlog_ids != plan_ids:
        issues.append(f'crosswalk: razlika backlog/plan {sorted(backlog_ids ^ plan_ids)}')

    # svaki nalaz MO-xxx mora biti spomenut barem jednom u backlogu ili planu
    refs = ''
    for name in ('06-improvements-backlog.md', '07-implementation-plan.md',
                 '05-backend-plan-integration.md'):
        p = AUDIT / name
        refs += p.read_text(encoding='utf-8') if p.is_file() else ''
    orphan = sorted(f for f in finding_ids if f not in refs)
    if orphan:
        issues.append(f'nalazi bez reference u backlogu/planu: {orphan}')

    return {
        'documents_expected': len(FILES),
        'findings_by_document': counts,
        'finding_ids': sorted(finding_ids),
        'plan_steps': steps,
        'backlog_ids': sorted(backlog_ids),
        'issues': issues,
        'limitation': ('Provjerava samo oznake, naslove i crosswalk; ne potvrđuje tačnost dokaza, '
                       'sadržaj, prolaznost testova, sve putanje ni odsustvo tajni.'),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--json', action='store_true', help='Ispiši strukturirani sažetak.')
    args = parser.parse_args()
    r = run()
    if args.json:
        print(json.dumps(r, ensure_ascii=False, indent=2))
    else:
        print(f"Dokumenata očekivano: {r['documents_expected']}; "
              f"nalaza: {sum(r['findings_by_document'].values())}; "
              f"plan koraka: {r['plan_steps']}; backlog stavki: {len(r['backlog_ids'])}; "
              f"formalnih praznina: {len(r['issues'])}.")
        for issue in r['issues']:
            print('-', issue)
        print(r['limitation'])
    return 1 if r['issues'] else 0


if __name__ == '__main__':
    raise SystemExit(main())
