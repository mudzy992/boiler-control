# 24 — Kontroler: silazak do granice, i granica koja nije bila očigledna

**Status:** realizacija + simulacioni gate. Korak 6 iz `17` §13 (**prvi dio**).
**Datum:** 2026-11-12. **Grana:** `arena/da41e5ba-boiler-control`.
**Ulazi:** `17` §8 (pravila), §11 (prihvat), §12 (vlasnikov primjer), `22` (`s`), `23` (noćni minimum, ishod dana).

---

## 0. Šta ovaj korak jeste — i šta još nije

Napravljena je **odluka** (`proposal-controller.ts`) i **mjerni gate koji je pušta dalje**
(`scripts/audit/controller_sim.cjs`). Nije napravljeno **povezivanje na predlog**: `DailyRecordWriter`
i dalje piše isto što je pisao u `20`. Nijedan korisnik još ne dobija drugu polaznu.

To nije nedovršen posao nego red koji `17` §11.1 sam propisuje („ide se u shadow režim,
a ne direktno na bojler"): odluka mora prvo proći simulaciju, pa onda mjesec-dva shadow
upisa, pa tek onda zamijeniti predlog. Ovaj dokument pokriva prva dva koraka te lestvice.

## 1. Šta je napravljeno

| Fajl | Šta je |
|---|---|
| `src/modules/DailyRecord/proposal-controller.ts` | `decideProposal` (čista), `shortCycleFloorFrom` |
| `src/modules/DailyRecord/tests/proposal-controller.spec.ts` | 24 testa |
| `scripts/audit/controller_sim.cjs` | zatvorena petlja kroz **stvarne** module, 60 dana, tri kuće |

## 2. Pravila koja su na kraju napisana

Red je dio odluke, ne stil.

| # | Situacija | Akcija | Izvor |
|---|---|---|---|
| 1 | `DEGRADED`, nema ishoda, nema modela | **ne mijenjaj** | `17` §8.2 |
| 2 | podbačaj dana ili noći > 1,0 K | **+1,5 K** (ne čeka dwell) | `17` §8.2, §8.3 |
| 3 | prebačaj > 1,5 K | **−1,0 K** | `17` §8.2 |
| 4 | kratki ciklusi (medijana < 6 min) | **ne spuštaj**; ako postoji naučena granica, idi na nju | v. §4 |
| 5 | udobno, dugi ciklusi | **−1,0 K**, ali **nikad ispod ravnotežne polazne** | v. §3 |
| 6 | manje od 3 dana od zadnje promjene | ne mijenjaj (osim pravila 2) | `17` §8.2 |
| 7 | bez poredljivih noći (`NO_FORECAST`, `NO_EVIDENCE`) | **ne spuštaj** | `23` §4 |
| 8 | tvrde granice | raspon 30–55, noćni minimum, ±2 K/dan | `23` §5 |

### 2.1 Dvije stvari iz `17` §8.2 koje nijesu implementirane

**Deadband 0,5 K** — nije implementiran jer **ne može da se aktivira**: svi koraci su
fiksni (1,0 K dolje, 1,5 K gore), pa je svaka promjena veća od 0,5 K. Pravilo je
zadovoljeno po konstrukciji, a ne zaboravljeno. Da je ostavljeno kao kod, bio bi to
mrtav uslov sa testom koji ne dokazuje ništa.

**Pravilo `T_max = 120 min`** — nije implementirano kao zasebno pravilo jer **mjerenje
za njega ne postoji**: `DayOutcome` (`23` §3) ne mjeri vrijeme do postizanja cilja.
Umjesto da se izmisli ulaz, oslanja se na posljedicu: ako kuća ne postigne cilj na
vrijeme, to se vidi kao podbačaj u jutarnjim satima i pravilo 2 reaguje. Razlika je
samo u slučaju „stigla je, ali tačno na granici" — a to je razlika koju 5-minutna
serija i `ε = 1 K` ne razlikuju. Ako se ikad pokaže potreba, mjeri se `reachedTargetMin`
u `DayOutcome`, pa pravilo dobija svoj ulaz.

## 3. Nalaz koji simulacija nije mogla izbjeći: ravnotežna polazna

Prva verzija kontrolera spuštala je polaznu dok ne nastane podbačaj, pa vraćala. U
simulaciji je to izgledalo uredno dok se ne pogleda dno: `light` kuća je došla do
32,2 °C, soba je pala na **18,96 °C**, i tek tada je uslijedilo podizanje. Podbačaj od
2,04 K — dvostruko više od tolerancije.

Uzrok nije podešavanje koraka nego fizika. Iz modela (`22` §2), uz `y = s·x − c`:

```
ravnotežna polazna:  F_eq = T_cilj + s·(T_cilj − T_vanja,min)
```

To je polazna pri kojoj kuća **u najhladnijem satu** drži cilj uz neprekidno grijanje.
Ispod nje cilj se matematički ne može držati — ne „teže", nego nikako. Kontroler koji
spušta ispod nje ne pravi uštedu; on troši komfor i to naplaćuje kroz podbačaj.

Zato je pravilo: **nikad ispod `F_eq`**. To nije konzervativnost nego granica.

Posljedica za računanje: `F_eq` se računa sa **gornjom** granicom intervala za `s`
(`slopeCiHigh`). Potcijenjen `s` daje prenisku `F_eq`, a preniska `F_eq` je hladna kuća.
U simulaciji je razlika između `s` i `s_high` oko 0,5 K polazne.

### 3.1 Šta onda „spuštanje" uopšte donosi

U ovom modelu — **ništa po pitanju gasa**, i to treba reći glasno. Kuća drži 21 °C i pri
49,2 °C i pri 38,2 °C; razlika je u tome što pri 49,2 kotao radi 10-minutne cikluse, a
pri 38,2 radi 40-minutne. Prosječna isporučena toplota je ista, jer termostat to drži.

Ušteda postoji u stvarima koje model **ne sadrži**: povratna temperatura (kondenzacija),
gubici pri paljenju/gašenju, i kraći rad na visokoj polaznoj. Zato `17` §11.1 i kaže da je
„polazna iznad sobe" proxy, a ne mjera. Ovaj dokument to ponavlja: **kontroler snižava
cikluse i približava polaznu potrebi; procenat uštede se ne tvrdi.**

## 4. Kratki ciklusi: pravac nije očigledan, pa se ne pogađa

Vlasnikov primjer: na 49 °C ciklusi su bili prekratki, formula je tražila 49,74 — dakle
sistem mora predložiti vrijednost koja daje dovoljno duge cikluse.

Dva moguća uzroka kratkih ciklusa:

| Uzrok | Šta pomoći | Šta se vidi |
|---|---|---|
| polazna **previsoka** | spusti | soba brzo stigne cilj pa se gasi |
| polazna **preniska** uz minimalnu modulaciju kotla | podigni | kotao daje više nego što tijela odaju |

Iz jednog dana se to **ne razlikuje**. Zato kontroler ne pogađa smjer, nego pamti mjesto:

```
ako je medijana ciklusa < 6 min pri polazni F  →  granica = F + 1,0 K
```

Granica se pamti (najviša zabilježena) i nikad se ne ide ispod nje. Time vlasnikov
slučaj završava tačno kako traži: predlog ostaje na 50, a ne klize na 49 svaki drugi dan.
Bez pamćenja granice polazna bi padala na `F` i vraćala se na `F + 1` u krug.

### 4.1 Zašto prag 6 min, a ne 15

Prva verzija imala je **15 min**, obrazloženu kao donju granicu „normalnog" (4–5 ciklusa
na sat = 12–15 min). Simulacija je pokazala da je taj prag **štetan**: `light` kuća pri
današnjoj formuli ima medijanu 10 min, pa bi bila proglašena kratkom i kontroler se ne bi
smio spustiti — a spuštanje je upravo ono što cikluse produžava (10 → 40 min). Prag je
zato **6 min**: dvostruko iznad „2–3 min" koje praksa navodi kao kratak ciklus, a daleko
ispod normalnih 12–15. Služi da uhvati patološko ciklusiranje, ne da ocijeni rad koji je
samo ispod prosjeka.

Ovo je jedini prag u cijelom sistemu koji je pomjeren **na osnovu mjerenja**, i pomjeren
je zato što je stari blokirao učenje. Standard ga ne propisuje.

## 5. Simulacioni gate (obavezan prije koraka 6)

`node scripts/audit/controller_sim.cjs --days=60`

Fizika je ista kao u `learning_sim.cjs` (jedan kapacitet, tri kuće, senzor 0,5 °C, poll
1 min, kašnjenje 60 s), ali odluka **nije kopija** — ide kroz stvarne module:

```
uzorci (5 min) → buildDayRow + fitDailyBalance   (HomeModel/daily-balance.ts)
               → computeDayOutcome               (DailyRecord/day-outcome.ts)
               → nightFloorFrom                  (DailyRecord/flow-bounds.ts)
               → decideProposal                  (DailyRecord/proposal-controller.ts)
```

Rezultat (60 dana, isti seed kao `learning_sim`):

| Kuća | Polazna start → kraj | Ciklusa/dan | Medijana ciklusa | Podbačaj > 1 K poslije dana 10 | Najgori | `s` na kraju (istina) |
|---|---|---|---:|---:|---:|---:|
| light | 49,2 → **38,2** | 64,5 → **22,0** | 10 → **40 min** | **0/50** | 0,82 K | 0,757 (0,755) |
| medium | 49,2 → **42,2** | 40,0 → **12,5** | 15 → **65 min** | **0/50** | 0,80 K | 0,950 (0,943) |
| heavy | 49,2 → **43,3** | 23,5 → **7,5** | 30 → **109 min** | **0/50** | 0,78 K | 1,001 (1,000) |

Tvrdnje koje skripta provjerava (i padne ako ne prođu): polazna nikad izvan 30–55;
nijedan dan sa podbačajem > 1 K poslije dana 10; nijedan dnevni skok > 2 K koji nije
posljedica noćnog minimuma; kontroler je stvarno spustio polaznu.

### 5.1 Šta ovaj gate dokazuje, a šta ne

| Dokazano | Nije dokazano |
|---|---|
| pravilo „nikad ispod `F_eq`" drži komfor 60 dana u tri različite kuće | da model nema grešku koja bi u stvarnoj kući dala prenisku `F_eq` (sunce, DHW, otvoren prozor) |
| naučeni `s` se vraća na istinu kroz odluku, a ne samo kroz fit | da je ista polazna sigurna u kući sa bržom dinamikom od simulirane |
| ciklusi se produžavaju 2,5–3,6× | uštedu u gasu — model je ne mjeri |
| noćni minimum i granica iz kratkih ciklusa ne blokiraju učenje | da te dvije granice rade kad zatrebaju: u simulaciji nijedna nije aktivirana (baza je pokrila noć) |

Zadnji red je važan: sigurnosne granice su u simulaciji **neaktivne**, pa su njihove
tvrdnje pokrivene jediničnim testovima (`flow-bounds`, `proposal-controller`), ne
simulacijom. Simulacija ne može dokazati ono što se u njoj ne dogodi.

## 6. Dvije greške koje je gate uhvatio prije ijednog korisnika

Zapisano namjerno, jer je to jedina vrijednost gate-a:

1. **Spuštanje ispod ravnotežne polazne** — `light` je došla do 32,2 °C i 18,96 °C u sobi
   (podbačaj 2,04 K). Ispravljeno pravilom iz §3; prije toga je 4/50, 7/50 i 9/50 dana
   bilo preko tolerancije.
2. **Prag kratkih ciklusa od 15 min** — blokirao je spuštanje u `light` kući, pa je
   polazna **rasla** (49,2 → 53,2) i ciklusi se nijesu produžavali. Ispravljeno na 6 min
   uz objašnjenje u §4.1.

Oba su nađena u simulaciji, ne u proizvodnji — što je i razlog zašto simulacija ide prije
povezivanja.

## 7. Šta ostaje otvoreno

| Šta | Zašto |
|---|---|
| povezivanje na predlog (shadow) | traži kolone (shadow polazna + razlozi + naučene granice) i servis; sljedeći korak |
| pamćenje granica i zaboravljanje | granica iz kratkih ciklusa danas nema pravilo zaboravljanja; predlaže se 30 dana bez ponavljanja |
| exploration (`17` §8.5) | nije implementiran: traži `exploration` polje u `DailyRecord` i dokaz rezerve u 3 od 5 dana; bez toga bi bio nagađanje |
| `T_max` kao zasebno pravilo | v. §2.1 — nema mjerenja |
| tvrdnja o uštedi | traži baseline 28 dana + dva mjesečna `GasReading`-a (`19` §5) |
