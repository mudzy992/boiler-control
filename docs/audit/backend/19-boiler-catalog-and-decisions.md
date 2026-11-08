# 19 — Katalog bojlera i odluke 1–5

**Status:** dokumentacija prije realizacije. Ne mijenja aplikacijski kod.
**Datum:** 2026-11-08. **Grana:** `arena/da41e5ba-boiler-control`.
**Nadovezuje se na:** `18` §5 (pet otvorenih pitanja), `17` (sistem učenja).

---

## 0. Odluke vlasnika 2026-11-08

| # | Pitanje iz `18` §5 | Odluka |
|---|---|---|
| 1 | `dhwMode` | **Katalog poznatih bojlera Vaillant i Bosch**; odabirom modela aplikacija zna tip i smije li savjetovati |
| 2 | Max polazna za podno | **Ona koja je dozvoljena**, pita se pri kreiranju profila kad se odabere podno grijanje |
| 3 | Sedmična potvrda | **Da**, uvodi se |
| 4 | Retencija serije | „Koliko je sigurno" → **odlučeno u §4** |
| 5 | Bazni period za uštedu | Prepustio meni → **odlučeno u §5** |

---

## 1. Katalog: zašto postoji

### 1.1 Pitanje nije „kombi ili cilindar"

Prvo istraživanje je pokazalo da je pravo pitanje **„jesu li polazna grijanja i temperatura PTV-a odvojena podešavanja"**. Kod potvrđenih modela jesu:

| Model | Polazna grijanja | PTV | Odvojeno? |
|---|---|---|---|
| Vaillant ecoTEC plus VUW | 30–80 °C, tvornički 75; ograničeno parametrom **D.071** (40–80) | 35–65 °C | **da** |
| Vaillant ecoTEC plus VU | 30–80 °C, D.071 | vanjski cilindar | **da** |
| Vaillant ecoTEC plus VUI | 30–80 °C, D.071 | 35–65 °C (integrirani cilindar) | **da** |
| Bosch Condens 7000 WP | 30–85 °C (tipka za grijanje 30–80) | 35–80 °C | **da** |

Iz toga slijedi pravilo koje rješava sigurnosnu blokadu iz `18` §2.1: **snižavanje polazne grijanja ne dira PTV** na ovim modelima, pa je optimizacija bezbjedna — **pod uslovom da korisnik unosi polaznu grijanja, a ne temperaturu PTV-a.**

Zato katalog nije „lista imena" — on nosi **jedan sigurnosni bit** i **jedan raspon**.

### 1.2 Šta je potvrđeno, a šta nije

Katalog (`boiler-catalog.json`) ima 13 zapisa u dvije marke:

| Stanje | Broj | Šta to znači |
|---|---:|---|
| `VERIFIED_MANUAL` | 4 | ima izvor (priručnik) i brojeve — smije se koristiti |
| `TO_VERIFY` | 9 | porodica poznata, **brojevi namjerno `null`** — koristi se globalni raspon i **ne savjetuje se** snižavanje |

Nepotvrđeni zapisi **ne smiju imati izmišljene brojeve** — to je pravilo koje validator provjerava, ne preporuka.

### 1.3 Pravila koja izlaze iz kataloga

```
efektivni_min = max(30, model.heatingFlowMinC ?? 30)
efektivni_max = min(55, home.maxHeatingFlowC ?? 55, model.heatingFlowMaxC ?? 55)
```

Sigurnosna pravila (`rules.dhwSafety`):

| Situacija | Ponašanje |
|---|---|
| Odvojenost krugova **nije potvrđena** | **ne savjetuje se snižavanje**; predlog ostaje na trenutnoj vrijednosti, uz objašnjenje |
| Cilindar ili integrirani cilindar | PTV se **ne dira**; polazna grijanja se smije snižavati |
| Jedno podešavanje za oboje (stariji uređaj) | **nema optimizacije** — snižavanje bi ugrozilo PTV |

Ovo je jedina stvar u cijelom projektu gdje pogrešan savjet može naškoditi zdravlju. Zato je pravilo „nije potvrđeno → ne savjetuj", a ne „pretpostavi najbolje".

### 1.4 Šta katalog **ne** radi

**Ne širi raspon proizvoda.** Bojler može 80 °C, ali predlog i unos ostaju **30–55** — odluka vlasnika. Katalog služi samo da provjeri je li savjet za grijanje siguran i unutar granica konkretnog modela.

### 1.5 Validator

```bash
python3 scripts/audit/boiler_catalog_check.py
```

Provjerava: jedinstvene `id`, dozvoljene vrijednosti `dhw`/`specStatus`, da `VERIFIED_MANUAL` ima izvor i brojeve, da `TO_VERIFY` **nema** brojeve, fizički smislene raspone, `min < max`, da potvrđeni model sa PTV-om ima PTV granice i potvrđenu odvojenost, te da `rules.dhwSafety` postoji. Trenutno: **exit 0**.

---

## 2. Podno grijanje — pitanje u profilu

Kad korisnik pri kreiranju profila odabere `heatingType = UNDERFLOOR` ili `hasFloorHeating = true`, traži se **maksimalna polazna koju sistem dozvoljava** (podatak od instalatera ili iz projekta grijanja).

```
HomeProfile.maxHeatingFlowC   // nullable
```

- Ako je unesena → gornja granica predloga je `min(55, maxHeatingFlowC)`.
- Ako nije → predlog se ograničava na **konzervativnu vrijednost za podno** i prikazuje se napomena da se granica potvrdi.
- Nikad iznad 55, nikad iznad modela bojlera.

Zašto ne fiksni broj: podno grijanje nema jednu granicu — ona zavisi od estriha, cijevi i projektne temperature. Izmisliti 45 bi bilo isto što i izmisliti koeficijent, a to smo odbili u `17` §7.

---

## 3. Sedmična potvrda polazne

Pošto vrijednost važi do sljedeće izmjene (`18` §0), jedini način da se uhvati zaboravljeni unos je povremena potvrda.

| Pravilo | Vrijednost |
|---|---|
| Kada | jednom sedmično, uz dnevnu notifikaciju (ne kao zaseban push) |
| Kako | jedan dodir: **„još 50 °C"** ili **„promijenio sam"** |
| Ako odgovori „još X" | `FlowSetEvent` se ne piše; bilježi se `confirmedAt` |
| Ako odgovori „promijenio sam" | otvara se unos; nova vrijednost ide kao događaj sa `setAt` |
| Ako ne odgovori | **ništa se ne mijenja** — nema kazne, nema isključivanja iz modela |
| Poslije 21 dan bez potvrde | u prikazu stoji „polazna nije potvrđena od …"; model radi nesmetano |

Ovo je namjerno tiho. Kazna za normalno ponašanje (vrijednost stoji) bila bi gora od problema koji rješava.

---

## 4. Retencija serije — odluka

**Odluka: 5-min serija se čuva 24 mjeseca, zatim se sažima na 15 min i čuva trajno; dnevni zapisi se čuvaju trajno.**

Obrazloženje brojevima:

| Podatak | Veličina |
|---|---|
| 1 red / 5 min | 288/dan → **105.120/godina** |
| red sa indeksom | ≈ 150 B → **≈ 16 MB/dom/godina** |
| 24 mjeseca punih 5 min | ≈ **32 MB/dom** (dva puna perioda grijanja) |
| 15-min poslije toga | ≈ 5 MB/dom/godina |

Zašto 24 mjeseca: identifikacija koristi prozore do 60 dana, a tvrdnja o uštedi traži **najmanje dvije sezone** da bi obuhvatila različite zime. Sve preko toga ne povećava tačnost nijednog algoritma koji imamo — samo povećava izloženost podacima.

**Sigurnosna strana:** serija ne sadrži lokaciju, ime ni identitet; vezana je na `homeProfileId`. Briše se sa nalogom, kao i ostali podaci (postoji `account-export.service.ts`; brisanje mora pokriti i novu tabelu).

---

## 5. Bazni period za uštedu — odluka

**Odluka: interno 28 dana, eksterno (u UI) nijedna tvrdnja prije dva završena mjesečna očitanja gasa.**

Zašto ne 14 dana:

1. **Vremenski režim.** Dva tjedna mogu pasti cijela u jedan tip vremena (blago ili hladno); 28 dana pokriva najmanje jedan pun ciklus promjene.
2. **`u_day` kalibracija.** Dnevni član (sunce, gosti, kuhanje) treba ≥ 4 sedmice da se procijeni; sa 14 dana on je još šum.
3. **Gas je mjesečan.** `GasReading` ima `@@unique([userId, referenceMonth])` — najmanja mjerna jedinica je **mjesec**, ne dan. Dnevna „ušteda" bi bila izmišljena preciznost.

Zato: model i kontroler rade od dana 8–14 (to je učenje), a **tvrdnja o uštedi** čeka dva mjeseca. Do tada UI smije pokazati samo ono što je izmjereno: polaznu, cikluse, potrošnju — bez izvedenog procenta.

---

## 6. Šta ovo mijenja u ranijim dokumentima

| Dokument | Promjena |
|---|---|
| `18` §2.1 (PTV blokada) | **riješeno katalogom** — blokada postaje pravilo, ne pitanje |
| `18` §5 (5 otvorenih) | sva pet odgovorena |
| `17` §14.3 (retencija, bazni period) | odlučeno ovdje |
| `16` §4.5 (raspon) | nepromijenjeno: 30–55 |
| Registar (`18` §1) | stavke I-9, T-xx, C-xx dobijaju rješenje u projektu, ali **ostaju ❌ u kodu** dok se ne implementiraju |

**Jedna posljedica za UI koju treba zapisati odmah:** na kombi bojleru postoje **dva** podešavanja — polazna grijanja i temperatura PTV-a (često 60). Današnja oznaka „trenutna temperatura kotla" je dvosmislena i korisnik može unijeti PTV. Oznaka mora biti **„polazna temperatura za grijanje"**, a raspon 30–55 dodatno hvata najčešću grešku (unos 60 se odbija).

---

## 7. Šta ostaje otvoreno

1. **Dopuna kataloga** — 9 zapisa je `TO_VERIFY`; svaki traži priručnik za konkretnu oznaku. Posebno `atmoTEC`, `turboTEC` i `Gaz 6000 W`, gdje odvojenost krugova **ne smije** biti pretpostavljena.
2. **Instalacioni parametar D.071** — na ecoTEC plus gornja granica polazne se postavlja instalaterski (40–80). Ako je na uređaju postavljena na 55, to objašnjava zašto vlasnik kaže „bojler ne dozvoljava više". Aplikacija to ne može očitati — korisnik unosi ono što vidi na displeju.
3. **Ostale marke** — Buderus, Viessmann, Immergas, Demir Dokum su česte u BiH. Katalog je proširiv; do tada vrijedi pravilo „nepotvrđeno → ne savjetuj".
4. **Gdje katalog živi u kodu** — predlog: `backend/src/data/boiler-catalog.json` + seed u bazu, sa `specStatus` i `source` kao poljima, da se dopuna radi bez deploya.
