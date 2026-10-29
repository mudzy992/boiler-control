#!/usr/bin/env python3
"""Objedinjeni prioritet za backend + frontend + mobile backlog.

Prioritet = Impact x Confidence / Effort (ICE). Effort i Confidence se ČITAJU iz
backlog tablica (ne prepisuju se), Impact je eksplicitno dodijeljen u IMPACT_TABLA s
obrazloženjem — tako da je poredak provjerljiv, a ne ručno pogađan.

Skripta je read-only i idempotentna: ne mijenja nijedan fajl.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKLOGS = [
    ('backend', ROOT / 'docs/audit/backend/09-improvements-backlog.md'),
    ('frontend', ROOT / 'docs/audit/frontend/06-improvements-backlog.md'),
    ('mobile', ROOT / 'docs/audit/mobile/06-improvements-backlog.md'),
]
ID_RE = re.compile(r'(SEC|PRIV|FORM|FEAT|PERF|REL|OBS|API|MAINT|FE2|MO2)-\d+')
EFFORT_NUM = {'S': 1.0, 'S/M': 1.5, 'M': 2.0, 'M/L': 2.5, 'L': 3.0}
# Procjena u radnim danima (raspon) po oznaci truda — koristi se za sume u roadmapu.
EFFORT_DAYS = {'S': (0.25, 0.5), 'S/M': (0.5, 1.0), 'M': (2.0, 3.0),
               'M/L': (3.0, 5.0), 'L': (5.0, 8.0)}

# Stavke gdje čisti ICE daje pogrešan signal i gdje ga namjerno nadjačavamo.
# Razlog je uvijek isti: posljedica je ireverzibilna (curenje tajni, gubitak podataka,
# pucanje instaliranih klijenata) pa se ne smije čekati na red po omjeru cijene i koristi.
ICE_OVERRIDE = {
    'SEC-0': ('Talas A', 'Aktivne kredencijale u historiji repozitorija — curenje je '
                          'ireverzibilno. Rotacija je vlasnikova akcija i traje < 1 dan; '
                          'trud L se odnosi na cjelokupan proces, ne na rotaciju.'),
    'SEC-4': ('Talas A', 'Token bez revokacije je usko vezan uz SEC-0 i FE2-2; odgađanje '
                         'ostavlja otvoren put ponovne upotrebe ukradenog tokena.'),
    'MO2-2': ('Talas B', 'Version gate je preduslov za SVE backend promjene ugovora '
                         '(API-1) — bez njega nove rute ruše instalirane verzije.'),
    'API-1': ('Talas B', 'Ugovor o verzijama mora postojati prije bilo koje promjene '
                         'shape-a; inače se krši kompatibilnost unazad.'),
    'API-2': ('Talas B', 'OpenAPI codegen je preduslov za FE2-8 (Talas C) i mobilne tipove; '
                         'po čistom ICE-u pada u Talas E jer je trud L, ali bi tada poredak '
                         'talasa kršio zavisnost — potrošač bi išao prije svog izvora.'),
    'FORM-1': ('Talas C', 'Pogrešna formula daje pogrešnu preporuku koja košta stvarnog '
                          'novca; ali zahtijeva mjerenje i replay pa nije quick win.'),
}

# Impact 1-5: 5 = korisnik gubi podatke/funkciju ili sigurnosni proboj;
# 4 = značajna funkcionalna/sigurnosna degradacija; 3 = pouzdanost/kvalitet;
# 2 = UX/polish; 1 = higijena/dokumentacija.
IMPACT_TABLA = {
    # --- backend ---
    'SEC-0': (5, 'aktivne kredencijale u repozitoriju — direktan proboj'),
    'SEC-1': (5, 'IDOR: čitanje tuđih zapisa'),
    'SEC-2': (5, 'IDOR: mutacija tuđih zapisa'),
    'SEC-3': (4, 'otvoren test endpoint bez limita'),
    'SEC-4': (5, 'token bez revokacije/rotacije'),
    'SEC-5': (4, 'upload bez content sniffing'),
    'SEC-6': (3, 'scrape mreža i logovi'),
    'SEC-7': (3, 'zastarjele zavisnosti'),
    'PRIV-1': (4, 'GDPR izvoz/brisanje nedostaje'),
    'PRIV-2': (2, 'audit log — korisna higijena, nije proboj'),
    'FORM-1': (5, 'pogrešna formula → pogrešna preporuka → stvarni trošak plina'),
    'FEAT-7': (5, 'neparsirano očitanje plina → pogrešna potrošnja'),
    'FEAT-8': (4, 'pogrešan bucket/timezone u historiji'),
    'FEAT-1': (4, 'prognoza je temelj preporuka'),
    'FEAT-2': (2, 'advisory upozorenje, hipotetska vrijednost'),
    'FEAT-3': (3, 'procjena računa'),
    'FEAT-4': (2, 'multi-boiler — rijedak slučaj'),
    'FEAT-5': (3, 'indikator efikasnosti'),
    'FEAT-6': (3, 'prošireni izvozi'),
    'REL-1': (3, 'weather SWR i fallback'),
    'REL-2': (3, 'radnik po uređaju'),
    'REL-3': (4, 'push se gubi bez outboxa'),
    'REL-4': (3, 'izolacija test seeda'),
    'REL-5': (3, 'cache senzora'),
    'REL-6': (3, 'identitet instalacije'),
    'REL-7': (4, 'neprovjeren snapshot mijenja ciklus kotla'),
    'REL-8': (4, 'nearomski upis dana → miješani podaci'),
    'PERF-1': (3, 'indeksi nakon mjerenja'),
    'PERF-2': (3, 'paginacija i N+1'),
    'OBS-1': (4, 'bez metrika nema dijagnoze u produkciji'),
    'API-1': (5, 'promjena ugovora ruši instalirane mobile verzije'),
    'API-2': (4, 'OpenAPI kao izvor tipova'),
    'MAINT-1': (1, 'dokumentacija mrtvog koda'),
    'MAINT-2': (3, 'CI workflowi'),
    'MAINT-3': (3, 'liveness/build/migracije'),
    'MAINT-4': (3, 'test fixturei'),
    # --- frontend ---
    'FE2-1': (4, 'type-check lažno zelen, 12 grešaka'),
    'FE2-2': (5, 'JWT u localStorage bez refresha'),
    'FE2-3': (3, 'mešoviti dohvati + polling bez pauze'),
    'FE2-4': (3, 'bundle 2.972 kB bez splitinga'),
    'FE2-5': (2, 'i18n nepotpun'),
    'FE2-6': (4, 'bez security headera i gzipa'),
    'FE2-7': (4, 'tri suprotne deploy konfiguracije'),
    'FE2-8': (4, 'ručni tipovi bez ugovora'),
    'FE2-9': (3, 'weather ekran v2'),
    'FE2-10': (3, 'preporuke se ne prikazuju'),
    'FE2-11': (4, 'nema testova ni infrastrukture'),
    'FE2-12': (3, 'mrtav kod + delete bez onError'),
    'FE2-13': (2, 'a11y modala'),
    'FE2-14': (4, 'poslovna logika duplirana na klijentu'),
    'FE2-15': (2, 'admin prikaz — još nema zahtjeva'),
    'FE2-16': (3, 'lint ne radi'),
    # --- mobile ---
    'MO2-1': (4, 'dev fallback pokazuje na produkciju'),
    'MO2-2': (5, 'bez version gatea stare verzije pucaju na novom API-ju'),
    'MO2-3': (3, 'deep link cilja nepostojeći ekran'),
    'MO2-4': (2, 'mrtav kod'),
    'MO2-5': (4, 'greške se ne prikazuju korisniku'),
    'MO2-6': (4, 'Settings prekidači bez efekta i bez perzistencije'),
    'MO2-7': (4, 'push token ostaje aktivan nakon odjave'),
    'MO2-8': (4, 'nema testova ni linta'),
    'MO2-9': (2, 'a11y'),
    'MO2-10': (2, 'i18n 3 ekrana'),
    'MO2-11': (2, 'ProfileScreen bez i18n/RQ'),
    'MO2-12': (3, 'health score na klijentu'),
    'MO2-13': (3, 'liste bez virtualizacije'),
    'MO2-14': (3, 'NativeBase uz React 19'),
    'MO2-15': (3, 'preporuke bez objašnjenja'),
    'MO2-16': (4, 'višak permisija + nešifriran cache dokumenata'),
    'MO2-17': (3, 'weather v2'),
    'MO2-18': (1, 'doc drift'),
    'MO2-19': (4, 'fiktivne metrike prikazane kao stvarne'),
    'MO2-20': (3, 'backend DTO prilagođen mobilnom klijentu'),
    'MO2-21': (1, 'BottomSheet animacija i naslov'),
    'MO2-22': (4, 'CSV export pada u runtimeu'),
}


# Talasi po ICE traci. A = odmah, E = kasnije/opcionalno.
WAVE_BANDS = [(4.0, 'Talas A'), (2.5, 'Talas B'), (2.0, 'Talas C'),
              (1.5, 'Talas D'), (0.0, 'Talas E')]
WAVE_ORDER = ['Talas A', 'Talas B', 'Talas C', 'Talas D', 'Talas E']


def wave_of(ice: float) -> str:
    for threshold, name in WAVE_BANDS:
        if ice >= threshold:
            return name
    return 'Talas E'


def load_items() -> list[dict]:
    items: list[dict] = []
    seen: set[str] = set()
    for phase, path in BACKLOGS:
        if not path.is_file():
            raise SystemExit(f'nedostaje backlog: {path}')
        for line in path.read_text(encoding='utf-8').split('\n'):
            if not line.startswith('|'):
                continue
            cells = [c.strip() for c in line.strip('|').split('|')]
            if not cells or not ID_RE.fullmatch(cells[0]):
                continue
            item_id = cells[0]
            if item_id in seen:
                continue
            seen.add(item_id)
            effort = next((c for c in cells[1:]
                           if re.fullmatch(r'[SML](/[SML])?', c)), None)
            if 'VERIFIKOVANO' in line:
                confidence, basis = 1.0, 'VERIFIKOVANO'
            elif 'HIPOTEZA' in line:
                confidence, basis = 0.5, 'HIPOTEZA'
            else:
                confidence, basis = 0.7, 'bez oznake (konzervativno 0.7)'
            title = re.sub(r'\*\*', '', cells[1] if phase != 'backend' else cells[2])
            items.append({'phase': phase, 'id': item_id, 'effort': effort,
                          'confidence': confidence, 'confidence_basis': basis,
                          'title': title[:150]})
    return items


def score(items: list[dict]) -> tuple[list[dict], list[str]]:
    problems: list[str] = []
    for it in items:
        if it['effort'] not in EFFORT_NUM:
            problems.append(f"{it['id']}: effort {it['effort']!r} nije prepoznat")
        if it['id'] not in IMPACT_TABLA:
            problems.append(f"{it['id']}: nema dodijeljen Impact")
    for it in items:
        eff = EFFORT_NUM.get(it['effort'] or '', 2.0)
        impact = IMPACT_TABLA.get(it['id'], (3, 'default 3 — provjeriti'))[0]
        it['impact'] = impact
        it['impact_reason'] = IMPACT_TABLA.get(it['id'], ('', ''))[1]
        it['effort_num'] = eff
        it['ice'] = round(impact * it['confidence'] / eff, 3)
    for it in items:
        lo, hi = EFFORT_DAYS.get(it['effort'] or 'M', (2.0, 3.0))
        it['days'] = {'min': lo, 'max': hi}
        ov = ICE_OVERRIDE.get(it['id'])
        it['ice_wave'] = wave_of(it['ice'])
        it['wave'] = ov[0] if ov else it['ice_wave']
        it['override_reason'] = ov[1] if ov else ''

    ranked = sorted(items, key=lambda x: (WAVE_ORDER.index(x['wave']), -x['ice'],
                                          x['phase'], x['id']))
    for i, it in enumerate(ranked, 1):
        it['rank'] = i
    return ranked, problems


def wave_summary(ranked: list[dict]) -> dict:
    out = {}
    for name in WAVE_ORDER:
        grp = [i for i in ranked if i['wave'] == name]
        out[name] = {
            'count': len(grp),
            'ids': [i['id'] for i in grp],
            'days_min': round(sum(i['days']['min'] for i in grp), 2),
            'days_max': round(sum(i['days']['max'] for i in grp), 2),
        }
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--json', action='store_true', help='Strukturirani izlaz.')
    parser.add_argument('--top', type=int, default=20, help='Broj stavki u tekstu (default 20).')
    args = parser.parse_args()

    ranked, problems = score(load_items())
    quick_wins = [i for i in ranked if i['effort'] == 'S' and i['impact'] >= 3]

    if args.json:
        print(json.dumps({'items': ranked, 'problems': problems,
                          'quick_wins': [i['id'] for i in quick_wins],
                          'wave_summary': wave_summary(ranked)},
                         ensure_ascii=False, indent=2))
    else:
        print(f"Stavki: {len(ranked)}  (backend/frontend/mobile)")
        print(f"Quick wins (S i Impact>=3): {len(quick_wins)}")
        print(f"Formula: ICE = Impact x Confidence / Effort  "
              f"(S=1, S/M=1.5, M=2, M/L=2.5, L=3)")
        print("\nSazetak po talasima (dani su suma raspona po oznaci truda):")
        for wname, wdata in wave_summary(ranked).items():
            print(f"  {wname:9} {wdata['count']:>3} stavki   "
                  f"{wdata['days_min']:>5.2f}-{wdata['days_max']:<5.2f} dana")
        print(f"\n{'#':>3} {'ID':9} {'faza':9} {'I':>2} {'C':>4} {'E':>4} {'ICE':>6} {'talas':9}")
        for it in ranked[:args.top]:
            print(f"{it['rank']:>3} {it['id']:9} {it['phase']:9} {it['impact']:>2} "
                  f"{it['confidence']:>4} {it['effort']:>4} {it['ice']:>6} {it['wave']:9}"
                  f"{'  [override]' if it['override_reason'] else ''}")
        print(f"\nQuick wins: {', '.join(i['id'] for i in quick_wins)}")
        print(f"Nadjacan ICE: {', '.join(i['id'] for i in ranked if i['override_reason'])}")
        for p in problems:
            print('PROBLEM:', p)
    return 1 if problems else 0


if __name__ == '__main__':
    raise SystemExit(main())
