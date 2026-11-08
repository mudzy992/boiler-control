#!/usr/bin/env python3
"""Provjera potpunosti registra iz `docs/audit/backend/18`.

Registar praznina je koristan samo ako nijedan raniji nalaz nije tiho ispušten.
Ova skripta to provjerava mašinski:

  1. izvuče svaki `F-xx`, `L-xx`, `D-xx` iz `13` i `15` (nalozi),
  2. provjeri da svaki postoji u `18` (registar),
  3. provjeri da `18` ne pominje ID koji nije nigdje definisan (tipfeler),
  4. ispiše statusnu statistiku registra.

Izlazni kod 1 ako bilo šta nedostaje. Bez mreže, baze i izmjene koda.

Upotreba:
    python3 scripts/audit/register_selfcheck.py [--json] [--help]
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parents[2] / "docs" / "audit" / "backend"

SOURCES = {
    "13": BASE / "13-flow-temp-max-audit.md",
    "15": BASE / "15-daily-proposal-audit.md",
    "18": BASE / "18-input-policy-and-gap-register.md",
}

ID_RE = re.compile(r"\b([FLDTICUS])-(\d{1,3})\b")

# F/L/D su nalozi iz 13 i 15; T/I/C/U/S su novi zahtjevi definisani u 18.
DEF_PREFIXES = set("FLD")
NEW_PREFIXES = set("TICUS")
STATUS_RE = re.compile(r"(✅|⚠️|❌|🔒|➖)")

HELP = __doc__


def read(path: Path) -> str:
    if not path.exists():
        print(f"Ne postoji: {path}", file=sys.stderr)
        sys.exit(2)
    return path.read_text(encoding="utf-8")


def ids_in(text: str, prefixes: set[str] | None = None) -> set[str]:
    out: set[str] = set()
    for m in ID_RE.finditer(text):
        if prefixes is not None and m.group(1) not in prefixes:
            continue
        out.add(f"{m.group(1)}-{m.group(2).zfill(2)}")
    return out


def register_rows(text: str) -> list[tuple[str, str]]:
    """Vrati (id, status) za svaki red registra koji počinje ID-om u tabeli."""
    rows = []
    for line in text.splitlines():
        if not line.startswith("|"):
            continue
        m = ID_RE.search(line)
        if not m:
            continue
        status = STATUS_RE.search(line)
        rows.append((m.group(0), status.group(1) if status else "?"))
    return rows


def main() -> int:
    args = sys.argv[1:]
    if "--help" in args:
        print(HELP)
        return 0
    as_json = "--json" in args
    unknown_args = [a for a in args if a not in ("--json", "--help")]
    if unknown_args:
        print(f"Nepoznat argument {unknown_args[0]!r}; koristite --help", file=sys.stderr)
        return 2

    texts = {k: read(v) for k, v in SOURCES.items()}

    defined = ids_in(texts["13"], DEF_PREFIXES) | ids_in(texts["15"], DEF_PREFIXES)
    registered_rows = register_rows(texts["18"])
    registered = [rid for rid, _ in registered_rows]
    registered_set = set(registered)

    missing = sorted(defined - registered_set)
    unknown = sorted(
        rid for rid in registered_set
        if rid.split("-")[0] not in (DEF_PREFIXES | NEW_PREFIXES)
    )
    duplicates = sorted({rid for rid in registered if registered.count(rid) > 1})

    counts: dict[str, int] = {}
    for _, status in registered_rows:
        counts[status] = counts.get(status, 0) + 1

    result = {
        "definisano_u_13_i_15": len(defined),
        "u_registru": len(registered),
        "nedostaje_u_registru": missing,
        "duplikati_u_registru": duplicates,
        "nepoznat_id_u_registru": unknown,
        "status": counts,
    }

    if as_json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print("Provjera registra praznina (docs/audit/backend/18)")
        print(f"  nalaza u 13 i 15:        {len(defined)}")
        print(f"  redova u registru:       {len(registered)}")
        legenda = {"✅": "zatvoreno", "⚠️": "djelimično", "❌": "praznina", "🔒": "blokada", "➖": "van opsega"}
        for mark in ("✅", "⚠️", "❌", "🔒", "➖"):
            if counts.get(mark):
                print(f"    {mark} {legenda[mark]:11s} {counts[mark]}")
        if missing:
            print(f"  NEDOSTAJE u registru ({len(missing)}): {', '.join(missing)}")
        else:
            print("  nijedan nalaz iz 13/15 nije ispušten")
        if duplicates:
            print(f"  DUPLIKAT ID u registru ({len(duplicates)}): {', '.join(duplicates)}")
        else:
            print("  nema duplih ID-eva")
        if unknown:
            print(f"  NEPOZNAT ID u registru ({len(unknown)}): {', '.join(unknown)}")
        else:
            print("  nema ID-a sa nepoznatim prefiksom")

    ok = not missing and not unknown and not duplicates
    if not as_json:
        print("Registar potpun." if ok else "Registar NIJE potpun.")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
