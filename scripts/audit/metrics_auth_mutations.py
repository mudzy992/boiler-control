#!/usr/bin/env python3
"""SEC-6 anchored mutation checks.

Each mutation must apply to exactly one anchor and be killed by the targeted
Jest suites. Files are restored in finally, even on failure.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"

MUTATIONS = [
    (
        "controller_guard_removed",
        BACKEND / "src/common/metrics.controller.ts",
        "@UseGuards(MetricsAuthGuard)\n@Controller('metrics')",
        "@Controller('metrics')",
    ),
    (
        "guard_fail_open_when_unconfigured",
        BACKEND / "src/common/metrics-auth.guard.ts",
        "    if (!expected) {\n      throw new ServiceUnavailableException(\n        'Metrics authentication is not configured',\n      );\n    }",
        "    if (!expected) {\n      return true;\n    }",
    ),
    (
        "guard_min_length_removed",
        BACKEND / "src/common/metrics-auth.guard.ts",
        "if (token.length < METRICS_AUTH_MIN_LENGTH || /\\s/.test(token)) return null;",
        "if (/\\s/.test(token)) return null;",
    ),
    (
        "guard_cache_control_removed",
        BACKEND / "src/common/metrics-auth.guard.ts",
        "    response.setHeader('Cache-Control', 'no-store');\n",
        "",
    ),
    (
        "reporting_id_label_reintroduced",
        BACKEND / "src/common/reporting.service.ts",
        'output += `reporting_home_health_score ${minHealthScore}\\n`;',
        'output += `reporting_home_health_score{deviceId="1"} ${minHealthScore}\\n`;',
    ),
    (
        "reporting_anomaly_aggregate_min_instead_of_max",
        BACKEND / "src/common/reporting.service.ts",
        "const maxAnomalyRate = Math.max(...reports.map((r) => r.anomalies.rate));",
        "const maxAnomalyRate = Math.min(...reports.map((r) => r.anomalies.rate));",
    ),
    (
        "reporting_log_device_id_reintroduced",
        BACKEND / "src/common/reporting.service.ts",
        "    this.structuredLogger.log('Anomaly recorded for reporting', {\n      module: 'reporting',",
        "    this.structuredLogger.log('Anomaly recorded for reporting', {\n      deviceId,\n      module: 'reporting',",
    ),
]

TESTS = [
    "src/common/tests/metrics-auth.spec.ts",
    "src/common/tests/reporting-sec6.spec.ts",
]


def run_tests() -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["npx", "jest", *TESTS, "--runInBand", "--silent"],
        cwd=BACKEND,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )


def main() -> int:
    if "--help" in sys.argv:
        print("Upotreba: python3 scripts/audit/metrics_auth_mutations.py")
        print("Pokrece SEC-6 anchored mutacije nad metrics guard/reporting kodom.")
        return 0
    if len(sys.argv) != 1:
        print("Nepoznat argument; koristite --help", file=sys.stderr)
        return 2

    baseline = run_tests()
    if baseline.returncode != 0:
        print("[mutations] baseline FAILED")
        print(baseline.stdout[-4000:])
        return 1
    print("[mutations] baseline PASS")

    killed = 0
    for name, path, old, new in MUTATIONS:
        original = path.read_text()
        count = original.count(old)
        if count != 1:
            print(f"[mutations] {name} ANCHOR COUNT {count} != 1")
            return 1
        try:
            path.write_text(original.replace(old, new, 1))
            result = run_tests()
            if result.returncode == 0:
                print(f"[mutations] {name} SURVIVED")
                print(result.stdout[-4000:])
                return 1
            killed += 1
            print(f"[mutations] {name} KILLED")
        finally:
            path.write_text(original)

    restored = run_tests()
    if restored.returncode != 0:
        print("[mutations] post-restore FAILED")
        print(restored.stdout[-4000:])
        return 1
    print(f"[mutations] {killed}/{len(MUTATIONS)} KILLED; post-restore PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
