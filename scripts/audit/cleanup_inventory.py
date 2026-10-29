#!/usr/bin/env python3
"""List tracked documentation cleanup candidates and tracked references, without modifying files."""
import argparse
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args()
    paths = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode().split('\0')
    paths = [p for p in paths if p]
    def candidate(p):
        name = Path(p).name
        return p.startswith('docs/internal/') or (p.endswith('.md') and (
            re.match(r'^(PHASE_|P2|MIGRATION_)', name) or
            re.search(r'(_COMPLETE|_SUMMARY)\.md$', name)))
    candidates = [p for p in paths if candidate(p)]
    # Do not read environment files, logs, binary assets, lockfiles or generated content.
    suffixes = {'.md', '.ts', '.tsx', '.js', '.jsx', '.json', '.yml', '.yaml', '.sh', '.html', '.css'}
    searchable = [p for p in paths if Path(p).suffix in suffixes or Path(p).name in {'Dockerfile', 'Makefile'}]
    contents = {}
    for path in searchable:
        try:
            contents[path] = (ROOT / path).read_text(encoding='utf-8')
        except (OSError, UnicodeError):
            continue
    print('Kandidat\tReference izvan skupa kandidata (samo putanje)')
    for path in candidates:
        name = Path(path).name
        refs = [source for source, text in contents.items()
                if source != path and source not in candidates and (path in text or name in text)]
        print(path + '\t' + (', '.join(refs) if refs else '—'))
    print(f'\nUkupno: {len(candidates)}; reference zahtijevaju ručnu provjeru.')

if __name__ == '__main__':
    main()
