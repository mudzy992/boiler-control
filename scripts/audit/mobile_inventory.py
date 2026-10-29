#!/usr/bin/env python3
"""Read-only inventar mobilne aplikacije: da li svaki ekran, komponenta, navigator,
API metoda i deep link cilj ima red u docs/audit/mobile/01-inventory.md.

Skripta NE mijenja nijedan fajl. Poklapanje imena nije semantička potvrda potpunosti opisa.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MOBILE = ROOT / 'mobile'
SRC = MOBILE / 'src'
INVENTORY = ROOT / 'docs/audit/mobile/01-inventory.md'
BACKEND_SRC = ROOT / 'backend/src/modules'
ROUTES = SRC / 'constants/routes.ts'


def read(path: Path) -> str:
    return path.read_text(encoding='utf-8') if path.is_file() else ''


def route_constants() -> dict[str, str]:
    """Mapira `KONSTANTA.Clan` -> stvarna vrijednost rute iz `src/constants/routes.ts`.

    MO2-3: imena ruta su prešla sa string literalima na zajedničke konstante. Bez
    ovog mapiranja inventar ne bi vidio ni registrovana imena ni deep link ciljeve,
    pa bi provjera „svaki cilj je registrovan" postala lažno zelena (prazan skup
    ciljeva trivialno zadovoljava uvjet).
    """
    text = read(ROUTES)
    out: dict[str, str] = {}
    for block in re.finditer(
        r'export const ([A-Z][A-Z0-9_]*)\s*=\s*\{(.*?)\}\s*as const;', text, re.S
    ):
        const_name, body = block.group(1), block.group(2)
        for m in re.finditer(r"([A-Za-z0-9_]+)\s*:\s*'([^']*)'", body):
            out[f'{const_name}.{m.group(1)}'] = m.group(2)
    return out


def resolve(expr: str, consts: dict[str, str]) -> str:
    """`'Gas'` -> Gas; `MAIN_TAB_SCREENS.Gas` -> Gas (ako je konstanta poznata)."""
    expr = expr.strip().strip("'\"")
    return consts.get(expr, expr)


def ts_files(base: Path) -> list[Path]:
    return sorted(p for p in base.rglob('*.ts*') if p.is_file()) if base.is_dir() else []


def collect() -> dict:
    inv = read(INVENTORY)

    screens = sorted(p.name for p in ts_files(SRC / 'screens'))
    components = sorted(p.name for p in ts_files(SRC / 'components'))
    navigators = sorted(p.name for p in ts_files(SRC / 'navigation'))
    services = sorted(p.name for p in ts_files(SRC / 'services'))

    consts = route_constants()

    # registrovana imena ekrana u navigatorima (Stack.Screen/Tab.Screen, uključujući višelinijske)
    # MO2-3: ime može biti string literal (name="Main") ili konstanta (name={ROOT_SCREENS.Main}).
    nav_text = '\n'.join(read(p) for p in ts_files(SRC / 'navigation'))
    nav_text += '\n' + read(SRC / 'screens/gas/GasScreen.tsx')
    registered = set(re.findall(r'<(?:Stack|Tab)\.Screen\s+name="([^"]+)"', nav_text))
    registered |= {
        resolve(m.group(1), consts)
        for m in re.finditer(r'<(?:Stack|Tab)\.Screen\s+name=\{([A-Za-z0-9_.]+)\}', nav_text)
    }

    # deep link ciljevi iz notificationService.handleDeepLink
    # MO2-3: cilj može biti literal (screen: 'Gas') ili konstanta (screen: MAIN_TAB_SCREENS.Gas).
    notif = read(SRC / 'services/notifications/notificationService.ts')
    deep_targets = [resolve(t, consts) for t in re.findall(r"screen:\s*'([A-Za-z0-9_]+)'", notif)]
    deep_targets += [
        resolve(m.group(1), consts)
        for m in re.finditer(r'screen:\s*([A-Z][A-Z0-9_]*\.[A-Za-z0-9_]+)', notif)
    ]
    bad_deep_targets = sorted({t for t in deep_targets if t not in registered})

    # čuvar protiv lažno zelene: ako handler postoji a nijedan cilj nije prepoznat,
    # to znači da parser ne razumije zapis — a ne da ciljeva nema.
    parse_issues = []
    if 'handleDeepLink' in notif and not deep_targets:
        parse_issues.append(
            'handleDeepLink postoji, ali nijedan deep link cilj nije prepoznat '
            '(parser ne pokriva zapis) — provjera bi bila lažno zelena'
        )
    if not registered:
        parse_issues.append(
            'nije prepoznato nijedno registrovano ime ekrana — provjera bi bila lažno zelena'
        )

    # ciljevi iz linking konfiguracije (RootNavigator): ključevi su imena ekrana
    root = read(SRC / 'navigation/RootNavigator.tsx')
    start = root.find('const linking')
    if start >= 0:
        # Krećemo od prve `{`, a ne od `const linking`: inače anotacija tipa
        # (`const linking: LinkingOptions<any> = {`) daje lažni cilj `linking`.
        brace = root.find('{', start)
        linking_block = root[brace:] if brace >= 0 else ''
    else:
        linking_block = ''
    end = linking_block.find('\n};')
    linking_block = linking_block[:end] if end >= 0 else linking_block
    structural = {'screens', 'config', 'prefixes'}
    # MO2-3: ključ može biti string literal ('add-reading':) ili izračunati ključ
    # iz konstante ([GAS_TAB_SCREENS.Readings]:). Stari regex je vidio samo prvo.
    linking_keys = {
        m.group(1).strip("'\"") for m in re.finditer(r"([A-Za-z0-9_'\-]+)\s*:", linking_block)
    }
    linking_keys |= {
        resolve(m.group(1), consts)
        for m in re.finditer(r'\[\s*([A-Z][A-Z0-9_]*\.[A-Za-z0-9_]+)\s*\]\s*:', linking_block)
    }
    linking_targets = sorted(linking_keys - structural)
    bad_linking_targets = sorted(t for t in linking_targets if t not in registered)
    if linking_block and not linking_targets:
        parse_issues.append(
            'linking konfiguracija postoji, ali nijedan cilj nije prepoznat '
            '(parser ne pokriva zapis) — provjera bi bila lažno zelena'
        )

    # API metode
    client = read(SRC / 'services/api/client.ts')
    client_methods = [
        m.group(2)
        for m in re.finditer(r'^  (async )?([a-zA-Z][A-Za-z0-9_]*)\(', client, re.M)
        if m.group(2) != 'constructor'
    ]
    hp = read(SRC / 'services/api/homeProfile.api.ts')
    hp_methods = re.findall(r'^  ([a-zA-Z][A-Za-z0-9_]*): async', hp, re.M)
    th = read(SRC / 'services/api/thermostat.api.ts')
    th_methods = re.findall(r'^  ([a-zA-Z][A-Za-z0-9_]*): async', th, re.M)
    dash = read(SRC / 'api/dashboard.api.ts')
    dash_methods = re.findall(r'^export const ([a-zA-Z][A-Za-z0-9_]*)', dash, re.M)

    all_methods = client_methods + hp_methods + th_methods + dash_methods
    missing_methods = sorted({m for m in all_methods if f'`{m}`' not in inv and f'.{m}`' not in inv
                              and f' {m}' not in inv})

    # nekorištene metode: ime se nigdje ne pojavljuje izvan fajla definicije i import linija
    corpus_files = [p for p in ts_files(SRC)
                    if p.name not in ('client.ts', 'homeProfile.api.ts', 'thermostat.api.ts',
                                      'dashboard.api.ts')]
    corpus = '\n'.join(read(p) for p in corpus_files) + read(MOBILE / 'App.tsx')
    corpus = '\n'.join(ln for ln in corpus.split('\n') if not ln.strip().startswith('import '))
    unused = sorted(m for m in all_methods if not re.search(r'\b%s\b' % re.escape(m), corpus))

    # backend rute koje mobile koristi
    backend_routes: set[str] = set()
    for ctrl in BACKEND_SRC.rglob('*.controller.ts'):
        text = read(ctrl)
        base = re.search(r"@Controller\('([^']+)'\)", text)
        prefix = base.group(1) if base else ''
        for m in re.finditer(r"@(Get|Post|Patch|Put|Delete)\((?:'([^']*)')?\)", text):
            verb = m.group(1).upper()
            sub = m.group(2) or ''
            route = '/' + '/'.join(x for x in (prefix, sub) if x)
            backend_routes.add(f'{verb} {route}')
    # i18n pokrivenost ekrana
    screens_without_i18n = []
    for p in ts_files(SRC / 'screens'):
        text = read(p)
        if "t('" not in text and re.search(r'<(Text|Heading)', text):
            screens_without_i18n.append(p.name)

    markers = {
        'mob:screens': len(screens),
        'mob:components': len(components),
        'mob:navigators': len(navigators),
        'mob:services': len(services),
        'mob:apimethods': len(client_methods),
    }
    marker_issues = [
        f'marker <!-- {k}:{v} --> nije pronađen u 01-inventory.md'
        for k, v in markers.items() if f'<!-- {k}:{v} -->' not in inv
    ]
    missing_rows = {
        'screens': [s for s in screens if s not in inv],
        'components': [c for c in components if c not in inv],
        'navigators': [n for n in navigators if n not in inv],
        'services': [s for s in services if s not in inv],
    }

    return {
        'screens': len(screens),
        'components': len(components),
        'navigators': len(navigators),
        'services': len(services),
        'api_methods': {'client': len(client_methods), 'homeProfile': len(hp_methods),
                        'thermostat': len(th_methods), 'dashboard.api': len(dash_methods)},
        'registered_screen_names': sorted(registered),
        'deep_link_targets': sorted(set(deep_targets)),
        'deep_link_targets_not_registered': bad_deep_targets,
        'linking_targets': linking_targets,
        'linking_targets_not_registered': bad_linking_targets,
        'parse_issues': parse_issues,
        'methods_missing_in_inventory': missing_methods,
        'methods_defined_but_never_called': unused,
        'screens_without_i18n': sorted(screens_without_i18n),
        'marker_issues': marker_issues,
        'rows_missing_in_inventory': missing_rows,
        'backend_route_count': len(backend_routes),
        'limitation': ('Poklapanje imena nije semantička potvrda potpunosti opisa; '
                       'popis nekorištenih metoda je heuristika po imenu — ne vidi dinamičke '
                       'pozive niti razlikuje istoimene metode u različitim slojevima '
                       '(npr. getHeatingStats postoji i u analytics.api i u dashboard.api).'),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--json', action='store_true', help='Ispiši strukturirani sažetak.')
    args = parser.parse_args()
    r = collect()

    if args.json:
        print(json.dumps(r, ensure_ascii=False, indent=2))
    else:
        print(f"Ekrana: {r['screens']}; komponenti: {r['components']}; navigatora: {r['navigators']}; "
              f"servisa: {r['services']}; API metoda: {sum(r['api_methods'].values())} {r['api_methods']}")
        print(f"Registrovana imena ekrana: {', '.join(r['registered_screen_names'])}")
        print(f"Deep link ciljevi: {', '.join(r['deep_link_targets'])} -> "
              f"nepostojeći: {r['deep_link_targets_not_registered'] or 'nema'}")
        print(f"Linking ciljevi: {', '.join(r['linking_targets'])} -> "
              f"nepostojeći: {r['linking_targets_not_registered'] or 'nema'}")
        print(f"Ekran bez i18n: {r['screens_without_i18n'] or 'nema'}")
        print(f"Metode bez poziva: {len(r['methods_defined_but_never_called'])} "
              f"({', '.join(r['methods_defined_but_never_called'])})")
        print(f"Redova koji nedostaju u inventaru: "
              f"{ {k: v for k, v in r['rows_missing_in_inventory'].items() if v} or 'nema' }")
        print(f"Metode bez reda u inventaru: {r['methods_missing_in_inventory'] or 'nema'}")
        for issue in r['marker_issues']:
            print('-', issue)
        print(r['limitation'])

    ok = not (r['marker_issues']
              or any(r['rows_missing_in_inventory'].values())
              or r['methods_missing_in_inventory']
              or r['parse_issues']
              or r['deep_link_targets_not_registered']
              or r['linking_targets_not_registered'])
    return 0 if ok else 1


if __name__ == '__main__':
    raise SystemExit(main())
