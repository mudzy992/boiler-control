# MAX AUDIT — polazna temperatura, učenje, anomalije i instrukcije korisniku

Status: **radna verzija, spremna za stručnu reviziju** · Datum: 2026-11-08 · Grana: `arena/da41e5ba-boiler-control`

Obim: `FlowTemperatureEngine` i sve tri strategije, oba puta učenja, oba sloja detekcije anomalija, health/izvještajni pragovi koji ih koriste, te **svaka poruka koja od tih izračuna stiže do korisnika**.

Ovaj dokument ne mijenja aplikacijski kod. Ne mjeri stvarnu instalaciju. Ne daje dozvolu za automatsko upravljanje kotlom.

> **Revidirano 2026-11-08:** stvarni ugovor proizvoda je **jedna dnevna preporuka** uz ručno podešavanje na bojleru, i unos trenutne polazne kao evidencija. Mjerenja i nalazi u ovom dokumentu ostaju valjani, ali kriterij ocjene mijenja `15-daily-proposal-audit.md` — tamo su i nalazi koji iz tog ugovora proizlaze (D-01…D-10) i revidirani prioriteti.

---

## 0. Metod, klase dokaza i ograničenja

### 0.1 Klase dokaza

| Oznaka | Značenje |
|---|---|
| **VERIFIKOVANO (izvršeno)** | Vrijednost je dobijena pokretanjem **stvarnog** koda (`FlowTemperatureEngine`, `AnomalyDetectionService`) nad sintetičkim ulazima. |
| **VERIFIKOVANO (lažna baza)** | Stvarni servis je izvršen s in-memory lažnim Prisma/notification slojem (isti postupak kao `scripts/audit/learning_end_repro.cjs`). Dokazuje kontrolni tok i upisane vrijednosti, ne ponašanje Postgresa. |
| **VERIFIKOVANO (izvor)** | Tvrdnja je neposredno pročitana u kodu; navedena je putanja i linija. Nije izvršena nad bazom. |
| **REPLIKA (izvršeno)** | Aritmetika je prepisana iz izvora red-po-red i izvršena, jer je u servisu neodvojiva od Prisma poziva. Nije dokaz ponašanja baze. |
| **HIPOTEZA** | Izvedeno iz koda i brojeva, ali traži potvrdu na stvarnim podacima ili od stručnjaka. |

### 0.2 Alat

```
node scripts/audit/formula_max_audit.cjs [--json] [--only=curve|prod|robust|learning|anomaly|sensitivity]
node scripts/audit/formula_pipeline_repro.cjs [--json]
```

Prva skripta izvršava **čistu formulu** (engine + detektor). Druga izvršava **servise** (preporuka, dnevni cron, anomaly checker, `BoilerService`) nad lažnom bazom i pokriva nalaze koji žive izvan motora: perzistenciju učenja, sezonalnost, nedostatak prognoze i prepisivanje `timestampEnd`.

Skripte uvoze stvarni kod preko `ts-node/register/transpile-only`, uz isti sintetički enum-stub koji koristi postojeći `scripts/audit/formula_table.cjs`. Nema mreže, baze, tajni, ni upisa u aplikacijski kod. U prvoj skripti je aritmetika učenja **REPLIKA** `heating.recommendation.service.ts:52-90`; u drugoj se izvršava **stvarni servis** nad lažnom bazom, pa je perzistencija mjerena, a ne rekonstruisana.

### 0.3 Šta ovaj dokument NIJE

- Nije mjerenje performansi sistema. Svi brojevi su sintetički ulazi u stvarni kod.
- Nije potvrda da produkcijska baza sadrži redove u `HeatingIntervalLearning`. Baza nije čitana.
- Nije dozvola za slanje komandi kotlu. `IThermostatAdapter` izlaže samo čitanje (`backend/src/modules/Boiler/adapter/thermostat-adapter.interface.ts:18-24`).
- Nije zamjena za provjeru proizvođačkih granica kotla, podnog kruga i zaštite od smrzavanja.

### 0.4 Odnos prema ranijem auditu

`docs/audit/backend/06-formulas.md` je tačno lociralo većinu problema. Ovaj dokument **ispravlja i kvantifikuje** četiri stvari koje su tamo ostale na nivou opisa:

1. skok na 10 °C nije „~48 na 46" — bazna krivulja pada **48,0000 → 45,0000 (−3,0000)**, a izlaz **48,00 → 46,00 (−2,00)**; na −15 °C skok krivulje postoji (**56 → 55,4997**) ali ga clamp **potpuno maskira** (55 → 55);
2. izlaz ispod 48 °C nije rubni slučaj: dostupan je u sva tri načina rada (ANONYMOUS tačno 46,00; PROFILE_ONLY 46,0–47,8; FULL 46,0–47,98), a **ANONYMOUS domen ima i rupu** — nijedna vrijednost ne postoji između 46,00 i 48,0003;
3. self-inclusion u baseline-u anomalija nije samo „može iskriviti statistiku" — konkretno **70-minutni ciklus koji je 6σ iznad historije prestaje biti detektovan**;
4. učenje nije samo „pogrešan predznak" — mjereni „overshoot" je po konstrukciji **≤ −1 °C** (dead zone), pa učenje sistematski **spušta** polaznu i time pojačava nedogrijavanje.

---

## 1. Izvršni sažetak — nalazi po prioritetu

| # | Nalaz | Dokaz | Ozbiljnost | Posljedica za korisnika |
|---|---|---|---|---|
| **F-01** | Preporuka može biti 46–47,9 °C u **sva tri načina rada**, a aplikacija dozvoljava unos samo 48–55 °C. | VERIFIKOVANO (izvršeno): ANONYMOUS daje tačno 46; PROFILE_ONLY 46,0–47,8; FULL 46,0–47,98; `set-current-temp.dto.ts:12-18`; `boilerLimits.ts` | **Kritično** | Korisnik ne može izvršiti preporuku; health score ga kazni za „odstupanje" koje je sam sistem propisao. |
| **F-02** | Učenje mjeri `roomCurrentTemp` **s početka** ciklusa, ne s kraja. | VERIFIKOVANO (izvor): `thermostat.polling.service.ts:485`; `heating.anomayl.checker.service.ts:318` | **Kritično** | Naučeni offset je sistematski negativan → polazna pada → soba se sporije grije → offset pada dalje. |
| **F-03** | „Overshoot" se **dodaje** polaznoj, i to dvaput (offset ≈ μ(overshoot) + 0,5·μ(overshoot)). | VERIFIKOVANO (izvršeno): +2 °C overshoot → +3,00 °C na polaznu | **Kritično** | Kad je soba prevruća, sistem **podiže** polaznu. Povratna veza suprotnog znaka. |
| **F-04** | `HeatingIntervalLearning` se **nikada ne kreira**; jedini upis je `updateMany({id})`, a novi red ima `id: 0`. | VERIFIKOVANO (lažna baza): `where {"id":0}`, `create=0`, `upsert=0`, upisano **0 redova** uz `samples=1` | **Visoko** | Učenje tiho ne radi: `FULL` je nedostizan bez ručno zasejanog reda, a neuspjeh se ne loguje. |
| **F-05** | `confidence` učenja je matematički konstanta 0,1 za svaki N. | VERIFIKOVANO (izvršeno): 6 uzoraka → 0,1 svaki put | **Visoko** | Model nikad ne „sazrijeva"; health score s naučenim redovima ne može preći ~69/100. |
| **F-06** | Profilna polja `windowType`, `insulationType`, `heatingType`, `ceilingHeight` **ne stižu** do motora ni na jednoj produkcionoj putanji. | VERIFIKOVANO (izvršeno + izvor): `boiler.service.ts:104-109`, `heating.recommendation.service.ts:127-132` | **Visoko** | Korisnik unosi podatke koji ništa ne mijenjaju; efekat bi bio do 2–3 °C. |
| **F-07** | Podno grijanje (−2 °C) i `ceilingHeight` u metrima (3,2) daju 46 °C — ali samo ako se polja proslijede. | VERIFIKOVANO (izvršeno): `ceilingHeight=3.2` → 46,00 | Srednje | Latentni bug jedinica (DTO 1,8–5 m vs engine cm) koji čeka da neko „popravi" prosljeđivanje. |
| **F-08** | `seasonMode='SUMMER'` vraća isključeno grijanje **bez obzira na vanjsku temperaturu**, bez frost guarda. | VERIFIKOVANO (lažna baza): pri −12…−4 °C `SUMMER` → **0 °C**, `WINTER` → 53,88 °C | **Visoko (sigurnost)** | Profil koji korisnik zaboravi prebaciti isključuje grijanje i na −10 °C. |
| **F-09** | Anomalija se detektuje **samo po trajanju ciklusa**; baseline uključuje event koji se provjerava. | VERIFIKOVANO (izvršeno): 70 min vs μ=60 → detektovano `true` bez self, `false` sa self | **Visoko** | Stvarni kvarovi (soba ne dostiže cilj, polazna ne prati preporuku, senzor zamrznut) nijesu pokriveni. |
| **F-10** | Pri σ=0 prag „2σ" degeneriše: 61 min vs historija 60/60/60 → anomalija, pouzdanost 80 %. | VERIFIKOVANO (izvršeno) | Srednje | Lažni alarmi i push notifikacije na šum od jedne minute. |
| **F-11** | Potvrda anomalije upisuje **prognozirani** kraj kao stvarni i pokreće učenje na njemu. | VERIFIKOVANO (lažna baza): stvarni kraj 11:00 → upisano **08:30 (150 min unazad)**, isto proslijeđeno učenju | **Visoko** | Model uči iz vlastite procjene — samopotvrđujuća petlja. |
| **F-12** | Nema podataka o vremenu → `tempMin=0, tempMax=0` → **51,00 °C** kao punopravna preporuka. | VERIFIKOVANO (lažna baza): `BoilerService` 51,00 °C i dnevni cron 51,00 °C (`weightedExternalTemp=0`) bez ijednog podatka o vremenu | **Visoko** | Korisnik dobija samouvjerenu preporuku iz nepostojećih podataka. |
| **F-13** | Poruke nisu instrukcije: nema akcije, nema razloga, nema roka podataka; svih 12 ključeva u `alerts.*` (6 parova naslov/poruka) **nema potrošača u kodu**. | VERIFIKOVANO (izvor): `mobile/src/locales/config.ts:1422-1437`, grep bez potrošača | **Visoko** | Korisnik zna da „nešto nije u redu", ali ne zna šta da uradi. |
| **F-14** | `expectedHeatTimeMin` se upisuje kao 0 kad je nepoznat, a UI ga prikazuje kao „0 min". | VERIFIKOVANO (izvor): `daily:93`, `heating.recommendation.service.ts:166,176`, `RecommendationBreakdown.tsx` | Srednje | Korisniku se tvrdi da zagrijavanje traje 0 minuta. |
| **F-15** | Anomalija „prolonged_idle" se emituje i za cikluse koji normalno traju > 120 min, jer prag nije relativan. | VERIFIKOVANO (izvršeno): 200 min uz μ=60 → `prolonged_idle` | Nisko | Šum u alertima za velike sisteme. |
| **F-16** | Dnevni cron piše `Recommendation` **prije** provjere „već poslano", pa dva pokretanja daju dva reda za isti dan. | VERIFIKOVANO (lažna baza): 2 pokretanja → **2 reda**, 1 notifikacija | Srednje | Izvještaji dupliraju preporuke; `recommendations[0]` prikazuje samo jednu. |

**Jedna rečenica:** formula je deterministična i predvidiva, ali (a) njen izlaz nije uvijek izvršiv, (b) učenje uči pogrešan signal s pogrešnim znakom i bez perzistencije, (c) anomalije gledaju samo trajanje i same sebe koriste kao baseline, i (d) nijedan od tih izlaza nije pretvoren u razumljivu, sigurnu instrukciju.

---

## 2. Izračun polazne temperature

### 2.1 Lanac poziva

```
Cron */1 min  ThermostatPollingService.pollDevice
              ├─ BoilerService.calculateFlowTemp(userId)        ← Dashboard, /api/boiler/sync
              │    ├─ weather (v2 → cache → user.homeLocation → 'Visoko')
              │    ├─ seasonMode (SUMMER/AUTO) → rani return 0
              │    ├─ HeatingIntervalLearning.findUnique       ← FULL ako red postoji
              │    ├─ HeatingEvent (7 dana, take 10)           ← events offset
              │    └─ FlowTemperatureEngine.calculate()
              │         AnonymousStrategy | ProfileStrategy | FullStrategy
              └─ recommendationService.processHeatingEvent()   ← start i end ciklusa
Cron 0 0 * * *  DailyRecommendationService                        ← dnevna preporuka + push
```

Tri ulaza, tri različita skupa podataka, isti motor. To je izvor nekonzistentnosti opisanih u §2.3 i §3.

### 2.2 Formula po komponentama

Svi izrazi su prepisani iz izvora. „Efekat" je izmjeren na stvarnom motoru (`--only=sensitivity`).

| Komponenta | Izraz | Jedinica / domen | Izvor | Efekat |
|---|---|---|---|---|
| Ponderisana vanjska | `ext = clamp(0,7·Tmin + 0,3·Tmax, −15, 10)` | °C, [−15, 10] | `base.strategy.ts:7-9` | vidi §2.6 |
| Bazna krivulja | `45` ako `ext ≥ 10`; `56` ako `ext ≤ −15`; inače `51 − 0,3·ext` | °C, [45, 56] | `base.strategy.ts:36-40` | −0,30 °C po °C |
| Home offset | `learningOffset · confidence` (FULL), `· confidence · 0,8` (PROFILE) | °C | `full.strategy.ts:7-10`, `profile.strategy.ts:11-15` | ×confidence |
| Interval offset | `offset + 0,5·avgOvershoot + 0,2·clamp((30 − avgReach)·0,05, −1, 1)`; ×0,6 za `*morning*` | °C | `full.strategy.ts:13-26` | vidi §3 |
| Events offset | `Σ delta·(active ? 0,15 : 0,05)·e^(−0,25·index)`; ×0,5 za `*morning*` | °C | `full.strategy.ts:28-37` | do +3,11 °C pri 10 događaja |
| Faktori profila | `max(0, 150 − area)·0,02 + (height − 230)·0,02 + window + heating` | °C | `profile.strategy.ts:23-47` | +1,8 °C za 60 m²; 0 za ≥150 m² |
| Faktor izolacije | 0,8 / 0,85 / 0,9 / 0,95 / 1, clamp [0,7, 1] | — | `profile.strategy.ts:50-69` | množi **i** offset **i** faktore |
| Kombinacija | `final = clamp(base + (offsets + factors)·insulation, 46, 55)` | °C, [46, 55] | `base.strategy.ts:17-25` | — |
| Confidence | ANONYMOUS 0; PROFILE `conf·0,8`; FULL `conf` | 0–1 | `profile.strategy.ts:71-73`, `full.strategy.ts:49-51` | — |

**Prvo sistemsko zapažanje (VERIFIKOVANO izvor):** `insulationFactor` se primjenjuje na **ukupan** zbir, uključujući naučeni offset i negativne korekcije. Dobra izolacija zato guši i „naučeno" i „kaznu za prozore" — dvije veličine koje fizikalno nemaju isti izvor. To nije samo numerička sitnica: onemogućava da se kasnije kalibrira jedan sloj bez mijenjanja drugog.

### 2.3 Šta stvarno stiže do motora

Ovo je najvažnija tabela u dokumentu, jer objašnjava zašto su mnogi „faktori" u §2.2 mrtvi u produkciji.

| Polje `HomeProfileInput` | Prosljeđuje `boiler.service.ts` | Prosljeđuje `heating.recommendation.service.ts` | Prosljeđuje `daily.recommendation.service.ts` | Efekat danas |
|---|---|---|---|---|
| `floorArea` | da (105) | da (128) | da (59) | **aktivan** |
| `learningOffset` | da (106) | da (129) | da (60) | aktivan, ali uvijek 0 (nema pisca) |
| `confidence` | da (108) | da (130) | da (62) | aktivan |
| `insulationFactor` | konstanta `1` (107) | konstanta `1` (131) | konstanta `1` (61) | **mrtav** |
| `ceilingHeight` | **ne** | **ne** | **ne** | default 230 → faktor 0 |
| `windowType` | **ne** | **ne** | **ne** | default → faktor 0 |
| `heatingType` | **ne** | **ne** | **ne** | default → faktor 0 |
| `insulationType` | **ne** | **ne** | **ne** | default 1,0 |
| `insulationThickness` | **ne** | **ne** | **ne** | nigdje se ne koristi |

**VERIFIKOVANO (izvršeno):** objekat sastavljen tačno kako ga sastavlja `boiler.service.ts:104-109` daje **identičan** `finalTemp` kao goli `{ floorArea }` (50,37 °C pri Tmin=2/Tmax=9). Kada se ista polja prosljede direktno, izlaz se mijenja: single-glazed **+2,00**, podno **−2,00**, ADVANCED izolacija **−0,12** (jer guši i area faktor), plafon 320 cm **+1,80**.

**Posljedica za korisnika:** ekran profila prikazuje i dozvoljava unos `ceilingHeight`, `insulationType`, `windowType`, `heatingType` (`dashboard.service.ts:126-129` ih čak vraća klijentu), ali nijedan od tih podataka ne ulazi u preporuku. To je najgori oblik nekonzistentnosti: korisnik ulaže trud i dobija isti broj, pa prestaje vjerovati sistemu.

**Uz to (VERIFIKOVANO izvor):** `HomeProfile.learningConfidence` ima `@default(0)` (`schema.prisma:57`). Izraz `input.homeProfile?.confidence ?? 0.1` ne „spašava" nulu, jer `0 ?? 0.1 === 0`. Izmjereno: profil s `learningConfidence = 0` i `learningOffset = 3` daje **50,37 °C** — isto kao da offseta nema — i `confidence = 0`. Dakle: (a) offset bez confidence-a je mrtav, (b) korisnik vidi „Pouzdanost: 0 %" iako motor radi ispravno.

### 2.4 Numerički dokaz: krivulja, prekidi, rupa u domenu

**VERIFIKOVANO (izvršeno), `--only=curve`:**

| Vanjska (min=max) | Krivulja °C | Final °C | Napomena |
|---:|---:|---:|---|
| −25,00 | 56,0000 | 55,00 | clamp gore |
| −15,00 | 56,0000 | 55,00 | clamp gore |
| −14,999 | 55,4997 | 55,00 | skok krivulje maskiran |
| −10,00 | 54,0000 | 54,00 | linearno |
| 0,00 | 51,0000 | 51,00 | referentna točka |
| 9,999 | 48,0003 | 48,00 | — |
| **10,00** | **45,0000** | **46,00** | **prekid** |
| 20,00 | 45,0000 | 46,00 | clamp dolje |

**Prekidi (izmjereno na obje strane granice):**

| Granica | Krivulja | Final | Vidljivo korisniku |
|---|---|---|---|
| `ext = 10` (donja strana) | 48,000000 → 45,000000 (**−3,000000**) | 48,00 → 46,00 (**−2,00**) | **da** — preporuka pada 2 °C kad prognoza pređe 10 °C |
| `ext = −15` (gornja strana) | 56,000000 → 55,499700 (**−0,500300**) | 55,00 → 55,00 (**0,00**) | ne — clamp skriva prekid |

Dakle: formula ima **dva** diskontinuiteta, ali samo jedan proizvodi vidljiv skok. To je gore od „dva skoka": jedan je skriven i zato ga testovi i korisnici ne vide, a drugi se ponaša kao neobjašnjiv pad preporuke u najtoplijem dijelu sezone.

**Izlazni domen po načinu rada (VERIFIKOVANO izvršeno):**

| Način | Minimum | Maximum | Vrijednosti ispod 48 | Rupa u domenu |
|---|---:|---:|---|---|
| `ANONYMOUS` | 46,00 | 55,00 | **samo `46`** | **da** — nema ničega između 46,00 i 48,0003 |
| `PROFILE_ONLY` (površina 10–300 m², ext 8–14 °C) | 46,00 | 51,40 | 46,0 … 47,8 (korak 0,1) | ne |
| `FULL` (offset −4…+4, ext 0–10 °C) | 46,00 | 55,00 | 46,00 … 47,98 | ne |

Dakle: u anonimnom načinu preporuka je ili **46,00** ili **≥ 48,0003** — skok od 2 °C bez ijedne međuvrijednosti. Kod profila i učenja ispod 48 postoji kontinuirano, pa je problem širi: **ako naučeni offset spusti preporuku u pojas 46–47,98, nijedna vrijednost iz tog pojasa nije unesiva.**

**To se direktno sudara s ulaznim prozorom:**

| Sloj | Minimum | Maksimum | Izvor |
|---|---:|---:|---|
| Preporuka (engine) | **46** | 55 | `base.strategy.ts:25` |
| Unos korisnika (DTO) | **48** | 55 | `set-current-temp.dto.ts:12-18` |
| Web konstanta | **48** | 55 | `frontend/src/constants/boilerLimits.ts` |
| Mobile klizač | **48** | 55 | `mobile/src/screens/dashboard/DashboardScreen.tsx:369-370` |

**Izmjereni slučajevi neizvršive preporuke:**

| Situacija | Preporuka | Unos dozvoljen |
|---|---:|---|
| Vanjska 10 °C, anonimno | 46,00 | **ne** |
| Vanjska 10 °C, 60 m² (PROFILE_ONLY) | 46,80 | **ne** |
| ext 5 °C + naučeni offset −2 | 47,50 | **ne** |
| ext 8 °C + naučeni offset −1 | 47,60 | **ne** |
| ext 8 °C + naučeni offset −3 | 46,00 | **ne** |

`frontend/src/constants/boilerLimits.ts` u komentaru eksplicitno kaže da 46 „nije granica unosa" i da su web i backend usklađeni. To je tačno na nivou *validacije*, ali **nije tačno na nivou proizvoda**: preporuka i unos su dva različita domena, i kad se prvi spusti ispod drugog, korisnik ostaje bez akcije.

**Lančana posljedica (VERIFIKOVANO izvor + izračun):** korisnik koji dobije 46 °C, a može unijeti 48 °C, proizvodi `flowDelta = |48 − 46| = 2`. `heating-health.ts:33` kaže `FLOW_DELTA_PENALTY_PER_C = 12,5`, pa health komponenta pada na `100 − 2·12,5 = 75`, uz težinu 25 → **gubi 6,25 bodova health scorea zato što nije mogao izvršiti neizvršivu preporuku**. Ista razlika hrani poruku „Odstupanje temperature polazne vode" (`mobile/src/locales/config.ts:1426`).

### 2.5 Robusnost na nevalidne ulaze

**VERIFIKOVANO (izvršeno), `--only=robust`:**

| Ulaz | `finalTemp` | `baseCurveTemp` | `confidence` |
|---|---:|---:|---:|
| `tempMin = NaN` | **NaN** | NaN | 0 |
| `tempMax = NaN` | **NaN** | NaN | 0 |
| `tempMin = tempMax = null` | 51,00 | 51,00 | 0 |
| `tempMin = tempMax = undefined` | 51,00 | 51,00 | 0 |
| `tempMin = Infinity` | 46,00 | 45,00 | 0 |
| `tempMin = −Infinity` | 55,00 | 56,00 | 0 |
| `confidence = NaN` | **NaN** | 51,00 | **NaN** |
| `floorArea = NaN` | **NaN** | 51,00 | 0,08 |
| `ceilingHeight = NaN` | **NaN** | 51,00 | 0,08 |
| `learningOffset = NaN` | 51,00 | 51,00 | 0,40 |

`learningOffset` je jedino polje koje je spašeno, i to slučajno (`|| 0` ga pretvara u 0). Sve ostalo propagira `NaN` do izlaza, jer clamp `Math.max(46, Math.min(55, NaN))` vraća `NaN`, a `Number(NaN.toFixed(2))` ga propušta.

Motor nema nijednu `Number.isFinite` provjeru, a `Number(finalTemp.toFixed(2))` propušta `NaN` dalje u `FlowTempResult.finalTemp`, pa u `recommendation.recommendedFlowTemp` (Prisma `Float`), pa u UI. Uz to se nepoznat podatak (`null`/`undefined`) pretvara u **0 °C** i daje 51,00 °C kao da je izmjereno — to je u §5 tretirano kao zaseban kvar instrukcije.

### 2.6 Osjetljivost (stvarni motor)

**Vanjska temperatura** — 0,30 °C/°C linearno, s prekidom na granici:

| ext | final | ext+1 | Δ |
|---:|---:|---:|---:|
| −10 | 54,00 | 53,70 | −0,30 |
| −5 | 52,50 | 52,20 | −0,30 |
| 0 | 51,00 | 50,70 | −0,30 |
| 5 | 49,50 | 49,20 | −0,30 |
| 9 | 48,30 | 46,00 | **−2,30** |

**Površina** — asimetrična, nula-točka na 150 m²:

| Površina | final | Tumačenje |
|---:|---:|---|
| 60 m² | 52,80 | +1,80 |
| 100 m² | 52,00 | +1,00 |
| 149 m² | 51,02 | +0,02 |
| 150 m² | 51,00 | 0 |
| 200 m² | 51,00 | **0** |
| 400 m² | 51,00 | **0** |

Manji stan dobija **višu** polaznu, veći **nikakvu** korekciju. Fizikalno je potrebno obrnuto ili, tačnije, potreban je model toplotnih gubitaka (W/m²·K), a površina sama nije dovoljna. Ovo nije „pogrešan koeficijent" nego **pogrešan model**.

**Naučeni offset 2 °C** — linearno po `confidence`:

| confidence | PROFILE_ONLY | FULL |
|---:|---:|---:|
| 0,0 | 51,00 | 51,00 |
| 0,1 | 51,16 | 51,20 |
| 0,5 | 51,80 | 52,00 |
| 1,0 | 52,60 | 53,00 |

**Događaji** (delta = 5 °C, aktivni) — rastu bez gornje granice:

| N događaja | events offset | final | final (morning) |
|---:|---:|---:|---:|
| 1 | 0,750 | 51,75 | 51,38 |
| 3 | 1,789 | 52,79 | 51,89 |
| 5 | 2,419 | 53,42 | 52,21 |
| 10 | 3,112 | 54,11 | 52,56 |

Ovo je jedina komponenta koja reaguje na **stvarno nedogrijavanje** (`delta = target − current`, pozitivno kad je soba hladna). Znak je ispravan. Problem je što se sabira s komponentom koja ima suprotan znak i što nema ograničenja po komponenti.

---

## 3. Princip learninga

### 3.1 Trenutni algoritam

**VERIFIKOVANO (izvor), `heating.recommendation.service.ts:43-90`:**

```
overshoot   = roomCurrentTemp − roomTargetTemp                 °C
reachTime   = (timestampEnd − timestampStart) / 60000          min
n'          = samples + 1
avgReach'   = (avgReach · samples + reachTime) / n'
avgOver'    = (avgOver · samples + overshoot) / n'
offset'     = (offset  · samples + overshoot) / n'
conf'       = min(1, (conf · samples + 0,1) / n')
```

To je **kumulativni aritmetički prosjek** (težina `1/N`, beskonačna memorija, bez zaboravljanja) i **jedna** vrijednost `overshoot` koja se istovremeno upisuje u dva različita polja (`avgOvershoot` i `offset`) i potom u motoru koristi dvaput (§3.3).

### 3.2 Simulacija (REPLIKA, izvršeno)

Realističan slijed, s onim što poller zaista prosljeđuje na kraju ciklusa (`roomCurrentTemp` s **početka**; završni snapshot nije uzet):

| N | overshoot | reach min | avgReach | avgOvershoot | offset | confidence |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | −2,0 | 42 | 42,00 | −2,00 | −2,000 | 0,1 |
| 2 | −1,5 | 38 | 40,00 | −1,75 | −1,750 | 0,1 |
| 3 | −1,6 | 47 | 42,33 | −1,70 | −1,700 | 0,1 |
| 4 | −1,8 | 51 | 44,50 | −1,73 | −1,725 | 0,1 |
| 5 | −1,4 | 40 | 43,60 | −1,66 | −1,660 | 0,1 |
| 6 | −1,9 | 44 | 43,67 | −1,70 | −1,700 | 0,1 |

**Efekat na preporuku (stvarni engine):** bez učenja **50,37 °C** → sa naučenim stanjem **48,76 °C** (**−1,61 °C**). Motor „nauči" da smanji polaznu, iako je uzrok bio to što je soba bila hladna.

### 3.3 Nalazi

**L-01 — Mjeri se početna, a ne završna temperatura (Kritično, VERIFIKOVANO izvor).**
Na kraju ciklusa poller prosljeđuje `roomCurrentTemp: lastEvent.roomCurrentTemp` (`thermostat.polling.service.ts:485`) — to je očitanje **s početka** ciklusa, dok je stvarno završno očitanje dostupno u `device.roomCurrentTemp` i u `BoilerHistory`/snapshot-u. Isto radi i potvrda anomalije (`heating.anomayl.checker.service.ts:318`). Izmjereno: svih šest uzoraka daje negativan „overshoot".

**L-02 — Dead zone garantuje da je „overshoot" uvijek negativan (Kritično, VERIFIKOVANO izvor).**
`resolveHeatingState` uključuje grijanje tek kad je `current <= target − DEAD_ZONE`, a `DEAD_ZONE = 1,0` (`thermostat.polling.service.ts:48,528-535`, tačka `:534`). Dakle u trenutku uključivanja uvijek vrijedi `current ≤ target − 1`, pa je izmjereni „overshoot" **≤ −1 °C po konstrukciji**. Uz L-01 to nije šum — to je sistematska pristrasnost. Petlja je pozitivna u pogrešnom smjeru: niža polazna → sporije zagrijavanje → veći početni deficit → niža polazna.

**L-03 — Isti broj se koristi dvaput i sabira s pogrešnim znakom (Kritično, VERIFIKOVANO izvršeno).**
Motor računa `intervalOffset = offset + 0,5·avgOvershoot + 0,2·reachAdj` (`full.strategy.ts:20-23`), a servis je već postavio `offset ≈ avgOvershoot` (§3.1). Efektivno se dodaje **1,5× prosječni overshoot**. Izmjereno: pravi overshoot **+2 °C** (soba prevruća) daje **+3,00 °C** na polaznu (49,77 → 52,77). Kad je soba prevruća, sistem grije jače. Isto u negativnom smjeru potvrđeno u §3.2.

**L-04 — `reachTimeAdjustment` ima obrnut znak od svrhe (Visoko, VERIFIKOVANO izvor + izvršeno).**
`(30 − avgReach)·0,05` je **pozitivno** kad se sistem grije **brže** od 30 min (`full.strategy.ts:53-56`). Brže zagrijavanje znači da postoji rezerva snage → polazna može ići **niže**, a formula je podiže. Efekat je mali (0,1 °C pri 20 min), ali pojačava L-03.

**L-05 — Učenje se hrani vlastitom procjenom (Visoko, VERIFIKOVANO izvor).**
`confirmOrUpdateAnomaly` postavlja `timestampEnd = event.proposedEndTime ?? new Date()` (`heating.anomayl.checker.service.ts:289-292`). `proposedEndTime` je izračunat kao `start + averageDuration` (`anomaly-detection.service.ts:124-129`) — to je **prognoza**, ne mjerenje. Zatim se `processHeatingEvent` poziva s tim vremenom (`:313-322`) i `reachTime` u učenju postaje modelova vlastita procjena. Model potvrđuje sebe.

**L-06 — Perzistencija prvog uzorka je nemoguća (Visoko, VERIFIKOVANO lažna baza).**
`getOrCreateIntervalLearning` vraća `{ id: 0, ... }` kad red ne postoji i gura ga u lokalni niz (`:190-207`). Jedini upis je `updateMany({ where: { id: intervalLearning.id } })` (`:80`), a `where {id: 0}` ne pogađa nijedan red. U `backend/src` **nema nijednog** `heatingIntervalLearning.create` ni `upsert` (grep). `count` se ne provjerava i ne loguje. **Izmjereno** (`formula_pipeline_repro.cjs`): jedan zatvoreni ciklus na profilu bez naučenih redova → `updateMany({ where: { id: 0 } })`, `create: 0`, `upsert: 0`, **upisano 0 redova**, dok je `samples=1` i `confidence=0,1` poslano u prazno. Zaključak: bez izvana zasejanog reda `FULL` je nedostizan i učenje nikad ne počinje; ako red postoji, učenje radi s bugovima L-01…L-05. Stvarno stanje produkcijske baze nije provjereno.

**L-07 — `confidence` je konstanta (Visoko, VERIFIKOVANO izvršeno).**
`(0,1·N + 0,1)/(N+1) = 0,1` za svaki N. Izmjereno kroz 6 uzoraka: 0,1 svaki put. Dvije posljedice: (a) model nikad ne prelazi iz „nema podataka" u „pouzdano"; (b) `health` komponenta `learningConfidence` dobija 10/100 uz težinu 35, pa svi ostali signali savršeni daju `(10·35 + 100·65)/100 = 68,5 → 69`. Kad naučeni redovi postoje, health score je **strukturno ograničen na 69**.

**L-08 — Interval `confidence` se u motoru ne koristi (Visoko, VERIFIKOVANO izvor + izvršeno).**
`intervalLearning.confidence` se prosljeđuje u `FlowTempInput` (`heating.recommendation.service.ts:136`), ali je `full.strategy.ts` **nikad ne čita**; `calculateConfidence` vraća `homeProfile.confidence` (`:49-51`). Izmjereno: offset −1,7 ulazi s punom težinom već nakon prvog uzorka. Nema minimalnog broja uzoraka, nema skaliranja po pouzdanosti, nema gornje granice po komponenti.

**L-09 — Decay je po indeksu, ne po vremenu; baseline može sadržavati buduće cikluse (Visoko, VERIFIKOVANO izvor).**
Težina događaja je `e^(−0,25·index)` (1; 0,779; 0,607; 0,472). Motor **ne prima** `timestampStart`, pa događaj od prije 1 minute i od prije 6 dana imaju istu težinu ako su isti po redu. Uz to, upit za historiju anomalija ima samo donju granicu (`timestampStart: { gte: subDays(now, 14) }`, `heating.anomayl.checker.service.ts:110-118`), pa za event koji se provjerava naknadno baseline uključuje i cikluse **poslije** njega (look-ahead).

**L-10 — Ključ intervala se računa po vremenu obrade, ne po vremenu događaja (Visoko, VERIFIKOVANO lažna baza).**
`processHeatingEvent` zove `getIntervalKey()` bez argumenta (`:36,210-222`), pa event koji stigne u 09:05 za ciklus u 08:50 ide u `late_morning`, a ne u `morning`. `DailyRecommendationService` ide dalje: cron je `0 0 * * *` (ponoć), a `getIntervalKey` **hardkodira** `part = 'morning'` (`daily:139-146`), pa dnevna preporuka uvijek računa `weekday_morning`/`weekend_morning` bez obzira na doba i bez obzira na `hour`. Komentar „svaki dan u 6:00" (`daily:23`) nije tačan. **Izmjereno:** dnevni cron pokrenut u **srijedu 14:30** upisuje `intervalKey: "weekday_morning"` (a po satu bi bio `weekday_afternoon`), pa „jutarnja" preporuka koristi naučeno stanje jutra u popodne.

**L-11 — Nedostaju zaštite koje bi učinile učenje bezbjednim (Visoko, VERIFIKOVANO izvor).**
Nema: minimalnog broja uzoraka prije primjene, gornje granice po komponenti, maksimalnog koraka po danu, provjere varijanse, detekcije outliera, atomske transakcije (read-modify-write bez `WHERE samples = n`, pa konkurentni eventi gube upise), ni idempotentnosti. Izmjereno: jedan outlier od +9 °C u pet uzoraka podiže offset na +1,4; tri takva daju offset +9 → **clamp na 55**.

**L-12 — Home offset nema pisca (Visoko, VERIFIKOVANO izvor).**
`HomeProfile.learningOffset` i `learningConfidence` se čitaju na tri mjesta, ali **nijedan kod ih ne upisuje** (grep kroz `backend/src`). Home komponenta je danas strukturno 0. To znači da je `PROFILE_ONLY` praktično samo `krivulja + area faktor`.

### 3.4 Ciljni dizajn učenja

Predlaže se zamjena, ne „popravka znaka". Ispravka znaka bez L-01 i L-05 samo bi obrnula pristrasnost, ne uklonila.

**1. Ispravan signal.** Definisati mjerene veličine prije ikakvog modela:

| Signal | Definicija | Izvor |
|---|---|---|
| `deficit0` | `target − roomTemp` u trenutku uključivanja | `HeatingEvent` + snapshot |
| `deficitEnd` | `target − roomTemp` u trenutku isključivanja | **završni snapshot** |
| `reached` | da li je `roomTemp ≥ target` i u kom trenutku (interpolacija između pollova) | niz snapshotova |
| `overshoot` | `max(0, roomTempEnd − target)` | završni snapshot |
| `heatingRate` | °C/min između dva polla, samo u stabilnom dijelu | niz snapshotova |
| `flowError` | `flowActual − flowSuggested` tokom ciklusa | `BoilerHistory` |

`reached` se **ne smije** izvoditi iz `timestampEnd`: grijanje se gasi kad termostat/state machine odluči, ne kad soba dostigne cilj.

**2. Ograničeno učenje (bounded EWMA po intervalu i po tipu dana):**

```
svaki uzorak x ulazi samo ako je |x − μ| < k·σ  (k=3), uz σ iz minimalno 5 uzoraka
μ ← α·x + (1−α)·μ,  α = max(α_min, 1/min(N, N_max))      // α_min ≈ 0,05, N_max ≈ 40
v ← α·(x−μ_old)² + (1−α)·v
confidence ← f(N, v): 0 za N < N_min; raste s N; pada s varijansom; 0 ako je σ/μ > prag
```

Sa `N_min = 8` i `α_min = 0,05`, model ima konačnu memoriju (~20 uzoraka), ne trči za jednim outlierom i **sam izračuna** kada mu se može vjerovati. `confidence` mora biti izlaz modela, ne konstanta.

**3. Ograničenja primjene (u motoru, ne u servisu):**

```
max |intervalOffset| ≤ 3 °C;  max |homeOffset| ≤ 3 °C
primijeni samo ako confidence ≥ 0,3 i N ≥ N_min
startup/shutdown guard: ako je |Δfinal| > 2 °C u jednom danu → korak 1 °C + log
```

**4. Perzistencija.** `upsert` na `(homeProfileId, intervalKey)` unutar transakcije; optimistic concurrency preko `samples` u `where`; `create` na prvom uzorku; log `count` i `samples` poslije upisa. Bez toga se L-06 ponavlja u svakoj novoj verziji.

**5. Razdvojiti slojeve.** `avgOvershoot`, `offset`, `avgReachTimeMin` ne smiju svi ulaziti u isti zbir s različitim koeficijentima znaka. Preporuka: **jedan** naučeni offset po intervalu (ograničen), plus **odvojeni dijagnostički** signali koji ulaze u anomalije i instrukcije, a ne u polaznu.

**6. Mjerenje uspjeha (definisati prije uvođenja):** vrijeme do dostizanja cilja (p50/p90), overshoot (°C), vrijeme izvan komfora (K·h), broj ciklusa/dan, udio ciklusa koji dostignu cilj, gas/m³ po stepen-danu uz prijavljeno porijeklo podataka. **Greška prema staroj preporuci nije metrika uspjeha** — stara preporuka nije istina.

---

## 4. Praćenje anomalija

### 4.1 Sadašnje stanje

Dva sloja, oba samo po trajanju ciklusa:

| Sloj | Ulaz | Pravilo | Izvor |
|---|---|---|---|
| `HeatingAnomalyCheckerService` | `HeatingEvent` (open, zatvoreni u 24 h) | μ i σ trajanja iz istog `intervalKey` u 14 dana; poziva detektor | `heating.anomayl.checker.service.ts:103-155` |
| `AnomalyDetectionService` | `currentDuration`, `μ`, `σ`, `N`, `threshold=2` | `duration > μ + 2σ` → `overshoot`; `< μ − 2σ` → `early_stop`; `> 120` → `prolonged_idle`; `< 5` → `rapid_cycling` | `common/anomaly-detection.service.ts:63-131` |
| Health sloj | 20 najnovijih eventa | kratki/dugi ciklusi, `targetShortfall`, `targetOvershoot`, udio anomalija | `common/heating-health.ts:136-196` |

### 4.2 Numerički dokaz

**Self-inclusion (VERIFIKOVANO izvršeno).** Upit historije uključuje event koji se provjerava: `CLOSED` event već ima `timestampEnd`, a filter je `timestampEnd: { not: null }` (`:115`). Baseline postaje `historija + event`.

| Slučaj | μ | σ | Detektovano |
|---|---:|---:|---|
| Historija 60/58/62, event 70 min | 60,00 | 1,633 | **da**, `overshoot`, conf 0,90 |
| Isto, ali event uključen u baseline (60/58/62/**70**) | 62,50 | 4,555 | **ne**, conf 0 |
| Historija 60/58/62, event 200 min | 60,00 | 1,633 | da, `overshoot` + `prolonged_idle`, conf 1,00 |
| Isto, sa self (60/58/62/**200**) | 95,00 | 60,638 | da, **samo** `prolonged_idle`, conf 0,20 |

Prvi red je **pravi false negative**: ciklus 6σ iznad historije se ne prijavljuje. Drugi je **maskirana klasifikacija**: alarm se i dalje javi, ali izgubi statistički nalaz i 80 % pouzdanosti.

**σ = 0 degeneracija (VERIFIKOVANO izvršeno).** Historija 60/60/60 → σ = 0. Ciklus od **61** minute: `61 > 60 + 2·0` → `overshoot`, `confidence 0,8`. Jedna minuta iznad prosjeka proizvodi anomaliju i push. Uz polling svake minute, ovo je sistemski izvor lažnih alarma.

**Ostali izmjereni slučajevi:** N=2 → nijedna detekcija (minimalno 3, `:63-70`); 4 min → `early_stop` + `rapid_cycling` conf 1,00; 140 min uz σ=0 i CLOSED → `early_stop` je zaštićen s `σ > 0` (`:78`), pa se ne javi.

### 4.3 Nalazi

**A-01 — Self-inclusion (Visoko, izvršeno).** Kako je gore. Popravka: baseline mora isključiti event koji se provjerava (`id: { not: event.id }`) i sadržavati samo evente **prije** `timestampStart` provjeravanog eventa.

**A-02 — σ = 0 nije zaštićeno (Visoko, izvršeno).** `if (!stdDev && durations.length < 3) return;` (`checker:136`) propušta σ=0 kad je N ≥ 3, a detektor tada poredi s golu vrijednost μ. Potrebno: minimalna apsolutna margina (npr. `max(2σ, 10 min)`) i fallback na IQR/MAD, jer trajanje ima teški rep.

**A-03 — Samo trajanje (Visoko, izvor).** Nijedan od sljedećih kvarova se ne detektuje: polazna ne prati preporuku; soba ne dostiže cilj uprkos dugom ciklusu; senzor „zamrznut" (ista vrijednost satima); skok temperature bez grijanja; potrošnja gasa odstupa od stepen-dana; vanjski senzor odstupa od prognoze. To su upravo kvarovi koje korisnik primijeti.

**A-04 — Dvije confidence funkcije, jedna mrtva (Srednje, izvor).** `calculateConfidence` (`:170-195`, težine 0,8/0,75/0,6/0,85) se ne koristi u `checker`-u; tamo se koristi `result.confidence` iz `detectAnomalies`. Dvije istine za isti pojam.

**A-05 — Više tipova se gubi u izvještaju (Nisko, izvor).** `recordAnomaly(..., anomalyResult.types[0] ?? 'unknown', ...)` (`checker:180`) upisuje samo prvi tip, pa `early_stop + rapid_cycling` postaje `early_stop`.

**A-06 — Potvrda može pomjeriti `timestampEnd` unazad (Visoko, VERIFIKOVANO lažna baza).** `endTime = event.proposedEndTime ?? new Date()` (`:289`). Ako je ciklus u međuvremenu normalno završen (`handleHeatingEnd` je upisao stvarni kraj) i korisnik tapne „potvrdi" bez datuma, upisuje se **procijenjeni** kraj, potencijalno **prije** stvarnog. Time se prepisuje trajanje koje ulazi u učenje i anomalije. **Izmjereno:** event sa stvarnim krajem 11:00 i `proposedEndTime` 08:30 → nakon `confirm` u bazi stoji **08:30**, a učenje dobija isti kraj uz `roomCurrentTemp` 21,8 °C (početno očitanje).

**A-07 — Nema ponovne provjere (Srednje, izvor).** `anomalyCheckedAt` se postavlja za svaki zatvoreni event (`:91-94`), pa se jednom ocijenjen ciklus više nikad ne provjerava ni nakon što stigne bolji baseline.

**A-08 — `prolonged_idle` nije relativan (Nisko, izvršeno).** Fiksno 120 min. Sistem sa ciklusima od 150 min dobija anomaliju na svakom normalnom ciklusu.

**A-09 — Push bez kočenja (Srednje, izvor).** Nema deduplikacije po uređaju/danu ni cooldown-a; svaki novi event može poslati novi `SYSTEM_ALERT`.

**A-10 — Poruka anomalije koristi interne ključeve (Srednje, izvor).** `Interval weekday_late_morning - anomalija: overshoot, prolonged_idle` (`checker:205`) — `intervalKey` i `AnomalyType` enum idu korisniku sirovi, na bosanskom, bez akcije.

**A-11 — Health pragovi nisu stručno potvrđeni (Srednje, izvor).** `heating-health.ts:11-14` to eksplicitno kaže. `SHORT_CYCLE_MINUTES=20`, `LONG=90`, `±1,5 °C` su preuzeti, ne izmjereni. Uz to `learningConfidence` težina 35 daje strukturne 69/100 (L-07).

**A-12 — Anomalija ne ulazi u preporuku (Srednje, izvor).** Flag `isAnomaly` postoji na eventu, ali `calculateFlowTemp` čita evente bez obzira na njega (`boiler.service.ts:162-172`). Ciklus koji je sistem ocijenio anomalijom i dalje punom težinom ulazi u `events` offset.

### 4.4 Predloženi katalog anomalija

Umjesto četiri pravila po trajanju — katalog s eksplicitnim podacima, pragom i **onim što se korisniku smije reći**.

| Kod | Uslov (nacrt) | Podaci | Pouzdanost | Poruka korisniku |
|---|---|---|---|---|
| `cycle_too_long` | `dur > max(μ+2σ, 120)` i `deficitEnd > 0,5` | trajanje, deficit na kraju | N, σ | „Ciklus je trajao X min, a soba je ostala Y °C ispod cilja." |
| `cycle_no_progress` | `heatingRate < 0,02 °C/min` tokom ≥ 20 min | niz snapshotova | broj uzoraka | „Temperatura sobe se ne mijenja iako grijanje radi." |
| `rapid_cycling` | ≥ 3 ciklusa < 10 min u 60 min | start/end | broj | „Kotao se uključuje i isključuje često." |
| `target_not_reached` | `deficitEnd > 1,5` u ≥ 3 od 5 ciklusa | deficitEnd | broj | „Cilj se ne dostiže — provjerite radijatore ili povećajte polaznu." |
| `overshoot_after_stop` | `roomEnd > target + 1,5` | završni snapshot | broj | „Soba prelazi cilj — polazna je vjerovatno previsoka." |
| `flow_not_followed` | `flowActual − flowSuggested` > 3 °C tokom ≥ 30 min | `BoilerHistory` | broj | „Stvarna polazna odstupa od preporučene." |
| `sensor_frozen` | identična `roomCurrentTemp` ± 0,1 tokom ≥ 3 h uz grijanje | snapshotovi | trajanje | „Termostat ne pokazuje promjenu — provjerite uređaj." |
| `sensor_stale` | `lastSeen` > 15 min | `lastSeen` | — | „Termostat se ne javlja." |
| `weather_missing` | nema svježe prognoze | `weatherCache` | — | „Vanjski podaci nisu dostupni; preporuka nije izračunata." |
| `frost_risk` | `ext < 0` i grijanje isključeno (SUMMER) | prognoza + `seasonMode` | — | **Kritično:** „Vanjski je ispod 0 °C, a grijanje je isključeno." |

Za svaki kod treba: minimalni broj uzoraka, vrijeme „hlađenja" (ne ponavljaj isti kod unutar X h), i zabranu zaključivanja o uzroku iz jedne mjere.

---

## 5. Instrukcije korisniku

### 5.1 Inventar svega što danas stiže do korisnika

| Gdje | Tekst / sadržaj | Izvor | Šta fali |
|---|---|---|---|
| Push `DAILY_RECOMMENDATION` | „Nova dnevna preporučena polazna temperatura kotla je **X** °C" | `daily.recommendation.service.ts:119-120` | nema akcije, raspona, pouzdanosti, roka podataka; X može biti 46 (neizvršivo) |
| Push `SYSTEM_ALERT` | „Interval weekday_morning - anomalija: overshoot. Trajanje: 130min, prosjek: 60min. Molimo provjerite stanje grijanja." | `checker:204-209` | interni ključevi, nema šta konkretno provjeriti |
| Push `HEATING_STARTED` | „Započeto zagrijavanje na X °C" | `polling:439-440` | informativno, korektno |
| Push `HEATING_ENDED` | „Grijanje trajalo X min" | `polling:493-494` | informativno, korektno |
| Dashboard health upozorenja (5 tipova) | „Ciljna temperatura se ne dostiže - prosječno zaostajanje: X °C" itd. | `heating-health.ts:136-196` | nema akcije; tekst je **samo bosanski** i ide u `message`, pa engleski UI prikazuje bosanski |
| Dashboard „preporuka" (anonimno) | `recommendedFlowTemp` + `source: 'LIVE_CALCULATION'` | `dashboard.service.ts:77-80` | izračunato za **Visoko** bez profila, a prikazano kao preporuka |
| Breakdown kartica | bazna krivulja, ponder, home/interval/events, final, confidence, „0 min" | `RecommendationBreakdown.tsx` (web i mobile) | „0 min" kad nema podatka (F-14); `confidence: 0` bez objašnjenja |
| i18n `alerts.*` | 12 ključeva / 6 parova: `flowTempCritical`, `flowTempWarning`, `thermostatOffline`, `thermostatUnresponsive`, `learningLow`, `weatherUnavailable` | `mobile/src/locales/config.ts:1422-1437` | **nijedan nema potrošača u kodu** (grep) — pripremljeno, ali mrtvo |

### 5.2 Zašto to nisu instrukcije

1. **Nema akcije.** Nijedna poruka ne kaže šta korisnik treba da uradi, ni šta *ne* treba.
2. **Nema izvršivosti.** Preporuka od 46 °C se ne može unijeti (F-01); poruka ipak kaže „preporučena ... je 46 °C".
3. **Nema neizvjesnosti.** `confidence: 0` i „0 min" se prikazuju kao činjenice; nema razlike između „nisam izračunao" i „izračunao sam 0".
4. **Nema porijekla podataka.** Ne piše za koji grad, za koje vrijeme, iz koje prognoze.
5. **Nema sigurnosne granice.** Nema upozorenja na smrzavanje; `SUMMER` isključuje grijanje bez obzira na temperaturu (F-08).
6. **Nema lokalizacije u porukama s backenda.** Struktura je dvojezična samo za statične ključeve; dinamičke poruke su hardkodirane na bosanskom.

### 5.3 Politika: objekat instrukcije

Svaki odgovor prema klijentu treba nositi **instrukciju**, ne golu brojku:

```ts
type HeatingInstruction = {
  code: 'set_flow_temp' | 'keep_current' | 'collect_data' | 'check_thermostat'
      | 'check_radiators' | 'check_boiler' | 'contact_service' | 'frost_warning'
      | 'heating_off_season' | 'no_weather' | 'learning_warming_up';   // stabilan ključ
  severity: 'info' | 'action' | 'warning' | 'critical';
  action: 'none' | 'user_set_flow_temp' | 'user_check' | 'user_contact_service';
  targetFlowTemp: number | null;      // SAMO ako je unutar [48, 55] i podaci svježi
  confidence: number | null;          // null kad nema podataka — nikad 0 kao "nema"
  reasonCodes: string[];              // npr. ['base_curve', 'learning_offset']
  dataFreshness: { weatherAt: string | null; learningSamples: number };
  requiresConfirmation: true;         // uvijek korisnik potvrđuje; nema automatske komande
  textKey: string;                    // i18n ključ; parametri uz njega
};
```

**Pravila (obavezujuća, testiraju se):**

- **R-1** Nijedna instrukcija ne smije tražiti unos izvan `[48, 55]`. Ako motor vrati 46–47,9, instrukcija je `keep_current` ili `set_flow_temp` na **48** uz eksplicitno „minimum uređaja"; izlaz motora i izlaz instrukcije moraju biti usklađeni.
- **R-2** „Nepoznato" nije `0`. Nedostatak prognoze daje `code: 'no_weather'`, `confidence: null`, `targetFlowTemp: null`.
- **R-3** Svaka instrukcija nosi rok podataka („prema prognozi od 07:00").
- **R-4** Instrukcija je uvijek korisnička akcija s potvrdom. Nijedan tekst ne smije zvučati kao da je sistem nešto izvršio.
- **R-5** Ne tražiti od korisnika podatke koji ne ulaze u formulu (`windowType`, `insulationType`, `heatingType`, `ceilingHeight`) dok se F-06 ne popravi — ili ih popraviti, ili ukloniti iz obrasca.
- **R-6** Anomalija zasnovana samo na trajanju ne smije tvrditi uzrok ni kvar; opisuje mjerenje i predlaže provjeru.
- **R-7** `confidence` se prikazuje kao „pouzdanost", uz broj uzoraka; `0` se prikazuje kao „model se još uči", ne kao „0 %".
- **R-8** Frost guard je iznad svih ostalih pravila: ako je vanjska ≤ 0 °C, grijanje se ne smije preporučiti isključeno ni u `SUMMER` načinu.

### 5.4 Matrica odluke

| Scenario | `code` | Nivo | Akcija | Tekst (bs) — nacrt |
|---|---|---|---|---|
| Nema profila | `collect_data` | info | `none` | „Da bi preporuka bila tačna, dodajte podatke o domu." |
| Profil, nema prognoze | `no_weather` | warning | `user_check` | „Vremenska prognoza nije dostupna, pa polaznu nijesam izračunao. Provjerite vezu ili postavite lokaciju." |
| Preporuka u [48, 55], conf ≥ 0,5 | `set_flow_temp` | action | `user_set_flow_temp` | „Predlažem polaznu **X °C** (pouzdanost Y %, N uzoraka, prognoza od HH:MM)." |
| Preporuka < 48 (toplo vrijeme / negativan offset) | `keep_current` | info | `none` | „Izračunata vrijednost je ispod minimuma uređaja (48 °C). Ostavite trenutnu postavku; sistem radi na donjoj granici." |
| Naučeni offset postoji, N < 8 | `learning_warming_up` | info | `none` | „Model se još uči (N uzoraka). Preporuka se za sada drži krivulje." |
| `samples = 0` / nema reda učenja | `learning_warming_up` | info | `collect_data` | „Preporuka je početna i ne koristi vaše navike." |
| Ciklus dug, cilj nedostignut | `check_radiators` | warning | `user_check` | „Grijanje je radilo X min, a soba je Y °C ispod cilja. Provjerite da su radijatori topli i da termostat nije blokiran." |
| Ciklus dug, bez napretka temperature | `check_boiler` | warning | `user_check` | „Temperatura sobe se ne mijenja. Provjerite pritisak i prikaz greške na kotlu." |
| Česti kratki ciklusi | `check_boiler` | warning | `user_check` | „Kotao se često uključuje/isključuje. Provjerite pritisak vode i postavku histereze." |
| Soba prelazi cilj nakon stopa | `target_overshoot` | action | `user_set_flow_temp` | „Soba je Y °C iznad cilja. Predlažem sniženje polazne za 1 °C, ali ne ispod 48 °C." |
| Stvarna polazna odstupa > 3 °C | `flow_deviation` | info | `user_check` | „Stvarna polazna (X) odstupa od preporučene (Y). Provjerite postavku na kotlu." |
| Termostat se ne javlja > 15 min | `check_thermostat` | warning | `user_check` | „Termostat se ne javlja X min. Provjerite baterije i vezu." |
| ext ≤ 0 i grijanje isključeno | `frost_warning` | **critical** | `user_check` | „Vanjski je X °C, a grijanje je isključeno. Uključite grijanje ili način AUTO." |
| Sezona isključena (prosjek > 16 °C) | `heating_off_season` | info | `none` | „Grijanje je isključeno jer je prosječna vanjska Y °C. Uključite ručno ako vam je hladno." |
| Anomalija (bilo koja) | iz kataloga §4.4 | warning | `user_check` | opis mjerenja + jedna provjera |

### 5.5 Šta se ovim **ne** smije reći

- Ne smije se reći „sistem je postavio polaznu na X" — sistem ne šalje komande.
- Ne smije se reći „kotao je u kvaru" na osnovu trajanja ciklusa.
- Ne smije se prikazati ušteda koja nije izmjerena; „ušteda" bez mjerenja gasa po stepen-danu je tvrdnja, ne rezultat.
- Ne smije se prikazati preporuka za drugi grad kao korisnikova (danas: `Visoko`, F-12/§5.1).
- Ne smije se tražiti unos ispod 48 °C ni iznad 55 °C (R-1).

### 5.6 Acceptance testovi za instrukcije

| Test | Očekivanje |
|---|---|
| Motor vrati 46,00 | Nema `targetFlowTemp: 46`; `code: keep_current` ili cilj 48 uz objašnjenje |
| `weather = null` | `code: no_weather`, `targetFlowTemp: null`, `confidence: null`; **nikad** 51 |
| `samples = 0` | `code: learning_warming_up`; UI ne prikazuje „0 %" ni „0 min" |
| `seasonMode = SUMMER`, `ext = −5` | `frost_warning`, severity `critical` |
| Anomalija `cycle_too_long` | Tekst sadrži mjerene brojeve; ne sadrži `weekday_` ni `overshoot` |
| Bilo koja instrukcija | `requiresConfirmation === true`, `action !== 'device_command'` |
| Engleski jezik | Nijedan korisnički tekst nije bosanski (testira se na `message`, ne samo na ključ) |
| `confidence = 0` | UI piše „model se još uči", ne „0 %" |

---

## 6. Test plan

### 6.0 Stvarno stanje testova (izmjereno 2026-11-08)

```
npx jest --listTests | wc -l                                  → 91 test fajla
npx jest --listTests | grep -ci 'Heating/(engine|strategies)' → 0
```

- **Formula nema nijedan test.** Ne postoji `Heating/engine` ni `Heating/strategies` test fajl, ni test za `heating.recommendation.service.ts` matematiku. Sve u §2 i §3 je danas zaštićeno samo ovim auditom.
- Relevantan podskup (`HeatingRecommendation`, `HeatingAnomalyCheckerService`, `Schedule`, `Boiler`, `common/anomaly-detection`): **11 suite, 7 prošlo, 4 nije moglo ni da se učita** — `boiler-current-temp-http`, `anomaly-confirm-http`, `anomaly-ownership`, `daily-recommendation-v2-routing`. Uzrok je ekološki, ne logički: `src/generated/prisma` je u `.gitignore`, a `npx prisma generate` u ovom okruženju pada jer traži `binaries.prisma.sh` (nedostupno). U 7 učitljivih suite-a prolazi **52 testa**.
- `recommendation-write-sites.spec.ts` **prolazi**, ali mockuje engine i koristi **već postojeći** red učenja (`id: 1`, `samples: 8`). Putanja iz F-04 — profil bez reda — nije pokrivena, pa zeleni test aktivno **čuva** trenutno ponašanje.
- `anomaly-detection.service.spec.ts` testira samo čistu funkciju nad zadatim μ/σ. Nema σ=0 slučaja, nema self-inclusion, nema upita za baseline (A-01/A-02).
- Nijedan test ne provjerava da se `learningOffset`/`learningConfidence` **upisuju**; pojavljuju se samo kao fiksture (L-12).

**Zaključak:** zelena linija na ovim testovima ne znači da formula radi — ne postoji test koji bi pao kad se polazna pogrešno izračuna. Prvi korak nije „više testova", nego **golden-file za motor** (§6, tačka 6) i regresije za F-04/F-08/F-12/A-06, koje se mogu napisati bez baze po uzoru na `formula_pipeline_repro.cjs`.

**Unit / property (bez baze):**
1. Kontinuitet i monotonost krivulje na `[−15, 10]` s eksplicitnim izuzetkom na granicama; test mora **fiksirati** trenutni prekid (48 → 46) dok se ne odluči drugačije.
2. `finalTemp` uvijek u `[46, 55]`; u `ANONYMOUS` načinu uvijek u `{46} ∪ [48,55]` — dokumentuje F-01 kao ugovor.
3. `NaN`/`Infinity`/`null`/`undefined` za svako numeričko polje: nikad `NaN` u izlazu.
4. `insulationFactor` ne smije mijenjati znak nijedne komponente (property).
5. `intervalKey` s `includes('morning')`: tabela svih 10 ključeva (danas `late_morning` greškom ulazi).
6. Golden-file za sve scenarije iz `formula_max_audit.cjs --json` (uključujući domen po načinu rada). **Djelimično urađeno:** `scripts/audit/fixtures/formula_golden.json` pokriva 133 slučaja motora i detektora sa `--check-golden` gate-om (exit 1 na drift). Domen po načinu rada još nije u snimku.

**Learning:**
7. Simulacija s eksplicitnim vremenima: `reachTime` i `overshoot` iz **završnog** snapshot-a.
8. Idempotentnost: dva ista eventa ne mijenjaju stanje dvaput; konkurentni update ne gubi uzorak.
9. Prvi uzorak se **kreira** (regresija za L-06).
10. Outlier > 3σ ne pomjera offset više od 1 °C.
11. `confidence` raste s N i pada s varijansom; nikad konstanta.

**Anomalije:**
12. Baseline isključuje event koji se provjerava (regresija za A-01).
13. σ=0: 61 min vs 60/60/60 **nije** anomalija (regresija za A-02).
14. Baseline ne sadrži evente poslije `timestampStart` (look-ahead).
15. Potvrda anomalije ne mijenja već postojeći stvarni `timestampEnd` (regresija za A-06).

**Instrukcije:**
16. Svih 8 testova iz §5.6, u oba jezika.
17. Nijedan `targetFlowTemp` izvan `[48, 55]`.
18. Nijedan tekst ne sadrži interni enum (`weekday_`, `overshoot`, `prolonged_idle`).

**Shadow / backtest (prije bilo kakve promjene):**
19. Nova formula i nova instrukcija računaju se paralelno iza feature flaga; korisnik i dalje vidi staro; loguje se samo agregatna razlika bez identifikatora.
20. Backtest na odobrenom, deidentifikovanom snapshotu `HeatingEvent` + `BoilerHistory` + prognoza **dostupnih prije** događaja; vremenski split po domaćinstvu i sezoni; bez look-ahead.
21. Metrike: vrijeme do cilja (p50/p90), overshoot, K·h izvan komfora, broj ciklusa/dan, gas/m³ po stepen-danu. **Ne** „poklapanje sa starom preporukom".

---

## 7. Backlog

Redoslijed, tačne izmjene po fajlu, migracije, rollback i kriteriji prihvata: **`14-flow-temp-implementation-plan.md`**. Talas F0 tog plana (golden gate) je već implementiran.

| ID | Stavka | Trud | Rizik | Zavisnost |
|---|---|---|---|---|
| B-101 | Uskladiti izlaz motora s ulaznim prozorom (46–47,9 → instrukcija `keep_current` ili cilj 48) — **odluka vlasnika** | S | nizak | — |
| B-102 | Prekidač funkcije: `SUMMER` + `ext ≤ 0` → `frost_warning`, ne „off" | S | nizak | — |
| B-103 | Proslijediti `windowType`/`insulationType`/`heatingType`/`ceilingHeight` u motor **ili** ih ukloniti iz profila | M | srednji | odluka o modelu |
| B-104 | Ispraviti `ceilingHeight` jedinicu (DTO 1,8–5 m → cm) uz regresije | S | srednji | B-103 |
| B-105 | Završni snapshot u učenje umjesto početnog (`polling:485`, `checker:318`) | M | **visok** (mijenja preporuke) | shadow |
| B-106 | Ukloniti dvostruko sabiranje overshoota i obrnuti znak korekcije | M | **visok** | B-105, shadow |
| B-107 | `upsert` + transakcija + `count` log za `HeatingIntervalLearning` | S | nizak | — |
| B-108 | Bounded EWMA + varijansa + `N_min` + per-component cap u motoru | L | visok | B-105…107 |
| B-109 | Izračunati `confidence` iz N i varijanse, ne konstantu 0,1 | M | srednji | B-108 |
| B-110 | Ukloniti self-inclusion i look-ahead iz baseline-a anomalija | S | nizak | — |
| B-111 | Minimalna margina `max(2σ, 10 min)` + MAD za σ=0 | S | nizak | — |
| B-112 | Proširiti katalog anomalija (§4.4) — najmanje `target_not_reached`, `flow_not_followed`, `sensor_frozen` | L | srednji | B-113 |
| B-113 | Instrukcijski sloj (`HeatingInstruction`) + i18n bs/en + 8 acceptance testova | M | srednji | B-101 |
| B-114 | Ukloniti „0 min" i „0 %"; prikazati „nepoznato"/„model se uči" | S | nizak | — |
| B-115 | Ukloniti ili povezati 12 mrtvih i18n ključeva upozorenja (`alerts.*`) | S | nizak | B-113 |
| B-116 | Anonimni dashboard: označiti grad i „nije personalizovano" | S | nizak | — |
| B-117 | `NaN`/non-finite guard u motoru i DTO | S | nizak | — |
| B-118 | Backtest harness + shadow flag + pragovi prihvatanja | L | visok | B-105…112 |
| B-119 | Ukloniti hardkodirani `part='morning'` i računati ključ iz vremena događaja | S | srednji | — |
| B-120 | Deduplikacija push anomalija (cooldown po uređaju/kodu) | S | nizak | B-112 |
| B-121 | Jedinstven `Recommendation` po `(userId, dan)` + provjera „već poslano" **prije** upisa | S | nizak | — |
| B-122 | Golden-file i regresije za F-04/F-08/F-12/A-06 po uzoru na `formula_pipeline_repro.cjs` | M | nizak | — |

---

## 8. Otvorena pitanja i odluke koje traži vlasnik

1. **Šta je „polazna temperatura" u ovom proizvodu** — preporuka koju korisnik ručno unosi, ili cilj koji sistem nekad bude izvršavao? Od toga zavisi da li je F-01 kozmetički ili blokirajući.
2. **Da li 46 °C uopšte smije biti preporuka** za ovaj kotao? Ako da, ulazni prozor mora ići dolje; ako ne, motor mora stati na 48. Trenutno su oba odgovora istovremeno „da".
3. **Proizvođačke granice** kotla, podnog kruga, radijatora i zaštita od smrzavanja — nijesu utvrđene. Nijedan broj iz ovog dokumenta nije zamjena za njih.
4. **Smije li `SUMMER` isključiti grijanje bez provjere vanjske temperature?** Predlažem ne (B-102).
5. **Koliko uzoraka je dovoljno** da se naučeni offset primijeni (`N_min`)? Prijedlog 8; traži potvrdu.
6. **Fizička definicija `overshoot` i „dostizanja cilja"** — da li je dostizanje prvi poll s `room ≥ target`, ili interpolirani trenutak? Traži stručnjaka.
7. **Postoje li u produkciji redovi u `HeatingIntervalLearning`** i ko ih je stvorio? Bez toga se ne zna da li je učenje mrtvo ili radi s pogrešnim znakom. Baza nije čitana.
8. **Reprezentativni podaci** za backtest: porijeklo, saglasnost, pokrivenost, vremenska zona. Bez toga B-118 ostaje otvoren.
9. **Da li je gas/m³ po stepen-danu prihvatljiva metrika** s obzirom na kvalitet očitanja (`docs/audit/backend/06-formulas.md`, B-015…B-018)?

---

## 9. Reprodukcija

```bash
# instalacija backend zavisnosti (skripta koristi ts-node iz backend/node_modules)
cd backend && npm ci && cd ..

node scripts/audit/formula_max_audit.cjs --help
node scripts/audit/formula_max_audit.cjs                 # sve sekcije, tekstualno
node scripts/audit/formula_max_audit.cjs --json          # mašinski čitljivo
node scripts/audit/formula_max_audit.cjs --only=robust   # samo nevalidni ulazi
node scripts/audit/formula_max_audit.cjs --only=learning # samo učenje
node scripts/audit/formula_max_audit.cjs --only=anomaly  # samo anomalije

node scripts/audit/formula_pipeline_repro.cjs            # servisi nad lažnom bazom
node scripts/audit/formula_pipeline_repro.cjs --json     # mašinski čitljivo

node scripts/audit/formula_max_audit.cjs --write-golden  # snimi trenutno ponašanje
node scripts/audit/formula_max_audit.cjs --check-golden  # exit 1 ako se ponašanje promijeni
```

`formula_pipeline_repro.cjs` sadrži `assert` tvrdnje za svaki nalaz koji pokriva — ako se ponašanje promijeni, skripta pada s kodom 1. Zbog toga je pogodna kao osnova za regresione testove (B-122), a ne samo kao dokaz.

Skripta ne piše u bazu, ne poziva mrežu i ne mijenja aplikacijski kod. Rezultati su sintetički i ne predstavljaju mjerenje sistema.

---

## 10. Zaključak

Formula nije „skoro dobra". Ona je **deterministična, ali zatvorena u pogrešnom krugu**: izlaz joj je djelimično neizvršiv, učenje joj mjeri pogrešan trenutak s pogrešnim znakom i bez perzistencije, anomalije gledaju jednu dimenziju i same sebe uzimaju za referencu, a korisnik na kraju dobija broj bez akcije, bez neizvjesnosti i bez porijekla.

Uz to, **formula nema nijedan test** (§6.0): 91 test fajl u repou, nijedan za engine ili strategije. Ono što je danas „zeleno" ne bi palo ni da se polazna izračuna dvostruko.

Redoslijed popravke nije proizvoljan: prvo **zaustaviti štetu** (B-101, B-102, B-105/B-106 iza shadow flaga, B-110), zatim **učiniti učenje mjerljivim** (B-107…109), pa **graditi instrukcije** na podacima kojima se može vjerovati (B-112, B-113). Instrukcija izgrađena na trenutnom signalu bila bi uvjerljiva i pogrešna — što je gore od trenutnog stanja.

Ništa u ovom dokumentu nije dozvola za automatsko upravljanje kotlom. Fizičke zaštite ne zavise od aplikacije.
