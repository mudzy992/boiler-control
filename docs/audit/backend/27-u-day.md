# 27 — `u_day`: dnevni dobitak (sunce, gosti, kuhanje)

**Status:** realizacija. **Datum:** 2026-11-15. **Grana:** `arena/da41e5ba-boiler-control`.
**Ulazi:** `17` §13 korak 7 (mjerenje ishoda + `u_day`), §1 (dnevni član ±1–2 °C),
`22` (model kuće), `24` (kontroler), `19` §6.2 (`u_day` prije tvrdnje o uštedi).

---

## 0. Problem koji rješava

Model kuće opisuje **prosječan dan**: `y = s·x − c`. Stvarni dan nosi dobitke koji u
modelu nisu: sunce kroz prozor, gosti, kuhanje, peglanje, otvoren prozor. Njihova
posljedica je mjerljiva u podacima koje već imamo — tog dana se kuća grijala **manje**
nego što jednačina predviđa za istu vanjsku temperaturu.

Bez tog člana kontroler na sunčan dan predlaže polaznu za oblačan: kuća se pregrijava,
termostat gasi, pa se javljaju kratki ciklusi — tačno ono što kontroler treba da smanji.

## 1. Odakle broj — ostatak, ne senzor

```
predviđeno = s·x − c            (s = slopeS, c = internalGainC iz modela)
ostatak    = y − predviđeno
dobitak    = −ostatak           (više dobitaka ⇒ manje predato ⇒ ostatak < 0)
```

Znak je jedina stvar koja ovdje može tiho pokvariti sve: **pozitivan `u_day` znači više
dobitaka**, pa polazna ide **niže**. Ako se znak okrene, greška ide u opasnu stranu —
kuća se hladi, a aplikacija spušta. Zato znak ima svoj test, a ne samo komentar.

Računa se nad **svim** danima iz fita, uključujući one koje je fit izbacio kao otvoren
prozor: upravo ti dani nose najveći dobitak, a granica ih drži u razumnoj mjeri.

## 2. Tri pravila koja drže procjenu poštenom

| Pravilo | Vrijednost | Zašto |
|---|---|---|
| granica dobitka | **±2 K** | `17` §1: dnevni dobitak je ±1–2 °C ekvivalenta. Veći ostatak nije sunce nego otvoren prozor ili loš uzorak. |
| medijana, ne prosjek | zadnjih **7** dana | jedan rođendan ne smije pomjeriti odluku; prosjek bi ga razdijelio na sve dane |
| minimum dana | **4** | medijana 3 dana je još šum; bez 4 dana procjena je `null` |

`null` **nije** nula. Nula bi bila tvrdnja „prosječan dan"; `null` je „nemam procjenu" i
znači da se ništa ne oduzima. Isto pravilo kao kod nagiba: neizmjerena vrijednost se ne
izmišlja.

Uz procjenu se pamti i **rasipanje** (`max − min` u prozoru). Ono nije dio odluke, ali
kaže koliko jedna odluka zavisi od jednog dana — 0,3 K je mirna sedmica, 1,9 K nije.

## 3. Gdje ulazi u odluku

```
F_eq    = cilj + s·(cilj − T_vanja,min)      // prosječan dan, gornji CI za s
F_model = F_eq − u_day                        // dan sa dobitkom traži manje
```

`u_day` mijenja **baznu** vrijednost kontrolera. Time automatski nasljeđuje pravilo
„nikad ispod ravnotežne polazne": na sunčan dan baza je niža, pa je i pod niže dozvoljeno
spustiti — ali ne ispod nje same. Granice (`±2 K/dan`, raspon, noćni minimum, plafon
sistema i modela) ostaju netaknute i redoslijed im je isti (`23` §5).

Praćenje kroz vrijeme:

| Fajl | Šta je |
|---|---|
| `src/modules/HomeModel/day-gain.ts` | čista matematika: `dayGains`, `estimateDayGain`, `applyDayGain` |
| `src/modules/HomeModel/home-model.service.ts` | računa uz fit i upisuje `uDayC`, `uDayDays`, `uDayAt` |
| `src/modules/DailyRecord/proposal-shadow.service.ts` | oduzima `u_day` od ravnotežne polazne |
| `prisma/migrations/20261115100000_day_gain` | tri nullable kolone na `HomeModel` |

## 4. Životni ciklus vrijednosti

- **Uspješan fit** → `uDayC` se računa iz ostataka istog fita i upisuje. Nikad nije stariji
  od nagiba.
- **Uspješan fit, ali manje od 4 dana** → `uDayC` se **briše** (`null`). Stara procjena ne
  smije nadživjeti dokaz koji ju je dao.
- **Neuspješan fit** (`insufficient`/`rejected`) → ništa se ne dira, kao i nagib: procjena
  koja nije nastala ne zamjenjuje onu koja jeste, a stanje je ionako `DEGRADED`.

## 5. Šta je provjereno

`npx jest src/modules/HomeModel src/modules/DailyRecord` → svi testovi prolaze, od toga
**14 novih** za `day-gain` i 4 nova na nivou servisa:

- **znak**: dan sa manje predatog grijanja nosi pozitivan dobitak; hladniji od modela
  negativan; primjena: pozitivan spušta, negativan podiže;
- **granica**: sirovo 5 K daje 2 K i `capped: true`; isto u minusu;
- **medijana**: 6 običnih dana i jedan rođendan daju običan dan, rasipanje 1,9 K;
- **prozor**: 8 starih dana sa 9 K ne pregazi 4 nova sa 0,5 K — medijana je 0,5;
- **minimum**: 3 dana → `null`, ne nula;
- **slučajevi bez procjene**: `null`/`undefined`/`NaN` ne mijenjaju polaznu;
- **servis**: uz nagib se pamti i `u_day` (na simuliranoj kući sa stalnim dobicima ≈ 0,
  jer bi inače dobitak bio brojan dvaput), a kad fita nema — ne dira se;
- **kontroler**: 2 K dobitka spušta ravnotežnu sa 44,04 na 42,04; −1,5 K podiže na 45,54;
  korak spuštanja (±1 K) i dnevna granica (±2 K) i dalje drže dnevnu promjenu.

## 6. Šta ostaje

| Šta | Zašto |
|---|---|
| kalibracija prije tvrdnje o uštedi | `u_day` se sada **procjenjuje**; za tvrdnju treba ≥ 28 dana i baseline (`19` §5) |
| sunce kao ulaz, ne kao ostatak | bez solarnog senzora ostatak je jedini izvor; sa senzorom bi `u_day` imao dokaz umjesto zaključka |
| raspodjela po satu | danas je jedan broj po danu; jutarnji i popodnevni dobitak nisu isti |
| `u_day` u dnevnom zapisu | pamti se u modelu, ne po danu — za analizu bi koristilo zapisati ga uz predlog |
