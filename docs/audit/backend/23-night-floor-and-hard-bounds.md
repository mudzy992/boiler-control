# 23 — P4: noćni minimum i tvrde granice

**Status:** realizacija. Korak 5 iz `17` §13.
**Datum:** 2026-11-11. **Grana:** `arena/da41e5ba-boiler-control`.
**Ulazi:** `17` §8.2 (granice), §8.4 (redoslijed), §9 (mjerenje ishoda), §14.1 (`ε`), `20` (dnevni zapis), `22` (`s`).

---

## 0. Šta ovaj korak jeste — i šta još nije

Korak 5 gradi **dvije stvari koje kontroler ne smije sam izmišljati**:

1. **mjerenje ishoda dana** — šta se stvarno dogodilo u kući (koliko ciklusa, koliko je
   soba podbacila, posebno noću, kolika je stvarna banda termostata);
2. **tvrde granice** — fizički raspon, izmjereni noćni minimum i najveća dnevna
   promjena, s pravilom šta pobjeduje kad se sukobe.

**Kontroler još ne postoji.** Nijedan predlog se od ovog koraka ne mijenja: `DailyRecordWriter`
i dalje piše isto što je pisao u `20`. Ovo je mjerenje i ograda, ne odluka. Odluka je
korak 6, a `17` §13 uz njega veže obaveznu simulaciju.

Razlog za ovaj red je iz `17` §13: **sigurnost prije optimizacije.** Da je kontroler
napisan prvi, spuštao bi polaznu bez ijednog izmjerenog dokaza da je niža vrijednost
bila dovoljna.

## 1. Šta je napravljeno

| Fajl | Šta je |
|---|---|
| `src/modules/DailyRecord/day-outcome.ts` | čista funkcija: serija uzoraka → mjerni zapis dana |
| `src/modules/DailyRecord/flow-bounds.ts` | čiste funkcije: `applyHardBounds`, `nightFloorFrom` |
| `src/modules/DailyRecord/daily-outcome.service.ts` | I/O: učitava seriju, piše mjerna polja, noćni cron, `nightFloorFor` |
| `src/modules/DailyRecord/daily-record.module.ts` | izvozi oba pisca (`DailyRecordWriter`, `DailyOutcomeService`) |
| `prisma/schema.prisma` | `DailyRecord`: 7 novih mjernih kolona |
| `prisma/migrations/20261111100000_daily_outcome/migration.sql` | aditivna migracija (7 × `ADD COLUMN`) |
| testovi | `day-outcome.spec.ts` (20), `flow-bounds.spec.ts` (25), `daily-outcome.service.spec.ts` (8) |

## 2. Jedan zapis, dva pisca — i zašto ne jedan

`DailyRecord` sada ima **dva** pisca, i to je namjerno:

| Pisac | Kada | Šta smije pisati |
|---|---|---|
| `DailyRecordWriter` (`20`) | 06:00 lokalno | `proposedFlowTemp`, `proposedAt`, `skipReason`, `seasonMode` |
| `DailyOutcomeService` | 03:20 UTC, za završene dane | samo mjerna polja + `outcomeAt`, `outcomeVersion` |

Mjerni upis je `updateMany` sa `outcomeAt: null` **u samom uslovu**, ne u `if`-u prije
njega: dva procesa ne smiju oba upisati, a jedan dan se mjeri jednom. Test zaključava
i drugu stranu: u `data` mjernog upisa **nema** ni `proposedFlowTemp`, ni `proposedAt`,
ni `flowSetC` — predlog se ne prepisuje mjerenjem, ni slučajno.

## 3. Šta se mjeri i kako se zove

### 3.1 Ciklus

**Ciklus** je neprekinuti blok uzoraka sa `isHeating = true`. Trajanje je
`zadnji − prvi + 5 min`, jer uzorak na 5 min pokriva svoj interval `[t, t+5)`.
Blok 06:00–08:00 (25 uzoraka) traje **125 min**, ne 120 — i to je tačno ono što
kotao radi.

Ciklus od **jednog** uzorka se broji u `cycles`, ali **ne** ulazi u medijanu trajanja:
jedan uzorak nije trajanje, a izbacivanje iz broja bi sakrilo kratak ciklus, što je
upravo ono što nas zanima (`17` §9.2).

Ciklus koji pređe ponoć je **odsječen na granici dana**. To je mjerni artefakt i ne
skriva se: dan mjeri svoj dan. Alternativa — pripisivanje ciklusa danu u kojem je
počeo — miješala bi dva dana u jedan red i zamutila duty.

### 3.2 Podbačaj i prebačaj

`undershootC = max(cilj − soba)`, nikad negativno; `overshootC = max(soba − cilj)`.
**Cilj je uzorkovan, ne fiksan 21.** Kuća koja drži 20 °C uz cilj 20 °C nije podbacila;
mjerenje prema fiksnom cilju optužilo bi korisnika za njegov vlastiti izbor.

`comfortOk = undershootC ≤ ε`, sa `ε = 1,0 K` (`17` §14.1), istim iznosom kao
`DEAD_ZONE`. Ispod toga je normalna banda termostata, a ne neudobnost.

### 3.3 Noćni prozor

Noć **pripada danu koji se završava u 06:00**: `dan − 1 22:00` → `dan 06:00`.
Zašto tako, a ne `dan 22:00` → `dan + 1 06:00`:

- taj prozor je **u cjelini prošao** u trenutku kad se dan obračunava, pa je mjerenje
  konačno odmah — suprotni prozor bi u trenutku upisa bio odsječen na 03:20 i ostao
  trajno kraći;
- vrijednosti se upisuju **jednom** (`outcomeAt`), pa „dopuna" poslije nije opcija.

Cijena tog izbora: polazna koja je nosila tu noć nije uvijek polazna upisana u isti
dnevni zapis — ako se polazna mijenja, izmjena obično padne ujutro. Zato se uz noć
**ne pamti dnevni `flowSetC`, nego izmjerena polazna iz serije** (`ThermostatObservation.flowSetC`),
i to najčešća vrijednost u prozoru (kod izjednačenja kasnija). Tako dokaz uvijek nosi
polaznu koja je stvarno bila na kotlu te noći, a ne onu koja je u bazi možda upisana
dan kasnije.

Uz to se pamti i **najhladniji izmjereni sat te noći** (`nightMinOutdoorMeasuredC`) —
mjereno, a ne prognoza iz `nightMinC`. Bez toga se noći ne mogu porediti.

### 3.4 Izmjerena histereza

`hysteresisK = median(T_off − T_on)` i `hysteresisAsymmetryK = median(cilj − T_on)`,
mjereno na prelazima `grijanje → mirovanje`. Sa uzorkovanjem na 5 min bias je manji
od 0,2 K (`17` §9.4). Manje od **dva** prelaza ne daje mjeru — jedan prelaz je slučaj,
ne banda (`null`, ne nula).

Ovo je jedini način da se provjeri da li je `DEAD_ZONE = 1,0` (koji je zaključan)
uopšte ono što termostat radi. Ako izmjereno odstupa, to je nalaz, ne dopuštenje da
se `DEAD_ZONE` mijenja.

### 3.5 Odbijanje umjesto nule

`computeDayOutcome` ne vraća dan koji nije izmjeren:

| Razlog | Uslov |
|---|---|
| `INCOMPLETE` | manje od 80 % od 288 uzoraka (isti prag kao fit modela, `22` §3) |
| `NO_ROOM` | ima uzoraka, ali ni jedan nema sobnu temperaturu |

Preskočen dan **nije** dan sa nulom ciklusa. Servis ga preskače i zapiše razlog u log;
`outcomeAt` ostaje `null`, pa se dan može obraditi kad podaci dođu.

### 3.6 Granica popunjavanja

Servis popunjava **sedam dana nazad**, ne cijelu istoriju. Dan stariji od toga se ne
obračunava sam i `outcomeAt` mu ostaje `null`. To je granica koja se priznaje, a ne
skriva: serija za tako star dan se više ne čita, pa se ne bi ni mogla izmjeriti.
Ako se upis prijavi kao „obračunato", to je zato što je `updateMany` stvarno vratio
`count > 0`; ako je drugi proces upisao prvi, dan ide u „preskočeno" sa razlogom
`ALREADY_WRITTEN`, a ne u obračunate.

## 4. Noćni minimum — granica iz dokaza, ne iz modela

Pravilo (`17` §8.4):

> Ako je u **poredljivoj** noći polazna `F` podbacila, sljedeći put se ne ide ispod
> `F + 1,0`.

Poredljiva noć je ona čiji je izmjereni noćni minimum unutar **±2 K** od prognoze za
noć koja slijedi. Podbačaj veći od `ε = 1,0 K` je „podbacila"; manji je unutar bande.

| `basis` | `floorC` | Znači |
|---|---|---|
| `NO_FORECAST` | `null` | nema prognoze noćne minimalne — nema s čim porediti |
| `NO_EVIDENCE` | `null` | nema noći sa svim trima mjerenjima u toleranciji |
| `NO_FAILURE` | `null` | poredljive noći postoje, ni jedna nije podbacila |
| `RAISED_FROM_FAILURE` | `worstFailingFlowC + 1,0` | dokaz postoji |
| `AT_LIMIT` | `55` | traženo bi prešlo maksimum |

Tri stvari koje ovo pravilo **ne tvrdi**:

1. **Ne tvrdi da je `F + 1,0` dovoljno.** Tvrdi samo da `F` nije bilo. Prvo bi bio model
   koji nemamo; drugo je dokaz koji imamo.
2. **Ne tvrdi ništa kad dokaza nema.** `floorC: null` nije „nema ograničenja" nego
   „nema dokaza" — i tada kontroler **ne smije spuštati polaznu**. To je obaveza za
   korak 6, upisana i u kod (`flow-bounds.ts`, komentar uz `nightFloorFrom`).
3. **Ne koristi se kao cilj.** Minimum podiže predlog kad je predlog niži; ne vuče ga
   gore ako je predlog već iznad.

`+1,0 K` je najmanji korak koji izlazi iz izmjerene bande od 1,0 K. `+1,5 K` iz `17`
§8.2 je korak učenja, a ne granica koja se primjenjuje svaki dan — primijenjen dnevno
bio bi oscilacija.

## 5. Tvrde granice i redoslijed koji se ne mijenja

```
1. raspon [30, 55]              → RANGE
2. noćni minimum                → NIGHT_FLOOR
3. dnevna promjena ±2 K         → DAILY_CHANGE
4. ponovno raspon i noćni minimum
```

Korak 4 postoji zbog jednog slučaja: prethodna polazna 40, odluka 36, dokaz da je 40
bilo prenisko → minimum 41. Dnevna granica bi 41 spustila, ali **ne smije**: sigurnost
ima prednost pred glatkoćom. Rezultat je 41, a razlozi nose `NIGHT_FLOOR`. Kad se
sukob stvarno dogodi (minimum 44, dozvoljeno `[38, 42]`), rezultat je **44** i razlozi
su `['NIGHT_FLOOR', 'DAILY_CHANGE']` — prekršaj dnevne granice se ne skriva.

Nekonačan broj (`NaN`, `Infinity`) se **odbija** izuzetkom, ne „popravlja": `NaN`
provučen kroz `clamp` ostaje `NaN` i kao takav bi otišao na kotao.

`±2 K/dan` nije fizička granica nego protiv-oscilirajuća: bez nje bi jedan loš dan
vratio polaznu gore 8 °C, a sljedeći je spustio isto toliko.

## 6. Migracija

`20261111100000_daily_outcome` — sedam aditivnih, nullable kolona na `DailyRecord`:

`nightUndershootC`, `nightMinOutdoorMeasuredC`, `nightFlowC`, `hysteresisK`,
`hysteresisAsymmetryK`, `outcomeAt`, `outcomeVersion`.

Stari redovi ostaju kakvi su; `outcomeAt IS NULL` znači „još nije obračunat". Rollback:
`DROP COLUMN` za tih sedam; predlozi i serija ostaju netaknuti.

**Migracija nije primijenjena ni na jednu bazu.** `prisma validate`/`generate` u ovom
okruženju ne rade (mreža blokira `binaries.prisma.sh`), pa je SQL pisan ručno po istom
obrascu kao tri prethodne. To je rizik koji se rješava prvim `prisma migrate deploy`
na pravoj bazi, ne tvrdnjom da je provjereno.

## 7. Šta je provjereno — i čime

`npx jest src/modules/DailyRecord` → **87 testova, 87 prošlo** (5 suite-a):
`day-outcome` 20, `flow-bounds` 25, `daily-outcome.service` 8, plus postojeći
`daily-record-writer` i `proposal-schedule`.

Testovi ne provjeravaju „da li funkcija radi" nego **definicije**, jer će kontroler
naslijediti upravo njih:

- ciklus 06:00–08:00 je 125 min; blok od jednog uzorka se broji ali ne mjeri;
  ciklus preko ponoći je odsječen;
- podbačaj uz uzorkovan cilj; `ε` na granici je još udoban; prebačaj odvojen od podbačaja;
- noć: 21:55 i 06:00 nijesu noć, 22:00 i 05:55 jesu; minimum vanjske je minimum
  prozora, ne dana; polazna je najčešća u prozoru, kod izjednačenja kasnija;
- histereza: tri prelaza → medijana; jedan prelaz → `null`; prelaz bez cilja daje
  bandu ali ne asimetriju;
- granice: svih 5 kombinacija raspona, redoslijed koji ne dopušta da dnevna promjena
  spusti ispod minimuma, `NaN` odbijen, i prelaz preko 9 × 5 × 6 kombinacija ulaza
  gdje se provjerava da je izlaz uvijek unutar `[30, 55]` i nikad ispod noćnog minimuma;
- servis: mjerni upis ne dira polja predloga; `outcomeAt: null` je u uslovu upisa;
  nepotpun dan se preskače sa razlogom; kad drugi proces upiše prvi, dan je
  „preskočeno / `ALREADY_WRITTEN`", a ne „obračunato"; nepoznata kuća je greška.

**Šta nije provjereno:** TypeScript kompilacija cjeline (`tsc` nije dostupan u
okruženju) — provjerava se samo ono što ts-jest učita. Zato su i `flow-bounds.ts`
i `day-outcome.ts` u cjelini uvezeni u testove; nema mrtvog koda koji nije prošao
kroz transpajler.

## 8. Šta ostaje otvoreno

| Šta | Zašto nije sada |
|---|---|
| kontroler (korak 6) | obavezna simulacija prije njega (`17` §13) |
| `a`, `b` apsolutno | nema prozora mirovanja u mjerenjima (`22` §0) |
| `u_day` u formuli | korak 7; danas postoji samo zapis ishoda, ne i njegova težina |
| tvrdnja o uštedi | traži 28 dana baseline-a + dva mjesečna `GasReading`-a (`19` §5) |
| primjena migracije | nema baze u okruženju |
