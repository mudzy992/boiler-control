# HANDOFF — stanje na kraju turna (2026-10-31)

Radni dokument za nastavak. Nije dio audit nalaza; može se obrisati kad se
Talas D završi.

## Git stanje (VERIFICIRANO)

- Grana: `arena/1bfee051-boiler-control`
- HEAD: **`e0b4e8b`** — `docs(audit): REL-7 - zabiljezen CI ishod run 41226811814`
- Radno stablo: **čisto (0 ne-commitovanih)**
- Zadnji CI run: **`41227022427`** = `completed success`, sva tri joba
  (`test` 21 koraka, `frontend` 18, `mobile` 10)

**UPOZORENJE — lokalni git ref se vraća na base `c0131ff` između turnova.**
Desilo se **5 puta**. Prvo u svakom turnu:

```
git rev-parse HEAD          # mora biti e0b4e8b ili novije
git status --short | wc -l  # mora biti 0
```

Ako HEAD pokaže `c0131ff` i status ~199 fajlova, oporavak je:

```
git fetch origin arena/1bfee051-boiler-control
git reset --mixed origin/arena/1bfee051-boiler-control   # NE --hard
```

`--mixed` ne dira radno stablo, pa ne-commitovani rad preživi.

## Završeno u ovom turnu

### FE2-2 (#32) — access token iz `localStorage` u memoriju
Commiti `3193f3c` + `3978b66`. CI `41218607380` i `41218925886` oba success.
Detalji u `STATUS.md` sekcija „FE2-2 — Auth migracija".

### REL-7 (#33) — Tuya snapshot: nepoznato nije nula (B-026)
Commiti `62977ab` + `83bd15a` + `e0b4e8b`. CI `41226811814` i `41227022427`
oba success. Detalji u `STATUS.md` sekcija „REL-7 — Tuya snapshot".

Ključno: aplikacija **ne upravlja** Tuya termostatom (read-only API, 0 PUT/POST
pogodaka), pa B-026 nije fizički sigurnosni rizik nego integritet podataka.
Ispravka ne uvodi fail-safe stanje nego princip *ne bilježiti promjenu koju ne
možemo posmatrati*. Zastavica `INCOMPLETE_SNAPSHOT_GUARD_ENABLED`, zadano
UKLJUČENO.

## NALAZ `TempSet /2` — RIJEŠEN (vlasnik potvrdio uslov)


**RJEŠENJE (2026-10-31).** Vlasnik je potvrdio uslov: *ako `TempSet` dolazi iz
Tuya adaptera, a ne iz baze, i on treba `/2`*. Provjereno u kodu —
`tuya.adapter.ts:303` čita `status['TempSet']` (odgovor Tuya API-ja iz
`fetchStatus`), **nije** iz baze. Nasuprot tome `activeInterval.targetTemp`
dolazi iz `prisma.thermostatProgram` i **već je normalizovan** jer
`decodeTuyaProgram` dijeli s 2 na `:393` prije `syncProgram` upisa — tamo se ne
dijeli ponovo. Ispravka primijenjena samo na Tuya granu.

Regression guard ažuriran na realistične duplirane vrijednosti (`TempSet:42`
→ `targetTemp:21`); `TempSet:0` ostaje kao kontrola stvarne nule. Guard EXIT=0,
jest 18/18, eslint (CI komanda) 0 errors, type-check 0 grešaka izvan Prisma
kaskade.

**OTVORENO (nije verificirano):** `test/unit/tuya-adapter.spec.ts:67,189`
koristi `TempSet: 44` ali **ne assertuje apsolutnu ciljnu temperaturu** (testira
brojanje zahtjeva i cache), pa ne štiti ovu ispravku. Vrijedi dodati test koji
assertuje jedinice.

---

## (historijski) NOVI NALAZ — bio otvoren, čeka vlasnika

### (historijski) `TempSet` se ne dijeli s 2 dok se `TempCurrent` dijeli — HIPOTEZA

Vlasnik je potvrdio da Tuya vraća duplirane vrijednosti (44 → 22 °C).

| Linija | Kod | Dijeli s 2? |
|---|---|---|
| `tuya.adapter.ts:333` | `rawCurrentTemp / 2` | **da** |
| `tuya.adapter.ts:393` | `i.temp / 2` (program) | **da** |
| `tuya.adapter.ts:303` | `toNullableNumber(status['TempSet'])` | **NE** |

Dokaz da je i `TempSet` dupliran: `test/unit/tuya-adapter.spec.ts:66-67`
koristi `TempCurrent: 40, TempSet: 44` (40/2=20 °C, 44/2=22 °C).

**Zašto je HIPOTEZA, ne VERIFIKOVANO:** nema pristupa stvarnom Tuya API-ju, a
navedeni test ne assertuje ciljnu temperaturu (testira brojanje zahtjeva), pa
nije dokaz namjere.

**Posljedica ako je tačno:** fallback grana (`Mode !== '0'` ili bez programa)
vraća cilj 44 umjesto 22, pa `resolveHeatingState` (`polling.service.ts:467-468`)
vidi `20 < 44` i **uvijek grije**.

**Namjerno NIJE dirano** u REL-7 — bila bi promjena ponašanja bez odobrenja, a
vlasnik ima stvarni uređaj da to potvrdi.

**Idući korak kad vlasnik potvrdi:** podijeliti `TempSet` s 2 na `:303`, dodati
test koji assertuje jedinice, i provjeriti da li `Mode === '0'` grana (koja
čita cilj iz baze, `activeInterval.targetTemp`) već ima °C — miješanje jedinica
između te dvije grane je isto moguće.

## Sljedeće po redoslijedu (Talas D)

`docs/audit/MASTER-ROADMAP.md`. REL-7 (#33) gotov. Sljedeći:

**REL-8 (#34)** — red u `docs/audit/backend/09-improvements-backlog.md`.

Ostatak Talasa D: FEAT-6, PERF-1, PERF-2, SEC-6, FE2-10, FE2-3, MO2-12,
MO2-13, MO2-15, MO2-20. (REL-4, MAINT-2, MAINT-4 već gotovi.)

Blokirani: MO2-7 (#29), FORM-1 (#31 — vlasnik traži referentne senzorske
uzorke).

## Obavezujuće konvencije (iz prethodnih turnova)

- Nikad PR na ovoj grani — vlasnik ručno radi pull/merge. Commit+push odobreni.
- **Provjeriti CI ishod prije nego se korak proglasi gotovim.** Poll
  `gh api .../actions/runs/{id}` do `completed`, pa provjeriti jobove i
  anotacije. `gh run view --log-failed` NE radi (host nije na allowlistu).
- CI lint korak pokreće eslint **bez** `--fix`. Lokalni `npm run lint` ima
  `--fix`. Provjera mora koristiti CI-jevu tačnu komandu:
  `npx eslint 'src/**/*.ts' 'test/**/*.ts' --ignore-pattern 'src/generated/**'`
- Svaki korak plana: cilj, fajlovi, migracija/rollback, feature flag, obavezni
  testovi s komandom, pomoćne skripte, kriterij prihvatanja, procjena truda,
  kompatibilnost unazad.
- Dokumenti na bosanskom, identifikatori na engleskom.
- Backlog redovi se označavaju `**RIJEŠENO U KODU <datum> (ID, sha):** …
  **OSTAJE OTVORENO:** …`. Tabela ima **6 ćelija** — pazi na `|` u tekstu
  (REL-7 je imao `number | null` i razbio tabelu na 7).
- `MASTER-ROADMAP.md` je čista ICE rang-lista, bez oznaka napretka.
- Nakon commita koji dokument pokazuje na SHA: **ne amendati**, napraviti novi
  commit.

## Okruženje — šta radi, šta ne

**Radi:** `npm ci` (backend/frontend/mobile), `npx jest <path>`,
`npx tsc --noEmit`, `npx eslint`, 9 audit skripti (`scripts/audit/*.py`),
`gh api`, repro skripte (`node scripts/audit/*.cjs`).

**NE radi (ne pokušavaj ponovo):**
- `binaries.prisma.sh` → Prisma klijent se ne može generisati ⇒
  `src/generated/prisma/` nedostaje ⇒ `tsc` daje ~2000 grešaka kaskade.
  **Mjerodavno je brojati samo greške u svojim fajlovima, isključujući
  TS2307 i TS2339.**
- `tuya-adapter.spec.ts` i `thermostat-polling-metrics.spec.ts` padaju lokalno
  (nedostaje Prisma klijent) — **potvrđeno da padaju identično na čistom
  HEAD-u**, dakle pre-postojeće.
- Playwright browser CDN, `eas-cli`, `docker`, `nginx`, postgres, redis,
  emulator, `apt-get` (PEP 668 / dpkg lock).
- `node_modules` i `/tmp` se brišu između turnova ⇒ prvo `npm ci`.
- **Bash heredoc izobličava `š`/`č`/`ž`** ⇒ koristiti `write_file` ili Python.
- **Non-ASCII zamke:** tri puta nađen homoglyph (`иначе` u `api.ts`, `gutа`
  U+0430, `о` U+043E u `STATUS.md:468`, `е` U+0435 u `04-findings.md:246`) i
  kineski `事件` u komentaru. Uvijek skenirati:
  `re.findall(r'[\u0400-\u04FF\u4E00-\u9FFF]+', s)`

## Metode koje su se pokazale nužnim

1. **Mutacijska provjera s asertacijom na anker.** „Test prolazi" ne znači
   „test nešto provjerava". Python `assert s.count(old)==1` prije mutacije —
   bez toga mutacija tiho ne bude primijenjena. REL-7: 4/4. FE2-2: 6/6.
2. **Provjeri na čistom HEAD-u prije nego tvrdiš „ja sam ovo slomio"**
   (`git worktree add /tmp/x <sha>`). Više puta se ispostavilo da je pad
   pre-postojeći.
3. **CI-jeva tačna komanda, ne lokalni alias.** REL-7 je pao u CI-ju upravo
   zbog `--fix` razlike.
4. **Poređenje anotacija s prethodnim runom** da se dokaže „nula novih".
5. **Ne vjerovati dokumentaciji bez provjere.** `12-sec4-refresh-token.md:41`
   je preporučivao `SameSite=none` što je vodilo u nesigurniju konfiguraciju.
