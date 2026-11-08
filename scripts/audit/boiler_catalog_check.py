#!/usr/bin/env python3
"""Provjera kataloga bojlera (`docs/audit/backend/boiler-catalog.json`).

Katalog je sigurnosni podatak: iz njega aplikacija odlučuje smije li uopšte
savjetovati snižavanje polazne. Zato svaki zapis mora biti ili **potvrđen iz
priručnika** (tada ima izvor i brojeve) ili **otvoreno nepotvrđen** (tada nema
izmišljenih brojeva). Ova skripta to provjerava.

Provjere:
  1. JSON se parsira, ima `version` i `envelope`.
  2. `id` je jedinstven.
  3. `dhw` i `specStatus` su iz dozvoljenih skupova.
  4. VERIFIED_MANUAL  ⇒ ima `source` i numeric `heatingFlowMinC/MaxC`.
  5. TO_VERIFY        ⇒ NEMA numeričkih granica (da se ništa ne izmisli).
  6. Brojevi su u fizički smislenim rasponima i min < max.
  7. Ako je PTV protočan/cilindar i krugovi su odvojeni, PTV granice postoje.
  8. Raspon proizvoda (envelope) je 30–55 i nije gađen katalogom.

Izlazni kod 1 pri bilo kojoj grešci. Bez mreže i baze.

Upotreba:
    python3 scripts/audit/boiler_catalog_check.py [--json] [--help]
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

CATALOG = Path(__file__).resolve().parents[2] / "docs" / "audit" / "backend" / "boiler-catalog.json"

DHW_KINDS = {"INSTANT", "INTEGRATED_CYLINDER", "EXTERNAL_CYLINDER", "NONE"}
SPEC_STATUS = {"VERIFIED_MANUAL", "PARTIAL", "TO_VERIFY"}
NUMERIC_FLOW_FIELDS = ("heatingFlowMinC", "heatingFlowMaxC", "heatingFlowFactoryC")
NUMERIC_DHW_FIELDS = ("dhwTempMinC", "dhwTempMaxC")


def main() -> int:
    args = sys.argv[1:]
    if "--help" in args:
        print(__doc__)
        return 0
    as_json = "--json" in args
    bad_args = [a for a in args if a not in ("--json", "--help")]
    if bad_args:
        print(f"Nepoznat argument {bad_args[0]!r}; koristite --help", file=sys.stderr)
        return 2

    problems: list[str] = []
    stats = {"entries": 0, "verified": 0, "to_verify": 0, "brands": 0}

    try:
        data = json.loads(CATALOG.read_text(encoding="utf-8"))
    except FileNotFoundError:
        print(f"Ne postoji: {CATALOG}", file=sys.stderr)
        return 2
    except json.JSONDecodeError as exc:
        print(f"JSON nije ispravan: {exc}", file=sys.stderr)
        return 1

    env = data.get("envelope") or {}
    if env.get("appHeatingFlowMinC") != 30 or env.get("appHeatingFlowMaxC") != 55:
        problems.append("envelope mora biti 30–55 (odluka vlasnika 2026-11-08)")

    seen_ids: set[str] = set()
    for brand in data.get("brands", []):
        stats["brands"] += 1
        brand_name = brand.get("brand")
        if not brand_name:
            problems.append("postoji brend bez imena")
            continue
        for fam in brand.get("families", []):
            stats["entries"] += 1
            fid = fam.get("id")
            where = f"{brand_name}/{fid or '?'}"
            if not fid:
                problems.append(f"{brand_name}: zapis bez `id`")
            elif fid in seen_ids:
                problems.append(f"duplikat `id`: {fid}")
            else:
                seen_ids.add(fid)

            dhw = fam.get("dhw")
            if dhw not in DHW_KINDS:
                problems.append(f"{where}: `dhw` = {dhw!r} nije u {sorted(DHW_KINDS)}")

            status = fam.get("specStatus")
            if status not in SPEC_STATUS:
                problems.append(f"{where}: `specStatus` = {status!r} nije u {sorted(SPEC_STATUS)}")
            elif status == "VERIFIED_MANUAL":
                stats["verified"] += 1
                if not fam.get("source"):
                    problems.append(f"{where}: VERIFIED bez `source`")
                if fam.get("heatingFlowMinC") is None or fam.get("heatingFlowMaxC") is None:
                    problems.append(f"{where}: VERIFIED bez granica polazne")
            elif status == "TO_VERIFY":
                stats["to_verify"] += 1
                invented = [f for f in NUMERIC_FLOW_FIELDS if fam.get(f) is not None]
                if invented:
                    problems.append(
                        f"{where}: TO_VERIFY ne smije imati izmišljene granice ({', '.join(invented)})"
                    )

            lo, hi = fam.get("heatingFlowMinC"), fam.get("heatingFlowMaxC")
            if lo is not None and hi is not None:
                if lo >= hi:
                    problems.append(f"{where}: heatingFlowMinC {lo} ≥ heatingFlowMaxC {hi}")
                if not (20 <= lo <= 60):
                    problems.append(f"{where}: donja granica polazne {lo} °C je izvan 20–60")
                if not (40 <= hi <= 95):
                    problems.append(f"{where}: gornja granica polazne {hi} °C je izvan 40–95")

            dlo, dhi = fam.get("dhwTempMinC"), fam.get("dhwTempMaxC")
            if dlo is not None and dhi is not None and dlo >= dhi:
                problems.append(f"{where}: dhwTempMinC {dlo} ≥ dhwTempMaxC {dhi}")

            separate = fam.get("separateHeatingDhwSettings")
            if status == "VERIFIED_MANUAL" and dhw in ("INSTANT", "INTEGRATED_CYLINDER"):
                if separate is None:
                    problems.append(
                        f"{where}: potvrđen model sa PTV-om, a `separateHeatingDhwSettings` nije naveden"
                    )
                elif separate is True and (dlo is None or dhi is None):
                    problems.append(
                        f"{where}: krugovi odvojeni i PTV postoji, a PTV granice nisu navedene"
                    )
            if status == "TO_VERIFY" and separate is not None:
                problems.append(
                    f"{where}: TO_VERIFY ne smije tvrditi odvojenost krugova (vrijednost {separate!r})"
                )

    rules = data.get("rules") or {}
    if "dhwSafety" not in rules:
        problems.append("nedostaje `rules.dhwSafety` — bez njega aplikacija ne zna kad NE smije savjetovati")

    result = {
        "brands": stats["brands"],
        "entries": stats["entries"],
        "verified": stats["verified"],
        "to_verify": stats["to_verify"],
        "problems": problems,
    }

    if as_json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print("Katalog bojlera — provjera")
        print(f"  brendova:        {stats['brands']}")
        print(f"  zapisa:          {stats['entries']}")
        print(f"    potvrđeno:     {stats['verified']} (iz priručnika)")
        print(f"    za potvrdu:    {stats['to_verify']} (bez izmišljenih brojeva)")
        if problems:
            print(f"  PROBLEMA ({len(problems)}):")
            for p in problems:
                print(f"    - {p}")
        else:
            print("  nema problema")

    ok = not problems
    if not as_json:
        print("Katalog ispravan." if ok else "Katalog NIJE ispravan.")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
