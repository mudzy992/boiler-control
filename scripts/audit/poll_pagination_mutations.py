#!/usr/bin/env python3
"""PERF-2: anchored mutation provjera bounded pollinga.

Svaka mutacija mora imati jedinstven anchor u trenutnom kodu i mora biti
"ubijena" od strane ciljanih Jest testova. Skripta uvijek vraca originalne
fajlove, cak i kad mutacija prezivi ili Jest padne.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SERVICE = ROOT / "backend/src/modules/ThermostatPoll/thermostat.polling.service.ts"
CONFIG = ROOT / "backend/src/modules/ThermostatPoll/polling-pagination.ts"
BACKEND = ROOT / "backend"

TESTS = [
    "src/modules/ThermostatPoll/tests/polling-pagination.spec.ts",
    "src/modules/ThermostatPoll/tests/thermostat-polling-pagination.spec.ts",
    "src/modules/ThermostatPoll/tests/thermostat-polling-metrics.spec.ts",
]

MUTATIONS = [
    (
        "wrong_default_off",
        CONFIG,
        "if (raw === undefined) return true;",
        "if (raw === undefined) return false;",
    ),
    (
        "batch_hard_cap_removed",
        CONFIG,
        "export const HARD_POLL_BATCH_SIZE = 500;",
        "export const HARD_POLL_BATCH_SIZE = 5000;",
    ),
    (
        "take_removed",
        SERVICE,
        "take: batchSize,",
        "take: undefined,",
    ),
    (
        "relation_include_restored",
        SERVICE,
        "select: POLL_DEVICE_SELECT,",
        "include: { user: true },",
    ),
    (
        "short_page_break_removed",
        SERVICE,
        "if (devices.length < batchSize) break;",
        "if (false) break;",
    ),
    (
        "order_desc",
        SERVICE,
        "orderBy: { id: 'asc' },",
        "orderBy: { id: 'desc' },",
    ),
    (
        "cursor_first_instead_of_last",
        SERVICE,
        "cursor = devices[devices.length - 1].id;",
        "cursor = devices[0].id;",
    ),
    (
        "device_error_swallowed",
        SERVICE,
        "return 'failed';",
        "return 'success';",
    ),
]


def run_tests() -> bool:
    proc = subprocess.run(
        ["npx", "jest", *TESTS, "--runInBand", "--silent"],
        cwd=BACKEND,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    if proc.returncode != 0:
        print(proc.stdout[-4000:])
    return proc.returncode != 0


def main() -> int:
    if "--help" in sys.argv:
        print("Usage: python3 scripts/audit/poll_pagination_mutations.py")
        print("PERF-2 anchored mutation checks. Exit 0 = all killed, 1 = survived, 2 = bad anchor.")
        return 0
    originals = {path: path.read_text(encoding="utf-8") for path in {SERVICE, CONFIG}}
    for name, path, old, _new in MUTATIONS:
        count = originals[path].count(old)
        if count != 1:
            print(f"[mutations] anchor nije jedinstven za {name}: {count}", file=sys.stderr)
            return 2
    killed = 0
    try:
        for name, path, old, new in MUTATIONS:
            original = originals[path]
            path.write_text(original.replace(old, new, 1), encoding="utf-8")
            try:
                died = run_tests()
            finally:
                path.write_text(original, encoding="utf-8")
            print(f"[mutations] {name}: {'KILLED' if died else 'SURVIVED'}")
            if died:
                killed += 1
            else:
                return 1
    finally:
        for path, text in originals.items():
            path.write_text(text, encoding="utf-8")
    print(f"[mutations] {killed}/{len(MUTATIONS)} killed")
    return 0 if killed == len(MUTATIONS) else 1


if __name__ == "__main__":
    raise SystemExit(main())
