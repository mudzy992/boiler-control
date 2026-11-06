# Audit audita

Faza 4. Datum: 2026-11-06. Pregled dokumenata Faza 1–3 nakon CI popravke `e7142f1`.

## Šta je bilo tačno

- Tri UI sloja (antd, lokalni `components/*`, shadcn) i odluka Q1.
- Obrazac “greška = prazan ekran” na većini ruta.
- Dva ugovora događaja grijanja, potrošnja plina, health sa servera, breakdown kao snapshot.
- Redoslijed zavisnosti (tokeni → auth → shell → primitiv → stanja → stranice).
- Redis nije dashboard keš.

## Rupe i greške

| ID | Problem | Dokaz | Ispravka |
|---|---|---|---|
| A1 | Shell i dashboard “ne parsiraju” kao trenutno stanje | `e7142f1`; Frontend CI `42296147396` zelen; lokalni `tsc` 0 grešaka | Status: **riješeno kao parse**. Q3 rewrite ostaje strategija, ne činjenica “ne pokreće se”. |
| A2 | Q8 “blokiran padom builda” | Isti CI prolazi type-check, lint, test, build | Q8 = **nije izmjeren**, ne blokiran parse-om. |
| A3 | AU-02 / GR-01 / BO-01 kao kritični “ne učitava se” | Importi popravljeni u `e7142f1` | Ozbiljnost pada na “riješeno”; UX/antd problemi ostaju. |
| A4 | Matrica u `04` kolona Parse/import | Većina `x` zastarjela | Matrica ažurirana: parse zatvoren; ostaju antd, error=prazno, i18n, dijalog. |
| A5 | Preuveličan uticaj SH-01/DA-01 na “app mrtav” | Login radi na `localhost:81` | App se pokreće; UX je polovičan, ne “blank forever”. |
| A6 | Nedovoljno: zamjena plots/icons | `@ant-design/plots`, `@ant-design/icons` u dashboard/shell | Pokriveno u `06` i `08` I6/I7. |
| A7 | Nedovoljno: koji set umire prvi | Lokalni `components/*` vs `shared/components/ui` | Pravilo: stranice prelaze na shadcn; lokalni set se briše u I7. |
| A8 | Nedovoljno: `InputNumber` vuče antd | `components/InputNumber.tsx` | I3/I7: shadcn brojčani unos ili Input + pattern. |
| A9 | gate-2.md zamrznut snapshot | Tačan za GATE 2 trenutak | Ostaje historija; trenutni status u STATE i ovom fajlu. |
| A10 | Module markdown (shell.md, …) još pišu “ne parsira” | Faza 2 dokumenti | Ne prepisuju se svi; napomena ispod. Nalazi ID ostaju validni kao historija + preostali UX. |

## Šta je potcijenjeno

- Vizuelni dug: `brand` / `surface` klase postoje u JSX-u a nisu u Tailwind temi → dugmad i površine izgledaju “polovično” i u dark modeu.
- Antd i dalje u početnom grafu (`ThemeContext`, ikone, plots, dijelovi stranica).
- Karakterizacijski testovi za profile PUT whitelist i home-profile dirty/create nisu napisani (samo predloženi).

## Šta je preuveličano

- “Web dashboard se ne pokreće” poslije `e7142f1`. Pokreće se; redizajn nije gotov.
- Trud L na DA-01 kao blokator cijele Faze 5: parse je S/M popravka; pravi L je rewrite UX-a.

## Izmijenjeni dokumenti u ovoj fazi

- `04-cross-module-synthesis.md` — status parse/Q8/AU-02.
- `open-questions.md` — Q8.
- `STATE.md` — Faza 4 / GATE 3.
- Module fajlovi: **bez masovnog rewrita**; vidi napomenu.

## Napomena uz module docs

Nalazi `SH-01`, `DA-01`, `AU-02`, `GR-01`, … ostaju u tabelama kao ID-evi. Status “kritično / ne parsira” za one zatvorene u `e7142f1` tretira se kao **zatvoreno u kodu**, a redizajn i dalje planira rewrite shell/dashboard (Q3).
