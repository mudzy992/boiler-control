# Formule grijanja i obračuna — radna verzija

## Sažetak: pet prioritetnih nalaza

1. **VERIFIKOVANO:** granica vanjske temperature 10 °C proizvodi skok konačne anonimne preporuke sa približno 48 na 46 °C; na −15 °C skok bazne krivulje prikriva konačni clamp (`backend/src/modules/Heating/strategies/base.strategy.ts:7-39`; `node scripts/audit/formula_table.cjs`). Vrijednosti 45 i 56 mogu biti bazne, ali konačni rezultat je ograničen na 46–55 °C.
2. **VERIFIKOVANO:** DTO prihvata visinu 1,8–5, dok strategija polazi od 230 i komentira centimetre (`backend/src/modules/HomeProfile/dto/create-home-profile.dto.ts:32-35`, `backend/src/modules/Heating/engine/types.ts:12-15`, `backend/src/modules/Heating/strategies/profile.strategy.ts:23-27`). **Nije potvrđeno da se nesaglasna vrijednost danas prosljeđuje u motor:** pregledana tri proizvođača inputa izostavljaju visinu; na sintetičkom direktnom ulazu 2,5 naspram 250 izlazi 46,45 naspram 51,4 °C.
3. **VERIFIKOVANO:** overshoot, njegov naučeni prosjek/offset i brzo dostizanje cilja mogu povećati preporuku (`backend/src/modules/HeatingRecommendation/heating.recommendation.service.ts:37-65`, `backend/src/modules/Heating/strategies/full.strategy.ts:13-25,53-55`). Potrebni su fizička definicija, analiza signala i stručna validacija prije promjene znaka.
4. **VERIFIKOVANO:** kada ne postoji interval učenja, u servis se stavlja memorijski objekat s `id: 0`, nakon čega se poziva `updateMany` umjesto stvaranja (`heating.recommendation.service.ts:75-85,163-180`); bez odgovarajućeg reda update može zahvatiti nula redova. Stvarno stanje produkcijske baze nije provjereno.
5. **VERIFIKOVANO:** vremenska lokacija, nevalidni ili odsutni podaci, tip grijanja i per-model granice nisu pouzdano dostupni motoru na svim putanjama. Izračun nije dozvola za automatsko upravljanje: novi model mora ostati u shadow modu do potvrde stručnjaka i zasebne odluke (detalji `05-weather.md`, `base.strategy.ts:24-25`, `boiler.service.ts:93-100`).

## Otvorena pitanja

- Jesu li temperature zaista preporuke koje korisnik ručno unosi? Ne pretpostavljati da su automatske komande uključene. Potrebno je provjeriti sve krajnje izvršne putanje i realnu instalaciju prije odluka o sigurnosti.
- Proizvođačke granice kotla, sistemskih komponenti i podnog kruga, radne/zaporne granice, zaštita od smrzavanja i hidrauličko miješanje nisu utvrđeni. Ne izmišljati jedinstvenu sigurnu temperaturu ni koristiti audit primjere za stvarni uređaj.
- Raspoloživi reprezentativni `HeatingEvent`, `BoilerHistory`, gas i weather podaci, njihovo porijeklo, saglasnost, pokrivenost, redoslijed i vremenska zona nisu provjereni. Produkciju ne čitati bez odobrenja.
- Tačna fizička definicija `overshoot`, trenutka dostizanja cilja i trajanja događaja nije validirana sa stručnjakom; event-end nije nužno dostizanje cilja.
- Nedostaje potpuna analiza svih formula i provjera seed podataka/test coverage-a; ovaj dokument ostaje radna verzija, a ne gotova validacija motora.

## Metod i izvršene skripte

`node scripts/audit/formula_table.cjs --help` i `node scripts/audit/formula_table.cjs` izvršavaju stvarni `FlowTemperatureEngine` nad sintetičkim ulazima. Generisani Prisma enum import je zamijenjen sintetičkim enum vrijednostima, kao stringovima iz sheme; nema DB/mreže. `python3 scripts/audit/backtest_sketch.py --help` i `--demo` rade samo offline poravnanje sintetičkog eventa/uređaja/historije i dostavljene predikcije. Skica ne trenira ni računa ishod potrošnje i ne izvodi uzročne zaključke. Ništa nije primijenjeno na uređaj.

## Izvršena tabela ulaz → izlaz

Sve vrijednosti u tabeli su **VERIFIKOVANO — sintetički direktni ulaz u stvarni motor**, ne stvarni podaci. Osim označenih promjena: `tempMin=tempMax=0`, `floorArea=150`, nema eventa ni dodatnih faktora. Izlaz je konačan nakon ograničenja i zaokruživanja na 2 decimale.

| Ulaz | ext ponder °C | Bazna krivulja °C | Izlaz °C | Tumačenje |
|---|---:|---:|---:|---|
| Anonymous, −15 / −15 | −15 | 56 | 55 | clamp |
| Anonymous, −14,999 / −14,999 | −14,999 | 55,4997 | 55 | clamp |
| Anonymous, 0 / 0 | 0 | 51 | 51 | osnovni slučaj |
| Anonymous, 9,999 / 9,999 | 9,999 | 48,0003 | 48 | granica odozdo |
| Anonymous, 10 / 10 | 10 | 45 | 46 | skok, zatim clamp |
| Anonymous, min −5 / max 5 | −2 | 51,6 | 51,6 | 0,7 min + 0,3 max |
| PROFILE_ONLY, površina 100 / 150 / 200 m² | 0 | 51 | 52 / 51 / 51 | asimetričan area faktor |
| PROFILE_ONLY, visina 2,5 / 250 | 0 | 51 | 46,45 / 51,4 | sintetički input u metrima naspram cm; pozivi trenutno izostavljaju visinu |
| PROFILE_ONLY, home offset 2, confidence 0,5 | 0 | 51 | 51,8 | home komponenta 0,8; izlazni confidence 0,4 |
| FULL, overshoot 2, vrijeme 20 / 40 min | 0 | 51 | 52,1 / 51,9 | brže daje veću interval komponentu 1,1 umjesto 0,9 |
| FULL, `weekday_late_morning`, offset 1 | 0 | 51 | 51,6 | `includes('morning')` hvata i `late_morning` |

Obračun 0,8 u PROFILE_ONLY i 0,8 u prikazanom confidence-u **nisu dva uzastopna množenja istog offseta**: isti sniženi confidence koristi se u offsetu, a odvojeno se izračunava i vraća kao rezultat (`profile.strategy.ts:10-20,71-73`). Nema dokaza da motor množi offset ponovo izlaznim confidence-om. Pitanje da li je dvostruko korištenje istog sniženja semantički poželjno ostaje otvoreno.

## Pregled postojećih formula

Formule u tabeli su **VERIFIKOVANO u izvoru**. Predložene alternative su hipoteze za istraživanje, a ne odobrene postavke. Granice važe samo za eksplicitne clampove; DTO, DB i stvarna fizika mogu imati druga ograničenja.

| Segment, izvor | Trenutni oblik / jedinice i raspon | Rizik i kandidat za validaciju |
|---|---|---|
| Ponder i krivulja `base.strategy.ts:7-25,36-40` | `ext=clamp(0,7 Tmin+0,3 Tmax,−15,10)` °C; `Tbase=45` za ext≥10, `56` za ext≤−15, inače `51−0,3 ext`; `final=clamp(base+(offset+factor)×insulation,46,55)` °C. | Diskontinuitet i zasićenje; ponder nije dokazana fizikalna veličina. Kandidat: kontinuirana ekvitermna krivulja s lokacijskim projektnim uslovima i ogrjevnim tijelima, isključivo u shadowu. |
| Površina/visina `profile.strategy.ts:23-27` | `max(0,150−area)×0,02`; `(height−230)×0,02`; empirijski doprinos °C. `area` DTO 10–2000; visina DTO 1,8–5 naspram engine cm. | Površina sama ne određuje potrebnu polaznicu; ne uskladiti jedinice bez odluke i regresija. Model toplotnih gubitaka po m², K i izvorima podataka, bez tvrdnje da je precizan bez kalibracije. |
| Prozori/grijanje/izolacija `profile.strategy.ts:29-68` | Prozor triple −1, double 0, single +2; underfloor −2, ostalo 0; faktor izolacije 0,8/0,85/0,9/0,95 ili 1, ograničen 0,7–1, množi i negativne doprinose i naučeni offset. | Kategorizacija i fiksni koeficijenti nisu potvrđeni. Potrebna validacija stvarnog sistema, odvojena korekcija opterećenja od naučenog offseta i hard granica. |
| Profil `profile.strategy.ts:10-20,71-72` | home = offset × confidence × 0,8; rezultat confidence = confidence × 0,8. Deklarisani tip navodi 0–1 (`types.ts:19-20`), sam motor ne provodi clamp confidence. | Kalibrisati pouzdanost, validirati finite/range i držati je odvojeno od fizičkih jedinica. |
| FULL interval `full.strategy.ts:7-25,53-55` | home=offset×home confidence; interval=`offset+0,5×avgOvershoot+0,2×clamp((30−avgReachMin)×0,05,−1,1)`; morning ×0,6; rezultat confidence=home confidence. | Predznak može biti suprotan željenoj povratnoj vezi; interval confidence i samples nisu korišteni u `calculateOffsets`. Validirati znak, prag uzoraka, variance, max korak i ograničenja po komponenti. |
| FULL događaji `full.strategy.ts:28-36`; ulaz `boiler.service.ts:153-169` | Σ `delta×(active?0,15:0,05)×exp(−0,25×index)`, morning ×0,5; delta=cilj−trenutno °C. | Zavisi od redoslijeda, ne stvarne starosti; string `includes` hvata i `late_morning`. Kandidat: typed interval i vremenski decay s vremenskom zonom i zaštitom od stale senzora. |
| Učenje `heating.recommendation.service.ts:37-85` | overshoot=current−target °C; reach=(end−start)/60000 min; aritmetički novi prosjek i offset iz prethodnih N uzoraka; confidence=`min(1,(oldConfidence×N+0,1)/(N+1))`. | Offset ponovo koristi isti overshoot; confidence sa 0,1 ostaje 0,1 umjesto rasta s N. Prosjek bez transakcijske zaštite može izgubiti konkurentne update-e; novi interval koristi `id:0`. Kandidat bounded EWMA/RLS, varijansa i minimum uzoraka, idempotentne transakcije. |
| Dnevni posao `daily.recommendation.service.ts:38-80,125-142` | Prvi profil, fiksni interval `morning`, bez eventa; FULL kada learning postoji ali predaje samo `offset` i `confidence`; null weather min/max postaje 0. | Različite ulazne putanje daju različitu preporuku; izostanak podataka ne smije biti 0 °C. Aktivni profil, svježina i jedinstvena input-fabrika. |
| Sezonalnost `boiler.service.ts:103-115,203-210` | SUMMER vraća off; AUTO ako `(min+max)/2 > 16` vraća off. | Prag bez histereze; nisu svi potrošači motora na istoj putanji. Analizirati uslove i antifrost sigurnost, dodati verificirane prelaze/histerezu pod stručnim nadzorom. |
| Anomalije `heating.anomayl.checker.service.ts:110-151`; `common/anomaly-detection.service.ts:62-129,170-194` | μ=Σ trajanja/N, σ=√(Σ(d−μ)²/N); minimalno 3 historije; prag μ±2σ, dodatni >120 min i <5 min zavisno od OPEN/CLOSED; postoje dvije različite confidence logike. | Teška repna distribucija, mali N, self-inclusion i vremenski kontekst mogu iskriviti statistiku; odvojiti detekciju i kalibraciju te testirati σ=0 i otvorene cikluse. |
| Reporting `common/reporting.service.ts:230-247,315-379` | dnevno `100−min(30,5×anomalije/h)−min(20,3×fallback/h)−min(15,0,5×timeouts)−min(10,2×trips)`, clamp 0–100; sedmično prosjek dnevnih. | Za nenegativne metrike suma kazni je najviše 75 pa trenutni dnevni score ne može pasti ispod 25; prazni sedmični izvještaj vraća 100 i može izgledati zdravo bez podataka. Označiti dostupnost i denominatore, ne tretirati heuristiku kao sigurnosnu dijagnozu. |
| Dashboard `backend/src/modules/Dashboard/dashboard.service.ts:299-318,331-375,475-503` | trajanje = Σ zatvorenih trajanja / broj svih događaja, uključujući otvorene; temperature = aritmetički prosjek; trend confidence = prosjek trenutnih intervalnih redova po datumu zadnjeg updatea. | Otvoreni ciklus snižava prosječno trajanje; satni bucket je samo sat bez datuma i koristi server zonu; trend nije historija uzoraka. Koristiti broj zatvorenih, zonu korisnika i stvarnu vremensku seriju. Pregledani DashboardService nema vlastitu formulu health score-a; ne treba je izmišljati. |
| Gas `backend/src/modules/Gas/gas.reading.service.ts:44-65,416-475,492-529,642-647` | Potrošnja = razlika uzastopnih brojila, negativni intervali se preskaču; ukupni sati iz punih zatvorenih boiler intervala; prosjek polaznice = Σ(duration×temp)/Σduration; m³/h = gas/h; cijena = potrošnja intervala × cijena na završnom datumu, PDV = zbir×0,17. | Očitavanja izvan granice nisu interpolirana, ciklusi koji presijecaju granice se isključuju, 0 može značiti nema podataka, promjena cijene unutar intervala pripisuje se cijeni na kraju; m³/h nije fizički dokaz efikasnosti kotla. Očitanja i cijene `Float` traže decimalnu računsku politiku. |

**Opseg pretrage:** pregledana gas analiza ne računa medijan ili standardnu devijaciju; oni se ne smiju pripisati Gas modulu samo zato što su navedeni u početnom promptu. Devijacija je potvrđena u anomaly checkeru. Za kompletnost potrebno je pregledati i ostale pomoćne formule/putanje te povezati svaku sa stvarnim testovima.

## Početni nalazi i preporučene provjere

### [F-001] Skok krivulje na 10 °C — Ozbiljnost: VISOKO — Pouzdanost: VERIFIKOVANO
- Gdje: `backend/src/modules/Heating/strategies/base.strategy.ts:7-39`.
- Šta nije u redu i zašto: granica prelazi s približno 48 na 46 °C u anonimnom slučaju, iako je ulaz promijenjen za 0,001 °C. Nije dokazano da se preporuka automatski primjenjuje.
- Dokaz: gornja tabela i `node scripts/audit/formula_table.cjs`.
- Preporuka: istražiti kontinuiranu krivulju i histerezu, pod hard limitima konkretnog sistema, isključivo u shadowu prije odluke.
- Kako provjeriti: golden test na granici s epsilonima, property test kontinuiteta i monotonosti izvan saturacije, test svih ulaza/clampova; `cd backend && npm test -- --runInBand`.
- Trud: M — Zavisnosti: validacija inženjera grijanja, per-model granice, weather kvaliteta.

### [F-002] Neslaganje jedinica visine — Ozbiljnost: VISOKO potencijalno — Pouzdanost: VERIFIKOVANO (izvor/sintetički ulaz), HIPOTEZA (efekat u aktuelnom radu)
- Gdje: `backend/src/modules/HomeProfile/dto/create-home-profile.dto.ts:32-35`, `backend/src/modules/Heating/engine/types.ts:12-15`, `backend/src/modules/Heating/strategies/profile.strategy.ts:23-27`; proizvođači inputa `backend/src/modules/Boiler/boiler.service.ts:93-100`, `backend/src/modules/Schedule/daily.recommendation.service.ts:53-60`, `backend/src/modules/HeatingRecommendation/heating.recommendation.service.ts:107-114`.
- Šta nije u redu i zašto: DTO raspon odgovara metrima, strategija očekuje cm; sintetički direktni 2,5 izaziva veliki negativni faktor. Trenutno tri pregledana poziva ne prosljeđuju visinu i zato nije potvrđeno da se ova pogreška javlja kod njih.
- Dokaz: offline tabela 2,5→46,45 naspram 250→51,4 pri istom ostalom ulazu. Mjerenja nisu stvarne kuće.
- Preporuka: eksplicitni kanonski unit u tipu/shemu, provjeriti postojeće DB vrijednosti i staru mobile kompatibilnost; migracija/conversion samo nakon potvrde distribucije i backupa.
- Kako provjeriti: test m/cm i DB fixture starih vrijednosti, invalid ranges, test svih call siteova i shadow poređenje; `cd backend && npm test -- --runInBand`.
- Trud: M — Zavisnosti: podaci, DTO/klijenti, eventualna migracija.

### [F-003] Učenje ne kreira nedostajući interval — Ozbiljnost: SREDNJE — Pouzdanost: VERIFIKOVANO (kod)
- Gdje: `backend/src/modules/HeatingRecommendation/heating.recommendation.service.ts:46-85,163-180`.
- Šta nije u redu i zašto: fallback je memorijski objekt ID 0, a update koristi `updateMany` bez kreiranja. Ako takav red ne postoji, prvi uzorak nije upisan; konkurentni uzorci mogu prepisati jedni druge.
- Dokaz: `id: 0` i `updateMany({ where: { id: intervalLearning.id }... })`; broj zahvaćenih redova se ne provjerava. Realni sadržaj produkcije nije provjeren.
- Preporuka: transakcijski upsert po jedinstvenom `(homeProfileId,intervalKey)`, optimistička ili redna kontrola konkurentnosti i idempotentnost po događaju; računati s posljednjim potvrđenim vrijednostima.
- Kako provjeriti: u izolovanom PostgreSQL testu prvi završeni event kreira red, ponovljeni event se ne broji dva puta, dva konkurentna ne gube uzorke, izvršava se `cd backend && npm run test:integration`.
- Trud: M — Zavisnosti: semantika samplea, migracija idempotency ključa, kontrola historije.

### [F-004] Heuristički score bez podataka može izgledati savršen — Ozbiljnost: SREDNJE — Pouzdanost: VERIFIKOVANO
- Gdje: `backend/src/common/reporting.service.ts:230-247,315-325,337-379`, `backend/src/modules/Dashboard/dashboard.service.ts:299-309`.
- Šta nije u redu i zašto: prazan sedmični izvještaj vraća 100, dok dashboard u broj ciklusa ubraja i nezavršene u nazivnik. Score nije validirana fizička sigurnosna mjera.
- Dokaz: direktne formule i uslov prazne liste u navedenom izvoru.
- Preporuka: vratiti kvalitet podataka i `null/insufficient_data` za nepoznato; precizno definisati zatvoreni ciklus i metrike.
- Kako provjeriti: 0 događaja, jedan zatvoren + jedan otvoren, negativna trajanja i različite vremenske zone; `cd backend && npm test -- --runInBand`.
- Trud: M — Zavisnosti: API/klijentska kompatibilnost i definicija metrike.

## Kandidat budućeg modela i sigurnosna ograničenja

Kandidat, ne kalibrisana formula: kontinuirana ekvitermna krivulja `Tflow = Troom + (TdesignFlow − Troom) × clamp((Troom − Tout)/(Troom − TdesignOutside),0,1)^p`, s parametrima za lokaciju i tip emitera uz verifikaciju stručnjaka. Ovo je pojednostavljena hipoteza, ne universalni termodinamički model; projektnu vanjsku temperaturu, temperaturu dizajna, exponent, granice i hidrauličke uslove mora potvrditi ovlašteni stručnjak za svaku konfiguraciju. Bez validiranog profila nema automatske primjene. Posebna nezavisna zaštita kotla/ogrjevnog sistema, proizvođačka ograničenja, zaštita podnog kruga, histereza i limit brzine promjene imaju prednost nad preporukom. Trenutni UI unos 48–55 (`backend/src/modules/Boiler/dto/set-current-temp.dto.ts:9-15`) nije dokaz sigurnog raspona svih kotlova niti usklađen s engine clampom 46–55.

Učenje: kalibrisani bounded EWMA ili RLS kandidat uz minimalni broj reprezentativnih uzoraka, procjenu varijanse i pouzdanosti, isključenje anomalnih/senzorski nevaljanih događaja, bounded korekciju i zabranu učenja iz neidentifikovane lokacije. Učinak predznaka testirati nad definisanim `overshoot` i ciljem grijanja prije usvajanja. Potrošnju normalizovati stepen-danima `Σ max(0,Tbase−Tavg,d)` uz dogovorenu baznu temperaturu i lokalni datum; odvojiti potrošnju sanitarne vode i promjene ponašanja. Stepen-dani sami ne dokazuju uštedu.

## Osjetljivost, backtest i shadow plan

- Izvršena lokalna osjetljivost obuhvata dvije granice, ponder, tri površine, dvije visine, confidence/offset, dvije brzine i jutarnji string (tabela iznad). Za punu analizu treba sistematska mreža unutar validiranih granica po tipu sistema, promjena jednog ulaza, multi-parameter interakcije, clamp saturation i finite/NaN/fallback provjere; rezultati ne smiju biti upravljačke preporuke.
- `scripts/audit/backtest_sketch.py --demo` demonstrira poravnanje `HeatingEvent` → `ThermostatDevice.userId` → najbliži prethodni `BoilerHistory` unutar 60 min s unaprijed dostavljenim sintetičkim predikcijama. Ispis je samo agregat (broj, mean delta i mean absolute delta), ne eksportuje identifikatore. To **nije puni backtest**: asocijacija po korisniku nije eksplicitna relacija i može povezati pogrešan uređaj/profil ili ponavljati historiju. Bez event ID-a u historiji i input snapshot-a nema pouzdanog vraćanja tada dostupnih podataka niti izbora bez look-ahead pristranosti.
- Za puni harness: odobren, deidentificiran i verzioniran snapshot `HeatingEvent`, `BoilerHistory`, lokacije/weather forecast-a dostupnog *prije* događaja, uređaja, learning stanja i gas očitanja; deterministički replay postojećeg i kandidatskog motora samo s tada dostupnim podacima, dokumentovanje nedostajućih/nepovezanih slučajeva i fixture/seed scenarija. Vremenski split po domaćinstvu i sezoni, out-of-sample, bez curenja budućih podataka; prikazati intervale pouzdanosti, broj uzoraka, bias i različite stratifikacije. Ne prenositi podatke iz produkcije bez pristanka i plana privatnosti.
- Golden-file i property testovi: granice ±epsilon, monotonost i kontinuitet za definisane domene, temperaturne i per-model hard limite, timezone/DST, nula naspram null, `NaN`/Infinity, validnu konverziju jedinica, redoslijed događaja i vremenski decay, offset sign, minimalni samples, jedinstvenost i idempotentnost. Testirati seed fixture kao *primjer*, ne kao dokaz performansi u stvarnim kućama.
- Shadow u zasebnom feature flagu: računati oboje bez komandi i bez promjene preporuke prikazane korisniku; logovati agregatne razlike i kvalitet ulaza bez tajni/identifikatora. Metrike: greška prema historijskoj preporuci nije ušteda; pratiti vrijeme dostizanja cilja, overshoot, vrijeme izvan komfora, učestalost ciklusa, stale ulaze i gas/m³ po stepen-danu uz jasno porijeklo i ograničenja. Prije bilo kakvog prebacivanja trebaju se definisati pragovi prihvatanja, nezavisna sigurnosna revizija, stručna validacija i plan canary/rollbacka.
- Rollback: ugasiti flag za kandidat i ostati na prethodnoj verziji prikaza bez slanja komandi; zadržati razdvojene shadow podatke i novu shemu tokom prozora povrata. Potpuno brisanje ili migracija historije nije automatski rollback. Fizičke zaštite ne zavise od aplikacije.

### Uticaj validacije gas ulaza na matematičke rezultate

**VERIFIKOVANO (izolovano):** ulazni `counterValue` u stvarnom `ValidationPipe` prihvata prazni string kao 0 i negativan broj; servis s lažnom DB bez prethodnog očitanja prosljeđuje negativnu vrijednost u create (B-016). Za sintetičke zapise s kasnijim stanjem 200 i ranijim 100 servis odbija historijski unos (B-017), iako sam numerički niz raste s vremenom. Boolean reference string `false` postaje `true` (B-015), pa se može promijeniti izbor intervala koji analiza koristi ako klijent šalje takav ulaz. Ove reprodukcije nisu HTTP, stvarna baza ni dokaz prisutnosti pogrešnih produkcijskih očitanja. Paralelni dnevni duplikat je hipoteza na osnovu neatomskog koda i sheme (B-018). Golden/backtest dataset mora uključiti kvalitet i porijeklo očitanja, ne pretpostaviti da su svi ulazi korektni; pravila resetovanja/korekcije brojila treba potvrditi s vlasnikom domene.

### Dashboard vremensko grupisanje

**VERIFIKOVANO (servis/fake DB):** za satnu agregaciju `getHeatingSummary` i `getHeatingStats` koriste samo `HH:00`, pa isti sat dva dana postaje jedna grupa. To je ispravno samo ako je poslovni cilj profil po satu dana; za vremensku seriju treba datum/zonu/offset, uključujući ponovljeni DST sat. Summary dnevni bucket koristi server-local datum, stats UTC datum (`Dashboard/dashboard.service.ts:331-340,436-441`), pa razlika zavisi od server timezone i graničnih podataka. `node scripts/audit/dashboard_repro.cjs` reprodukuje spajanje u UTC, ali ne dokazuje DST efekt ili produkcijski prikaz. Vidi B-020 za test i dogovor ugovora.

### Izvršni replay postojećeg enginea — ograničeni sintetički korak

`node scripts/audit/engine_replay.cjs --demo` izvršava stvarni `FlowTemperatureEngine` nad tri sintetička, unaprijed poravnata snapshota. Dva su prihvaćena, jedan s vremenom dostupnosti prognoze nakon događaja odbačen; razlike prema sintetičkoj historijskoj preporuci imaju srednju 0 °C, srednju apsolutnu 1 °C i maksimalnu apsolutnu 1 °C. To nisu mjerenja sistema ni rezultati nove formule. `--input <putanja>` prihvata JSON s `snapshots` poljem; svaki element treba `eventAt`, `weatherAvailableAt`, `profileAvailableAt`, `baselineAvailableAt` kao ISO timestamps sa zonom, `recordedFlowTemp` broj i stvarni `engineInput` (`mode`, `weather.tempMin/tempMax`, `homeProfile.floorArea` te opcionalna engine polja); uz `intervalLearning` traži se `learningAvailableAt`, uz `recentEvents` i `eventsAvailableAt`. Za ove timestampove nakon događaja red se odbacuje, a nedostajuće/nevalidne ulaze broji bez ispisa identifikatora ili podataka. Dodatni sintetički test preko `--input` potvrdio je 1 validan, 1 future-rejected i 2 invalid (odsutna vremenska zona i nedostajući event provenance).

**Ograničenje:** provjera poredi vremenske oznake koje daje izvor; ne dokazuje da su `HeatingEvent`, `BoilerHistory`, profil, weather i learning zaista tačno povezani ili da su njihove historijske vrijednosti stvarno bile raspoložive. Script ne pristupa bazi, ne stvara snapshot, ne evaluira novi kandidat, komfor, potrošnju, uštedu, confidence interval ni split. Postojeća seed skripta je destruktivna (B-021) i nije pokrenuta; ne koristiti produkcijske podatke bez odobrenja i zaštite privatnosti. Puni, kauzalno oprezan backtest, seed safety i pravi provider fixture ostaju otvoreni.
