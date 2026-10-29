# Model podataka — radna verzija

## Sažetak: pet početnih nalaza

1. **VERIFIKOVANO:** Prisma shema ima 15 modela i 12 enum definicija (`backend/prisma/schema.prisma:12-369`); ovaj dokument popisuje definicije, ne potvrđuje da produkcijska baza odgovara shemi.
2. **VERIFIKOVANO:** `HeatingEvent` ima indeks samo po `deviceId`, dok polling traži posljednji događaj sortiran po `timestampStart` (`schema.prisma:115-132`, `backend/src/modules/ThermostatPoll/thermostat.polling.service.ts:82-85`). Korist složenog indeksa je **HIPOTEZA** do mjerenja plana upita.
3. **VERIFIKOVANO:** `WeatherCache` nema deklarisani indeks, a servis čita po gradu, sortira po vremenu i briše zastarjeli zapis prije poziva providera (`schema.prisma:147-172`, `backend/src/modules/Weather/weather.service.ts:23-51`). Zbog toga taj obrisani zapis nije dostupan kao fallback pri grešci.
4. **VERIFIKOVANO:** novčane cijene, stopa PDV-a i očitanje brojila koriste `Float` (`schema.prisma:28,191-195,297-303`). Rizik akumulacije grešaka zaokruživanja je **HIPOTEZA** dok se ne izmjeri obračun.
5. **VERIFIKOVANO:** obavezne relacije nemaju eksplicitni `onDelete` u Prisma shemi; u CI baseline SQL-u odgovarajući FK-ovi imaju `ON DELETE RESTRICT`, a opcionalni aktivni profil `SET NULL` (`backend/prisma/migrations/20260826000000_postgres_baseline/migration.sql:113-120,148-150`). Stvarna produkcijska FK pravila nisu provjerena.

## Otvorena pitanja

- Koja migracijska historija i koji indeksi zaista postoje u produkciji? Ručni baseline korišten u privremenom CI-ju nije dokaz produkcijske šeme; nema izvršenog schema-diffa ni introspekcije produkcije.
- Koja je ugovorena retencija, rast po korisniku/uređaju, restauracija backupa, ograničenje troška i pravni osnov čuvanja svake vrste podatka?
- Kolika je tačnost obračuna plina i zaokruživanje ulaznih računa? Za izbor `Decimal(p,s)` potrebni su primjeri, mjerne jedinice i dogovor o preciznosti.
- Koji su stvarni planovi upita i veličine indeksa? Svi predloženi indeksi moraju proći `EXPLAIN (ANALYZE, BUFFERS)` u izolovanoj bazi s reprezentativnim podacima i analizom troška upisa.

## Metod i relacije

**VERIFIKOVANO:** ovaj pregled odnosi se na deklaracije u `backend/prisma/schema.prisma`, a ne na izvedenu produkcijsku bazu. Modeli su povezani ovako: `User` → `HomeProfile` → `ThermostatDevice` → `HeatingEvent` i `ThermostatProgram`; `HomeProfile` → `HeatingIntervalLearning`; `User` → `BoilerHistory`, `GasReading`, `GasPriceHistory`, `Recommendation`, `UserDevice`, `Notification`, `NotificationPreference`. `User.activeHomeProfileId` je dodatna opcionalna jedinstvena relacija na profil. `WeatherCache` i `TuyaToken` nemaju deklarisane relacije. `GasPriceHistory.gasReadingId` je opcionalni skalar, ne Prisma relacija/FK u shemi (`schema.prisma:297-309`).

Svaki red ima oznaku za `scripts/audit/backend_inventory.py`; prisustvo markera **ne dokazuje** potpunost analize polja ni tačnost rasporeda migracija.

## Popis svih modela

Sve činjenice o poljima i indeksima su **VERIFIKOVANO u shemi** na navedenim linijama. Značenje i retencija moraju se dodatno potvrditi s vlasnikom i servisima.

| Model i dokaz | Ključna polja, relacije i indeksi | Rast / osjetljivost i otvoreno |
|---|---|---|
| <!-- schema:model:User --> `User` `schema.prisma:12-43` | PK `id`; jedinstveni `email`, `username` i `activeHomeProfileId`; role, plan, timezone, trenutna temperatura; povezani profili/uređaji/zapisi. | Lični podaci i hash lozinke; brisanje zavisi od povezanih redova. Provjeriti backup i retention politike. |
| <!-- schema:model:HomeProfile --> `HomeProfile` `schema.prisma:45-75` | `userId` indeks; profil objekta, lokacija, svojstva i vrijednosti učenja; relacija na korisnika, uređaje i intervale. | Lokacija i podaci o kući; koordinata i vremenska zona profila nisu deklarisane. |
| <!-- schema:model:ThermostatDevice --> `ThermostatDevice` `schema.prisma:77-98` | `homeProfileId` i `userId` posebno indeksirani; vanjski string `deviceId`, vendor, snapshot i režim; relacije na profil i korisnika. | FK-ovi pojedinačno ne garantuju da profil pripada istom korisniku; provjeriti servis i integritet pri kreiranju. Nema deklarisane jedinstvenosti `deviceId`. |
| <!-- schema:model:ThermostatProgram --> `ThermostatProgram` `schema.prisma:100-113` | `deviceId`, dan, početna minuta, cilj, redoslijed; unique `(deviceId, dayType, orderIndex)`. | Ograničenja domene minuta i temperature nisu deklarisana u shemi; provjeriti DTO/servis. |
| <!-- schema:model:HeatingEvent --> `HeatingEvent` `schema.prisma:115-132` | Uređaj, početak/kraj, stanje, temperature i anomalije; `@@index([deviceId])`; fizička imena temperatura preko `@map`. | Događaji mogu kontinuirano rasti; mjeriti `(deviceId,timestampStart)` i retenciju. `userConfimed` je postojeći naziv polja. |
| <!-- schema:model:Recommendation --> `Recommendation` `schema.prisma:134-145` | `userId`, datum, temperatura, očekivano vrijeme, confidence; indeks po korisniku. | Za sortiranje/filtriranje po danu procijeniti složeni indeks nakon pregleda upita. |
| <!-- schema:model:WeatherCache --> `WeatherCache` `schema.prisma:147-172` | Grad, vrijeme dohvata, temperatura i niz vremenskih polja; nema relacije ni deklarisanog dodatnog indeksa ili unique ključa. | Više redova po gradu je moguće; geolokacijska dvosmislenost i potencijalni rast. |
| <!-- schema:model:BoilerHistory --> `BoilerHistory` `schema.prisma:174-186` | `userId`, vanjska i preporučena/stvarna temperatura, interval i `createdAt`; indeks po korisniku, dva `@map`. | Raste uz događaje i sinhronizaciju; ispitati indeks `(userId,createdAt)` i agregiranu retenciju. |
| <!-- schema:model:GasReading --> `GasReading` `schema.prisma:188-208` | Korisnik, vrijeme, `counterValue`, potrošnja/cijena, putanje i metapodaci PDF/slike; unique `(userId,referenceMonth)`. | Računi i slike sadrže osjetljive podatke; uskladiti brisanje fajlova i baze. Opcionalni `referenceMonth` u PostgreSQL unique indeksu dopušta više NULL vrijednosti. |
| <!-- schema:model:HeatingIntervalLearning --> `HeatingIntervalLearning` `schema.prisma:229-242` | Profil, ključ intervala, prosjek vremena/premašaja, offset, confidence i broj uzoraka; unique `(homeProfileId,intervalKey)`. | Potrebna definicija porijekla, vremenskog raspona i pouzdanosti uzoraka. |
| <!-- schema:model:TuyaToken --> `TuyaToken` `schema.prisma:244-250` | PK, token, istek i timestamp; bez relacije na korisnika/račun. | Vrijednost tokena je tajna: ne bilježiti u logu; pregledati enkripciju, pristup i rotaciju. |
| <!-- schema:model:UserDevice --> `UserDevice` `schema.prisma:252-264` | Korisnik, platforma i jedinstveni Expo push token, `isActive`, `lastSeenAt`; indeks po korisniku. | Token je osjetljiv identifikator; provjeriti deaktivaciju i promjenu vlasništva tokena. |
| <!-- schema:model:Notification --> `Notification` `schema.prisma:266-283` | Korisnik, vrsta, naslov, poruka, JSON, vrijeme i status; unique `(userId,sourceRef)`, posebni indeksi `userId`, `type`. | Raste; retencija i paginacija potrebne. Više NULL `sourceRef` vrijednosti ne sudara se u PostgreSQL unique indeksu. |
| <!-- schema:model:NotificationPreference --> `NotificationPreference` `schema.prisma:285-295` | Korisnik, vrsta i enabled; unique `(userId,type)`. | Unaprijed odrediti zadane postavke i konkurentno kreiranje. |
| <!-- schema:model:GasPriceHistory --> `GasPriceHistory` `schema.prisma:297-310` | Korisnik, `priceExVat`, `vatRate`, vrijeme početka/kraja, izvor, opcionalni skalarni ID očitanja; indeks po korisniku. | Preklapanje perioda i tačnost obračuna nisu ograničeni u shemi; moguća potreba za `Decimal`. |

## Popis svih enum definicija

Sve su **VERIFIKOVANO** u shemi; navod upotrebe ne dokazuje da je svaka vrijednost podržana u klijentima.

| Enum i dokaz | Opseg |
|---|---|
| <!-- schema:enum:InsulationType --> `InsulationType` `schema.prisma:210-215` | STANDARD, EPS, MINERAL_WOOL, ADVANCED; sam `HomeProfile` koristi posebno definisani `HomeProfile_insulationType`. |
| <!-- schema:enum:WindowType --> `WindowType` `schema.prisma:217-221` | SINGLE_GLAZED, DOUBLE_GLAZED, TRIPLE_GLAZED; duplirane vrijednosti u `HomeProfile_windowType`. |
| <!-- schema:enum:HeatingType --> `HeatingType` `schema.prisma:223-227` | RADIATOR, UNDERFLOOR, MIXED; duplirane vrijednosti u `HomeProfile_heatingType`. |
| <!-- schema:enum:SeasonMode --> `SeasonMode` `schema.prisma:312-316` | WINTER, SUMMER, AUTO. |
| <!-- schema:enum:NotificationType --> `NotificationType` `schema.prisma:318-325` | Šest vrsta notifikacija. |
| <!-- schema:enum:ThermostatMode --> `ThermostatMode` `schema.prisma:327-331` | MANUAL, PROGRAM, OFF. |
| <!-- schema:enum:DayType --> `DayType` `schema.prisma:333-337` | WORKDAY, SATURDAY, SUNDAY. |
| <!-- schema:enum:UserRole --> `UserRole` `schema.prisma:339-343` | USER, ADMIN, SUPPORT. |
| <!-- schema:enum:UserPlan --> `UserPlan` `schema.prisma:345-349` | FREE, PRO, ENTERPRISE. |
| <!-- schema:enum:HomeProfile_insulationType --> `HomeProfile_insulationType` `schema.prisma:351-356` | Vrijednosti kao `InsulationType`; koristi se na profilu. |
| <!-- schema:enum:HomeProfile_windowType --> `HomeProfile_windowType` `schema.prisma:358-362` | Vrijednosti kao `WindowType`; koristi se na profilu. |
| <!-- schema:enum:HomeProfile_heatingType --> `HomeProfile_heatingType` `schema.prisma:364-368` | Vrijednosti kao `HeatingType`; koristi se na profilu. |

**VERIFIKOVANO:** `HomeProfile.learningConfidence` se mapira u ulazni `confidence` (`backend/src/modules/Boiler/boiler.service.ts:93-100`); `HeatingIntervalLearning.confidence` je zasebno per-interval polje (`schema.prisma:229-241`). Sama različita imena ne dokazuju redundanciju ili da ih je sigurno spojiti. Potrebno je analizirati izvore pisanja, strategije i backtest prije promjene.

## Kandidati za mjerenje indeksa i retenciju

| Hipoteza — ne primjenjivati bez mjerenja | Dokaz obrazaca | Test/odluka |
|---|---|---|
| `(deviceId, timestampStart DESC)` za `HeatingEvent` | `thermostat.polling.service.ts:82-85,205-212`, `schema.prisma:129-131`. | Benchmark posljednjeg i minutnog upita, uticaj na insert; razmotriti i druge anomaly upite. |
| `(city, fetchedAt DESC)` za `WeatherCache` | `weather.service.ts:26-29`, `schema.prisma:147-172`. | Ispitati selektivnost i concurrent refresh; ciljna koordinatna shema može promijeniti ključ. |
| `(userId, createdAt DESC)` za `Notification` i `BoilerHistory` | `notifications.service.ts:96-100`, `thermostat.polling.service.ts:225-227`. | Izmjeriti listanje, debounce i historiju; posebno razmotriti `(userId,type,createdAt)` za debounce (`notifications.service.ts:53-56`). |
| Retencija/particionisanje događaja, weather zapisa, historije i notifikacija | Modeli i datumi: `schema.prisma:115-132,147-186,266-283`. | Prvo izmjeriti rast, definisati poslovne/pravne zahtjeve i backup; testirati arhivu, restore, obračune i analitiku prije brisanja. |

## Migracije i promjene bez gubitka podataka

**VERIFIKOVANO:** u `backend/prisma/migrations/` postoji jedan baseline SQL, a `backend/prisma/migrations_backup/` sadrži 24 historijska migracijska SQL fajla. **HIPOTEZA:** backup može predstavljati raniju razvojnu historiju; bez poređenja s produkcijskom `_prisma_migrations` ne tvrditi da se može ponovo primijeniti ili obrisati. CI baseline je ručno izrađen za privremenu praznu testnu bazu; prolaz migracije ne garantuje ekvivalentnost sa stvarnom produkcijom. Prije bilo kakvog zahvata: read-only inventar stvarne sheme i migracijskog stanja uz odobrenje vlasnika, backup i probni restore, diff sheme na izolovanoj kopiji, expand/backfill/validate/contract migracija, kontrola kompatibilnosti starih klijenata i unaprijed testiran rollback. `prisma migrate reset` se ne smije pokretati nad produkcijom.

## Status

Osnovni popis modela i enuma je tu; provjera stvarne šeme, svih upita i semantike brisanja po servisima, izračuna preciznosti, realnih obima i planova upita nije provedena. Ne označavati dokument niti Fazu 1 završenim.
