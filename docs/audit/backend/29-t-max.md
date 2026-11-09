# 29 — `T_max`: polazna koja stigne do cilja

**Status:** realizacija. **Datum:** 2026-11-17. **Grana:** `arena/da41e5ba-boiler-control`.
**Ulazi:** `17` §8.6 (odakle 120 min), §14.2 (obaveza prije puštanja), `24` §7,
`27` (`u_day`), `28` (istraživanje).

---

## 0. Obaveza koja je stajala otvorena

`17` §14.2 je zapisao, kao posljedicu simulacije:

> **`T_max` mora biti tvrdo ograničenje u kontroleru, ne metrika.** U simulaciji nije
> prekoračen ni u jednoj kući, ali nije bio ni ograničen — kontroler ga nije provjeravao.
> Prije pravog bojlera to postaje guard: ako predlog ne može dostići cilj u 120 min pri toj
> polaznoj, predlog se podiže.

Neprovjereno ograničenje nije ograničenje. Ovaj dokument ga provodi.

## 1. Odakle brzina dogrijavanja

Vrijeme do cilja je `t = ΔT / heatRate`, pa treba **brzina**, ne nagib kuće. Nagib `s`
opisuje odnos gubitaka i dobitaka — iz njega se ne dobija „koliko K na sat".

Brzina se zato **mjeri iz serije**, po ciklusu grijanja (`day-outcome.ts`):

```
rate = (T_room(zadnji) − T_room(prvi)) / (t_zadnji − t_prvi)      [K/h]
```

četiri pravila:

| Pravilo | Zašto |
|---|---|
| samo ciklusi u kojima soba **raste** | ciklus u kojem soba stoji uz uključeno grijanje znači da kotao ne može više — njegov nagib nije mjera brzine |
| trajanje **između** prvog i zadnjeg uzorka | dodavanje intervala (kako se mjeri trajanje ciklusa) razdijelilo bi isti rast na duže vrijeme i podcijenilo brzinu |
| polazna i soba **istog** ciklusa | par brojeva koji se poslije preračunava mora opisivati jedan mjereni uslov |
| medijana po ciklusu, a ispod 0,1 K/h se odbija | jedan brz ciklus nije dan; ispod praga je šum, ne mjerenje |

Mjeri se **neto** dogrijavanje: uključuje gubitke koji u tom trenutku teku. To je i pitanje
na koje odgovor treba — „koliko brzo soba stigne do cilja", ne „koliko kotao daje".

## 2. Preračun na drugu polaznu

```
heatRate(F) ≈ heatRate_measured · (F − R) / (F_measured − R)
F_potrebno   = R + (F_measured − R) · (ΔT / (T_max/60)) / heatRate_measured
```

Linearnost je **pretpostavka** (toplina koju emiter preda raste sa razlikom polazna–soba) i
najslabija je karika proračuna. Zato se njome polazna samo **podiže**:

- greška u pretpostavci tada ide u smjeru **više** topline, a ne manje;
- pod nikad ne snižava odluku koja je već viša;
- sve tvrde granice i dalje važe, pa je stvarni skok najčešće `+2 K/dan`, a ne izračunatih
  +5 K. Guard ne preskače korake: ako ni sutra ne stigne, podbacivanje je izmjereno i
  pravilo `UNDERSHOOT` diže bez dwell-a.

## 3. Redoslijed u kontroleru

```
… konvergencija → „nikad ispod ravnotežne" → istraživanje → T_max pod → tvrde granice
```

`T_max` je **poslije** istraživanja i to je namjerno: istraživanje smije ići niže samo dok
se stigne na vrijeme. Kad ne stigne, `T_max` poništava istraživanje (`exploration: false`) —
komfor je jači razlog od učenja. Dwell se ne primjenjuje: promašen cilj nije udobnost.

## 4. Šta guard ne radi

| Situacija | Ponašanje | Zašto |
|---|---|---|
| nema izmjerenog dogrijavanja | pod ne postoji | podizanje bez mjerenja je nagađanje, a nagađanje prema gore troši gas |
| nema sobne temperature | pod ne postoji | ne zna se koliko stepeni fali |
| soba je na cilju ili iznad | pod ne postoji | nema šta da se stigne |
| polazna ispod sobne | proračun odbijen | nema pogonske razlike |

Prve dvije situacije su česte na hladnom startu — i tada nisu opasne: bez modela kontroler
ionako ne spušta polaznu (`NO_MODEL`, `COLD_START`).

## 5. Šta je provjereno

`npx jest src/modules/DailyRecord` → **220 testova, 220 prošlo**, od toga 19 novih:

- `heat-time.spec.ts` (10): pri izmjerenoj polaznoj vraća izmjereno vrijeme; viša polazna
  dogrijava linearno brže; dostignut cilj ne traje ništa; polazna ispod sobe nema vremena;
  neupotrebljivo mjerenje daje `null`; obrnuti proračun vraća polaznu koja stiže **tačno** u
  120 min i ta polazna zaista daje 120 min;
- `day-outcome.spec.ts` (5): nagib iz stvarnog trajanja ciklusa (2,75 K kroz 55 min = 3 K/h);
  ciklus bez rasta ⇒ `null`; bez polazne ⇒ `null`; ispod praga ⇒ `null`; medijana od dva
  ciklusa uzima **donji**;
- `proposal-controller.spec.ts` (4): pod diže HOLD odluku i ne čeka dwell; nikad ne spušta
  višu odluku; pobjeđuje istraživanje; prolazi kroz tvrde granice;
- `proposal-shadow.service.spec.ts` (4): 19 °C soba, cilj 21, izmjereno 0,8 K/h pri 45 °C ⇒
  pod 50,25 °C, ali dnevna granica daje **47** i `DAILY_CHANGE`; bez mjerenja, bez sobne i sa
  sobom na cilju — pod ne postoji.

## 6. Šta ostaje

| Šta | Zašto |
|---|---|
| linearnost preračuna | najslabija karaka; traži mjerenje pri dvije polazne na istoj kući da se provjeri nagib krive |
| `T_max` u simulaciji | `controller_sim` ne mjeri brzinu dogrijavanja, pa je guard tamo neaktivan — pokriven je jediničnim testovima, ne simulacijom |
| brzina po uređaju | mjeri se iz jednog primarnog uređaja (`21` §7); dva termostata u dvije sobe daju dvije brzine |
| noćni prozor | guard koristi trenutni `T_max` za cijeli dan; noć ima svoj minimum i svoje pravilo (`23` §4) |
