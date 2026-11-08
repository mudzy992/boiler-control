# Audit prema stvarnom ugovoru proizvoda — jedna dnevna preporuka

Status: **revidirani audit, mjerodavan za ocjenu formule** · Datum: 2026-11-08 · Grana: `arena/da41e5ba-boiler-control`

Ovaj dokument zamjenjuje dio kriterija iz `13-flow-temp-max-audit.md`. Tamo gdje se nalazi razilaze, mjerodavan je ovaj dokument — razlozi su u §2.

Dokazi: `scripts/audit/daily_proposal_repro.cjs` (novo, izvršeno), `formula_pipeline_repro.cjs`, `formula_max_audit.cjs`. Stvarni kod, sintetički podaci, bez baze i mreže.

---

## 0. Ugovor proizvoda

Ovo je mjerni instrument audita. Sve ispod se ocjenjuje prema ovih osam stavki, ne prema tome kako bi sistem „mogao" raditi.

| # | Zahtjev |
|---|---|
| **R-1** | Aplikacija radi **isključivo** po ovom principu; nema drugog režima rada. |
| **R-2** | Korisnik u aplikaciju unosi **trenutno podešenu** polaznu temperaturu na bojleru. |
| **R-3** | Stvarnu polaznu korisnik **uvijek podešava ručno** na bojleru. Ne postoji automatsko podešavanje. |
| **R-4** | Aplikacija **jednom dnevno** predlaže polaznu temperaturu. |
| **R-5** | Predlog mora biti **dovoljan da zagrije dom** i da **pravi uštedu**. |
| **R-6** | Polazna se podešava **samo jednom dnevno** — jedan podatak važi cijeli dan. |
| **R-7** | Vanjska temperatura se prati **u svakom trenutku dana**. |
| **R-8** | Predlog se donosi na osnovu **svih aspekata doma, prethodnog intervala grijanja i intervala**, kroz **princip učenja**. |

**Šta iz ovoga slijedi za formulu** (i što je u `13` bilo pogrešno ocjenjeno):

- Preporuka nije „vrijednost za sada", nego **vrijednost za cijeli dan** → mora izdržati najhladniji dio dana, a ne prosjek.
- Jedinica učenja je **dan**, ne interval u danu → jedan potez, jedan ishod.
- Povratna informacija je **ono što je korisnik zaista podesio** (`currentBoilerFlowTemp`), jer je to jedina veza između predloga i stvarnosti.
- „Ušteda" je mjerljiva tvrdnja, ne osobina formule.

---

## 1. Verdikt po zahtjevu

| # | Zahtjev | Stanje u kodu | Verdikt | Dokaz |
|---|---|---|---|---|
| R-1 | samo ovaj princip | postoji samo ručni unos + preporuka; adapter nema pisanje | **poštuje** | `thermostat-adapter.interface.ts:18-24`; `setCurrentTemp` upisuje samo korisnikov unos |
| R-2 | unos trenutne polazne | `PATCH /api/boiler/current-temp`, `@Min(48) @Max(55)` | **poštuje uz uslov** | `boiler.controller.ts:73-97`, `set-current-temp.dto.ts` |
| R-3 | ručno podešavanje | nema izvršne komande | **poštuje** | grep: nema `post` prema uređaju u produkcionoj putanji |
| R-4 | **jednom dnevno** | preporuka se piše **11×/dan** za 5 ciklusa (10 iz ciklusa + 1 cron); dashboard računa **na svaki zahtjev** | **KRŠI** | §3 D-01, D-02 |
| R-5 | dovoljno za grijanje + ušteda | nema mjerenja uštede; nema stepen-dana; predlog ne pokriva noćni minimum | **KRŠI (djelimično)** | §3 D-06, D-07 |
| R-6 | jedan podatak za cijeli dan | 5 vremenskih bucket-a dnevno + drift do +1,24 °C unutar dana | **KRŠI** | §3 D-02, D-03 |
| R-7 | vanjska temp u svakom trenutku | mjeri se (poll), ali **formula vidi samo min i max** | **KRŠI** | §3 D-05 |
| R-8 | svi aspekti doma + interval + učenje | 4 od 5 profilnih polja ne stižu do motora; učenje ne stiže do dnevne preporuke | **KRŠI** | §3 D-04, D-08, i `13` F-06 |

**Ukupno: 3 od 8 poštuje, 5 krši.** Nijedan prekršaj nije kozmetički — svaki mijenja broj koji korisnik vidi ili njegovo značenje.

---

## 2. Šta se mijenja u odnosu na audit `13`

| Nalaz iz `13` | Šta ostaje | Šta se mijenja |
|---|---|---|
| **F-01** preporuka 46 °C nije unesiva | tačno, i ostaje kritično | **Novi okvir:** unos je *evidencija* onoga što stoji na bojleru. Ako aplikacija predloži 46, a prima 48–55, korisnik ne može ni zabilježiti šta je podesio. Problem nije „UI ne dozvoljava", nego **predlog izlazi iz opsega koji aplikacija može evidentirati**. Popravka: predlog uvijek unutar evidentiranog opsega ili eksplicitno „minimum uređaja". |
| **F-02/L-01** učenje mjeri početnu temp | ostaje kritično | Dodatno: pri jednom podešavanju dnevno, **početna temp svakog ciklusa je posljedica istog dnevnog poteza** — pa je i „korekcija po intervalu" nepripisiva. |
| **F-03/L-03** overshoot dvaput, pogrešan znak | ostaje kritično | Težina raste: pogrešan znak sada važi **cijeli dan**, ne jedan ciklus. |
| **F-04/L-06** učenje se ne perzistira | ostaje | — |
| **L-07** confidence je konstanta | ostaje | — |
| **L-08** interval confidence se ne koristi | ostaje | — |
| **L-10** bucket po vremenu obrade | **postaje centralni nalaz**, ne sporedni | Pri jednom podešavanju dnevno, bucket-i po dijelu dana **ne mogu se popuniti** i razdvajaju učenje od preporuke (§3 D-03/D-04). |
| **L-11** nema cap/min-samples | ostaje | `N_min` mora biti izražen u **danima**, ne u ciklusima. |
| **F-08** SUMMER gasi grijanje | ostaje kritično | Pod R-3/R-4 to znači: aplikacija **prestaje davati predlog** i korisnik ostaje bez informacije na −12 °C. |
| **F-12** nema prognoze → 51 °C | ostaje visoko | Sada je i pitanje R-5: predlog bez prognoze tvrdi da je „dovoljan". |
| **F-13** poruke nisu instrukcije | ostaje | Dnevna instrukcija ima drugačiji oblik (§7). |
| **`13` §2.2 „Efekat" po komponenti** | brojevi ostaju | **Tumačenje se mijenja:** kod dnevnog režima nije bitno kako komponenta djeluje na ciklus, nego kako mijenja **jedan dnevni broj**. |
| **`13` §3.2 „efekat na preporuku"** | brojevi ostaju | Isto: −1,61 °C je sada odstupanje **za cijeli dan**. |

Nijedan broj iz `13` nije oboren. Promijenjen je **kriterij**, ne mjerenje.

---

## 3. Novi nalazi (svi izmjereni)

### D-01 — Preporuka se piše 11 puta dnevno, ne jednom (Kritično, VERIFIKOVANO lažna baza)

`processHeatingEvent` se poziva na **početku i na kraju svakog ciklusa** (`thermostat.polling.service.ts:427,480`) i u svakom pozivu piše `Recommendation` (`heating.recommendation.service.ts:156-182`). Dnevni cron piše još jedan red.

| Ciklusa/dan | Upisa iz ciklusa | + cron | Ukupno |
|---:|---:|---:|---:|
| 2 | 4 | 1 | **5** |
| 5 | 10 | 1 | **11** |

U svih 11 upisa vrijednost je ista (**49,77 °C**) jer taj put hardkodira `recentEvents: []` (`:140`). Dakle: **ugovor „jednom dnevno" je prekršen u broju upisa, ali ne u vrijednosti** — što je gore nego da se vrijednost mijenja, jer izgleda ispravno. Posljedice: `Recommendation.date` se pomjera, red se prepisuje bez traga o tome šta je korisniku *prvo* rečeno, i nema zapisa „ovo je bio današnji predlog".

### D-02 — Dashboard daje drugu vrijednost u toku istog dana (Kritično, VERIFIKOVANO izvršeno)

`BoilerService.calculateFlowTemp` se poziva na svaki zahtjev (`dashboard.service.ts:64`, `boiler.controller.ts:50`) i **uključuje** `recentEvents` iz zadnjih 7 dana (`boiler.service.ts:161-179`).

| Stanje u toku istog dana | Predlog (°C) |
|---|---:|
| 0 ciklusa | 49,77 |
| 1 | 49,87 |
| 2 | 49,95 |
| 4 | 50,06 |
| 6 | 50,12 |
| 10 | **50,18** |

Uz aktivne cikluse (`active: true`, težina 0,15): **49,77 → 51,01 °C (+1,24)**.

To znači: korisnik ujutro dobije predlog, a poslijepodne na istoj stranici vidi drugi broj — bez ijednog novog podatka o vremenu i bez promjene podešavanja. Pod R-6 to je isti prekršaj kao D-01, ali **vidljiv korisniku**.

### D-03 — Push i dashboard računaju iz različitih bucket-a (Kritično, VERIFIKOVANO lažna baza)

U istom trenutku (srijeda 18:00), uz naučeni red **samo za `weekday_evening`**:

| Put | Bucket | Mode | Predlog |
|---|---|---|---:|
| Dnevni push (cron) | `weekday_morning` (hardkodirano, `daily:139-146`) | **PROFILE_ONLY** | **49,77 °C** |
| Dashboard / `/boiler/sync` | `weekday_evening` (stvarni sat) | **FULL** | **51,27 °C** |

Dvije stvari odjednom:

1. **Razlika 1,50 °C** između dvije „dnevne" preporuke u istom danu.
2. **Dnevni push ne koristi učenje uopšte** (`PROFILE_ONLY`), iako naučeni red postoji — jer traži `weekday_morning`, a ciklusi pune `weekday_evening`. Petlja je prekinuta: učenje se skuplja tamo gdje se preporuka ne čita.

### D-04 — Bucket-i se ne mogu popuniti pri jednom podešavanju dnevno (Kritično, VERIFIKOVANO izvršeno)

Model ima **10 bucket-a** (2 tipa dana × 5 dijelova dana). Uz uslov da se offset primijeni tek nakon `N_min = 8` uzoraka:

| Obrazac grijanja | Bucketi koji dostignu 8 uzoraka | Bucketi koji **nikad** ne dostignu 8 (365 dana) |
|---|---|---|
| 1 ciklus/dan (18:00) | 2 od 10 | **8** — `weekday_morning`, `weekday_late_morning`, `weekday_afternoon`, `weekday_night`, + sva 4 vikend izvan `evening` |
| 3 ciklusa/dan (7/14/19 h) | 6 od 10 | **4** — `late_morning` i `night` za oba tipa dana |

Prvi bucket (`weekday_evening`) dostiže 8 uzoraka nakon **10 dana**. Ali to je bucket koji dnevni push ne čita (D-03).

**Strukturni zaključak:** bucket-i po dijelu dana su ispravni samo ako se polazna mijenja više puta dnevno. Kod dnevnog podešavanja oni cijepaju **isti potez** na pet „uzroka" i time onemogućavaju učenje. Ovo nije parametar koji treba podesiti — to je pogrešna jedinica.

### D-05 — Oblik dana nije vidljiv formuli (Visoko, VERIFIKOVANO izvršeno)

Formula dobija **dva broja** (`tempMin`, `tempMax`) i računa `0,7·min + 0,3·max`.

Dva dana sa **identičnim min = −6 i max = +3**:

| Dan | Ponder | Stepen-sati | Predlog |
|---|---:|---:|---:|
| hladan cijeli dan, jedan blag sat | −3,30 | **303** | **51,99 °C** |
| blag cijeli dan, jedan hladan sat | −3,30 | **213** | **51,99 °C** |

**Razlika potrebe za grijanjem 42 %, identičan predlog.** Za dnevnu preporuku to je direktan prekršaj R-7: ono što treba znati nije minimum i maksimum, nego **koliko sati je bilo hladno i koliko hladno** (stepen-sati / stepen-dani), plus **noćni minimum** kao najgori slučaj. Vremenska serija postoji u podacima — `BoilerHistory.externalTemp` bilježi trenutnu vanjsku na svakom početku ciklusa (`polling:408`) — ali je motor ne dobija.

### D-06 — Ušteda se ne mjeri (Visoko, VERIFIKOVANO izvor)

- Nema stepen-dana nigdje u kodu (grep: 0 pogodaka za `degree.day|hdd|stepen.dan`).
- Gas se čita kao brojilo; nema normalizacije po vremenu ni po vanjskoj temperaturi.
- `BoilerHistory` čuva par (`suggestedFlowTemp`, `actualFlowTemp`) po početku ciklusa — to je **osnova** za mjerenje, ali se ne koristi za ocjenu ishoda.

R-5 traži da predlog „pravi uštedu". Danas se to ne može ni potvrditi ni opovrgnuti. **Predlog ne smije tvrditi uštedu** dok ne postoji ≥ 2 sedmice normalizovanih podataka.

### D-07 — Evidencija „šta je stvarno podešeno" može otići na pogrešan dan (Visoko, VERIFIKOVANO izvor)

`setCurrentTemp` upisuje `User.currentBoilerFlowTemp` (tačno) **i** prepisuje `actualFlowTemp` na **najnovijem** `BoilerHistory` redu (`boiler.service.ts:289-300`). Ako korisnik podesi temperaturu u 09:00, a zadnji ciklus je bio jučer u 22:00, evidencija se lijepi na **jučerašnji** red.

Uz to, `BoilerHistory` red nastaje **samo na početku ciklusa** (`polling:390-410`). Na dan bez ciklusa (blago vrijeme, `SUMMER`, korisnik ne loži) **nema reda** u koji bi se današnji predlog i današnje podešavanje upisali.

Posljedica po R-2/R-8: najvažniji podatak — „koju sam vrijednost predložio, koju je korisnik postavio, šta se dogodilo" — nije pouzdano vezan za **dan**.

### D-08 — Unesena polazna ne utiče ni na šta (Visoko, VERIFIKOVANO lažna baza)

| `currentBoilerFlowTemp` | Predlog |
|---:|---:|
| 48 | 49,77 °C |
| 55 | 49,77 °C |

Isti predlog. Korisnikov unos se koristi **samo** u health `flowDelta` (`dashboard.service.ts:826-835`), nikad u motoru ni u učenju. Time nedostaje najjači signal koji proizvod ima: **odstupanje između predloga i onoga što je korisnik zaista postavio** (bilo da ga je poslušao, bilo da je imao razlog da ne posluša).

### D-09 — Profilna polja koja korisnik unosi ne mijenjaju predlog (Visoko, preuzeto iz `13` F-06)

Pod R-8 („svi aspekti doma") ovo je teži nalaz nego u `13`: `windowType`, `insulationType`, `heatingType`, `ceilingHeight` ne stižu do motora ni na jednoj putanji. Korisnik popunjava profil, dobija isti broj.

### D-10 — Nema zapisa „današnji predlog" kao odluke (Srednje, VERIFIKOVANO izvor)

Ne postoji polje koje čuva: kada je predlog generisan, za koji dan važi, da li je prihvaćen, koja je bila osnova (prognoza u tom trenutku). `Recommendation` ima `date`, `breakdown` i `createdAt`, ali `date` se postavlja na ponoć na jednom putu (`heating.recommendation.service.ts:153-154`) i na `new Date()` na drugom (`daily:91`) — pa „preporuka za dan X" nije jednoznačna, a red se prepisuje 11× (D-01).

---

## 4. Kako dnevna preporuka treba da se računa

Ovo je prijedlog oblika, ne implementacija. Cilj je da jedan broj bude **dovoljan za cijeli dan** i da bude **objašnjiv**.

### 4.1 Ulazi

| Ulaz | Izvor | Zašto |
|---|---|---|
| Satna prognoza za 24 h | weather v2 (postoji) | oblik dana, ne samo min/max |
| **Noćni minimum** (22:00–06:00) | ista prognoza | najgori slučaj koji predlog mora pokriti |
| **Stepen-sati** `DH = Σ max(0, Tkomfor − Tsat)` | izračun | mjera potrebe, uporediva među danima |
| Vanjska temperatura izmjerena jučer | `BoilerHistory.externalTemp` | provjera prognoze i kalibracija |
| Stvarno podešena polazna (jučer/danas) | `User.currentBoilerFlowTemp` + dnevni zapis | veza predloga i stvarnosti |
| Dostignut cilj i overshoot po danu | eventi + **završni** snapshot | ishod poteza |
| Tip emitera i željeni režim | profil | nagib krivulje |
| Naučeni dnevni offset | dan-model (§5) | korekcija po kući |

### 4.2 Oblik

```
Tpredlog(dan) = clamp( Tkrivulja(DH, Tnoćni_min, emiter) + offset_dan , Tmin_uređaja , Tmax_uređaja )
```

- `Tkrivulja` — ekvitermna krivulja kalibrisana na **dva sidra**: projektna vanjska (najhladniji očekivani dan) i granica grijanja (npr. 15–16 °C). Linearna krivulja `51 − 0,3·ext` sa prekidima na 10 °C i −15 °C nije prihvatljiva za dnevnu odluku jer na granici daje skok od 2 °C — a taj skok tada važi cijeli dan.
- `Tnoćni_min` ulazi kao **donja granica** predloga: ako noć ide na −8 °C, predlog za dan mora biti dovoljan i za noć.
- `offset_dan` — jedan naučeni broj po danu, ograničen (§5).
- Zaokruživanje na korak koji uređaj podržava (npr. 0,5 °C) i **unutar opsega koji aplikacija evidentira** (48–55 °C). Ako krivulja traži manje, predlog je 48 uz napomenu „minimum uređaja".

### 4.3 Očekivani ishod (obavezni dio predloga)

Predlog mora nositi i tvrdnju koju je moguće provjeriti sutra:

> „Uz 48 °C i noćni minimum −6 °C, soba bi trebala dostići 21 °C do 20:00. Ako ne dostigne, sutra predlažem 49 °C."

Bez toga učenje nema šta da poređuje, a korisnik ne zna da li je predlog uspio.

---

## 5. Učenje pod dnevnim režimom

### 5.1 Jedinica je dan

| Danas | Treba |
|---|---|
| 10 bucket-a (2 × 5 dijelova dana) | **1 dnevni model** + najviše 2 podmodela: radni dan / vikend, i 3–4 temperature vanjske temperature |
| uzorak = ciklus | uzorak = **dan** (jedan potez) |
| `N_min` u ciklusima | `N_min` u **danima** (npr. 8 dana) |
| `confidence` konstanta 0,1 | `confidence = f(broj dana, varijansa)` |

Zašto: pri jednom podešavanju dnevno, pet ciklusa u danu nisu pet nezavisnih uzoraka — to je **jedan potez sa pet mjerenja**. Ako se svaki ciklus računa kao uzorak, model brže „uči" i brže griješi, a bucket-i se nikad ne popune (D-04).

### 5.2 Signali po danu

| Signal | Definicija | Danas |
|---|---|---|
| `reached` | da li je soba dostigla cilj i u koje vrijeme | ne postoji |
| `overshootEnd` | `max(0, roomTemp_end − target)` iz **završnog** snapshota | koristi se početni (pogrešno) |
| `flowError` | `stvarno podešeno − predlog` | postoji u podacima, ne koristi se |
| `gasPerDegreeDay` | m³ / stepen-dan | ne postoji |
| `userOverride` | korisnik postavio drugu vrijednost od predloga | ne postoji kao signal |

`userOverride` nije kvar — to je najkorisniji signal koji proizvod može dobiti: korisnik je imao razlog (hladno mu je, ili troši previše). Treba ga učiti, ne kažnjavati.

### 5.3 Ograničenja

```
offset_dan ← bounded EWMA(offset_dan, ishod, α = max(0,10; 1/min(dani; 20)))
cap: |offset_dan| ≤ 3 °C
max promjena po danu: 1 °C
primijeni samo ako dani ≥ 8 i varijansa ishoda ispod praga
```

### 5.4 Zatvaranje petlje

Danas petlja nije zatvorena ni na jednom mjestu: predlog se piše 11×, učenje gleda drugi bucket, a unesena polazna ne ulazi nigdje. Najmanja izmjena koja zatvara petlju:

1. jedan zapis po danu: `proposedFlowTemp`, `proposedAt`, `weatherBasis`, `nightMinC`, `degreeHours`;
2. `setCurrentTemp` upisuje **u taj zapis**, ne u najnoviji `BoilerHistory` red;
3. učenje čita **taj zapis** + ishod dana;
4. predlog se **ne preračunava** do sljedećeg dana.

To je istovremeno D-01, D-03, D-07 i D-08 — jedna izmjena sheme, ne četiri popravke.

---

## 6. Anomalije pod dnevnim režimom

Trajanje pojedinačnog ciklusa gubi na važnosti; dobija **ishod dana**.

| Kod | Uslov (nacrt) | Šta korisnik saznaje |
|---|---|---|
| `day_target_not_reached` | cilj nije dostignut ≥ 2 h u danu sa potrebom > 0 | „Soba je ostala X °C ispod cilja uz 48 °C." |
| `day_overshoot` | soba > cilj + 1,5 °C duže od 1 h | „Soba je prešla cilj — predlog je vjerovatno previsok." |
| `flow_not_followed` | `stvarno − predlog` > 2 °C tokom dana | „Stvarna polazna odstupa od predloga." |
| `no_cycle_on_cold_day` | `DH > prag`, a nijedan ciklus | „Grijanje nije radilo na dan sa potrebom." |
| `sensor_frozen` | ista sobna temperatura ≥ 3 h uz grijanje | „Termostat ne pokazuje promjenu." |
| `proposal_not_applied` | dan bez ijednog unosa polazne | **info, ne kvar** — korisnik nije morao primijeniti |
| `frost_risk` | vanjska ≤ 0 °C i grijanje isključeno | „Vanjski je −X °C, a grijanje je isključeno." |
| `weather_missing` | nema svježe prognoze | „Predlog nije izračunat jer nema prognoze." |

Pravilo: **anomalija opisuje mjerenje, ne uzrok.** „Ciklus je trajao 130 min" nije isto kao „kotao je u kvaru".

---

## 7. Instrukcija: kako izgleda tačan dnevni predlog

Jedna poruka dnevno, u fiksno lokalno vrijeme, sa četiri obavezna dijela:

```
[1] VRIJEDNOST      Predlažem 48 °C za danas.
[2] OSNOVA          Prognoza: noć −6 °C, dan do +3 °C, 261 stepen-sat.
[3] POUZDANOST      Model uči 12 dana; pouzdanost srednja.
[4] OČEKIVANI ISHOD Soba bi trebala dostići 21 °C do 20:00.
    AKCIJA          Postavite na bojleru, pa upišite stvarnu vrijednost.
```

Pravila (mjerodavna, zamjenjuju R-1…R-8 iz `13` §5.3 gdje se razilaze):

- **I-1** Jedan predlog dnevno; vrijednost se **ne mijenja** do sljedećeg dana ni na dashboardu ni u push-u.
- **I-2** Predlog je uvijek unutar opsega koji aplikacija evidentira (48–55); ako krivulja traži manje, predlog je 48 uz „minimum uređaja".
- **I-3** Nema prognoze → **nema predloga** (nikad 51 °C iz nule).
- **I-4** Frost: vanjska ≤ 0 °C i grijanje isključeno → kritično upozorenje, iznad svake korisničke postavke.
- **I-5** Traži se potvrda: korisnik upisuje **stvarno podešeno**; to je ulaz u učenje.
- **I-6** Nikad se ne tvrdi ušteda bez mjerenja (§4 D-06).
- **I-7** Anomalija nosi mjerenje i jednu provjeru, nikad dijagnozu.
- **I-8** Predlog se ne šalje kao „komanda"; aplikacija ne mijenja ništa na bojleru.

---

## 8. Revidirani prioriteti

P0 — ugovor (bez ovoga proizvod ne radi ono što tvrdi):

| ID | Stavka | Veže se na |
|---|---|---|
| **P0-1** | Dnevni zapis predloga (`proposedFlowTemp`, `proposedAt`, `weatherBasis`, `nightMinC`, `degreeHours`) i **zamrzavanje** vrijednosti do sljedećeg dana | D-01, D-02, D-10 |
| **P0-2** | `setCurrentTemp` upisuje u **današnji** zapis, ne u najnoviji `BoilerHistory` | D-07 |
| **P0-3** | Predlog ograničen na evidentirani opseg 48–55 + frost guard | `13` F-01, F-08 |
| **P0-4** | Ukloniti preračunavanje na svaki zahtjev; dashboard prikazuje **današnji zapis** + starost | D-02 |
| **P0-5** | Bez prognoze nema predloga | `13` F-12 |

P1 — učenje koje odgovara proizvodu:

| ID | Stavka | Veže se na |
|---|---|---|
| **P1-1** | Jedinica učenja = **dan**; ukloniti 10 bucket-a | D-03, D-04 |
| **P1-2** | Završni snapshot u ishod dana | `13` F-02 |
| **P1-3** | Ukloniti dvostruko sabiranje i obrnuti znak | `13` F-03 |
| **P1-4** | `flowError` (`stvarno − predlog`) kao signal učenja | D-08 |
| **P1-5** | `confidence` iz broja dana i varijanse | `13` L-07 |
| **P1-6** | Perzistencija (`upsert`, prvi uzorak) | `13` F-04 |

P2 — tačnost i mjerenje:

| ID | Stavka |
|---|---|
| **P2-1** | Satna prognoza → stepen-sati + noćni minimum u formulu (D-05) |
| **P2-2** | Profilna polja u motor **ili** van obrasca (D-09) |
| **P2-3** | Katalog dnevnih anomalija (§6) |
| **P2-4** | Ušteda: m³ po stepen-danu, ≥ 2 sedmice prije prve tvrdnje (D-06) |
| **P2-5** | Dnevna instrukcija (§7), i18n bs/en |

P3 — krivulja i validacija: ekvitermna krivulja, backtest, shadow, canary — kako je u `14` F5, ali sa **dnevnim** uzorkom i **stepen-satima**, ne sa ciklusima.

**Šta iz plana `14` ostaje nepromijenjeno:** F0 (golden gate), F1.1 (frost), F1.3 (nepoznato ≠ 0), F1.5 (jedan zapis/dan), F3.1–F3.3 (baseline, σ=0, potvrda).
**Šta se mijenja:** F2.4 (bucket EWMA → dnevni EWMA), F2.1 (uzorak = dan), F4 (dnevna instrukcija umjesto „trenutne"), F5 (mjere po danu).

---

## 9. Odluke vlasnika

### 9.1 Odlučeno 2026-11-08

1. **Opseg: 30–55 °C, oboje.** Bojler fizički ne dozvoljava iznad **55** i ne ide ispod **30**; vlasnik je potvrdio oba kraja 2026-11-08. Raspon važi **i za predlog i za unos** — nema više razlike između onoga što aplikacija predlaže i onoga što može evidentirati.
   *Posljedica u kodu:* donji clamp motora (`base.strategy.ts:25`, `Math.max(46, …)`) **mora pasti na 30**. Bez toga raspon 30–55 nije dostižan — motor ne može proizvesti ispod 46, pa je donjih 16 °C mrtvo slovo. Isto važi za `@Min(48)` (`set-current-temp.dto.ts:17`), `MIN_CURRENT_FLOW_TEMP` (`boiler.service.ts:34`), `mobile/src/constants/boilerLimits.ts:7` i test koji pinuje 48 (`boilerLimits.test.ts:10`).
   *Šta 30 otvara:* za dobro izolovanu kuću u blagom vremenu potreba je 24–32 °C, pa je dosadašnji pod od 46 bio **sistematski bias od 14–22 °C** — vidi `17` §4.4.
2. **Vrijeme: 06:00, fiksno, `Europe/Sarajevo`.** Ne „prvo otvaranje aplikacije".
   *Posljedica:* današnji cron je `0 0 * * *` — **ponoć**, ne 6:00 (`daily.recommendation.service.ts:24`), a komentar iznad tvrdi „svaki dan u 6:00" (L23). Dodatno, bez `timeZone` opcije sat se računa po vremenskoj zoni servera; u UTC kontejneru `0 6 * * *` znači 07:00/08:00 po lokalnom vremenu. Ovo je **tiha greška od jednog sata** i mora se pokriti testom, ne komentarom.
3. **Unos polazne: važi do sljedeće izmjene.** Korisnik unosi **samo kad promijeni** vrijednost na bojleru; do tada se prenosi prethodna. Unos je događaj, ne dnevna obaveza — detalji i posljedice na model u `18` §0.
4. **Noćni minimum: obavezan.** Predlog mora pokriti **prozor 06:00 → 06:00 sljedećeg dana**, jer se polazna podešava samo jednom. Današnja dnevna agregacija (`daily-weather-input.ts:39-57`) uzima `temperatureMinC` iz **kalendarskog dana**, što u 06:00 propušta najhladniji sat **predstojeće** noći — a upravo je on mjerodavan.

### 9.2 Ostaje otvoreno

5. **Šta ako korisnik ne primijeni predlog** — informacija ili kvar? (Moj predlog: informacija; nikad kazna, jer podešavanje nije obaveza.)
5. **Ušteda**: definicija (m³/stepen-dan, trošak?) i minimalan period prije prve tvrdnje u UI.
6. **Dnevni zapis**: nova tabela `DailyProposal` ili proširenje `Recommendation`? (Moj predlog: nova tabela sa `@@unique([userId, date])`, `Recommendation` ostaje povijest prikaza.)

---

## 10. Reprodukcija

```bash
cd backend && npm ci && cd ..      # ts-node iz backend/node_modules

node scripts/audit/daily_proposal_repro.cjs        # ugovor: upisi, drift, bucketi, oblik dana
node scripts/audit/daily_proposal_repro.cjs --json # mašinski čitljivo
node scripts/audit/formula_pipeline_repro.cjs      # servisi nad lažnom bazom
node scripts/audit/formula_max_audit.cjs --check-golden
```

Skripta ima `assert` tvrdnje za svaki nalaz iz §3; pad znači da se ponašanje promijenilo. Bez baze, mreže i uređaja.

---

## 11. Zaključak

Aplikacija **ne krši ugovor zato što formula nije tačna** — nego zato što je formula i dalje građena kao da se polazna mijenja više puta dnevno, a proizvod je jedan dnevni potez:

- preporuka se piše **11×** dnevno i računa na svaki zahtjev, pa nijedan broj nije „današnji";
- učenje skuplja **bucket-e po dijelu dana** koje jedan dnevni potez ne može napuniti, i to u bucket koji dnevni push ne čita;
- **oblik dana** (42 % razlike u potrebi) ne ulazi u formulu, jer se sve svodi na min/max;
- **ono što korisnik zaista podesi** ne ulazi ni u motor ni u učenje;
- „ušteda" se ne mjeri, pa se o njoj ne smije tvrditi.

Redoslijed je zato drugačiji od `13`: prvo **jedan dnevni zapis i zamrznuta vrijednost** (P0), pa dnevno učenje (P1), pa stepen-sati i mjerenje (P2), i tek onda krivulja (P3). Bez P0 nema smisla popravljati formulu — ne postoji objekat na koji bi se popravka odnosila.
