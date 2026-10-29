#!/usr/bin/env python3
"""Static import/model/cron hints. No runtime claims, DB access, or file writes."""
from __future__ import annotations
import argparse
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'backend/src'
IMPORT = re.compile(r"(?:\bfrom\s*|\brequire\s*\(\s*|\bimport\s*\(\s*)['\"]([^'\"]+)['\"]")
ACCESS = re.compile(r'\b(?:prisma|tx)\.([a-zA-Z][a-zA-Z0-9]*)\s*\.')
CRON = re.compile(r'@(?:Cron|Interval|Timeout)\s*\(')


def tracked(pattern):
    return subprocess.run(['git','ls-files','--',pattern],cwd=ROOT,check=True,capture_output=True,text=True).stdout.splitlines()


def target_module(file, spec):
    if spec.startswith('.'):
        candidate = (file.parent / spec).resolve()
    elif spec.startswith('src/'):
        candidate = (SRC / spec[4:]).resolve()
    else:
        return None
    try:
        rel = candidate.relative_to(SRC)
    except ValueError:
        return None
    parts = rel.parts
    if len(parts) >= 2 and parts[0] == 'modules':
        return parts[1]
    if parts and parts[0] == 'common':
        return 'common'
    if parts and parts[0] == 'prisma':
        return 'prisma'
    return None


def main():
    p = argparse.ArgumentParser(description='Statički graf direktnih importova modula, Prisma modela i dekorisanih poslova. Ne otkriva dinamički DI, runtime pozive, ownership ili pokrivenost testova.')
    p.add_argument('--json',action='store_true',help='Ispiši JSON umjesto Markdown tabele.')
    args = p.parse_args()
    files = [ROOT / f for f in tracked('backend/src/*.ts') if '/modules/' in f and '/generated/' not in f and '/tests/' not in f]
    module_root = SRC / 'modules'
    module_names = sorted({f.relative_to(module_root).parts[0] for f in files})
    models = {m[0].lower()+m[1:] for m in re.findall(r'^model\s+(\w+)\s*\{',(ROOT/'backend/prisma/schema.prisma').read_text(),re.M)}
    rows = {name:{'module':name,'imports':set(),'models':set(),'jobs':[],'files':0} for name in module_names}
    for f in files:
        rel = f.relative_to(module_root)
        if len(rel.parts) < 2: continue
        row = rows[rel.parts[0]]
        row['files'] += 1
        contents = f.read_text(encoding='utf-8')
        for spec in IMPORT.findall(contents):
            target = target_module(f,spec)
            if target and target != row['module']: row['imports'].add(target)
        row['models'].update(x for x in ACCESS.findall(contents) if x in models)
        for i,line in enumerate(contents.splitlines(),1):
            if CRON.search(line): row['jobs'].append(f'{f.relative_to(ROOT)}:{i}')
    result = []
    for row in rows.values():
        result.append({**row,'imports':sorted(row['imports']),'models':sorted(row['models']),'jobs':sorted(row['jobs'])})
    if args.json:
        print(json.dumps(result,ensure_ascii=False,indent=2))
    else:
        print('| Modul | Praćenih TS | Direktni interni importi | Prisma nazivi u direktnom `prisma`/`tx` pristupu | Deklarisani jobovi |')
        print('|---|---:|---|---|---|')
        for r in result:
            fmt = lambda items: ', '.join(f'`{x}`' for x in items) if items else '—'
            print(f"| `{r['module']}` | {r['files']} | {fmt(r['imports'])} | {fmt(r['models'])} | {fmt(r['jobs'])} |")
        print('\nSamo statički hintovi; tranzitivni DI, aliasi, transakcije drugih naziva, runtime registracija i semantički opseg nisu dokazani.')


if __name__ == '__main__':
    main()
