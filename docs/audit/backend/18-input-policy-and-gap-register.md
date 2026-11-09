# 18 — Politika unosa polazne i registar praznina prije realizacije

**Status:** dokumentacija prije realizacije. Ne mijenja aplikacijski kod.
**Datum:** 2026-11-08. **Grana:** `arena/da41e5ba-boiler-control`.
**Nadovezuje se na:** `15` (ugovor), `16` (sadašnje stanje), `17` (projekat učenja).

---

## 0. Politika unosa — odluka vlasnika 2026-11-08

> „Unosi se dnevno stvarno podešena polazna temperatura, ukoliko je bilo izmjene; ukoliko nije, uzima se od prethodnog dana dok se ne promijeni. Onog trenutka kada se promijeni, unosim je u aplikaciju i ona važi do sljedećeg mijenjanja."

Ovo zamjenjuje svaku formulaciju tipa „mora unijeti svaki dan". Unos je **događaj**, ne dnevna obaveza.

### 0.1 Semantika

```
polazna_na_snazi(t) = zadnji uneseni iznos čiji je setAt ≤ t
```

- Ako nema izmjene, vrijednost se **prenosi** i dan dalje važi bez ikakve akcije korisnika.
- Ako ima izmjene, korisnik je unosi u trenutku promjene; nova vrijednost važi od tog trenutka do sljedeće.
- Aplikacija **nikad** ne mijenja tu vrijednost, nikad je ne „ispravlja" na predlog i nikad ne pretpostavlja da je predlog primijenjen.

### 0.2 Šta to mijenja u podacima

Danas postoji samo `User.currentBoilerFlowTemp` + `currentBoilerFlowTempSetAt` — **jedno polje koje se prepisuje**. Time se historija gubi, pa se ne može odgovoriti na pitanje „koja je polazna bila na snazi u utorak u 06:00". Zato treba **događaj, ne polje**:

| Tabela | Polja | Zašto |
|---|---|---|
| `FlowSetEvent` (novo, append-only) | `id`, `homeProfileId`, `valueC`, `setAt`, `source` (`USER`/`IMPORT`), `createdAt` | jedini stvarni signal proizvoda; bez historije nema jednačine |
| `DailyRecord.flowSetC` | iznos na snazi u 06:00 | ulaz u dnevni bilans |
| `DailyRecord.flowSetChangedDuringDay` | bool + broj promjena | transparentnost i filtriranje |
| `DailyRecord.flowSetSince` | datum od kojeg vrijednost važi | prikaz („važi od 12.11.") |

**Vezanje na dom, ne na korisnika.** `currentBoilerFlowTemp` je danas na `User`, a bojler pripada **domu**. Korisnik sa dva doma danas ima jednu polaznu za oba — to je greška koju ova tabela ispravlja.

### 0.3 Ispravka regresora (bitna)

U `17` §6.1 dnevni bilans je pisan kao `D·(F − R)`. To važi **samo ako je polazna konstantna tokom dana**. Pošto izmjena može pasti usred dana, ispravan regresor je vremenski ponderisan:

```
y = (1/1440) · Σ_over_minutes  [ grijanje(t) · (F(t) − R(t)) ]
```

gdje je `F(t)` polazna **na snazi** u minuti `t`. Tada:

```
y = s·(R̄ − Ō) − c
```

Ovo je tačno za bilo koji broj izmjena u danu i svodi se na `D·(F − R)` kad je `F` konstanta. **Nema potrebe za dijeljenjem dana ni za izbacivanjem dana sa izmjenom** — što je bilo jedino rješenje sa starim oblikom.

### 0.4 Ne-potvrđena vrijednost

Vrijednost legitimno stoji sedmicama; to **nije** sumnjiv podatak i ne smije se kažnjavati u modelu. Ali ako je korisnik promijenio na bojleru, a zaboravio unijeti, model radi na pogrešnom `F` i to se **ne može detektovati iz podataka**.

Zato, proporcionalno:

| Pravilo | Vrijednost |
|---|---|
| Podsjetnik na potvrdu | **1× sedmično**, jedan dodir: „je li još 50 °C?" |
| Ako korisnik ne odgovori | ništa se ne mijenja, dani ostaju u modelu |
| Oznaka u prikazu | poslije **21 dan** bez potvrde: „polazna nije potvrđena od …" |
| Isključenje iz modela | **nikad** zbog starosti — samo zbog nedostajućih podataka |

Ovo je važno: sistem ne smije izmišljati kaznu za ponašanje koje je normalno.

### 0.5 Prvi unos i sezona

- Ako `FlowSetEvent` ne postoji: `F` je nepoznat → nema bilansa → `PROFILE_ONLY` (današnja formula), **označeno kao procjena**, uz jednokratni poziv da se unese trenutna vrijednost.
- U sezoni bez grijanja (`SUMMER`) nema predloga; vrijednost ostaje na snazi i prenosi se u novu sezonu.
- Prvi dan poslije duže pauze (≥ 5 dana bez grijanja): model se ne mijenja, `RECONTACT`, CI se širi.

---

## 1. Registar: svaki raniji nalaz i svaki novi zahtjev

Legenda: ✅ zatvoreno · ⚠️ djelimično · ❌ praznina · 🔒 blokada (traži odluku)

### 1.1 Formula i motor (`13` F-xx)

| ID | Šta je bio nalaz | Status | Gdje je riješeno / šta ostaje |
|---|---|---|---|
| F-01 | Predlog 46–47,9 °C, a unos dozvoljava samo 48–55 | ✅ | raspon 30–55 (`15` §9.1, `17` §0.1) + clamp motora 46→30 |
| F-02 | Učenje mjeri temp s početka ciklusa | ✅ | novi model ne koristi temp po ciklusu, nego dnevne prosjeke (`17` §6.1) |
| F-03 | „Overshoot" se dodaje polaznoj dvaput | ✅ | nema `overshoot` člana u novom modelu |
| F-04 | `HeatingIntervalLearning` se nikad ne kreira | ✅ | bucket-i se ukidaju; `DailyRecord` + `HomeModel` |
| F-05 | `confidence` je konstanta 0,1 | ✅ | CI iz bootstrapa (`17` §6.1), prikaz kao ± |
| F-06 | Profilna polja ne stižu do motora | ❌ | **mora se poslati** `ceilingHeight`, `windowType`, `insulationType`, `heatingType` (`16` §5.4) |
| F-07 | Podno + visina u metrima → 46 °C | 🔒 | profil se koristi, pa se **jedinice moraju fiksirati** (cm) i postojeći podaci provjeriti prije uključivanja |
| F-08 | `SUMMER` isključuje grijanje bez frost guarda | ❌ | definisati: u `SUMMER` **nema predloga** (ne 0 °C) + frost guard (§3.3) |
| F-09 | Anomalija se detektuje samo po trajanju | ➖ | van opsega dnevnog predloga; ostaje u `13` §4 |
| F-10 | σ=0 degeneriše prag 2σ | ➖ | van opsega; ostaje u `13` |
| F-11 | Potvrda anomalije upisuje prognozirani kraj | ➖ | van opsega; **ali** ne smije hraniti novi model (novi model ne čita `HeatingEvent` kao istinu) |
| F-12 | Nema vremena → 51,00 °C kao punopravna preporuka | ✅ | bez prognoze **nema predloga** (`17` §6.4) |
| F-13 | Poruke nisu instrukcije | ❌ | format instrukcije (`15` §7, I-1…I-8) još nije u kodu |
| F-14 | `expectedHeatTimeMin` 0 prikazan kao „0 min" | ❌ | polje mora biti **nullable** ili se ne prikazuje |
| F-15 | `prolonged_idle` apsolutni prag | ➖ | van opsega; ostaje u `13` |
| F-16 | Cron piše prije provjere „već poslano" | ✅ | jedinstveni `(userId, localDate)` + jedan pisac |

### 1.2 Učenje (`13` L-xx)

Svih dvanaest nalaza odnosi se na **stari mehanizam** (bucket-i, overshoot, `confidence`). Novi model ih ne nasljeđuje — ali svaki mora imati eksplicitno „zašto više ne postoji".

| ID | Šta je bio nalaz | Status | Šta ga zamjenjuje |
|---|---|---|---|
| L-01 | Mjeri se početna, ne završna temp | ✅ | dnevni prosjeci, bez temp po ciklusu |
| L-02 | Dead zone garantuje negativan „overshoot" | ✅ | nema overshoot člana |
| L-03 | Isti broj dvaput, pogrešan znak | ✅ | nema tog člana |
| L-04 | `reachTimeAdjustment` obrnut znak | ✅ | nema tog člana |
| L-05 | Učenje se hrani vlastitom procjenom | ❌ | **novi model ne smije čitati `Recommendation`**; samo mjerenja (zahtjev C-07 / U-7) |
| L-06 | Prvi uzorak se ne može persistirati | ✅ | `DailyRecord` je jedan red po danu, upsert |
| L-07 | `confidence` je konstanta | ✅ | CI iz podataka |
| L-08 | Interval `confidence` se ne koristi | ✅ | nema intervala |
| L-09 | Decay po indeksu, baseline sa budućim ciklusima | ✅ | nema baseline-a ni decay-a |
| L-10 | Ključ intervala po vremenu obrade | ✅ | nema ključa intervala; vrijeme ulazi kroz `t` |
| L-11 | Nedostaju zaštite koje učenje čine bezbjednim | ⚠️ | granice `s ∈ [0,2; 1,5]`, `DEGRADED`, `T_max` guard — **`T_max` još nije ograničenje** (`17` §14.2) |
| L-12 | Home offset nema pisca | ✅ | `dailyOffset` iz bilansa/kontrolera |

### 1.3 Dnevni ugovor (`15` D-xx)

| ID | Nalaz | Status | Rješenje |
|---|---|---|---|
| D-01 | 11 upisa dnevno | ✅ | jedan pisac, `DailyRecord` |
| D-02 | Druga vrijednost u toku dana | ✅ | vrijednost zamrznuta do sljedećih 06:00 |
| D-03 | Push i dashboard iz različitih bucket-a | ✅ | jedan izvor, nema bucket-a |
| D-04 | Bucket-i se ne mogu popuniti | ✅ | dan kao jedinica |
| D-05 | Oblik dana nevidljiv | ✅ | `nightMin`, stepen-sati, vremenski ponderisan bilans |
| D-06 | Ušteda se ne mjeri | ⚠️ | metrika definisana (`17` §11), **mjerenje još ne postoji**; gas je mjesečni, ne dnevni |
| D-07 | Unos može otići na pogrešan dan | ✅ | `FlowSetEvent` sa `setAt` (§0.2) |
| D-08 | Unesena polazna ne utiče ni na šta | ✅ | `F` je regresor |
| D-09 | Profilna polja ne mijenjaju predlog | ❌ | isto kao F-06 |
| D-10 | Nema zapisa „današnji predlog" | ✅ | `DailyRecord` + unique |

### 1.4 Novi zahtjevi — unos i podaci

| ID | Zahtjev | Status | Napomena |
|---|---|---|---|
| I-1 | Vrijednost važi do sljedeće izmjene | ✅ | §0.1 |
| I-2 | Izmjena usred dana | ✅ | ponderisan regresor §0.3 |
| I-3 | Historija unosa, ne samo zadnje polje | ❌ | `FlowSetEvent` (§0.2) — **danas ne postoji** |
| I-4 | Vrijednost vezana na **dom**, ne na korisnika | ❌ | danas je na `User` |
| I-5 | Prvi unos / nikad uneseno | ✅ | §0.5 |
| I-6 | Nikad auto-ispravka unosa | ✅ | §0.1 |
| I-7 | Sedmična potvrda, bez kazne u modelu | ❌ | §0.4 — nije nigdje implementirano ni projektovano do sada |
| I-8 | Sezona: bez predloga u `SUMMER` | ✅ | `DailyRecordWriter` (`20` §4): `SUMMER` → `OUT_OF_SEASON`, `AUTO` po grijnoj granici |
| I-9 | Raspon 30–55 u oba smjera | ⚠️ | odlučeno; **četiri mjesta + clamp motora** (`16` §4.5) |

### 1.5 Novi zahtjevi — dnevni zapis i vrijeme

| ID | Zahtjev | Status | Napomena |
|---|---|---|---|
| T-01 | `localDate` po **zoni doma**, ne servera | ✅ | `resolveHomeTimeZone`, kuća → korisnik → fallback (`20` §4) |
| T-02 | Cron u 06:00 `Europe/Sarajevo` | ✅ | `*/5` + lokalni sat po kući (`20` §3); `0 0 * * *` je bila **ponoć UTC** |
| T-03 | Ljetnje/zimsko vrijeme (23/25 h dan) | ⚠️ | zona i DST rade (`20` §7); dnevni prosjeci još ne postoje |
| T-04 | Propušten cron (server pao u 06:00) | ✅ | isti dan se nadoknađuje do 12:00; propušten **cijeli** dan se ne izmišlja (`20` §3) |
| T-05 | Aktivni dom, ne `homeProfiles[0]` | ✅ | `selectDueHomes` (`20` §3) |
| T-06 | Više uređaja u domu: koji daje seriju | ⚠️ | primarni uređaj + `sourceDeviceId` (`22` §6); model po zoni ne postoji |
| T-07 | Reproducibilnost: `modelVersion` + parametri | ✅ | `DailyRecord.modelVersion` + `params` (`20` §1) |

### 1.6 Novi zahtjevi — učenje i kontroler

| ID | Zahtjev | Status | Napomena |
|---|---|---|---|
| C-01 | Dnevni bilans kao primarni estimator | ✅ | `17` §6.1, izvršeno u simulaciji |
| C-02 | `T_max` kao **ograničenje**, ne metrika | ❌ | `17` §14.2 |
| C-03 | „Dostigao cilj" = `cilj − 0,5 K` (kvant) | ✅ | `17` §14.2 |
| C-04 | `DEGRADED` → **drži prošlu vrijednost**, ne formulu | ⚠️ | model: ne prepisuje brojeve (`22` §5); predlog još ne postoji |
| C-05 | `RECONTACT` poslije ≥ 5 dana bez grijanja | ❌ | §0.5 |
| C-06 | Granice `s ∈ [0,2; 1,5]`, odbaci van granica | ✅ | `17` §6.4 |
| C-07 | Exploracija samo uz rezervu komfora | ✅ | `17` §8.5 |
| C-08 | Kalibracija `u_day` prije tvrdnje o uštedi | ⚠️ | traži ≥ 28 dana |

### 1.7 Novi zahtjevi — prikaz, obavijesti, operacija

| ID | Zahtjev | Status | Napomena |
|---|---|---|---|
| U-1 | Naslovni broj „Danas: X °C" + vrijeme predloga | ❌ | danas broj nema naslovno mjesto |
| U-2 | Prikaz „primijenjeno / nije" | ❌ | `applied = |uneseno − predlog| ≤ 0,1` |
| U-3 | Notifikacija samo ako se promijenilo ≥ 0,5 K | ❌ | danas šalje svaki dan |
| U-4 | Najviše jedna notifikacija dnevno | ⚠️ | provjera postoji, ali poslije upisa (F-16) |
| U-5 | Objašnjenje „zašto" uz broj | ⚠️ | `breakdown` postoji, ali za staru formulu |
| U-6 | Nijedna tvrdnja o uštedi prije baznog perioda | ❌ | nije nigdje zaključano |
| U-7 | Model ne čita sopstvene preporuke | ❌ | zahtjev iz L-05, mora biti eksplicitan u kodu |
| S-1 | Prekidač za isključenje (bez deploya) | ❌ | `DAILY_PROPOSAL_ENABLED=false` → staro ponašanje |
| S-2 | Shadow režim prije pravog predloga | ❌ | `17` §13, nije projektovano u detalje |
| S-3 | Rollback plan | ❌ | uz S-1 |
| S-4 | Retencija serije od 5 min | ❌ | serija postoji (`21`), sažimanje **nije** — za sada se čuva sve |
| S-5 | Golden gate i replay fixture za novu formulu | ⚠️ | gate postoji za **staru** formulu (133 slučaja) |
| S-6 | Nijedan upis prema bojleru | ✅ | adapter je čitljiv (`16` §2.4) |

**Zbir:** 75 stavki — ✅ 40 · ⚠️ 10 · ❌ 20 · 🔒 1 · ➖ 4 (van opsega). Provjereno mašinski (§4).

---

## 2. Sigurnosne praznine koje moraju biti odlučene prije koda

### 2.1 PTV i Legionela — najozbiljnija praznina

Ako bojler **i priprema toplu vodu** iz istog podešavanja, snižavanje polazne na 35–40 °C je nesigurno: voda u bojleru mora dostizati **60 °C** zbog Legionele. Kod kombi bojlera PTV je odvojen (pločasti izmjenjivač) i polazna za grijanje smije nisko.

Aplikacija **danas ne zna** koji je tip: `HomeProfile.boilerModel` je slobodan tekst i nigdje se ne koristi.

| Opcija | Posljedica |
|---|---|
| Dodati `dhwMode: COMBI \| CYLINDER \| NONE` | ako je `CYLINDER`, predlog se ograničava i **ušteda se ne obećava** |
| Pitati pri postavljanju profila | jedan obavezan korak u onboardingu |
| Ne raditi ništa | **nedopustivo** — savjet bi mogao biti nesiguran |

Ovo je **blokada** za bilo koju tvrdnju o uštedi na sistemima sa bojlerom.

> **Riješeno 2026-11-08 → `19`.** Vlasnik je odabrao **katalog modela** umjesto slobodnog teksta. Katalog (`docs/audit/backend/boiler-catalog.json`) nosi sigurnosni bit „jesu li krugovi odvojeni" i raspon modela. Za potvrđene modele (ecoTEC plus VUW/VU/VUI, Bosch Condens 7000 WP) krugovi **jesu** odvojeni. Za nepotvrđene vrijedi: **nema savjeta o snižavanju.** Blokada postaje pravilo, ne pitanje.

### 2.2 Maksimalna polazna po emiteru

Gornja granica 55 je granica **bojlera**, ne sistema. Podno grijanje obično radi 30–45 °C; estrih i cijevi imaju svoje granice. Ako korisnik ima podno, predlog od 52 je najmanje neekonomičan, a može biti i štetan.

`heatingType` i `hasFloorHeating` postoje, ali **ni jedan limit ne zavisi od njih**. Traži se: `maxFlowC` po profilu, sa konzervativnim defaultom i potvrdom instalatera.

> **Riješeno 2026-11-08 → `19` §2.** Vlasnik: granica je **ona koju sistem dozvoljava** i pita se pri kreiranju profila kad se odabere podno grijanje. Nijedan fiksni broj se ne izmišlja; `HomeProfile.maxHeatingFlowC` je nullable, a bez njega predlog ostaje konzervativan uz napomenu.

> **Urađeno 2026-11-13 → `23` §5, `24` §2.** Kolona postoji (`maxHeatingFlowC Float?`), DTO prihvata **samo 30–55** (polje sužava zaključani raspon, nikad ga ne širi), a tvrde granice je primjenjuju kao plafon. Kad je noćni minimum iznad plafona, bira se fizička granica i razlog `SYSTEM_MAX` kaže da noć **nije** pokrivena.

### 2.3 Zaštita od smrzavanja

Pod od 30 °C je iznad smrzavanja, pa je predlog bezbjedan. Ali ako je soba blizu 0 °C (prazan stan, kvar), sistem ne smije nastaviti „optimizaciju": pravilo je **alarm i zamrznut predlog**, ne nastavak spuštanja. Ovo danas ne postoji ni u `SUMMER` grani (F-08).

---

## 3. Šta bi puklo da smo danas krenuli u realizaciju

1. **Pogrešan dom.** Cron uzima `homeProfiles[0]`, a `activeHomeProfileId` postoji — korisnik sa dva doma dobio bi predlog za pogrešan.
2. **Predlog ljeti.** Cron nema provjeru sezone, pa bi i u `SUMMER` pisao polaznu.
3. **Nema predloga ako server padne u 06:00.** Bez nadoknade, cijeli dan bez broja.
4. **06:00 nije 06:00.** Bez `timeZone`, u UTC kontejneru to je 07:00/08:00; `localDate` bi takođe bio pogrešan.
5. **Bez historije unosa.** `currentBoilerFlowTemp` se prepisuje, pa se ne zna koja je vrijednost bila na snazi u utorak — a to je ulaz u jednačinu.
6. **Regresor bio netačan.** `D·(F − R)` pod izmjenom usred dana daje pogrešan `y`; ispravljeno u §0.3.
7. **PTV.** Savjet bi mogao biti nesiguran na bojleru sa cilindrom.

---

## 4. Kako znamo da registar nije nepotpun

Registar nije dokaz da je sve pokriveno — dokaz je da **nijedan raniji nalaz nije tiho ispušten**. To se provjerava mašinski:

```bash
python3 scripts/audit/register_selfcheck.py
```

Skripta čita `13`, `15` i `18`, izvlači svaki `F-xx`, `L-xx`, `D-xx` i pada (exit 1) ako neki nalaz **ne postoji** u registru iz §1, ako se neki ID pojavljuje dvaput, ili ako postoji ID sa nepoznatim prefiksom.

Trenutni rezultat:

```
Provjera registra praznina (docs/audit/backend/18)
  nalaza u 13 i 15:        38
  redova u registru:       75
    ✅ zatvoreno   40
    ⚠️ djelimično  10
    ❌ praznina    20
    🔒 blokada     1
    ➖ van opsega  4
  nijedan nalaz iz 13/15 nije ispušten
  nema duplih ID-eva
  nema ID-a sa nepoznatim prefiksom
Registar potpun.            (exit 0)
```

**Ali registar nije plan.** Dvadeset praznina (poslije `20`, `21`, `22` i `23`) znači da podaci, model i **ograda** postoje, a da **odluka** još ne postoji: noćni minimum je izmjeren i tvrde granice su napisane (`23`), ali kontroler koji ih primjenjuje i tvrdnja o uštedi su i dalje ispred. Praznina se ne zatvara time što je pravilo napisano — nego time što ga predlog stvarno poštuje.

---

## 5. Bilo otvoreno — odgovoreno 2026-11-08

| # | Pitanje | Odgovor | Gdje |
|---|---|---|---|
| 1 | `dhwMode` | **Katalog modela** Vaillant i Bosch; odabir nosi tip | `19` §1 |
| 2 | `maxFlowC` po emiteru | **Ona koju sistem dozvoljava**, pita se u profilu | `19` §2 |
| 3 | Sedmična potvrda | **Da** — jedan dodir, bez kazne | `19` §3 |
| 4 | Retencija serije | **24 mjeseca punih 5 min**, pa 15 min trajno | `19` §4 |
| 5 | Bazni period za uštedu | **28 dana interno**, tvrdnja tek nakon 2 mjeseca gasa | `19` §5 |

Nijedno pitanje više ne blokira realizaciju. Ono što ostaje nije odluka, nego posao: **29 praznina iz §1** i dopuna kataloga (§`19` §7).
