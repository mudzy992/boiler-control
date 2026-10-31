#!/usr/bin/env python3
"""FEAT-6 anchored mutation checks.

Svaka mutacija ima jedinstven anchor (assert count == 1), mijenja stvarni
backend kod, pokrece ciljani Jest i vraca fajl u prvobitno stanje. Prolazak
testova bez mutacije nije dovoljan; svaka mutacija mora pasti.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"

MUTATIONS = [
    (
        "owner_scope",
        BACKEND / "src/modules/Dashboard/dashboard.service.ts",
        "where: { id: homeProfileId, userId },",
        "where: { id: homeProfileId },",
        ["src/modules/Dashboard/tests/dashboard-export.spec.ts"],
    ),
    (
        "csv_formula_neutralization",
        BACKEND / "src/common/csv.ts",
        "const safe = FORMULA_PREFIX.test(value) ? `'${value}` : value;",
        "const safe = value;",
        ["src/common/tests/csv.spec.ts"],
    ),
    (
        "v2_default_off",
        BACKEND / "src/modules/Dashboard/analytics-export.ts",
        "if (raw === undefined) return false;",
        "if (raw === undefined) return true;",
        ["src/modules/Dashboard/tests/analytics-export.spec.ts"],
    ),
    (
        "timezone_buckets",
        BACKEND / "src/modules/Dashboard/analytics-export.ts",
        "const key = exportBucketKey(event.timestampStart, zone, bucket);",
        "const key = exportBucketKey(event.timestampStart, 'UTC', bucket);",
        ["src/modules/Dashboard/tests/analytics-export.spec.ts"],
    ),
    (
        "max_rows_rejection",
        BACKEND / "src/modules/Dashboard/dashboard.service.ts",
        "const maxRows = analyticsExportMaxRows();",
        "const maxRows = Number.MAX_SAFE_INTEGER;",
        ["src/modules/Dashboard/tests/dashboard-export.spec.ts"],
    ),
]


def run_jest(paths: list[str]) -> int:
    cmd = ["npm", "test", "--", "--runInBand", "--silent", *paths]
    return subprocess.run(cmd, cwd=BACKEND, check=False).returncode


def main() -> int:
    failures: list[str] = []
    for name, path, old, new, tests in MUTATIONS:
        original = path.read_text(encoding="utf-8")
        count = original.count(old)
        if count != 1:
            print(f"ANCHOR FAIL {name}: expected 1 occurrence, found {count}")
            failures.append(name)
            continue
        try:
            path.write_text(original.replace(old, new), encoding="utf-8")
            code = run_jest(tests)
            if code == 0:
                print(f"MUTATION SURVIVED {name}")
                failures.append(name)
            else:
                print(f"MUTATION KILLED {name} (jest exit {code})")
        finally:
            path.write_text(original, encoding="utf-8")
    if failures:
        print("FAILED:", ", ".join(failures))
        return 1
    print("All FEAT-6 mutations killed and anchors unique.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
