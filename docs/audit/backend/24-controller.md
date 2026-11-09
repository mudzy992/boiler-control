# 24 — Kontroler: silazak do granice, i granica koja nije bila očigledna

**Status:** realizacija + simulacioni gate. Korak 6 iz `17` §13 (**prvi dio**).
**Datum:** 2026-11-12. **Grana:** `arena/da41e5ba-boiler-control`.
**Ulazi:** `17` §8 (pravila), §11 (prihvat), §12 (vlasnikov primjer), `22` (`s`), `23` (noćni minimum, ishod dana).

---

## 0. Šta ovaj korak jeste — i šta još nije

Napravljene su **tri stvari**: odluka (`proposal-controller.ts`), **mjerni gate koji je pušta
dalje** (`scripts/audit/controller_sim.cjs`) i **shadow upis** (`proposal-shadow.service.ts`).

Predlog se **još ne mijenja**: `DailyRecordWriter` i dalje piše isto što je pisao u `20`, a
odluka se računa uz njega i pamti u `DailyRecord.shadow*`. Nijedan korisnik ne dobija drugu
polaznu dok shadow period ne pokaže da se odluka i formula razlikuju tamo gdje treba.

To je lestvica koju `17` §11.1 sam propisuje („ide se u shadow režim, a ne direktno na
bojler"): simulacija → shadow → predlog. Ovaj dokument pokriva prve dvije prečke.

## 1. Šta je napravljeno

| Fajl | Šta je |
|---|---|
| `src/modules/DailyRecord/proposal-controller.ts` | `decideProposal` (čista), `shortCycleFloorFrom` |
| `src/modules/DailyRecord/tests/proposal-controller.spec.ts` | 24 testa |
| `src/modules/DailyRecord/proposal-shadow.service.ts` | shadow odluka uz predlog; pamti granicu iz kratkih ciklusa |
| `src/modules/DailyRecord/short-cycle-floor.ts` | dokad granica važi — 30 dana bez ponavljanja |
| `src/modules/DailyRecord/tests/proposal-shadow.service.spec.ts` | 13 testova |
| `src/modules/DailyRecord/{shadow-report.ts,shadow-report.service.ts,shadow.report.controller.ts}` | izvještaj shadow perioda (`26`) |
| `prisma/migrations/20261112100000_proposal_shadow/migration.sql` | 5 kolona na `DailyRecord`, 2 na `HomeModel` |
| `prisma/migrations/20261113100000_home_max_flow/migration.sql` | `HomeProfile.maxHeatingFlowC` (`19` §2) |
| `scripts/audit/controller_sim.cjs` | zatvorena petlja kroz **stvarne** module, 60 dana, tri kuće |

## 2. Pravila koja su na kraju napisana

Red je dio odluke, ne stil.

| # | Situacija | Akcija | Izvor |
|---|---|---|---|
| 1 | `DEGRADED`, nema ishoda, nema modela | **ne mijenjaj** | `17` §8.2 |
| 1b | model bojlera nije potvrđen iz kataloga | **ne spuštaj** (podizanje ostaje) | `25` §3 |
| 2 | podbačaj dana ili noći > 1,0 K | **+1,5 K** (ne čeka dwell) | `17` §8.2, §8.3 |
| 3 | prebačaj > 1,5 K | **−1,0 K** | `17` §8.2 |
| 4 | kratki ciklusi (medijana < 6 min) | **ne spuštaj**; ako postoji naučena granica, idi na nju | v. §4 |
| 5 | udobno, dugi ciklusi | **−1,0 K**, ali **nikad ispod ravnotežne polazne** | v. §3 |
| 6 | manje od 3 dana od zadnje promjene | ne mijenjaj (osim pravila 2) | `17` §8.2 |
| 7 | bez poredljivih noći (`NO_FORECAST`, `NO_EVIDENCE`) | **ne spuštaj** | `23` §4 |
| 8 | tvrde granice | raspon 30–55, noćni minimum, ±2 K/dan, **plafon sistema i modela** | `23` §5, `25` §4 |

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

## 6.5 Shadow upis — kako odluka ulazi u sistem bez uticaja

`ProposalShadowService.evaluate(homeId, localDate)` poziva se **poslije** upisa predloga
(isti prolaz u `DailyRecommendationService`, samo kad je red stvarno nastao) i:

1. čita današnji zapis (`nightMinC` = prognoza noći, `proposedFlowTemp` = formula);
2. čita `HomeModel` (`state`, `slopeCiHigh`, zapamćenu granicu iz kratkih ciklusa);
3. traži prošli predlog (za „prošlu polaznu" i dwell) i prošli obračunat ishod;
4. traži noćni minimum kroz `DailyOutcomeService.nightFloorFor` (\(23\) §4);
5. računa `F_eq` sa **gornjom** granicom intervala za `s`, uz plafon iz profila
   (`maxHeatingFlowC`);
6. poziva `decideProposal` i upisuje `shadowFlowC`, `shadowAction`, `shadowReasons`,
   `shadowAt`, `shadowVersion`.

Tri stvari koje su namjerno takve:

| Pravilo | Zašto |
|---|---|
| upis je `updateMany` sa `shadowAt: null` | odluka se računa jednom po danu; dva procesa ne smiju oba pisati |
| upis dira **samo** `shadow*` kolone | test to zaključava spiskom ključeva; `proposedFlowTemp`, `flowSetC` i mjerna polja su van domašaja |
| greška u shadow-u ne obara predlog | poziv je u `try/catch`; korisnik dobija predlog i kad kontroler padne |

**Granica iz kratkih ciklusa se pamti** u `HomeModel.shortCycleFloorC` i ne obara se dok
traje dokaz — **ali ističe poslije 30 dana bez ponavljanja** (2026-11-15, v.
`src/modules/DailyRecord/short-cycle-floor.ts`). Kratki ciklusi su svojstvo uslova, ne
kuće: granica nastala u blagoj zimi držala bi polaznu višom od potrebnog mjesecima, a
previsoka polazna je i dovela do pregrijavanja. Zato `shortCycleFloorAt` nosi datum
posljednjeg dokaza; istekla granica se **briše iz modela**, da ne stoji kao podatak koji
više ništa ne znači.

Dvije stvari se pritom **ne** rade:

- granica zapisana bez datuma (stariji redovi) **ostaje**: nedostatak datuma nije dokaz da
  je dokaz istekao, a brisanje bi vratilo polaznu tačno na vrijednost koja je pravila
  cikluse;
- sat ispred upisa ne čini granicu isteklom — negativna starost se čita kao nula.
Bez pamćenja polazna bi padala na `F` i vraćala se na `F + 1` u krug, jer se granica
izvodi iz jučerašnjeg dana — a jučerašnji dan je bio dobar tačno zato što je polazna bila
na `F + 1`.

Ono što shadow period treba da odgovori prije nego odluka postane predlog: koliko se
često odluka i formula razlikuju, u kojem smjeru, i da li je svaka razlika objašnjiva
razlogom iz `shadowReasons`. Ako razlika postoji bez razloga — to je greška, ne ušteda.

**Mjerenje je napravljeno 2026-11-14 → `26`.** `GET /api/daily-record/shadow-report`
vraća `differences`/`lowered`/`raised`/`changeSharePct`/`byReason`/`unexplained` i
presudu (`NO_DATA`, `UNEXPLAINED_DIFFERENCES`, `NOT_ENOUGH_DAYS`, `NO_DIFFERENCES`,
`READY`). Neobjašnjena razlika ima prioritet nad brojem dana: čekanje ne objašnjava
razliku, a presuda „još nema dovoljno dana" bi je sakrila iza roka.

## 7. Šta ostaje otvoreno

| Šta | Zašto |
|---|---|
| zamjena predloga odlukom | poslije shadow perioda; mjerenje postoji (`26`), pušta se na `READY` za stvaran dom |
| ~~pamćenje granice iz kratkih ciklusa~~ | **riješeno 2026-11-15:** ističe poslije 30 dana bez ponavljanja (§6.5) |
| exploration (`17` §8.5) | nije implementiran: traži `exploration` polje u `DailyRecord` i dokaz rezerve u 3 od 5 dana; bez toga bi bio nagađanje |
| `T_max` kao zasebno pravilo | v. §2.1 — nema mjerenja |
| tvrdnja o uštedi | traži baseline 28 dana + dva mjesečna `GasReading`-a (`19` §5) |

## 8. Šta je provjereno

`npx jest src/modules/DailyRecord` → **163 testa, 163 prošlo** (10 suite-a): `day-outcome` 20,
`flow-bounds` 25, `daily-outcome.service` 8, `proposal-controller` 26, `proposal-shadow.service` 13,
`shadow-report` 18 + `…service` 7 + `…controller` 6 (`26`), plus postojeći `daily-record-writer`
i `proposal-schedule`.

`node scripts/audit/controller_sim.cjs --days=60` → tvrdnje prošle (tabela u §5).

Cijela unit suite: **1059 prošlo / 37 palo u 3 suite-a** — sva tri su ekološka i postojala su
prije ovog koraka: `maint2-nontest-guard` (`EACCES` na `/usr/src/app`), `api-contract` (traži
bazu) i `transactional-integrity` (Nest DI u sopstvenom test-modulu ne poznaje
`ThermostatObservationService` iz `21`). Nijedan nije u vezi sa kontrolerom.

Migracije (`20261111100000_daily_outcome`, `20261112100000_proposal_shadow`) **nijesu
primijenjene** — `prisma validate`/`generate` u ovom okruženju ne rade. SQL je pisan ručno;
to se provjerava prvim `prisma migrate deploy`, ne tvrdnjom.
