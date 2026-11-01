#!/usr/bin/env python3
"""PERF-1 anchored mutation checks.

Each mutation has a unique anchor, is applied to the real file, runs the
contract Jest suite, and is restored in finally. Exit 0 means every mutation
was killed; exit 1 means a mutation survived; exit 2 means a bad anchor.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
SCHEMA = BACKEND / "prisma/schema.prisma"
MIGRATION = BACKEND / "prisma/migrations/20261101000000_perf1_heating_event_device_timestamp/migration.sql"
BENCHMARK = ROOT / "scripts/audit/perf1_index_benchmark.cjs"

TESTS = ["test/contract/perf1-index.spec.ts"]

MUTATIONS = [
    (
        "schema_composite_removed",
        SCHEMA,
        "  @@index([deviceId, timestampStart(sort: Desc)])\n",
        "",
    ),
    (
        "schema_sort_ascending",
        SCHEMA,
        "@@index([deviceId, timestampStart(sort: Desc)])",
        "@@index([deviceId, timestampStart(sort: Asc)])",
    ),
    (
        "migration_wrong_table",
        MIGRATION,
        'ON "HeatingEvent"("deviceId", "timestampStart" DESC)',
        'ON "WeatherCache"("deviceId", "timestampStart" DESC)',
    ),
    (
        "migration_drops_legacy_index",
        MIGRATION,
        'CREATE INDEX "HeatingEvent_deviceId_timestampStart_idx"',
        'DROP INDEX "HeatingEvent_deviceId_fkey";\nCREATE INDEX "HeatingEvent_deviceId_timestampStart_idx"',
    ),
    (
        "benchmark_weather_stress_decision",
        BENCHMARK,
        "weatherIndexRecommended: weatherNormal.eligible",
        "weatherIndexRecommended: weatherStress.eligible",
    ),
    (
        "benchmark_local_buffers_removed",
        BENCHMARK,
        "sharedHitBlocks + sharedReadBlocks + localHitBlocks + localReadBlocks",
        "sharedHitBlocks + sharedReadBlocks",
    ),
    (
        "benchmark_ci_node_env_guard_removed",
        BENCHMARK,
        "env.NODE_ENV === 'test' &&",
        "true &&",
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
        print("Usage: python3 scripts/audit/perf1_index_mutations.py")
        print("PERF-1 anchored mutation checks. Exit 0 = all killed, 1 = survived, 2 = bad anchor.")
        return 0
    originals = {path: path.read_text(encoding="utf-8") for path in {SCHEMA, MIGRATION, BENCHMARK}}
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
