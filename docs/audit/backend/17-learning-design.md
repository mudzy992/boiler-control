# 17 — Profesionalni sistem učenja: projekat

**Status:** projekat, prije implementacije. Ne mijenja aplikacijski kod.
**Datum:** 2026-11-08. **Grana:** `arena/da41e5ba-boiler-control`.
**Nadovezuje se na:** `15` (ugovor R-1…R-8), `16` (sadašnje stanje), `13` §3 (L-01…L-12).

---

## 0. Odluke i jedna ispravka

### 0.1 Odlučeno 2026-11-08

| Odluka | Vrijednost | Posljedica u kodu |
|---|---|---|
| Raspon na bojleru | **min 30, max 55** | unos 30–55; **i clamp motora mora pasti sa 46 na 30** — inače raspon 30–55 nije dostižan (vidi §4.3) |
| Vrijeme predloga | **06:00, `Europe/Sarajevo`** | `daily.recommendation.service.ts:24` |
| Noćni minimum | **obavezan** | prozor 06:00 → 06:00 |
| Vrijeme dogrijavanja `T_max` | **120 min** (§8.6) | ulaz u kontroler |
| Prag podbačaja `ε` | **1,0 K** (§8.2) | prag za vraćanje polazne |
| Histereza | **1,0 K** — već postoji u kodu (§9.4) | mjerni artefakt, dok se ne izmjeri stvarna |
| Rezolucija senzora | **0,5 °C** — hardverska | ograničava tačnost svake procjene |

### 0.2 Ispravka koju je vlasnik postavio i koja je tačna

> „Ne možemo reći 1 stepen hladnije vani, +0,3 polazne."

**Tačno.** `0.3` je u kodu konstanta bez izvora (`base.strategy.ts:38`: `51 − ext·0.3`). Ona nije izmjerena, nije izvedena i ne zavisi od kuće. U nastavku se pokazuje **odakle nagib zaista dolazi** (§3), **koliko današnja vrijednost promašuje** (§4) i **kako se tačan broj dobija iz podataka** (§6–§8).

---

## 1. Zašto sadašnje učenje ne može dati tačan broj

Pet izmjerenih činjenica, sve iz izvršenog koda (`15` §3, `13` §3):

1. **Red učenja se nikad ne kreira.** `HeatingIntervalLearning` ima `updateMany` (`heating.recommendation.service.ts:80`), ali **nema nijednog `create`** u produkcijskom kodu. Kad red ne postoji, pravi se memorijski objekat sa `id: 0` (`:196`) i update pogađa **nula redova**. Prvi uzorak se ne upisuje — nikad.
2. **Jedinica je pogrešna.** 10 bucket-a (`weekday|weekend` × `night|morning|late_morning|afternoon|evening`). Pri jednom grijanju dnevno **8 od 10 nikad ne dostigne 8 uzoraka** (`15` D-04).
3. **Bucket koji se uči nije bucket koji se čita.** Dnevni predlog je hardkodiran na `morning` (`daily.recommendation.service.ts:139-146`), ciklusi pune večernji (`15` D-03).
4. **Signal je pogrešan.** „Overshoot" se računa kao `roomCurrent − roomTarget` **na kraju ciklusa**, a polling pri kraju prosljeđuje **početno** očitanje (`13` F-005), pa je vrijednost negativna kad je grijanje uspjelo.
5. **Pouzdanost je konstanta.** `confidence` starta na 0,1 i ostaje 0,1: `(0.1·N + 0.1)/(N+1)` = 0,1 za svako N. Nikad ne raste, pa nikad ne kaže „sad znam".

Nijedna od ovih pet nije stvar podešavanja — svaka je strukturna. Zato ovaj dokument ne predlaže popravku postojećeg učenja, nego **zamjenu**.

---

## 2. Šta „tačno" znači — budžet greške

Vlasnikov zahtjev je „da tačno znamo". Profesionalno znači: **znati koliko se ne zna**. Bez toga nema razlike između naučenog broja i nagađanja.

| Veličina | Može se znati? | Tačnost koju podaci dopuštaju | Šta bi je poboljšalo |
|---|---|---|---|
| Nagib krivulje kuće `s` | **da**, iz podataka | ±0,05 do ±0,15 nakon ~20 dana sa varijacijom polazne | više dana, varijacija polazne |
| Potrebna polazna za dati dan | **da**, do koraka pretrage | ±0,5 °C (korak + deadband) | finiji korak kad se približi granici |
| Noćni minimum | **da** | ±0,5 °C (prognoza) | lokalni senzor umjesto prognoze |
| Stvarna polazna | **samo ako korisnik unese** | 0,1 °C (unos) ili **nepoznato** | senzor protoka, ili dosljedan unos |
| Povratna temperatura | **ne** | — | senzor povrata (nema ga u Tuya statusu: `tuya.adapter.ts` čita samo `TempCurrent`/`TempSet`) |
| Dobitak od kondenzacije | **ne** | — | povrat + satni gas |
| Sunce, unutrašnji dobici | djelimično | dnevni član `u_day`, ±1–2 °C ekvivalenta | solarni senzor, popis stanovnika |
| Naša mrtva zona (`DEAD_ZONE`) | **da, poznato** | **1,0 K**, zapisano u kodu | — |
| Stvarna histereza na zidu | **mjerljivo** | ±0,15 K nakon ~30 prelaza | serija od 5 min (§9.4) |

**Zaključak §2:** sistem može tvrditi „nagib ove kuće je 0,78 ± 0,09" i „predlog je 0,5 °C od minimuma koji drži komfor". **Ne može** tvrditi „ušteda je 7,3 %" bez povrata i gasa po danu. Svaka tvrdnja u UI mora nositi svoju nesigurnost — inače je marketing.

---

## 3. Fizika: odakle nagib zaista dolazi

### 3.1 Izvod

Za sobu tokom grijanja, linearni model (dovoljan za identifikaciju, ne za simulaciju cijele kuće):

```
C·dT_r/dt = k1·(T_flow − T_r) − k2·(T_r − T_out) + u
```

- `T_r` sobna, `T_flow` polazna, `T_out` vanjska,
- `k1` snaga ogrjevnih tijela po kelvinu razlike polazna–sobna,
- `k2` toplotni gubici po kelvinu razlike sobna–vanjska,
- `C` toplotni kapacitet, `u` sunce + ljudi + uređaji.

Podijeljeno sa `C`, sa `a = k1/C` i `b = k2/C`:

```
dT_r/dt = a·(T_flow − T_r) − b·(T_r − T_out) + u
```

U stacionarnom stanju (`T_r` konstantno, `T_flow` konstantno, `u = 0`):

```
T_flow = T_r + (b/a)·(T_r − T_out)
```

`b/a` **je** nagib krivulje. Zato:

```
∂T_flow / ∂T_out = −b/a
```

**Nagib nije univerzalna konstanta; to je odnos gubitaka i snage ogrjevnih tijela jedne kuće.** Isti izraz važi za svaku kuću, ali sa drugim `b/a`. Zato „0,3 za sve" ne može biti tačno za više od jedne kuće — i to samo ako ta kuća slučajno ima `b/a = 0,3`.

### 3.2 Šta kaže praksa (literatura)

Standardne krivulje grijanja imaju nagib („Steilheit") u rasponu **0,2–1,5**, i to po tipu emitera:

| Emiteri | Uobičajen nagib |
|---|---|
| Podno grijanje | 0,3–0,5 |
| Niskotemperaturni radijatori | 0,6–0,9 |
| Klasični radijatori | 0,8–1,5 |
| Starija kuća, radijatori | 1,4–1,6 |

Ovo je empirijski raspon, ne izvod — ali se poklapa sa `b/a` iz §3.1. Ono što je bitno: **0,3 je donji rub cijelog raspona**, tj. pretpostavka da svaka kuća ima podno grijanje ili je pasivna. Vidi [1](https://www.idm-energie.at/en/heat-pump-installation/control-configuration/), [2](https://www.vaillant.com/en/advice/help-center/heating-curve/), [4](https://uni-pro.at/unipro-doc/help_en/program/fb_heat_curve.html).

---

## 4. Šta to znači za konkretan dan — 3 / 7 °C

### 4.1 Današnji predlog

Ulaz `tempMin = 3`, `tempMax = 7`, površina 150 m², bez naučenog offseta:

```
ext  = 0.7·3 + 0.3·7 = 4.2
base = 51 − 0.3·4.2 = 49.74
final = 49.74 °C          ← izmjereno na stvarnom motoru
```

**To je tačno broj koji vlasnik pamti kao „predviđao je 49".** Isti broj dobija **svaka** kuća od 150 m² danas: bez prozora, bez izolacije, bez radijatora, bez stanara.

### 4.2 Ono što kuća zaista traži

Uz `T_r = 21 °C`, po formuli iz §3.1:

| Vanjska | Aplikacija | `s=0,3` (podno) | `s=0,6` (LT rad.) | `s=1,0` (rad.) | `s=1,4` (stara kuća) |
|---|---:|---:|---:|---:|---:|
| +10 °C | **46,00** | 24,3 | 27,6 | 32,0 | 36,4 |
| **+4,2 °C (danas 3/7)** | **49,74** | **26,0** | **31,1** | **37,8** | **44,5** |
| 0 °C | 51,00 | 27,3 | 33,6 | 42,0 | 50,4 |
| −5 °C | 52,50 | 28,8 | 36,6 | 47,0 | 57,4 → 55 |
| −10 °C | 54,00 | 30,3 | 39,6 | 52,0 | 64,4 → 55 |

(Vrijednosti >55 su fizički nemoguće na ovom bojleru i u praksi bi bile odsječene.)

Danas, za 3/7 °C, aplikacija predlaže **5,2 do 23,7 °C više** nego što kuća traži: 44,5 za najgore izolovanu, a 26,0 za podno grijanje.

### 4.3 Struktura greške — ovo je važnije od jednog dana

Aplikacijska krivulja ima **nagib 0,3** (kao najbolje izolovana kuća) i **paralelni pomak ≈ +24 K** (kao najgore izolovana). To nije nijedna kuća: kombinacija koja drži predlog visokim u blagom vremenu, a ne dovoljno strmim u hladnom.

| Posljedica | Vrijednost |
|---|---|
| Pri 0 °C aplikacija je **iznad** potrebe svake realne kuće osim najgore | +0,6 … +23,7 °C |
| Pri +10 °C razlika raste | +9,6 … +21,7 °C |
| Predlog nikad nije **premalen** u blagom vremenu | 0 slučajeva |
| Najveća greška je za **najbolje** izolovane kuće | do +23,7 °C |

Zato: **kratki intervali koje je vlasnik primijetio nisu slučajnost — oni su očekivani ishod.** Previsoka polazna → soba brzo dostigne cilj → termostat prekida → kratak ciklus. Više o tome u §9.

### 4.4 Dodatno: donji clamp 46 je sam po sebi bias

`base.strategy.ts:25` reže na `max(46, …)`. Za dobro izolovanu kuću u blagom vremenu potreba je 24–32 °C, a motor **ne može proizvesti ispod 46**. Zato odluka „raspon 30–55" traži i izmjenu **clampa u motoru**, ne samo DTO-a — inače je donjih 16 °C raspona mrtvo slovo.

---

## 5. Podaci koje moramo početi bilježiti

Danas postoji **jedno** očitanje sobne temperature po uređaju (`ThermostatDevice.roomCurrentTemp`, prepisuje se svake minute) i dva po ciklusu (`HeatingEvent`). **Vremenske serije nema**, a bez nje se `a` i `b` iz §3.1 ne mogu izračunati. Ovo je najveći stvarni nedostatak — veći od same formule.

### 5.1 `ThermostatObservation` (vremenska serija)

| Polje | Tip | Zašto |
|---|---|---|
| `deviceId`, `at` | Int, DateTime | jedinstveno po 5 min |
| `roomTempC` | Float? | `T_r` |
| `targetTempC` | Float? | program/cilj |
| `isHeating` | Boolean | on/off prozor |
| `outdoorTempC` | Float? | `T_out` |
| `flowSetC` | Float? | današnja polazna (iz unosa) |
| `source` | String | `TUYA` / `MANUAL` |

Upis: **svakih 5 min** (288/dan/kuća, ~105k godišnje — trivijalno). Polling već ide svake minute (`*/1 * * * *`), pa je downsample jeftin.

### 5.2 `DailyRecord`

| Polje | Zašto |
|---|---|
| `userId`, `homeProfileId`, `localDate` (`@@unique`) | jedan dan, jedan red |
| `proposedFlowTemp`, `proposedAt` | predlog u 06:00, zamrznut |
| `flowSetC`, `flowSetSince`, `flowSetSource` | polazna **na snazi** u 06:00 (`USER`/`CARRIED`); historija je u `FlowSetEvent`, `18` §0.2 |
| `flowSetChangedDuringDay` | jeste li mijenjali u toku dana |
| `nightMinC`, `dayMeanC`, `dayMaxC`, `degreeHours` | osnova prognoze |
| `modelVersion`, `slopeS`, `slopeCi`, `params` (Json) | **reproducibilnost** — svaki predlog mora biti preračunljiv |
| `cycles`, `medianCycleMin`, `dutyPercent`, `overshootC` | ishod |
| `comfortOk`, `undershootC` | ishod |
| `gasM3`, `degreeDays` | ušteda, kad bude |

### 5.3 `HomeModel` (jedan red po kući)

`a`, `b`, `s`, `ciS`, `samples`, `residualStd`, `lastFitAt`, `modelVersion`, `state` (`COLD_START`/`TRACKING`/`DEGRADED`).

### 5.4 Zašto bez ovoga nema učenja

- Bez `T_r` serije: `b` se ne može izračunati → nagib ostaje pretpostavka.
- Bez `flowSetC` po danu: ne zna se na kojoj polaznoj je ciklus radio → `a` se ne može izračunati.
- Bez `DailyRecord`: ne postoji objekat koji se uči, pa se uči bucket (§1).

---

## 6. Identifikacija: kako se `a` i `b` dobiju iz podataka

> **Ispravljeno 2026-11-08 poslije simulacije.** Prva verzija ovog poglavlja predlagala je derivacijsku metodu (nagib temperature u prozorima mirovanja i grijanja). Simulacija (`scripts/audit/learning_sim.cjs`) je pokazala da ta metoda **ne radi u uslovima koje imamo**: pri kratkim ciklusima **nema nijednog prozora mirovanja od 45 min** (medium: 0, light: 0), a kraći prozor ne prelazi kvant senzora od 0,5 °C. Zato je primarna metoda **dnevni bilans energije**, koja ne traži prozore.

### 6.1 Primarna metoda: dnevni bilans („energy signature")

Za jedan dan, u ravnoteži, energija predata kući jednaka je gubicima:

```
k1·Σ_min (grijanje(t)·(F(t) − R(t)))·Δτ = k2·(R̄ − Ō)·1440 − q_int·1440
```

- `F(t)` — polazna **na snazi** u minuti `t` (važi do sljedeće izmjene, `18` §0),
- `R̄`, `Ō` — dnevni prosjeci sobne i vanjske,
- `q_int` — stalni unutrašnji dobici.

Podijeljeno sa `k1·1440`:

```
y = s·(R̄ − Ō) − c,        y = (1/1440)·Σ_min grijanje(t)·(F(t) − R(t)),
                          s = k2/k1,   c = q_int/k1
```

`y` se **svodi na `D·(F − R)`** kad je polazna konstantna tokom dana; vremenski ponderisan oblik je nužan jer izmjena može pasti usred dana (`18` §0.3).

To je **prava linija kroz dane**: `y = s·x − c`, gdje je `y = D·(F − R)`, a `x = (R − O)`. Dvije nepoznate, jedan red po danu, a identifikuju se **varijacijom kroz dane** (polazna se mijenja po danu, vrijeme se mijenja). Nagib te prave **je** nagib krivulje kuće.

Zašto je ovo bolje od derivacija:

| Osobina | Dnevni bilans | Derivacija |
|---|---|---|
| Traži prozor mirovanja | **ne** | da — a pri kratkim ciklusima ga nema |
| Osjetljiv na kvant 0,5 °C | ne (radi na prosjecima) | da (promjena < kvanta) |
| Osjetljiv na 60 s kašnjenje | ne | blago |
| Broj uzoraka | 1/dan | mnogo, ali kratkih |

**Filtri po danu:** `|R − O| ≥ 5`, `D ∈ [0,05; 0,98]`, `|R − 21| ≤ 2` (dan u ravnoteži), nepotpuni dan se odbacuje.

**Robusnost:** poslije prvog fita odbacuju se dani sa rezidualom > 3·MAD (otvoren prozor, gosti, sunce) i fit se ponavlja. Interval pouzdanosti: bootstrap po danima, 5–95 percentil.

### 6.2 Sekundarna metoda: derivacije, kad su ciklusi dugi

Kad ciklusi traju ≥ 45 min (teške kuće, niske polazne), mogu se koristiti i prozori:

```
dT_r/dt = a·(T_flow − T_r) − b·(T_r − T_out) + u
```

To služi kao **kontrola** da dnevni bilans nije systemic bias, ne kao izvor procjene. Simulacija: prozora ≥45 min je bilo 0 (light, medium) i 273/397 (heavy) — dakle metoda je nedostupna tačno tamo gdje je problem najveći.

### 6.3 Uslovi pod kojima procjena valjana

| Uslov | Zašto | Kako se provjerava |
|---|---|---|
| `|R − O| ≥ 5 K` | mali signal → šum pojede nagib | filtar po danu |
| Dan u ravnoteži | bilans pretpostavlja stacionarno stanje | `|R − cilj| ≤ 2` |
| `D` mjerljiv | udio grijanja je ulaz, ne izlaz | evidencija `isHeating` |
| Poznata polazna | bez `F` nema jednačine | unos korisnika (R-2) |
| Najmanje 8 dana | 2 parametra + rezerva | `days` u `HomeModel` |
| Outlieri | otvoren prozor, DHW, gosti | rezidual > 3·MAD |

### 6.4 Robusnost i granice

- **Nelinearnost emitera:** radijatori idu sa eksponentom ≈1,3, ne 1,0. Linearni bilans je aproksimacija; greška ulazi u `ciS`.
- **Dnevni član `c`** nosi unutrašnje dobítke; on je ono što model ne zna, i ne smije se tumačiti kao fizička konstanta.
- **Nedostatak podataka ≠ nula.** Bez `O` ili bez `R` serije: **nema update-a**, stanje `DEGRADED`. Nikad `0 °C` kao danas (`formula_pipeline_repro.cjs`: nedostaje vrijeme → 51 °C, `weightedExternalTemp 0`).
- **Granice:** `s ∈ [0,2; 1,5]`; izvan toga se procjena odbacuje, ne „popravlja".

---

## 7. Analog-dani: gdje su korisni, a gdje nisu

Vlasnikova intuicija — „imamo isti dan iz prošlosti" — je dobra, ali **kao dokaz, ne kao lookup**. Tri razloga:

1. **Min/max nije identitet.** Dva dana sa 3/7 °C mogu se razlikovati **42 %** u potrebi za grijanjem (`15` D-05, izmjereno: 303 prema 213 stepen-sati). „Isti dan" po min/max nije isti dan.
2. **Jedan analog ne nosi nagib.** Jedan dan sa jednom polaznom daje jednu jednačinu sa dvije nepoznate.
3. **Analog bez ishoda je samo mišljenje.** Vrijednost nosi **ishod** tog dana: koliko su ciklusi trajali, je li soba držala cilj — ne broj koji je tada predložen.

Zato analog-dani ulaze na dva mjesta, oba kontrolisana:

- **Kao težine u regresiji:** dan sličan današnjem dobija veću težinu (`w = exp(−d²/2σ²)`), pa se nagib lokalno prilagođava sezoni.
- **Kao fallback u hladnom startu** (§11): dok `HomeModel` nema dovoljno uzoraka, predlog se izvodi iz **ishoda** najbližih dana, sa eksplicitno prikazanom nesigurnošću.

Metrika sličnosti (mora sadržavati oblik dana, ne samo min/max):

```
d² = w1·(nightMin_r − nightMin_d)² + w2·(dayMean_r − dayMean_d)²
   + w3·(degreeHours_r − degreeHours_d)² + w4·(wind_r − wind_d)²
   + w5·(cloud_r − cloud_d)² + w6·[dayType se razlikuje]
```

`dayType` (radni/vikend) ulazi jer se ponašanje kuće mijenja; min/max **sam** ne ulazi.

---

## 8. Kontroler: silazak do granice komfora

Ovo je srce „profesionalnog" dijela. Ne pogađa se formula — **traži se minimum koji još drži kuću**.

### 8.1 Cilj

```
minimiziraj  T_flow
uz uslov:    T_r ≥ T_target − ε  tokom cijelog dana
             i T_r dostigne T_target unutar T_max od početka ciklusa
```

To je isto što iskusan majstor radi ručno: „spuštaj dok ne počne da bude hladno, pa vrati jedan korak". Razlika je što sistem to radi mjerljivo i pamti.

### 8.2 Pravila

| Situacija | Akcija | Korak |
|---|---|---|
| Komfor držan cijeli dan, bez podbačaja | **spusti** | −1,0 °C (dok se ne približi; onda −0,5) |
| Podbačaj > 1,0 °C u bilo kojem satu | **vrati i pređi preko** | +1,5 °C (asimetrija: hladno je skuplje od toplog) |
| Dostizanje cilja > `T_max` (npr. 120 min) | podigni | +1,0 °C |
| Prebačaj > 1,5 °C iznad cilja | spusti | −1,0 °C |
| `|predlog − jučerašnji| < deadband 0,5 °C` | **ne mijenjaj** | 0 |
| Manje od 3 dana od zadnje promjene | ne mijenjaj | 0 (dwell) |
| Model `DEGRADED` / nema podataka | ne mijenjaj | 0 |

**Tvrde granice:** `T_flow ∈ [30, 55]`, ukupna promjena po danu ≤ 2 °C, nikad ispod 30, nikad iznad 55, i nikad ispod vrijednosti koja pokriva noćni minimum (§8.4).

### 8.3 Zašto asimetrija

Previsoka polazna: kuća topla, gas malo veći, korisnik nezadovoljan cijenom.
Preniska: kuća hladna, korisnik nezadovoljan **komforom** i gubi povjerenje u proizvod.
Zato se spušta sporo (−1), a podiže brzo (+1,5), i **ne prelazi** granicu koja je jednom izazvala podbačaj.

### 8.4 Noćni minimum kao tvrda granica

Po odluci iz `15` §9.1, predlog se pravi u 06:00 i mora pokriti noć. Zato se prije objavljivanja radi provjera:

```
T_flow_final = max( T_kontroler , T_noćni_minimum )
```

gdje je `T_noćni_minimum` najmanja polazna za koju model garantuje `T_r ≥ T_target` u najhladnijem satu prozora 06:00 → 06:00. Ako provjera podigne vrijednost, korisnik to vidi u objašnjenju („podignuto zbog noći na −4 °C"), a ne kao tihu korekciju.

### 8.5 Istraživanje (exploration) — kad je dozvoljeno

Bez varijacije polazne nagib se ne može identificirati. Ali istraživanje na račun komfora je nedopustivo, zato:

- dozvoljeno **samo** kad je prebačaj > 1 °C u tri od pet zadnjih dana (očigledna rezerva),
- amplituda 1 °C, nikad dva dana uzastopno u istu stranu,
- nikad u noći, nikad kad je `nightMin < 0 °C`,
- rezultat se bilježi u `DailyRecord` kao `exploration = true`, da se ne pomiješa sa konvergencijom.

### 8.6 `T_max = 120 min` — odakle tačno dolazi

Vlasnik je tražio da 120 min ima osnovu u struci, standardu ili fizici, a ne u osjećaju.

**Standard ne propisuje 120 min.** EN 12831-1 tretira vrijeme dogrijavanja kao **ulaz** u proračun toplotnog opterećenja („dodatna snaga dogrijavanja", Φ_RH) i daje tabele za 0,5 / 1 / 2 / 3 h, uz tipičan stambeni slučaj **1 h poslije 8 h noćnog pada od 4 K**, a 2–3 h za teške konstrukcije. Dakle:

| Tvrdnja | Status |
|---|---|
| „Standard kaže 120 min" | **nije tačno** — standard ne fiksira vrijeme |
| „120 min je unutar standardovog raspona, na konzervativnoj strani" | **tačno** — raspon je 0,5–3 h |
| „Dogrijavanje traži dodatnu snagu" | **tačno** — Φ_RH postoji upravo zato |

**Fizički oblik (tačniji od broja):**

```
t_dogrijavanja ≈ ΔT_pad / (heatRate − idleDecay),   heatRate ∝ (T_flow − T_r)
```

Zato `T_max` **nije neutralan parametar**: kraće dogrijavanje traži višu polaznu, a viša polazna smanjuje uštedu. To je jedini stvarni kompromis u cijelom sistemu.

**Zaključak:** 120 min se prihvata, ali se računa kao **stvarni prozor od početka grijanja do trenutka kad soba mora biti topla** (npr. 05:00 → 07:00), sa 120 kao zadatom vrijednošću kad program termostata ne kaže drugo. Ako korisnik ikad zatraži brže, to mora biti vidljivo kao cijena u polaznoj, ne kao besplatno podešavanje.

---

## 9. „Kratki intervali" — formalno

Vlasnikova opservacija je tačna i treba je pretvoriti u mjerljivu veličinu, ali **ne u direktan signal za spuštanje**. Kratak ciklus može značiti previsoku polaznu — ili preveliku histerezu termostata, ili premali broj emitera. Razlika se mora vidjeti u podacima.

### 9.1 Metrike po ciklusu

| Metrika | Definicija | Šta govori |
|---|---|---|
| `duration` | `timestampEnd − timestampStart` | dužina ciklusa |
| `rise` | `T_r(kraj) − T_r(početak)` | koliko je soba narasla |
| `heatRate` | `rise / duration` [K/h] | **brzina grijanja — glavni signal** |
| `overshoot` | `max T_r − T_target` | prebačaj |
| `idleDecay` | pad temperature kad je off [K/h] | gubici kuće |
| `cyclesPerDay`, `duty` | brojevi | ritam |

### 9.2 Pravilo

Kratak ciklus sa **velikim `heatRate`** = polazna previsoka za taj gubitak → smanji.
Kratak ciklus sa **malim `heatRate`** = polazna je u redu, problem je histereza ili snaga emitera → **ne diraj polaznu**, prijavi.

Formalno, očekivana dužina ciklusa iz modela:

```
duration_pred ≈ (histereza + overshoot) / |heatRate − idleDecay|
```

Ako je izmjereno **kraće** od predviđenog uz isti `heatRate`, uzrok nije polazna. To je razlika između „profesionalno" i „spusti jer je kratko".

### 9.3 Kondenzacija — šta smijemo tvrditi

Mehanizam je stvaran: kondenzacijski bojler kondenzuje dok je **povratna** voda ispod ~55 °C (prirodni gas), a najbolje ispod 40 °C; kratki ciklusi dodaju start/stop gubitke i prekidaju kontinuiranu kondenzaciju ([3](https://obrien-energy.com.au/how-condensing-boilers-work-on-industrial-sites/), [2](https://energyguide.org.uk/boiler-return-temperature-explained/)).

**Ali:** povratnu temperaturu **ne mjerimo** — Tuya status daje samo `TempCurrent` i `TempSet`. Zato:

- dozvoljeno je tvrditi: „niža polazna → niža povratna pri istom ΔT → više kondenzacije" (smjer, ne iznos);
- **nije** dozvoljeno tvrditi procenat uštede od kondenzacije bez senzora povrata i satnog gasa;
- `duty` i `cyclesPerDay` su mjerljivi i smiju ući u objašnjenje; „ušteda 8 %" ne smije.

### 9.4 Histereza, mrtva zona i rezolucija — tri različite stvari

Vlasnikovo pitanje: je li histereza **trenutak paljenja** (soba 21,5, cilj 22, grijanje kreće na 21) ili **rezolucija** (termostat ide u koracima 0,5)?

**Prvo jeste histereza. Drugo nije.** I oboje postoji u ovom sistemu, sa poznatim brojevima.

| Pojam | Šta je | Vrijednost ovdje |
|---|---|---|
| **Histereza / mrtva zona** | razlika između tačke paljenja i tačke gašenja | **1,0 K** — zapisano u kodu |
| **Rezolucija** | najmanji korak očitanja | **0,5 °C** — hardverska |
| **Tačnost** | koliko procjena može odstupiti | ±0,15 K nakon ~30 prelaza |

**Naša mrtva zona nije pretpostavka — to je kod.** `DEAD_ZONE = 1.0`, `thermostat.polling.service.ts:48`, primijenjeno u `resolveHeatingState` (`:528-535`):

```
ako grijanje radi:   isključi kad je T_r ≥ cilj
ako ne radi:         uključi kad je T_r ≤ cilj − 1,0
```

Banda je **1,0 K, cijela ispod cilja, asimetrična** — tačno kako je vlasnik opisao („cilj 22, grijanje kreće na 21 i niže"). Njegova prva pretpostavka nije pretpostavka; to je već napisano.

**Rezolucija 0,5 °C je također stvarna:** Tuya daje `TempCurrent` i `TempSet` u pola stepena (`tuya.adapter.ts:303,312,340` — `44 → 22,0`, `43 → 21,5`). Zato se histereza **ne može** izmjeriti tačnije od 0,5 K po jednom prelazu; tačnost raste usrednjavanjem.

#### Dvije histereze — i ne smiju se pomiješati

| Histereza | Gdje | Vrijednost | Šta određuje |
|---|---|---|---|
| Naša („shadow") | `DEAD_ZONE` | **1,0 K** | kad **mi** zabilježimo početak i kraj ciklusa |
| Stvarna, na zidu | termostat / bojler | **nepoznato** | kad bojler zaista počne i prestane grijati |

Aplikacija je prema kotlu čitljiva (`16` §2.4), pa `resolveHeatingState` **ne upravlja** kotlom — on odlučuje samo kad ćemo mi napisati `HeatingEvent`. Zato su `duration`, `cyclesPerDay` i `heatRate` izmjereni **našom** bandom, ne stvarnom. To nije greška, ali je mjerni artefakt: **stvarni ciklus može biti kraći od zapisanog.**

**Posljedica za „kratke intervale":** pošto naša banda već iznosi 1,0 K, kratak ciklus je **jači** dokaz previsoke polazne nego što bi bio sa tijesnom bandom. Vlasnikova opservacija time dobija na težini, ne gubi.

#### Kako se stvarna histereza mjeri, bez nagađanja

Iz serije `ThermostatObservation`, na svakom prelazu:

```
T_on   = očitanje u prvom uzorku kad isHeating postane true
T_off  = očitavanje u prvom uzorku kad postane false
banda       = median(T_off − T_on)
asimetrija  = median(cilj − T_on)
```

Bias zbog uzorkovanja na 5 min: < 0,2 K; greška procjene: < ±0,15 K nakon ~30 prelaza (~10–15 dana).

Do mjerenja se koristi **1,0 K**.

#### Zašto je to važno za kontroler

Dužina ciklusa ima fizički pod:

```
duration_pred ≈ (banda + prebačaj) / |heatRate − idleDecay|
```

Ako je banda 1,0 K a `heatRate` 3 K/h, ciklus **ne može** biti duži od ~20 min bez obzira na polaznu. Zato §9.2 razlikuje uzroke:

- kratak ciklus **uz visok `heatRate`** → polazna previsoka → spusti;
- kratak ciklus **uz nizak `heatRate`** → banda/histereza je uzrok → **polaznu ne diraj**.

Bez mjerenja bande ta dva slučaja izgledaju isto — i „spusti jer je kratko" postaje nagađanje.

---

## 10. Hladni start: prvih 14 dana

| Dani | Šta sistem radi | Šta korisnik vidi |
|---|---|---|
| 0 | Predlog = profilna formula (`16` §3.3), **označen kao procjena** | „prvi predlog, bez historije" |
| 1–3 | prikuplja seriju, ne mijenja ništa | isti predlog, + napomena |
| 4–7 | prva procjena `b` (hlađenje), `a` još slab | „nagib se procjenjuje" |
| 8–14 | `a` i `b` zajedno, `s` sa širokim CI | „nagib 0,62 ± 0,21" |
| 15+ | `s` unutar ±0,10, kontroler preuzima spuštanje | „nagib 0,71 ± 0,08" |
| 28+ | `u_day` kalibrisan (sunce/ljudi), `DailyRecord` dovoljan za mjerenje uštede | prva moguća tvrdnja o uštedi |

Do dana 14 **nijedan broj se ne mijenja bez korisnikovog unosa** — sistem ne smije „učiti" iz podataka koje još ne razumije.

---

## 11. Validacija i prihvatni kriteriji

| Provjera | Kriterij |
|---|---|
| Tačnost nagiba | na sintetičkoj kući sa poznatim `a`, `b` (npr. `s = 0,8`) procjena mora pasti u ±0,1 nakon 20 dana šuma 0,2 K |
| Otpornost na outliere | otvoren prozor (pad 3 K u 10 min) ne pomjera `s` više od 0,05 |
| Nema podataka | bez `T_out` ili bez serije: `state = DEGRADED`, predlog se **ne mijenja** |
| Konvergencija | iz starta `s = 0,3` na istinu `0,8`, kontroler dođe unutar 1 °C u ≤ 10 dana bez podbačaja |
| Podbačaj | u 30 simuliranih dana **0** podbačaja > 1,0 K nakon dana 10 |
| Granice | nikad < 30, nikad > 55, dnevna promjena ≤ 2 °C |
| Reproducibilnost | svaki `DailyRecord` se može preračunati iz `modelVersion` + `params` i dati isti broj |
| Golden gate | `formula_max_audit.cjs --check-golden` zelen poslije svake izmjene motora |

Simulacija je obavezna prije puštanja: kuća sa poznatim `a`, `b`, histerezom i šumom senzora, 60 dana, pa se mjeri da li kontroler nađe `s` i da li drži komfor. Bez toga se ne ide na stvarni bojler.

---

### 11.1 Rezultat simulacije (`scripts/audit/learning_sim.cjs`, izvršeno)

Model kuće: jedan kapacitet, `a = k1/C`, `b = k2/C`, stalni dobici 200 W, šum vanjske temp 0,15 K. Uslovi mjerenja su **produkcijski**: histereza 1,0 K cijela ispod cilja, senzor zaokružen na 0,5 °C, evidencija sa 60 s kašnjenja, korak 1 min, 60 dana.

**Identifikacija nagiba** (istina `s` naspram procjene iz 60 dana, sa CI 90 %):

| Kuća | Istina `s` | Dan 10 | Dan 20 | Dan 60 | CI na dan 60 |
|---|---:|---:|---:|---:|---|
| light | 0,755 | 0,753 | 0,758 | **0,755** | 0,753–0,757 |
| medium | 0,943 | 0,943 | 0,948 | **0,945** | 0,942–0,950 |
| heavy | 1,000 | 0,995 | 0,998 | **1,001** | 0,989–1,014 |

Nagib je pogođen **do treće decimale već desetog dana**. Derivacijska metoda je istovremeno dala **0 prozora mirovanja ≥45 min** za light i medium — dakle neupotrebljiva tačno tamo gdje je problem najveći (§6).

**Kontroler** (start = današnja formula 49,2 °C, 60 dana):

| Kuća | Polazna start → kraj (prosjek zadnjih 10) | Ciklusa/dan | Medijana ciklusa | Polazna iznad sobe |
|---|---|---|---:|---:|---:|
| light | 49,2 → 39,1 (36,5) | 60,1 → **28,1** | 10 → **42 min** | 29,6 → **18,0 K/dan** |
| medium | 49,2 → 43,6 (40,4) | 41,1 → **21,7** | 17 → **52 min** | 29,6 → **21,6 K/dan** |
| heavy | 49,2 → 44,9 (41,6) | 11,9 → **6,6** | 59 → **177 min** | 29,6 → **22,7 K/dan** |

Podbačaj > 1 K poslije dana 10: **0 od 50 dana** u sve tri kuće (najgori 0,76–0,81 K). Sporije od 120 min: **0**. Polazna nikad izvan 30–55.

**Šta ovo dokazuje, a šta ne:**

| Dokazano | Nije dokazano |
|---|---|
| metoda je identificirajuća — nagib se nađe iz dnevnih prosjeka | da će CI u stvarnoj kući biti ±0,005: model nema sunce, DHW ni promjenu ponašanja |
| kontroler konvergira prema dolje bez podbačaja | da je isti korak siguran u kući sa bržom dinamikom |
| ciklusi se produžuju 2,4–3× kad polazna padne | procenat uštede — `polazna iznad sobe` je **proxy**, ne mjera |
| dnevni bilans radi kad derivacije ne rade | ponašanje pri otvorenom prozoru (u modelu ga nema) |

Posljednja dva reda su razlog zašto se ide u shadow režim, a ne direktno na bojler.

---

## 12. Primjer korak po korak — vlasnikov slučaj

**Ulaz:** danas min 3 / max 7; na bojleru trenutno **50**; u prošlosti identičan dan predložio **49**, ali su intervali bili kratki.

| Korak | Šta sistem radi | Rezultat |
|---|---|---|
| 1 | Izračuna oblik dana, ne samo min/max: `nightMin`, `dayMean`, `degreeHours` | npr. `nightMin 1,5`, `DH 168` |
| 2 | Nađe analogne dane po metrikama iz §7 (ne po min/max) | 4 dana u zadnjih 60, sličnost `d² < 0,4` |
| 3 | Za svaki analog pročita **ishod**: `heatRate`, `duration`, `overshoot`, `comfortOk` | 49 °C → `heatRate` visok, `duration` 22 min, `comfortOk` da |
| 4 | Uporedi sa modelom: predviđena dužina pri 49 °C vs izmjerena | izmjereno kraće **uz visok `heatRate`** → polazna previsoka (§9.2) |
| 5 | Provjeri rezervu: je li bilo podbačaja? | nije → smije spustiti |
| 6 | Primijeni korak od **najniže vrijednosti za koju znamo da je bila previsoka** (49), a ne od trenutnog unosa (50) | **48,0** — 49 je već dokazano previsoko, pa nema smisla testirati ga ponovo |
| 7 | Provjeri noćni minimum za predstojeću noć | ako noć ide na −2 °C, podigni na pokrivenost i **objasni zašto** |
| 8 | Zapiše `DailyRecord`: predlog, razlog, model, CI, `exploration=false` | sutra je ovo dokaz |

**Ključna razlika prema danas:** sistem ne pogađa da je 49 previše — on **čita da je 49 dao kratak ciklus uz visok `heatRate`**, pa 49 označava kao „dokazano previsoko" i spušta jedan mjerljiv korak **ispod njega**, uz granicu koju noć postavlja. Sutradan se zna ishod za 48 — i tako se, dan po dan, granica pomjera prema dolje dok komfor ne počne da popušta.

---

## 13. Redoslijed izgradnje

| # | Korak | Zašto tim redom | Zavisnost |
|---|---|---|---|
| 1 | `DailyRecord` + jedan pisac u 06:00 — **urađeno 2026-11-08, vidi `20`** | bez dana nema šta da se uči | — |
| 2 | `ThermostatObservation` (5 min) — **urađeno 2026-11-09, vidi `21`** | bez serije nema `a`/`b` | 1 |
| 3 | `HomeModel` + identifikacija `b` (off) — **izmijenjeno:** `s` iz dnevnog bilansa, vidi `22` §0 | najlakše i najstabilnije prvo | 2 |
| 4 | identifikacija `a` (on) + `s` sa CI — **`s` urađeno 2026-11-10 (`22`), `a` ostaje** | daje nagib kuće | 3 |
| 5 | noćni minimum + tvrda granica — **urađeno 2026-11-11, vidi `23`** | sigurnost prije optimizacije | 1 |
| 6 | kontroler: spuštanje do granice — **odluka + simulacija urađene 2026-11-12, vidi `24`; povezivanje na predlog ostaje** | donosi uštedu | 4, 5 |
| 7 | mjerenje ishoda + `u_day` | omogućava tvrdnju o uštedi | 1, 6 |
| 8 | analog-dani kao težine/fallback | poboljšava hladni start | 2, 4 |

Simulacija (§11) je obavezna prije koraka 6.

---

## 14. Otvoreno

### 14.1 Riješeno 2026-11-08

1. **`T_max` = 120 min.** Standard ne fiksira vrijeme (EN 12831-1 ga tretira kao ulaz, raspon 0,5–3 h, tipično 1 h za noćni pad od 4 K), pa je 120 min unutar raspona i na konzervativnoj strani. Računa se kao stvarni prozor do trenutka kad soba mora biti topla — vidi §8.6.
2. **`ε` = 1,0 K.** Poklapa se sa postojećom `DEAD_ZONE = 1.0`, pa znači „ispod normalne bande", a ne „ispod cilja". Ako mjerenje pokaže stvarnu bandu veću od 1,0 K, `ε` se **mora** povisiti na izmjerenu — inače kontroler javlja lažne podbačaje.
3. **Histereza** nije stvar odluke nego mjerenja: naša je 1,0 K (kod), stvarna se mjeri iz serije (§9.4), rezolucija je 0,5 °C (hardver).

### 14.2 Nova obaveza prije puštanja (iz simulacije)

- **`T_max` mora biti tvrdo ograničenje u kontroleru, ne metrika.** U simulaciji nije prekoračen ni u jednoj kući, ali nije bio ni ograničen — kontroler ga nije provjeravao. Prije pravog bojlera to postaje guard: ako predlog ne može dostići cilj u 120 min pri toj polaznoj, predlog se podiže.
- **„Dostigao cilj" = ušao u kvant ispod cilja.** Sa senzorom 0,5 °C i histerezom 1,0 K soba fizički **ne prelazi** cilj — termostat gasi na prvom kvantu ≥ cilj, pa je stvarni plafon ≈ `cilj − 0,25 K`. Svaka metrika koja traži `T_r ≥ cilj` prijaviće vječni promašaj; mjeri se `T_r ≥ cilj − 0,5 K`.

### 14.3 Ostaje otvoreno

4. **Senzor povrata** — postoji li mogućnost ugradnje? Bez njega kondenzacija ostaje smjer, ne broj.
5. ~~Koliko dana prije prve tvrdnje o uštedi~~ — **riješeno 2026-11-08 → `19` §5:** 28 dana interno, a tvrdnja u UI tek nakon **dva završena mjesečna očitanja gasa**. Učenje počinje ranije (§10), tvrdnja ne.
6. **Zadržati `HeatingIntervalLearning` kao istoriju** ili ga ukinuti? (predlog: ukinuti, jer 10 bucket-a nema mjesto u dnevnom modelu; `DailyRecord` ga zamjenjuje)
7. ~~Zamrznuti `DEAD_ZONE` u `DailyRecord`~~ — **riješeno 2026-11-08:** vlasnik potvrdio da je `DEAD_ZONE` uvijek 1. Vrijednost je konstanta, pa ranije izmjereni `heatRate`/`duration` ostaju uporedivi. U `DailyRecord` ide samo `modelVersion`.

Poznato ograničenje koje ostaje: **finije uzorkovanje nije opcija.** Polling ide svake minute zbog Tuya kvote, pa je serija od 5 min najbolje što smijemo tražiti — i zbog toga se tačnost izvlači iz dužih prozora i iz **dnevnog bilansa**, ne iz trenutnih nagiba (§6).
