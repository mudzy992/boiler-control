# 16 — Šta imamo sada, šta radi, koja formula, kako se odražava i šta nadogradnja mijenja

**Status:** objašnjenje prije implementacije. Ne mijenja aplikacijski kod.
**Datum:** 2026-11-08. **Grana:** `arena/da41e5ba-boiler-control`.
**Mjerodavni ugovor:** `15-daily-proposal-audit.md` §0 (R-1…R-8). **Nalazi:** `15` §3 (D-01…D-10).
**Odluke vlasnika od 2026-11-08:** gornja granica 55 tvrda; donja za predlog 46; predlog u 06:00 fiksno; noćni minimum obavezan (`15` §9.1).

Sve tvrdnje ispod su iz izvornog koda ili iz izvršenih skripti. Gdje nešto nije izmjereno, piše **nije izmjereno** — ne pretpostavka.

---

## 1. Šta imamo sada

### 1.1 Podaci koji postoje u sistemu

| Podatak | Gdje postoji | Stiže do formule? | Koristi se za učenje? | Vidljiv korisniku? |
|---|---|---|---|---|
| Satna prognoza, 72 h unaprijed | `openmeteo-v2.provider.ts:180-246` (`hourly[]`), keš `WeatherV2Cache` | **ne** | **ne** | djelimično (graf vremena) |
| Dnevni min / max | isti payload, `daily[]` | **da** | **ne** | da |
| Trenutna vanjska temp | `current.temperatureC` | **ne** (samo u `BoilerHistory.externalTemp` pri startu ciklusa, `thermostat.polling.service.ts:405-410`) | **ne** | da |
| Površina | `HomeProfile.floorArea` | **da** | **ne** | da |
| Visina plafona | `HomeProfile.ceilingHeight` | **ne** — nijedan od tri poziva je ne šalje | ne | da |
| Tip izolacije / debljina | `HomeProfile.insulationType`, `insulationThickness` | **ne** | ne | da |
| Tip prozora | `HomeProfile.windowType` | **ne** | ne | da |
| Tip grijanja | `HomeProfile.heatingType` | **ne** | ne | da |
| Broj stanara, godina gradnje | `numberOfResidents`, `constructionYear` | **ne** | ne | da |
| Ciljne sobne temp (dan/jutro/noć) | `targetDayTemp`, `targetMorningTemp`, `targetNightTemp` | **ne** | ne | da |
| Naučeni offset doma | `HomeProfile.learningOffset`, `learningConfidence` | **da** | **nikad se ne piše** (`13` F-08) | da (`/dashboard/health`) |
| Učenje po intervalu | `HeatingIntervalLearning` (10 bucket-a) | djelimično (samo `FULL`) | **red se nikad ne kreira** (`13` F-03) | da |
| Toplotni događaji (start/end, sobna temp) | `HeatingEvent` | da — zadnjih 10 u 7 dana, samo u „live" putu | da (i pogrešno, `13` F-005) | da |
| Historija kotla (predlog vs stvarno) | `BoilerHistory.suggestedFlowTemp` / `actualFlowTemp` | **ne** kao ulaz | **ne** | samo health `flowDelta` |
| Stanje brojila gasa | `GasReading` | ne | ne | da (Gas modul) |
| Stepen-dani / stepen-sati | **ne postoji** (`0` pogodaka za `degree.day`, `hdd`) | — | — | — |
| Zapis „današnji predlog" | **ne postoji** kao objekat; `Recommendation` je red bez jedinstvenosti | — | — | posredno |

**Zaključak §1:** sistem **skuplja** skoro sve što jedan dnevni predlog traži — satnu prognozu za 72 h, sve fizičke parametre kuće, stvarno podešenu polaznu, potrošnju gasa. **Do formule i do učenja stiže 1 fizički parametar (površina) i jedan broj koji se nikad ne mijenja.** Ostatak se skuplja i odbacuje.

### 1.2 Šta od podataka ne postoji, a treba

1. **Zapis dana** — jedan red po kući po danu sa predlogom, osnovom prognoze, noćnim minimumom i stepen-satima.
2. **Historija vanjske temperature** — satna prognoza se kešira kao **posljednji** payload (`WeatherV2Cache`, jedan red po ključu). Ono što se stvarno dogodilo vani ne ostaje nigdje; ostaje samo jedno očitanje po ciklusu grijanja.
3. **Ishod** — nema podatka „bilo je dovoljno / nije bilo dovoljno", pa se ni ušteda ne može izračunati.

---

## 2. Šta radi sada

### 2.1 Tri pisca preporuke

| # | Put | Kada se izvršava | Šta piše |
|---|---|---|---|
| 1 | `HeatingRecommendationService.processHeatingEvent` — zove se **dva puta po ciklusu** (start i end, `thermostat.polling.service.ts:427, 480`) | pri svakom startu i svakom završetku grijanja | `Recommendation` — `create` ako danas nema reda, inače `update` (`heating.recommendation.service.ts:156-182`) |
| 2 | `DailyRecommendationService.generateDailyRecommendations` (`@Cron('0 0 * * *')`, `daily.recommendation.service.ts:24`) | **u ponoć**, i **isključeno** u `development` i `test` (L26-27) | novi `Recommendation` red + notifikacija (L88, L116) |
| 3 | `POST /api/boiler/sync` → `calculateFlowTemp` (`boiler.controller.ts:45-66`) | kad korisnik klikne | **ništa** — funkcija je čista, poruka „Boiler history successfully synced" nije tačna |

Izmjereno (`15` D-01): 2 ciklusa dnevno → **4 upisa + 1 cron = 5**; 5 ciklusa → **11**. Nijedan od tih upisa nije „današnji predlog" — to su međurezultati.

### 2.2 Tajming

- Cron je zapisan kao `0 0 * * *` = **00:00**, a komentar iznad kaže „svaki dan u 6:00" (`daily.recommendation.service.ts:23-24`). **Kod radi ponoć.**
- Nema `timeZone` opcije: sat se računa po zoni servera. U UTC kontejneru `0 6 * * *` bi bilo 07:00/08:00 po lokalnom vremenu.
- Zato što radi u ponoć, a bucket je hardkodiran na `morning` (`daily.recommendation.service.ts:139-146`), dnevni predlog **nikad ne koristi učenje iz večeri** koje ciklusi pune (`15` D-03: `PROFILE_ONLY` 49,77 °C naspram `FULL` 51,27 °C u istom trenutku).

### 2.3 Šta korisnik vidi

| Mjesto | Šta prikazuje | Odakle |
|---|---|---|
| Push notifikacija | „Nova dnevna preporučena polazna temperatura kotla je X °C" | tekst iz cron-a (`daily.recommendation.service.ts:119-120`) |
| Dashboard (web/mobile) | **nema naslovnog broja**; prikazuje se panel „Zašto" (`RecommendationBreakdown`): bazna krivulja, ponder, offset doma, interval, događaji, konačna temp, pouzdanost, uzorci | `system.recommendation.breakdown` = **posljednji red iz baze** (`dashboard.service.ts:200`) |
| Web Reports | tabela `recommendedFlowTemp` | historija `Recommendation` |
| Sheet „Postavi trenutnu temp" | unos 48–55 | `PATCH /api/boiler/current-temp` |

Dvije stvari koje izgledaju kao rad, a nisu:

1. **`POST /boiler/sync` vraća `success: true` i „Boiler history successfully synced", a ne upisuje ništa** (`calculateFlowTemp` je čista funkcija, `boiler.service.ts:44-49`).
2. **Dashboard izračuna živu vrijednost i baci je.** `dashboard.service.ts:64` poziva `calculateFlowTemp(userId)` za svaki zahtjev; ta vrijednost se koristi **samo** u anonimnom ogranku (L77). Prijavljeni korisnik dobija red iz baze, a izračun je izgubljen rad (jedan upit profila + do dva upita vremena po svakom otvaranju ekrana).

### 2.4 Šta se ne dešava — dokazano

- **Nema nijednog upisa prema bojleru.** `IThermostatAdapter` ima samo `getCurrentTemperature`, `getTargetTemperature`, `fetchSnapshot` (`thermostat-adapter.interface.ts:38-45`). Potpis za potpisivanje zahtjeva prima `'GET' | 'POST'` (`tuya.adapter.ts:143`), ali adapter pravi **isključivo** `axios.get` — jedan poziv, `tuya.adapter.ts:189`; nijedna komanda nije implementirana. Aplikacija je prema kotlu strogo čitljiva.
- **Nema mjerenja ishoda.** `BoilerHistory` čuva `suggestedFlowTemp` i `actualFlowTemp`, ali se par nikad ne ocjenjuje.

---

## 3. Koja se formula koristi

### 3.1 Opšti oblik (stvarni kod)

```
ext    = clamp(0.7·tempMin + 0.3·tempMax, −15, 10)              base.strategy.ts:7-9
base   = 56                      ako ext ≤ −15
         45                      ako ext ≥ 10                       base.strategy.ts:36-40
         51 − 0.3·ext            inače
mods   = (home + interval + events + fizički faktori) · insulationFactor
final  = clamp(base + mods, 46, 55), zaokruženo na 2 decimale     base.strategy.ts:21-25
```

Komponente:

| Komponenta | Formula | Izvor |
|---|---|---|
| površina | `max(0, 150 − area) · 0.02` | `profile.strategy.ts:24-25` |
| visina | `(height − 230) · 0.02` (cm) | `:26-27` |
| prozor | single **+2**, double 0, triple **−1** | `:29-39` |
| grijanje | podno **−2**, ostalo 0 | `:42-45` |
| izolacija | množi **sve** doprinose: 0.8 / 0.85 / 0.9 / 0.95 / 1.0 | `:51-69` |
| naučeni offset doma | `learningOffset · confidence` (u `PROFILE_ONLY` još `×0.8`) | `:12-20`, `full.strategy.ts:9-11` |
| interval | `offset + 0.5·avgOvershoot + 0.2·clamp((30 − avgReachMin)·0.05, −1, 1)`, `×0.6` za „morning" | `full.strategy.ts:13-25` |
| događaji | `Σ delta · (active ? 0.15 : 0.05) · e^(−0.25·idx)`, `×0.5` za „morning" | `full.strategy.ts:29-37` |

### 3.2 Šta od toga stvarno stiže — tabela polja

Sva tri poziva (`boiler.service.ts:104-109`, `daily.recommendation.service.ts:58-63`, `heating.recommendation.service.ts:127-132`) šalju **samo**: `floorArea`, `learningOffset`, `confidence`, `insulationFactor: 1`.

| Polje | Poslano? | Efekat danas |
|---|---|---|
| `floorArea` | da | jedini fizički parametar |
| `ceilingHeight` | **ne** → default 230 | faktor uvijek **0** |
| `windowType` | **ne** → switch pada na default | faktor uvijek **0** |
| `heatingType` | **ne** → `=== UNDERFLOOR` false | faktor uvijek **0** |
| `insulationType` | **ne** → `default` | množitelj uvijek **1.0** |
| `insulationFactor` | poslan kao `1` | polje se **ignoriše** (strategija čita `insulationType`) |

### 3.3 Redukovani oblik — ovo se zaista izvršava

```
final = clamp( 51 − 0.3·clamp(0.7·min + 0.3·max, −15, 10)
               + max(0, 150 − area)·0.02
               + offset·confidence·(0.8 u PROFILE_ONLY, 1.0 u FULL)
               [+ interval + događaji, samo u FULL],  46, 55 )
```

Izmjereno na stvarnom motoru (`/tmp` verifikacija, isti ulaz kao pozivi):

| Površina | Predlog |
|---|---:|
| 80 m² | 52,40 |
| 100 m² | 52,00 |
| 120 m² | 51,60 |
| 150 m² | 51,00 |
| 200 m² | 51,00 |
| 300 m² | 51,00 |
| 400 m² | 51,00 |

**Kuća od 400 m² dobija isto što i 150 m².** Faktor je `max(0, 150 − area)`, pa veće kuće nikad ne dobiju ništa.

Motor **podržava** pun profil — kad mu se pošalje, radi: slim profil 51,00 °C naspram punog (single prozor + napredna izolacija + 300 cm + podno) **52,12 °C**. Razlika 1,12 °C postoji u motoru i **nikad ne nastane** jer je pozivi ne pošalju.

### 3.4 Osjetljivost — koliko formula uopšte može reći

| Promjena | Efekat na predlog |
|---|---|
| 1 °C hladnije vani | **+0,30 °C** polazne |
| 10 °C hladnije vani | +3,00 °C polazne |
| cijeli raspon 46–55 (9 °C) | pokriva tačno **30 °C** vanjske temp (−15…+10) |
| ispod −15 / iznad +10 | **ravno** (56→55, 45→46) |
| na granici 10 °C | skok **−2,03 °C** za 1 °C ulaza (48,03 → 46,00) |
| površina 150 → 80 m² | +1,40 °C |
| površina 150 → 300 m² | **0,00 °C** |

Dva dana sa identičnim min −6 / max +3, a različitom potrebom za grijanje (303 prema 213 stepen-sati, **+42 %**): **isti predlog 51,99 °C** (`15` D-05).

### 3.5 Šta formula ne može izraziti

1. **Oblik dana** — vidi samo dvije tačke, min i max, pomiješane 0,7/0,3.
2. **Trajanje hladnoće** — nema vremenske dimenzije; sat hladnoće i osam sati hladnoće su isti broj.
3. **Noć** — najhladniji sat noći ulazi samo ako je ujedno dnevni minimum, i to podijeljen sa 0,7.
4. **Kuću** — jedini fizički parametar je površina, i to samo za manje od 150 m².
5. **Samo podešavanje** — nema veze sa tim šta piše na bojleru (`15` D-08: unos 48 ili 55 → isti predlog 49,77 °C).
6. **Sopstvenu pouzdanost** — `confidence` je konstanta 0,1 dok se ne pojavi red učenja, a red se nikad ne kreira (`13` F-03).

---

## 4. Kako se ona odražava

### 4.1 Na korisnika

- Jedan broj u push poruci u **ponoć** (ne u 06:00), u tekstu: „Nova dnevna preporučena polazna temperatura kotla je X °C".
- Na dashboardu **nema naslovnog broja** — broj je sahranjen u panelu „Zašto" kao zadnji red tabele.
- Broj na panelu je **posljednji upisani red**, ne današnji predlog. Može biti od jučerašnjeg ciklusa.
- Sheet za unos trenutne temp je jedini tok povratne informacije — i on se ne koristi u proračunu.

### 4.2 Na podatke

- `Recommendation` red se prepisuje do 11× dnevno; `date` se postavlja na dva načina (`setHours(0,0,0,0)` u jednoj putanji, `new Date()` u drugoj), a šema **nema** `@@unique([userId, date])` — samo `@@index`.
- `BoilerHistory.suggestedFlowTemp` dobija **živu** vrijednost pri svakom startu ciklusa; `actualFlowTemp` se prepisuje na **najnoviji** red kad korisnik unese temp (`boiler.service.ts:289-300`), pa 09:00 unos može sletjeti na jučerašnji 22:00 red, a na dan bez ciklusa nema reda u koji bi se upisalo (`15` D-07).
- `HeatingIntervalLearning.samples` ostaje 0: red se ne kreira, a `updateMany` sa `id: 0` ne pogađa ništa (`heating.recommendation.service.ts:190-207`, `13` F-03).

### 4.3 Na bojler

**Ništa.** Nema upisa, nema komande, nema daljinskog podešavanja (§2.4). Jedina veza je tekst poruke koji korisnik ručno prenosi na bojler.

### 4.4 Na kuću

**Nije izmjereno i danas se ne mjeri.** Nema podatka da li je kuća dostigla cilj, ni koliko je gasa potrošeno za koliko hladnoće. Tvrdnja „dovoljno za grijanje i uz štednju" danas nema mjernu podlogu ni u jednom smjeru.

### 4.5 Posljedica koju treba znati prije izmjene granica

Motor klampuje na **46**, a unos prihvata **48–55**. Postoji pojas u kojem aplikacija **predlaže vrijednost koju sama ne može evidentirati** (`13` F-10). Granica 48 postoji na **četiri mjesta** i sva se moraju mijenjati zajedno:

| Mjesto | Vrijednost |
|---|---|
| `backend/src/modules/Boiler/dto/set-current-temp.dto.ts:17-18` | `@Min(48) @Max(55)` |
| `backend/src/modules/Boiler/boiler.service.ts:34-35` | `MIN/MAX_CURRENT_FLOW_TEMP` |
| `mobile/src/constants/boilerLimits.ts:7-8` | `MIN/MAX_CURRENT_FLOW_TEMP` |
| `mobile/src/constants/__tests__/boilerLimits.test.ts:10-11` | test **pinuje 48** |
| `backend/src/modules/Heating/strategies/base.strategy.ts:25` | clamp 46 (ostaje) |

**Odluka (2026-11-08): 30–55 za oba.** Bojler ne ide ispod 30 ni iznad 55, pa nema razloga za dva raspona: predlog i unos koriste isti. Time nestaje pojas „predlog koji se ne može evidentirati".

**Ali to traži i izmjenu clampa u motoru.** `base.strategy.ts:25` reže na `max(46, …)`; ako se digne samo DTO, motor i dalje nikad ne proizvede ispod 46 i donjih 16 °C raspona je mrtvo. Za dobro izolovanu kuću u blagom vremenu potreba je 24–32 °C, pa je dosadašnji pod od 46 bio **sistematski bias od 14–22 °C** (`17` §4.4).

---

## 5. Šta nadogradnja mijenja

Red po redu; „zatvara" = nalaz iz `15`/`13` koji prestaje postojati, „ne mijenja" = šta ostaje.

### 5.1 Jedan dnevni zapis umjesto 11 upisa

**Prije:** 5–11 upisa dnevno, vrijednost raste kroz dan 49,77 → 51,01 °C, `date` na dva načina, nema jedinstvenosti.
**Poslije:** jedan red `(userId, date)` sa `proposedFlowTemp`, `proposedAt`, `weatherBasis`, `nightMinC`, `degreeHours`, `actualSetFlowTemp`. Vrijednost se **ne mijenja** do sljedećih 06:00.
**Zatvara:** D-01, D-02, D-10. **Ne mijenja:** formulu — samo prestaje da se poziva više puta.

### 5.2 Jedan pisac, u 06:00, `Europe/Sarajevo`

**Prije:** cron u 00:00 bez vremenske zone + dva upisa iz pollinga + lažni „sync".
**Poslije:** `@Cron('0 6 * * *', { timeZone: 'Europe/Sarajevo' })`, idempotentno po danu; polling **samo evidentira** događaje i nikad ne piše predlog; `/boiler/sync` se uklanja ili iskreno vraća „nema upisa".
**Zatvara:** D-03 (dvije vrijednosti u istom danu), ponoćnu notifikaciju, tihu grešku od jednog sata. **Ne mijenja:** sadržaj proračuna.

### 5.3 Ulaz: prozor 06:00 → 06:00, noćni minimum, stepen-sati

**Prije:** `0.7·dnevniMin + 0.3·dnevniMax`, kalendarski dan.
**Poslije:** iz **iste** satne prognoze koja već postoji (72 h):
- `nightMin` = minimum satnih temperatura u prozoru **danas 06:00 → sutra 06:00**;
- `dayMean` / `dayMax` za dnevni dio;
- `degreeHours = Σ max(0, Tbase − T_h)` po satima, sa jednom dokumentovanom `Tbase`.
**Zatvara:** R-7, D-05 (oblik dana), dio D-06 (osnova za mjerenje). **Ne mijenja:** krivulju — samo šta u nju ulazi.
**Bitno:** `daily-weather-input.ts:39-57` uzima **kalendarski** `temperatureMinC`. U 06:00 to propušta najhladniji sat **predstojeće** noći — a on je mjerodavan. Satna prognoza ga već sadrži.

### 5.4 Fizički model: sva polja, dokumentovani koeficijenti

**Prije:** stiže samo površina; prozor, izolacija, visina, tip grijanja su u bazi i ne koriste se; kuća > 150 m² nema nikakav faktor.
**Poslije:** sva polja se prosljeđuju, koeficijenti se zapišu u jedan dokument i pokriju testom; površina prestaje biti jedini parametar.
**Zatvara:** R-8 (dio „svi aspekti doma"). **Ne mijenja:** činjenicu da koeficijenti nisu fizički validirani — to traži stručnjaka i stvarnu kuću, i zato ide u shadow.

### 5.5 Učenje: dan kao jedinica

**Prije:** 10 bucket-a (2 tipa dana × 5 dijelova dana); pri jednom grijanju dnevno **8 od 10 nikad ne dostigne 8 uzoraka** (D-04); dnevni push čita bucket koji se ne puni.
**Poslije:** **jedan** naučeni broj po kući — dnevna korekcija `dailyOffset`, ograničena (npr. ±2 °C), ažurirana jednom dnevno iz ishoda prethodnog dana. 365 uzoraka godišnje je dovoljno za stabilnu procjenu; 10 bucket-a nije.
**Zatvara:** D-03, D-04 strukturno. **Ne mijenja:** potrebu za tačnim signalom ishoda (§5.7).

### 5.6 Povratna veza: ono što je korisnik zaista podesio

**Prije:** `currentBoilerFlowTemp` se čuva, ali ne ulazi ni u proračun ni u učenje (D-08); lijepi se na najnoviji `BoilerHistory` red (D-07).
**Poslije:** upis ide u **današnji** dnevni zapis kao `actualSetFlowTemp`; razlika `actual − proposed` je ulaz u učenje.
**Zatvara:** D-07, D-08. **Ne mijenja:** činjenicu da je to samo jedan podatak dnevno — ali je to jedini stvarni signal koji proizvod ima, i danas je odsječen.

### 5.7 Mjerenje ishoda i uštede

**Prije:** nema.
**Poslije (minimum):**
- **dovoljno:** soba dostigla cilj u prvom ciklusu i nije pala ispod noćnog cilja — mjerljivo iz `HeatingEvent` + očitanja termostata;
- **ušteda:** isti komfor uz nižu polaznu, izraženo u **°C·dan** i u **m³ gasa po stepen-danu**; traži `GasReading` (postoji) i dnevnu sumu vanjske temperature (**ne postoji**, mora se početi čuvati).
**Zatvara:** R-5 djelimično, D-06. **Ne mijenja:** da ušteda **ne smije** biti tvrdnja u UI prije baznog perioda — preporuka ≥ 14 dana prije i ≥ 14 dana poslije.

### 5.8 Granice i zaštita

**Prije:** motor 46–55, unos 48–55, bez noćne provjere.
**Poslije:** predlog `clamp(..., 46, 55)`, gornja 55 tvrda, unos 30–55 (§4.5), i **provjera pokrivenosti noći**: ako predlog ne pokriva `nightMin`, podigni ga na minimum potreban za noć (uz jasnu poruku), nikad obrnuto.
**Zatvara:** pojas „predlog koji se ne može evidentirati", R-4/R-6 posljedice.

### 5.9 Prikaz

**Prije:** broj u ponoćnoj notifikaciji i u panelu „Zašto"; dashboard baca živi izračun.
**Poslije:** jedan naslovni broj — „**Danas: X °C**" sa vremenom predloga i oznakom „postavljeno / nije postavljeno"; panel „Zašto" ostaje; mrtav izračun se uklanja.
**Zatvara:** prazninu između onoga što sistem računa i onoga što korisnik vidi.

---

## 6. Šta nadogradnja **ne** mijenja

1. **Ne uvodi automatiku.** Bojler ostaje ručni; adapter je i dalje čitljiv samo (§2.4).
2. **Ne ukida obavezu unosa.** Bez dnevnog unosa stvarno podešene vrijednosti nema učenja — samo naglabanje.
3. **Ne dokazuje uštedu.** Prvih 14 dana su kalibracija, ne rezultat.
4. **Ne validira koeficijente.** Prozor/izolacija/visina dobijaju dokumentovane brojeve, ne **tačne** brojeve; tačni traže stručnjaka i jednu realnu kuću.
5. **Ne popravlja anomalije i instrukcije same po sebi.** One ostaju u `13` §4–§5; dnevni zapis im daje kontekst, ne rješenje.
6. **Ne mijenja da je 06:00 procjena.** Prvi predlog u 06:00 je pretpostavka; prvi **kalibrisani** predlog je moguć tek nakon nekoliko dana ishoda.

---

## 7. Predlog oblika formule v1 — bez izmišljenih koeficijenata

Princip: u prvu verziju ulazi **samo ono što se može odbraniti**, a stepen-sati se **mjere** dok se ne kalibrišu.

```
nightMin   = min satna temp u prozoru 06:00 → 06:00          (postojeća 72 h prognoza)
DH         = Σ max(0, Tbase − T_h)                            (Tbase = jedna dokumentovana konstanta)

T_base     = curve(nightMin)                                  (kontinualna, bez skoka na 10 °C)
T_house    = T_base + envelope(profil)                        (sva polja, koeficijenti dokumentovani, |doprinos| ≤ 2)
T_day      = T_house + k_DH · (DH_prognoza − DH_prosjek)      (k_DH = 0 u v1)
T_final    = clamp(T_day + dailyOffset, 46, 55)               (dailyOffset: jedan po kući, |·| ≤ 2, 1×/dan)
guard      = ako nightMin < −10 i T_final < 50 → upozori „provjeri noć"
```

Zašto `k_DH = 0` u v1: stepen-sati su **mjera** koja tek treba da dobije koeficijent iz stvarnih dana. Uvođenje bilo kojeg `k_DH > 0` bez mjerenja bilo bi izmišljena fizika — a to je greška koju ovaj audit ne smije napraviti.

Šta v1 time **već** popravlja: oblik dana ulazi preko `nightMin` (ne kroz prosjek min/max), noć je pokrivena po definiciji, sva polja kuće učestvuju, učenje je jedan broj koji se može napuniti, podešeno se evidentira i ulazi u učenje, i postoji jedan dnevni zapis.

---

## 8. Kako ćemo znati da je uspjelo — prihvatni kriteriji

| Korak | Kriterij (mjerljivo, bez uređaja) |
|---|---|
| P0 dnevni zapis | u 24 h tačno **1** red; 48 h → 2 reda; vrijednost se ne mijenja između 06:00 i 06:00; ponovni poziv ne mijenja `proposedFlowTemp` |
| P0 cron | pokrenut u `Europe/Sarajevo` 06:00 u ljetnom **i** zimskom vremenu; **0** upisa iz pollinga |
| P1 noćni minimum | za isti dan `nightMin` iz prozora 06→06 ≠ kalendarski `temperatureMinC` kad hladnoća padne poslije ponoći; pokriveno testom |
| P1 oblik dana | dva dana sa istim min/max a različitim stepen-satima daju **različit** predlog |
| P2 profil | dvije kuće iste površine, različit prozor/izolacija → **različit** predlog; test pinuje oba |
| P2 učenje | nakon 10 dana `dailyOffset` ≠ 0 i `samples` = broj dana (ne 0); jedan bucket, ne 10 |
| P3 povratna veza | unos 48 pa 55 → dnevni zapis to vidi i učenje se pomjera u istom smjeru |
| P4 ušteda | nakon ≥ 14 dana baznog perioda postoji izračun m³/stepen-dan; **ništa se ne tvrdi** prije toga |

Golden gate (`formula_max_audit.cjs --check-golden`, 133 slučaja) mora ostati zelen poslije svake izmjene motora; namjerna promjena klamp-a = 17 diffova, exit 1 (dokazano).

---

## 9. Redoslijed

1. **P0** dnevni zapis + jedan pisac u 06:00 (+ uklanjanje lažnog „sync") — najveći dio kvara nestaje bez diranja formule.
2. **P1** ulaz iz 72 h prognoze: prozor 06→06, `nightMin`, stepen-sati kao **podatak**.
3. **P2** sva profilna polja u motor + dokumentovani koeficijenti + test.
4. **P3** dnevno učenje (jedan `dailyOffset`) iz ishoda + podešene vrijednosti.
5. **P4** mjerenje uštede; tekst u UI samo poslije baznog perioda.
6. **P5** kontinualna krivulja (uklanjanje skoka na 10 °C) — posljednje, jer je najmanji efekat.

Detaljna mehanika koraka ostaje u `14-flow-temp-implementation-plan.md`, uz napomenu na vrhu da F2.1/F2.4/F4/F5 mijenjaju oblik po `15` i ovom dokumentu.

---

## 10. Otvoreno

1. **Unos ispod 46** — prihvatiti 30–55 (preporuka §4.5) ili ostati na 40–55? Ovo je jedina tačka gdje predlog audita traži potvrdu.
2. **`Tbase` za stepen-sate** — 15 °C (uobičajeno) ili ciljna sobna? Mora biti jedna konstanta, ista za mjerenje i za učenje.
3. **`DailyProposal` tabela** ili proširenje `Recommendation` (preporuka: nova tabela, `@@unique([userId, date])`).
4. **Ne primijenjen predlog** — informacija ili kvar (preporuka: informacija).
5. **Trajanje baznog perioda** prije prve tvrdnje o uštedi (preporuka ≥ 14 dana).
