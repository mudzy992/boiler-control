# 31 — Backfill `DailyRecord`-a iz podataka koji već postoje

Odgovor na dva pitanja: *kada je `DailyRecord` nastao* i *može li se historija
popuniti iz onoga što je već u bazi*. Drugo pitanje ima izmjeren odgovor, ne
procjenu: **301 dan** bi se mogao upisati, sa jasno označenim izvorom po stupcu.

Sve u ovom dokumentu je izmjereno na produkciji kroz `backend-build.yml`.
**Backfill je izvršen 2026-11-08**: upisano je **301 red** (run `42608075222`,
kredencijal `DATABASE_URL_BACKFILL`, jedna transakcija). Prije upisa je u istom
runu ispisan dry-run sa istim brojevima — 301 red, izvori: ciklusi 115, plin 131,
stepen-dan 4, predlog 298.

---

## 1. Kada je tabela nastala

| | |
|---|---|
| Migracija | `backend/prisma/migrations/20261108100000_daily_record/migration.sql` |
| Commit | `efe3792`, 2026-11-08 23:05 UTC |
| Sadržaj | `CREATE TABLE "DailyRecord"`, enum `FlowSetSource`, unique `(homeProfileId, localDate)` |
| Backfill u migraciji | **nema** — migracija to i piše: nijedan red se ne backfiluje |
| Redova danas | **1** |

Kasnije su na istu tabelu dodavane kolone, svaka svojom migracijom:
`20261111100000_daily_outcome`, `20261112100000_proposal_shadow`,
`20261116100000_exploration`, `20261117100000_heat_rate`,
`20261118100000_boiler_output_kw`.

Dakle tabela je nova i namjerno prazna. Historija **nije izgubljena iz baze** —
samo je nema u ovoj tabeli. Ciklusi su u `HeatingEvent`, stvarna polazna i
vanjska temperatura u `BoilerHistory`, plin u `GasReading`, a ono što je korisniku
tada rečeno u `Recommendation`.

## 2. Koliko dana pokrivaju izvori

| Izvor | Mjereno | Pokriva dana |
|---|---|---|
| `Recommendation` (stare preporuke) | 299 dana | **298** |
| `GasReading` | 132 očitanja, 909,8 m³, medijana razmaka **1 dan** | **131** |
| `HeatingEvent` | 415 ciklusa, 637,8 h, 2026-01-07 → 2026-11-09 | **115** |
| `BoilerHistory` | 116 dana | 116 (ali v. §4) |
| `ThermostatObservation` | 18 uzoraka ukupno, 1 dan sa ≥ 2 uzorka | 1 |
| `WeatherCache` / `WeatherV2Cache` | zadnji fetch, ne historija | 0 |
| **Ukupno za upis** | | **301** (upisano) |

Plin je bitno bolji izvor nego što se mislilo: medijana razmaka je jedan dan, pa
dnevna potrošnja postoji za 131 dan. Ono što ne postoji je veza plin ↔ stepen-dan
(0 dana), jer za stepen-dan treba dnevni prosjek vanjske temperature.

### Stanje poslije upisa (izmjereno, run `42608751388`)

| | |
|---|---|
| `DailyRecord` redova | **302** (301 backfill + 1 postojeći) |
| sa plinom | 131 |
| sa stepen-danom | 4 |
| sa `shadow*` | **0** — kako i treba |
| ponovni dry-run | **0 novih dana** → upis je idempotentan |
| plin po stepen-danu (prvi put izračunljivo) | **4 dana, 0,836 m³/K·dan** |

Onih 0,836 je prvi broj te vrste koji sistem ima; ali je iz **4 dana** i ne nosi
zaključak — treba ≥ 30 dana sa oba podatka prije nego se iz njega bilo šta tvrdi.

## 3. Šta bi se upisalo, po stupcu

| Stupac | Izvor | Uslov |
|---|---|---|
| `proposedFlowTemp`, `proposedAt` | `Recommendation` | postoji preporuka tog dana |
| `cycles`, `medianCycleMin`, `dutyPercent` | `HeatingEvent` | dan ima zatvorene događaje |
| `overshootC`, `undershootC` | `HeatingEvent` (`roomCurrentTemp` vs `roomTargetTemp`) | cilj postoji po događaju |
| `flowSetC` | `BoilerHistory.actualFlowTemp` — zadnje očitanje dana | polazna je tada bila ta |
| `gasM3` | `GasReading.consumption` | zbroj očitanja tog dana |
| `degreeDays` | `BoilerHistory.externalTemp`, baza 15 °C | **samo** uz ≥ 8 uzoraka/dan |
| `flowSetSince` | — | ostaje `null`: trenutak promjene nije zapisan |
| `flowSetSource` | — | uvijek `UNKNOWN`, i kad je vrijednost nađena |
| `modelVersion`, `outcomeVersion` | — | `backfill-events-1` |
| `outcomeAt` | — | vrijeme backfilla (tada su izračunate) |

`dutyPercent` iz događaja (stvarno trajanje rada) **nije** isti broj kao
`dutyPercent` iz uzoraka (udio bucket-a od 5 min). Zato backfill redovi nose svoju
verziju: ko bude fitovao model mora ih moći isključiti ili im dati manju težinu.

## 4. Šta se ne može rekonstruisati

| Grupa | Zašto |
|---|---|
| `shadowFlowC`, `shadowAction`, `shadowReasons` | odluka tada nije donesena; upisati je sada bilo bi tvrditi da jeste |
| `params` | ulazi proračuna nijesu zapisani, pa se ne zna šta je model tada znao |
| `heatRateCPerHour`, `hysteresisK`, `hysteresisAsymmetryK` | traže seriju uzoraka ≥ 2 po ciklusu; postoji 1 takav dan |
| `nightUndershootC`, `nightMinOutdoorMeasuredC`, `nightFlowC` | noćni prozor 22:00–06:00 nema uzorke: 0 noći sa uzorcima |
| `degreeDays` za 97 od 101 dana sa `BoilerHistory` | uzorci vanjske temperature su prorijedili ispod 8/dan |
| `WeatherCache` kao historija | to je zadnji fetch, ne dnevni zapis |

`computeDayOutcome` se **ne** koristi za backfill: traži ~288 uzoraka na dan i
svaki prošli dan bi vratio `INCOMPLETE`.

## 5. Kako se pokreće

```bash
# read-only, ništa ne mijenja — ovo je pokrenuto u CI-ju
npm run backfill:daily -- --dry-run

# upis — traži poseban kredencijal koji smije pisati
DATABASE_URL_BACKFILL=… npm run backfill:daily -- --apply --from 2026-01-01
```

Skripta **neće** uzeti `DATABASE_URL` kao zamjenu za `DATABASE_URL_BACKFILL`, da
„dry-run" ne bi postao upis zbog pogrešno postavljene varijable. Upis ide u jednoj
transakciji (`BEGIN`/`COMMIT`, `ON CONFLICT (homeProfileId, localDate) DO NOTHING`):
djelimičan backfill je stanje koje niko nije opisao.

Zona se određuje istom funkcijom kao kod živog pisca
(`weatherTimezone` → `user.timezone` → `Europe/Sarajevo`). Prva verzija skripte je
tražila potvrđenu zonu i vratila 0 redova, jer produkcijska kuća nema zonu; to bi
značilo da se dani režu po drugim granicama nego kod živih redova.

## 6. Šta ovo ne dokazuje

- Upis je potvrđen samo sa brojem redova i sažetkom izvora iz CI loga; nije
  otvoren nijedan red i nije provjereno da li se vrijednosti poklapaju s onim što
  je tog dana zaista bilo na kotlu. Prva provjera je moguća tek uz ponovni
  `--dry-run` (sada bi vratio 0 novih dana) i uz čitanje nekoliko redova.
- Brojevi su iz **jedne** kuće i jednog korisnika; nema podataka kako se ponaša
  na drugom.
- Ne provjerava se da se backfill redovi slažu sa budućim živim redovima za isti
  dan; to se vidi tek kad oba postoje.
- `flowSetC` je zadnje **očitanje**, ne postavljena vrijednost u trenutku
  predloga; dan sa više promjena polazne ima jednu vrijednost.
- Stepen-dan iz uređaja je iz mjerenja na jednoj lokaciji, ne iz meteorološke
  stanice; baza 15 °C je izabrana, ne izvedena iz podataka.
