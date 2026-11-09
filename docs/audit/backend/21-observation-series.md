# 21 — P1: vremenska serija (`ThermostatObservation`)

**Status:** realizacija. Drugi korak iz `17` §13.
**Datum:** 2026-11-09. **Grana:** `arena/da41e5ba-boiler-control`.
**Ulazi:** `17` §5.1 (polja), §6 (zašto serija), `19` §4 (retencija), `20` (P0).

---

## 0. Šta je napravljeno

| Fajl | Šta je |
|---|---|
| `prisma/schema.prisma` | model `ThermostatObservation`, enum `ObservationSource`, relacija na `ThermostatDevice` |
| `prisma/migrations/20261109100000_thermostat_observation/migration.sql` | aditivna migracija; serija počinje od prvog ciklusa poslije primjene |
| `src/modules/Observation/observation-bucket.ts` | poravnanje na pet minuta (čiste funkcije) |
| `src/modules/Observation/thermostat-observation.service.ts` | **jedini** pisac serije |
| `src/modules/Observation/observation.module.ts` | modul; izvozi samo pisca |
| `src/modules/ThermostatPoll/thermostat.polling.service.ts` | upis poslije state machine, sa stvarnim (nulabilnim) očitanjima |
| `src/modules/ThermostatPoll/polling-pagination.ts` | `POLL_DEVICE_SELECT` čita i `currentBoilerFlowTemp` |
| testovi | `Observation/tests/observation-bucket.spec.ts`, `Observation/tests/thermostat-observation.service.spec.ts`, `ThermostatPoll/tests/thermostat-polling-observation.spec.ts` |

Zašto serija uopšte postoji, najkraće: `ThermostatDevice.roomCurrentTemp` se
prepisuje svake minute i čuva **jedno** očitanje. `HeatingEvent` čuva **dva** po
ciklusu. Iz toga se `a` i `b` iz `17` §6 ne mogu izračunati — nema nagiba, nema
vremenskog prozora, nema čak ni dokaza da je soba hladila.

## 1. Pet minuta, poravnato na epohu

`at` je **početak** bucketa (06:03:47 → `06:00:00Z`), ne trenutak upisa.

Dvije posljedice, obje namjerne:

1. `@@unique([deviceId, at])` postaje prava garancija: restart procesa ili dva
   procesa ne mogu udvostručiti seriju, jer oba pišu isti `at`.
2. Serija je poravnata, pa se posljedice vide kao **praznine**, a ne kao
   neravnomjerno uzorkovanje. Praznina je podatak; neravnomjeran interval je
   zamka za svaki kasniji izračun nagiba.

Bucket je apsolutno vrijeme, pa ne zavisi od zone. Lokalni dan se izvodi kasnije,
istom funkcijom kao dnevni zapis (`20` §3).

**Mapa zadnjih bucketa** (`lastBucketByDevice`) je **optimizacija, ne
garancija.** Bez nje bi svaki minutni ciklus pokušao upis koji u 4 od 5
slučajeva pada na indeksu. Poslije restarta mapa je prazna → jedan suvišan
pokušaj → `P2002` → `exists`. Prava greška (ne `P2002`) bucket **ne** pamti,
pa naredni ciklus pokušava ponovo umjesto da pet minuta ostane prazno.

Polling pita `isDue(deviceId, now)` **prije** ijednog čitanja: u 4 od 5
ciklusa se ne upisuje ništa, pa nema smisla trošiti ni keš prognoze. To je
najava, ne odluka — odluku i dalje nosi `record()` i unique indeks.

## 2. Šta se upisuje, i šta se nikad ne izmišlja

| Polje | Izvor |
|---|---|
| `roomTempC`, `targetTempC` | očitanje adaptera; `null` ako uređaj nije poslao polje |
| `isHeating` | stanje **poslije** state machine u tom ciklusu |
| `outdoorTempC` | samo weather v2, inače `null` |
| `flowSetC` | `User.currentBoilerFlowTemp` (ograničenje iz `20` §6) |
| `source` | `TUYA` |

Tri odluke koje vrijedi imati zapisane:

1. **`?? 0` se ne koristi.** Stara logika ciklusa pretvara nedostajuću
   temperaturu u `0` da bi odlučila o grijanju; u seriju ide `null`. Isto važi
   za `NaN`/`Infinity` — postaju `null`, jer bi u bazi izgledali kao mjerenje.
2. **`isHeating` je stanje poslije prelaza.** Ako ciklus tek otvori grijanje,
   to očitanje već nosi `true`. Suprotno bi svako otvaranje ciklusa izgledalo
   kao jedan minut mirovanja.
3. **Nema legacy fallbacka za vanjsku temperaturu.** Za predlog gradski keš
   ima smisla (prognoza je ista za grad); u seriji bi keš temperatura stara
   nekoliko sati bila upisana kao „izmjerena u tom trenutku". Zato `null`.

## 3. Kada očitanja nema — i zašto je to u redu

Red se **ne** piše kada:

- je uređaj preskočen adaptivnim guardom (`skipped`) — nema svježeg očitanja;
- je snapshot nepotpun i guard je aktivan (`incomplete`) — ne znamo sobu.

To su praznine, i one su istinite. Bolje praznina nego red s nula stepeni.

**Greška u seriji ne obara polling.** Očitanje je već obrađeno; kvar serije se
bilježi kao upozorenje i ciklus ostaje uspješan. Suprotno bi značilo da kvar
pomoćne tabele gasi obradu grijanja.

## 4. Obim i retencija

| Veličina | Vrijednost |
|---|---|
| redova po uređaju dnevno | **288** (24 h / 5 min) |
| redova po uređaju godišnje | 105.120 |
| procjena po uređaju godišnje | ≈ 16 MB sa indeksima |

**Retencija iz `19` §4 još nije implementirana i to je namjerno.** Za sada se
čuva sve — to je sigurni smjer (ništa se ne gubi). Posao koji briše podatke ne
smije nastati bez baze na kojoj se može provjeriti; do tada je jedina ispravna
odluka ne brisati. Kada dođe, radi se kao zaseban korak: 24 mjeseca punih pet
minuta, pa sažimanje na 15 min, pa trajni dnevni agregati.

## 5. Šta je provjereno, a šta nije

**Provjereno izvršavanjem:**

```
npx jest src/modules/Observation src/modules/ThermostatPoll → 50 testova
cijeli suite                                               → 756 prošla;
                                                             12 padaju i padali
                                                             su prije (svih 12
                                                             traži pravi Prisma
                                                             klijent)
```

Pokriveno: poravnanje bucketa (uključujući granicu 07:09:59 → 07:05), pet
uzastopnih minuta = jedan red, neovisnost od zone, `288` dnevno; upis prvog
očitanja, preskok istog bucketa, novi bucket, `P2002` → `exists`, prava greška →
pokušaj ponovo, neovisnost uređaja; `null` ostaje `null` i za `NaN`/`Infinity`;
polling šalje stanje **poslije** prelaza u oba smjera (start i kraj), nepotpun
snapshot ostaje `null`, greška serije ne obara ciklus, uređaj bez kuće se
preskače, a ciklus izvan bucketa ne troši ni čitanje prognoze.

**Nije provjereno:**

- `prisma validate`/`generate` ne rade u sandboxu → **šema nije mašinski
  provjerena**, pregledana je ručno protiv migracije (polje po polje).
- Nijedan upit nije izvršen nad pravom bazom; migracija nije primijenjena.
- Za izvršavanje testova korišten je privremeni stub enumova u
  `src/generated/prisma` (u `.gitignore`, nije u commitu).
- Testovi za polling su rađeni sa mock prisma objektom — ne dokazuju da
  PostgreSQL prihvata upit, nego da servis šalje ispravne vrijednosti.

## 6. Sljedeći korak

`HomeModel` + identifikacija `b` iz perioda mirovanja (korak 3), pa `a` i `s` sa
intervalom pouzdanosti (korak 4). Prvi put tada serija dobija svrhu koja se može
izmjeriti: procjena nagiba mora pasti u ±0,1 nakon 20 dana (`17` §11).
