# MASTER ROADMAP — objedinjeni plan (Faza 4)

Jedan prioritizirani roadmap za backend, frontend i mobile. Prioritet je izračunat, a ne procijenjen na oko: formula i sve ulazne vrijednosti su u `scripts/audit/master_roadmap.py`, a izlaz se može reprodukovati s `python3 scripts/audit/master_roadmap.py --json`.

## Sažetak

- **74 stavki** iz tri backloga: 36 backend, 16 frontend, 22 mobile.
- Ukupna procjena **179–282 radnih dana** za sve stavke (jedan izvršilac, sekvencijalno; paralelni trackovi to skraćuju — v. „Procjene").
- **10 quick wins** ispod jednog dana (v. zasebna sekcija).
- **6 stavki ima nadjačan ICE** jer čisti omjer koristi i cijene daje pogrešan signal kod ireverzibilnih posljedica (curenje tajni, pucanje instaliranih klijenata).
- Kritični put: `MO2-1 → MO2-2 → API-1 → API-2 → FE2-8/mobilni tipovi` (**12.25–19.5 dana**), uz sigurnosni lanac `SEC-0/SEC-4 → FE2-2 → MO2-7` i testnu infrastrukturu (`FE2-16`, `MO2-8`, `REL-4`) kao paralelne preduslove.

## Otvorena pitanja za vlasnika

1. **Kredencijali (SEC-0):** tko rotira/revokuje stvarne aktivne ključeve i do kada? Ovo je jedina stavka koja ne čeka inženjera.
2. **Deploy topologija (FE2-7, MO2-1):** koji host je produkcija — `api.boiler-control.ba101.top/api`, `boiler.ba101.top/backend/api` ili nešto treće? Bez toga nijedna konfiguracija okruženja nije konačna.
3. **Version gate (MO2-2):** uvodimo li `expo-updates` + min-version endpoint prije bilo koje promjene API ugovora? Ako ne, stare instalacije će padati.
4. **Auth migracija (SEC-4, FE2-2):** rok prelaska s Bearer u `localStorage` na httpOnly cookie + rotirani refresh, i kako se postojeće sesije gasе.
5. **Formule (FORM-1, FEAT-7):** je li postojeći izračun potrošnje i preporuka mjerodavan, ili postoji referentna vrijednost s kojom se smije uporediti?
6. **Obim ovog ciklusa:** ide li Talas E (26 stavki, ~86–137 dana) u ovaj ciklus ili se planira zasebno?

## Kako je prioritet izračunat

**ICE = Impact × Confidence ÷ Effort.**

| Faktor | Skala | Izvor |
|---|---|---|
| Impact | 1–5 | Eksplicitno dodijeljen po stavci u `IMPACT_TABLA` s obrazloženjem (5 = gubitak podataka/funkcije ili sigurnosni proboj, 1 = higijena). |
| Confidence | 1.0 / 0.5 / 0.7 | **Čita se iz backloga:** `VERIFIKOVANO` → 1.0, `HIPOTEZA` → 0.5, bez oznake → 0.7. Nije izmišljeno. |
| Effort | S=1, S/M=1.5, M=2, M/L=2.5, L=3 | **Čita se iz backlog kolone „Trud”.** |

Trud se prevodi i u dane radi planiranja: S 0.25–0.5, S/M 0.5–1, M 2–3, M/L 3–5, L 5–8.

Rezultat: 74 stavke — **72 VERIFIKOVANO i 2 HIPOTEZA** (`PRIV-2`, `FEAT-2`; obje dobijaju Confidence 0.5 i zato padaju nisko). Nijedna stavka nije bez oznake, pa se grana 0.7 u praksi ne primjenjuje.

### Gdje je ICE namjerno nadjačan

Čisti ICE kažnjava skupe, a hitne stavke. Šest ih je pomjereno, uz obrazloženje:

| ID | ICE | Talas po ICE | Stvarni talas | Razlog |
|---|---|---|---|---|
| `SEC-0` | 1.667 | Talas D | **Talas A** | Aktivne kredencijale u historiji repozitorija — curenje je ireverzibilno. Rotacija je vlasnikova akcija i traje < 1 dan; trud L se odnosi na cjelokupan proces, ne na rotaciju. |
| `SEC-4` | 1.667 | Talas D | **Talas A** | Token bez revokacije je usko vezan uz SEC-0 i FE2-2; odgađanje ostavlja otvoren put ponovne upotrebe ukradenog tokena. |
| `MO2-2` | 2.5 | Talas B | **Talas B** | Version gate je preduslov za SVE backend promjene ugovora (API-1) — bez njega nove rute ruše instalirane verzije. |
| `API-1` | 2 | Talas C | **Talas B** | Ugovor o verzijama mora postojati prije bilo koje promjene shape-a; inače se krši kompatibilnost unazad. |
| `API-2` | 1.333 | Talas E | **Talas B** | OpenAPI codegen je preduslov za FE2-8 (Talas C) i mobilne tipove; po čistom ICE-u pada u Talas E jer je trud L, ali bi tada poredak talasa kršio zavisnost — potrošač bi išao prije svog izvora. |
| `FORM-1` | 1.667 | Talas D | **Talas C** | Pogrešna formula daje pogrešnu preporuku koja košta stvarnog novca; ali zahtijeva mjerenje i replay pa nije quick win. |

## Quick wins (< 1 dan)

Sve stavke s trudom `S` i Impact ≥ 3. Ukupno **0.25–0.5 dana** svaka; svih deset zajedno **2.5–5 dana**, a skidaju IDOR, lažno zeleni type-check, nedostajuće security headere, pogrešan API host, fiktivne metrike, slomljen CSV export i nijeme greške.

| Red | ID | Dio | I | ICE | Šta se dobije |
|---|---|---|---|---|---|
| 1 | `SEC-1` | backend | 5 | 5 | IDOR: čitanje tuđih zapisa |
| 2 | `FE2-1` | frontend | 4 | 4 | type-check lažno zelen, 12 grešaka |
| 3 | `FE2-6` | frontend | 4 | 4 | bez security headera i gzipa |
| 4 | `MO2-1` | mobile | 4 | 4 | dev fallback pokazuje na produkciju |
| 5 | `MO2-19` | mobile | 4 | 4 | fiktivne metrike prikazane kao stvarne |
| 6 | `MO2-22` | mobile | 4 | 4 | CSV export pada u runtimeu |
| 7 | `MO2-5` | mobile | 4 | 4 | greške se ne prikazuju korisniku |
| 10 | `FE2-12` | frontend | 3 | 3 | mrtav kod + delete bez onError |
| 11 | `FE2-16` | frontend | 3 | 3 | lint ne radi |
| 12 | `MO2-3` | mobile | 3 | 3 | deep link cilja nepostojeći ekran |

## Talas A — Odmah — sigurnost i funkcionalnost koja je sada slomljena

**9 stavki, 11.75–19.5 dana.**

| # | ID | Dio | I | C | E | ICE | Dana | Zašto ovaj Impact |
|---|---|---|---|---|---|---|---|---|
| 1 | `SEC-1` | backend | 5 | 1 | S | 5 | 0.25–0.5 | IDOR: čitanje tuđih zapisa |
| 2 | `FE2-1` | frontend | 4 | 1 | S | 4 | 0.25–0.5 | type-check lažno zelen, 12 grešaka |
| 3 | `FE2-6` | frontend | 4 | 1 | S | 4 | 0.25–0.5 | bez security headera i gzipa |
| 4 | `MO2-1` | mobile | 4 | 1 | S | 4 | 0.25–0.5 | dev fallback pokazuje na produkciju |
| 5 | `MO2-19` | mobile | 4 | 1 | S | 4 | 0.25–0.5 | fiktivne metrike prikazane kao stvarne |
| 6 | `MO2-22` | mobile | 4 | 1 | S | 4 | 0.25–0.5 | CSV export pada u runtimeu |
| 7 | `MO2-5` | mobile | 4 | 1 | S | 4 | 0.25–0.5 | greške se ne prikazuju korisniku |
| 8 | `SEC-0` | backend | 5 | 1 | L | 1.667 | 5–8 | aktivne kredencijale u repozitoriju — direktan proboj |
| 9 | `SEC-4` | backend | 5 | 1 | L | 1.667 | 5–8 | token bez revokacije/rotacije |

## Talas B — Preduslovi za sve ostalo (test/lint infra, version gate, ugovor API-ja)

**7 stavki, 12.75–20.5 dana.**

| # | ID | Dio | I | C | E | ICE | Dana | Zašto ovaj Impact |
|---|---|---|---|---|---|---|---|---|
| 10 | `FE2-12` | frontend | 3 | 1 | S | 3 | 0.25–0.5 | mrtav kod + delete bez onError |
| 11 | `FE2-16` | frontend | 3 | 1 | S | 3 | 0.25–0.5 | lint ne radi |
| 12 | `MO2-3` | mobile | 3 | 1 | S | 3 | 0.25–0.5 | deep link cilja nepostojeći ekran |
| 13 | `SEC-2` | backend | 5 | 1 | M | 2.5 | 2–3 | IDOR: mutacija tuđih zapisa |
| 14 | `MO2-2` | mobile | 5 | 1 | M | 2.5 | 2–3 | bez version gatea stare verzije pucaju na novom API-ju |
| 15 | `API-1` | backend | 5 | 1 | M/L | 2 | 3–5 | promjena ugovora ruši instalirane mobile verzije |
| 16 | `API-2` | backend | 4 | 1 | L | 1.333 | 5–8 | OpenAPI kao izvor tipova |

## Talas C — Ispravnost podataka, observability, glavni UX dugovi

**16 stavki, 31.25–48.5 dana.**

| # | ID | Dio | I | C | E | ICE | Dana | Zašto ovaj Impact |
|---|---|---|---|---|---|---|---|---|
| 16 | `FEAT-7` | backend | 5 | 1 | M/L | 2 | 3–5 | neparsirano očitanje plina → pogrešna potrošnja |
| 17 | `FEAT-8` | backend | 4 | 1 | M | 2 | 2–3 | pogrešan bucket/timezone u historiji |
| 18 | `OBS-1` | backend | 4 | 1 | M | 2 | 2–3 | bez metrika nema dijagnoze u produkciji |
| 19 | `REL-5` | backend | 3 | 1 | S/M | 2 | 0.5–1 | cache senzora |
| 20 | `SEC-3` | backend | 4 | 1 | M | 2 | 2–3 | otvoren test endpoint bez limita |
| 21 | `FE2-11` | frontend | 4 | 1 | M | 2 | 2–3 | nema testova ni infrastrukture |
| 22 | `FE2-13` | frontend | 2 | 1 | S | 2 | 0.25–0.5 | a11y modala |
| 23 | `FE2-14` | frontend | 4 | 1 | M | 2 | 2–3 | poslovna logika duplirana na klijentu |
| 24 | `FE2-4` | frontend | 3 | 1 | S/M | 2 | 0.5–1 | bundle 2.972 kB bez splitinga |
| 25 | `FE2-7` | frontend | 4 | 1 | M | 2 | 2–3 | tri suprotne deploy konfiguracije |
| 26 | `FE2-8` | frontend | 4 | 1 | M | 2 | 2–3 | ručni tipovi bez ugovora |
| 27 | `MO2-16` | mobile | 4 | 1 | M | 2 | 2–3 | višak permisija + nešifriran cache dokumenata |
| 28 | `MO2-6` | mobile | 4 | 1 | M | 2 | 2–3 | Settings prekidači bez efekta i bez perzistencije |
| 29 | `MO2-7` | mobile | 4 | 1 | M | 2 | 2–3 | push token ostaje aktivan nakon odjave |
| 30 | `MO2-8` | mobile | 4 | 1 | M | 2 | 2–3 | nema testova ni linta |
| 31 | `FORM-1` | backend | 5 | 1 | L | 1.667 | 5–8 | pogrešna formula → pogrešna preporuka → stvarni trošak plina |

## Talas D — Pouzdanost, performanse, auth migracija

**16 stavki, 37–57 dana.**

| # | ID | Dio | I | C | E | ICE | Dana | Zašto ovaj Impact |
|---|---|---|---|---|---|---|---|---|
| 32 | `FE2-2` | frontend | 5 | 1 | L | 1.667 | 5–8 | JWT u localStorage bez refresha |
| 33 | `REL-7` | backend | 4 | 1 | M/L | 1.6 | 3–5 | neprovjeren snapshot mijenja ciklus kotla |
| 34 | `REL-8` | backend | 4 | 1 | M/L | 1.6 | 3–5 | nearomski upis dana → miješani podaci |
| 35 | `FEAT-6` | backend | 3 | 1 | M | 1.5 | 2–3 | prošireni izvozi |
| 36 | `MAINT-2` | backend | 3 | 1 | M | 1.5 | 2–3 | CI workflowi |
| 37 | `MAINT-4` | backend | 3 | 1 | M | 1.5 | 2–3 | test fixturei |
| 38 | `PERF-1` | backend | 3 | 1 | M | 1.5 | 2–3 | indeksi nakon mjerenja |
| 39 | `PERF-2` | backend | 3 | 1 | M | 1.5 | 2–3 | paginacija i N+1 |
| 40 | `REL-4` | backend | 3 | 1 | M | 1.5 | 2–3 | izolacija test seeda |
| 41 | `SEC-6` | backend | 3 | 1 | M | 1.5 | 2–3 | scrape mreža i logovi |
| 42 | `FE2-10` | frontend | 3 | 1 | M | 1.5 | 2–3 | preporuke se ne prikazuju |
| 43 | `FE2-3` | frontend | 3 | 1 | M | 1.5 | 2–3 | mešoviti dohvati + polling bez pauze |
| 44 | `MO2-12` | mobile | 3 | 1 | M | 1.5 | 2–3 | health score na klijentu |
| 45 | `MO2-13` | mobile | 3 | 1 | M | 1.5 | 2–3 | liste bez virtualizacije |
| 46 | `MO2-15` | mobile | 3 | 1 | M | 1.5 | 2–3 | preporuke bez objašnjenja |
| 47 | `MO2-20` | mobile | 3 | 1 | M | 1.5 | 2–3 | backend DTO prilagođen mobilnom klijentu |

## Talas E — Funkcionalnosti i preostali dug (planirati po kapacitetu)

**26 stavki, 86–137 dana.**

| # | ID | Dio | I | C | E | ICE | Dana | Zašto ovaj Impact |
|---|---|---|---|---|---|---|---|---|
| 49 | `FEAT-1` | backend | 4 | 1 | L | 1.333 | 5–8 | prognoza je temelj preporuka |
| 50 | `PRIV-1` | backend | 4 | 1 | L | 1.333 | 5–8 | GDPR izvoz/brisanje nedostaje |
| 51 | `REL-3` | backend | 4 | 1 | L | 1.333 | 5–8 | push se gubi bez outboxa |
| 52 | `SEC-5` | backend | 4 | 1 | L | 1.333 | 5–8 | upload bez content sniffing |
| 53 | `MAINT-3` | backend | 3 | 1 | M/L | 1.2 | 3–5 | liveness/build/migracije |
| 54 | `REL-6` | backend | 3 | 1 | M/L | 1.2 | 3–5 | identitet instalacije |
| 55 | `SEC-7` | backend | 3 | 1 | M/L | 1.2 | 3–5 | zastarjele zavisnosti |
| 56 | `FEAT-3` | backend | 3 | 1 | L | 1 | 5–8 | procjena računa |
| 57 | `FEAT-5` | backend | 3 | 1 | L | 1 | 5–8 | indikator efikasnosti |
| 58 | `REL-1` | backend | 3 | 1 | L | 1 | 5–8 | weather SWR i fallback |
| 59 | `REL-2` | backend | 3 | 1 | L | 1 | 5–8 | radnik po uređaju |
| 60 | `FE2-15` | frontend | 2 | 1 | M | 1 | 2–3 | admin prikaz — još nema zahtjeva |
| 61 | `FE2-5` | frontend | 2 | 1 | M | 1 | 2–3 | i18n nepotpun |
| 62 | `FE2-9` | frontend | 3 | 1 | L | 1 | 5–8 | weather ekran v2 |
| 63 | `MO2-10` | mobile | 2 | 1 | M | 1 | 2–3 | i18n 3 ekrana |
| 64 | `MO2-11` | mobile | 2 | 1 | M | 1 | 2–3 | ProfileScreen bez i18n/RQ |
| 65 | `MO2-14` | mobile | 3 | 1 | L | 1 | 5–8 | NativeBase uz React 19 |
| 66 | `MO2-17` | mobile | 3 | 1 | L | 1 | 5–8 | weather v2 |
| 67 | `MO2-18` | mobile | 1 | 1 | S | 1 | 0.25–0.5 | doc drift |
| 68 | `MO2-21` | mobile | 1 | 1 | S | 1 | 0.25–0.5 | BottomSheet animacija i naslov |
| 69 | `MO2-4` | mobile | 2 | 1 | M | 1 | 2–3 | mrtav kod |
| 70 | `MO2-9` | mobile | 2 | 1 | M | 1 | 2–3 | a11y |
| 71 | `FEAT-4` | backend | 2 | 1 | L | 0.667 | 5–8 | multi-boiler — rijedak slučaj |
| 72 | `MAINT-1` | backend | 1 | 1 | S/M | 0.667 | 0.5–1 | dokumentacija mrtvog koda |
| 73 | `FEAT-2` | backend | 2 | 0.5 | M | 0.5 | 2–3 | advisory upozorenje, hipotetska vrijednost |
| 74 | `PRIV-2` | backend | 2 | 0.5 | M | 0.5 | 2–3 | audit log — korisna higijena, nije proboj |

## Zavisnosti i kritični put

Redoslijed nije samo poredak po ICE-u — neke stavke **blokiraju** druge. Prikazane su kao lanci; strelica znači „mora prije".

```
LANAC 1 — sigurnost (ne čeka ništa)
  SEC-0 rotacija kredencijala ──┬─> SEC-4 auth/refresh ──> FE2-2 httpOnly cookie ──> MO2-7 push deregistracija
  SEC-1 IDOR read ──> SEC-2 IDOR write ──> SEC-3 guard na test endpoint

LANAC 2 — kompatibilnost instaliranih klijenata (KRITIČNI PUT)
  MO2-1 jedan API host ──> MO2-2 version gate / expo-updates ──> API-1 verzionirani ugovori
        ──> API-2 OpenAPI codegen ──┬─> FE2-8 tipovi (frontend)
                                    └─> MO2-4 / tipovi (mobile)

LANAC 3 — testna infrastruktura (paralelno, preduslov za veće refaktore)
  FE2-1 pravi type-check ──> FE2-16 ESLint ──> FE2-11 frontend testovi
  MO2-8 lint+jest (mobile) ──> MO2-14 NativeBase→NativeWind (veliki refactor)
  REL-4 izolovan test seed ──> MAINT-4 fixturei ──> MAINT-2 CI workflowi

LANAC 4 — ispravnost podataka
  FEAT-7 parsiranje očitanja ──> FORM-1 porijeklo formule ──> FEAT-5 efikasnost
        ──> FEAT-3 procjena računa
  FEAT-8 bucket/timezone ──┬─> FE2-14 (frontend poslovna logika)
                           └─> MO2-12 (mobile health score)

LANAC 5 — weather i preporuke
  FEAT-1 forecast ──> REL-1 SWR/fallback ──┬─> FE2-9 weather v2 (web)
                                           └─> MO2-17 weather v2 (mobile)
  FORM-1 ──> FE2-10 / MO2-15 prikaz preporuka s objašnjenjem

LANAC 6 — pouzdanost pusha i uređaja
  REL-3 durable outbox ──> REL-6 identitet instalacije ──> MO2-7 deregistracija
  REL-7 validacija snapshot-a ──> REL-8 atomski upis dana ──> REL-2 radnik po uređaju
```
**Kritični put** je LANAC 2: `MO2-1 → MO2-2 → API-1 → API-2 → FE2-8 + mobilni tipovi`. Sve dok on nije gotov, nijedna promjena oblika odgovora ne smije u produkciju, jer instalirane mobilne verzije nemaju mehanizam prisilnog ažuriranja. Procijenjeno **12.25–19.5 dana** za cijeli lanac (`MO2-1` 0.25–0.5 + `MO2-2` 2–3 + `API-1` 3–5 + `API-2` 5–8 + `FE2-8` 2–3).

Drugi lanac koji se ne smije preskočiti je LANAC 3: bez `FE2-16`/`MO2-8`/`REL-4` veliki refaktori (`MO2-14` NativeBase→NativeWind, `FE2-4` code-splitting, `FE2-2` auth migracija) idu bez sigurnosne mreže.

## Procjene

| Talas | Stavki | Dana (min–max) | Šta se dobije na kraju talasa |
|---|---|---|---|
| Talas A | 9 | 11.75–19.5 | Nema poznatog sigurnosnog proboja; nijedna funkcija nije slomljena; greške su vidljive korisniku. |
| Talas B | 7 | 12.75–20.5 | Postoji test/lint mreža i version gate — dalje se smije mijenjati ugovor API-ja. |
| Talas C | 16 | 31.25–48.5 | Podaci o potrošnji i preporuke su provjerljivo ispravni; produkcija se može dijagnosticirati. |
| Talas D | 16 | 37–57 | Auth bez tokena u localStorage; push i upisi pouzdani; performanse izmjerene. |
| Talas E | 26 | 86–137 | Nove funkcionalnosti (forecast, računi, admin) i preostali UX dug. |
| **Ukupno** | **74** | **179–282** | |

**Kako čitati ove brojeve.** Suma pretpostavlja jednog izvršioca i sekvencijalan rad. Realno se dijeli na tri paralelna tracka koja se rijetko sudaraju:

| Track | Sadržaj | Dana | Bilješka |
|---|---|---|---|
| Backend | 36 stavki | 113–180 | Najduži track; LANAC 2 i 4 su na njemu. |
| Frontend | 16 stavki | 28–44 | Čeka `API-2` za tipove, ostalo može odmah. |
| Mobile | 22 stavke | 38–58 | `MO2-2` je kapija za sve ostale ugovore. |

Uz tri paralelna tracka zid-sat je otprilike **najduži track** (**113–180 dana**), a ne zbir. Ako se radi samo Talas A+B (16 stavki), to je **24.5–40 dana** i pokriva svu poznatu sigurnost i svu slomljenu funkcionalnost.

## Rizici

| Rizik | Zašto je realan | Ublažavanje |
|---|---|---|
| Promjena API ugovora sruši instalirane mobilne verzije | `MO2-2`: nema min-version provjere ni `expo-updates`; `eas.json` nema `preview` profil. | `MO2-2` **prije** `API-1`; verzije ugovora uz zadržavanje starog oblika; force-update tek nakon što gate postoji. |
| Auth migracija odjavi sve korisnike | `SEC-4` + `FE2-2` mijenjaju način nošenja tokena. | Step-up prelaz: stari Bearer radi do datuma X, paralelno cookie; mjerenje stope neuspjelih prijava prije gašenja. |
| Refactor NativeBase → NativeWind bez testova | `MO2-8`: 0 testova, lint exit 2; `MO2-14` dira 12 komponenti. | `MO2-8` je preduslov; migracija po komponenti uz snapshot; flag za postepeno uključivanje. |
| „Ispravka" formule promijeni preporuke bez reference | `FORM-1`: nema referentne vrijednosti za uporedbu. | Prije izmjene snimiti replay postojećih ulaza; shadow mode; vlasnik potvrđuje referentni izvor (otvoreno pitanje 5). |
| Procjene u danima su grube | Računate iz oznake truda (S/M/L), ne iz razrađenih zadataka. | Tretirati kao red veličine; re-planirati nakon Talasa A kad se stvarna brzina izmjeri. |
| ~~CI workflow je na staroj grani~~ **RIJEŠENO 2026-10-29** | Vlasnik odobrio izmjenu; `.github/workflows/backend-audit.yml` sada cilja `arena/1bfee051-boiler-control` na **obje** reference (linija 5 `on.push.branches` i linija 14 `if:` guard za `workflow_dispatch`). YAML validiran parserom. | Nema više akcije. Pri merge-u u `main` vlasnik mora ručno prebaciti trigger na `main`, jer workflow namjerno prati samo aktivnu granu. |

## Ključne odluke (bez njih se ne počinje)

| Odluka | Blokira | Preporuka | **Odluka vlasnika (2026-10-29)** |
|---|---|---|---|
| Koji je produkcijski API host | `MO2-1`, `FE2-7`, cijeli LANAC 2 | Jedan host u `.env`, dev fallback = greška, ne drugi produkcijski server. | **`api.boiler-control.ba101.top/api`.** Dev fallback se uklanja (greška, ne drugi host). |
| Uvodi li se version gate | `MO2-2`, `API-1`, sve promjene ugovora | Da, prije prve promjene shape-a. Bez toga mobile izdanja moraju ostati zaključana na starom ugovoru. | **Da — prije prve promjene API ugovora.** `MO2-2` postaje tvrdi preduslov za `API-1`/`API-2`/`SEC-4`/`FEAT-7`. |
| Rotacija kredencijala | `SEC-0`, `SEC-4` | Odmah, i nezavisno od ovog plana — to je vlasnikova akcija od pola dana. | **Agent priprema runbook + secret manager konfiguraciju, vlasnik odobrava prije izvršenja.** Bez ispisa tajni u chat ili repo. |
| Auth: cookie + refresh ili ostaje Bearer | `SEC-4`, `FE2-2`, `MO2-7` | Cookie + rotirani refresh, uz vremenski ograničen dual-mode. | **httpOnly cookie + rotirani refresh**, s dual-mode prelazom. |
| Mjerodavni izračun formule | `FORM-1`, `FEAT-5`, `FEAT-3`, `FE2-14`, `MO2-12` | Jedan izvor u backendu; klijenti ne računaju. | **Sad samo `FEAT-7`** (parsiranje/validacija — očigledno pogrešno ponašanje). `FORM-1` odgođen dok vlasnik ne nađe referentne senzorske uzorke; do tada se preporuka **ne mijenja**. |
| Obim ciklusa (ide li Talas E) | Planiranje kapaciteta | Talas A+B obavezno; C po kapacitetu; E zasebno planirati. | **Sve, uključujući Talas E** — 74 stavke, 179–282 dana. Radi se inkrementalno po talasima, počev od quick wins. |

## Šta NE raditi

- **Ne mijenjati oblik API odgovora prije `MO2-2` + `API-1`.** Instalirane mobilne verzije nemaju prisilno ažuriranje; svaka breaking promjena ih trajno lomi.
- **Ne raditi `MO2-14` (NativeBase → NativeWind) prije `MO2-8`.** Bez testova je to refactor 12 komponenti naslepo, a NativeBase radi uz React 19 (peer konflikt je upozorenje, ne pad).
- **Ne „popravljati" testove u mobilnoj aplikaciji usput.** `npm test` exit 127 i `npm run lint` exit 2 su posljedica nedostatka `jest`/`eslint-config-expo` — to je `MO2-8`, zaseban zadatak, ne usputna sitnica.
- **Ne dodavati nove funkcionalnosti (widget, offline unos, biometrija) prije Talasa B.** Sve one nasljeđuju slomljen auth, host i push; gradile bi se na nestabilnoj podlozi.
- **Ne brisati naizgled mrtav kod bez provjere (`MO2-4`, `FE2-12`, `MAINT-1`).** `getRecommendations` i `dashboard.api` metode nisu pozvane, ali su dio namjeravane funkcionalnosti (`FE2-10`/`MO2-15`) — brišu se tek kad se odluči da te funkcije neće.
- **Ne uvoditi Redis/workere prije `REL-4` i `MAINT-4`.** Bez izolovanog test seeda i fixturea nema načina dokazati da retry/outbox logika ne duplicira upise.
- **Ne tretirati `npm run type-check` u frontendu kao zelen.** Korenski `tsconfig.json` je solution-format (`files: []`) — `FE2-1` mora proći prije bilo koje tvrdnje da build prolazi.
- **Ne dirati `.github/workflows/**` bez odobrenja.** Izvan je dozvoljenih putanji ovog audita i trenutno cilja staru granu.

## Kako se napredak prati

Skripte iz `scripts/audit/` su read-only i idempotentne — mogu se pokrenuti bilo kad bez opasnosti po aplikaciju:

| Skripta | Šta provjerava |
|---|---|
| `python3 scripts/audit/master_roadmap.py` | Ovaj roadmap: ICE poredak, talasi, quick wins, procjene dana. `--json` za mašinsku obradu. |
| `python3 scripts/audit/document_selfcheck.py` | Formalni markeri backend dokumenata. |
| `python3 scripts/audit/backend_inventory.py` | Da li svaki modul/ruta ima red u backend inventaru. |
| `python3 scripts/audit/frontend_selfcheck.py` | Formalni markeri frontend dokumenata. |
| `python3 scripts/audit/mobile_selfcheck.py` | Formalni markeri mobilnih dokumenata + crosswalk backlog↔plan. |
| `python3 scripts/audit/mobile_inventory.py` | Da li svaki ekran/komponenta/API metoda ima red u inventaru. |

Za svaku stavku koja se implementira, kriterij prihvatanja je u odgovarajućem implementation-plan dokumentu (`docs/audit/backend/10-`, `frontend/07-`, `mobile/07-`); ovaj roadmap samo određuje **redoslijed**.

---

*Generisano u Fazi 4. Ulazni podaci: 74 stavke iz tri backloga; 72 VERIFIKOVANO, 2 HIPOTEZA. Nijedan aplikacijski fajl nije izmijenjen.*