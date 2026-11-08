# 20 — P0: dnevni zapis i jedan pisac u 06:00

**Status:** realizacija. Prvi korak iz `17` §13.
**Datum:** 2026-11-08. **Grana:** `arena/da41e5ba-boiler-control`.
**Ulazi:** `17` §5.2 (polja), §13 (redoslijed), `18` §0 (dogovor o unosu), `19` (odluke).

---

## 0. Šta je napravljeno

| Fajl | Šta je |
|---|---|
| `backend/prisma/schema.prisma` | model `DailyRecord`, enum `FlowSetSource`, relacije na `User` i `HomeProfile` |
| `backend/prisma/migrations/20261108100000_daily_record/migration.sql` | aditivna migracija (tabela + tip + indeksi + FK). Nijedan postojeći red se ne dira; rollback je u zaglavlju |
| `backend/src/modules/DailyRecord/proposal-schedule.ts` | čiste funkcije: lokalni dan, prag 06:00, prozor do 12:00, zona kuće, grijna granica, interval ključ |
| `backend/src/modules/DailyRecord/daily-record.due.ts` | koja kuća je u ovom trenutku "dužna" (filter, ne pisac) |
| `backend/src/modules/DailyRecord/daily-record.writer.ts` | **jedini** pisac `DailyRecord` redova |
| `backend/src/modules/DailyRecord/daily-record.module.ts` | modul; izvozi samo pisca |
| `backend/src/modules/Schedule/daily.recommendation.service.ts` | cron prepisan: kuca svakih 5 min i pita svaku kuću koliko je sati kod nje |
| `backend/src/modules/Dashboard/analytics-export.ts` | `localParts` izvezen (dodat `minute`) — ista funkcija računa dan i za izvoz i za zapis |
| testovi | `DailyRecord/tests/proposal-schedule.spec.ts`, `DailyRecord/tests/daily-record-writer.spec.ts`, `Schedule/tests/daily-recommendation-fanout.spec.ts` |

---

## 1. Pravilo: jedan pisac, bez `update`

`DailyRecordWriter` ima samo `create`, nikad `update`. Drugi pokušaj istog dana
pada na `@@unique([homeProfileId, localDate])`, hvata se `P2002` i vraća se
`exists` — to nije greška nego dokaz da je prvi upis bio jedini.

Zašto tako, a ne `upsert`: `upsert` bi tiho prepisao predlog koji je korisnik
već vidio. Historija bi izgledala uredno, a ne bi bila istinita. Ovo je jedina
zaštita koja radi i kad u istoj sekundi kucnu dva procesa.

Red i `Recommendation` (koji klijenti čitaju) nastaju u **istoj transakciji**:
ako drugo padne, prvo se poništava. Nikad zapis bez reda koji prikazuje, ni red
bez zapisa.

## 2. Red nastaje i kada predloga nema

To je razlika koju ranije nije bilo moguće napraviti:

| Stanje | Kako izgleda u bazi |
|---|---|
| Predlog donesen | red, `proposedFlowTemp`, `proposedAt`, `params` |
| Procijenjeno, namjerno bez predloga | red, `proposedFlowTemp = null`, `skipReason` |
| Sistem nije radio (server ugašen, kuća neaktivna) | **reda nema** |

`skipReason` ima četiri vrijednosti: `OUT_OF_SEASON`, `MISSED_WINDOW`,
`NO_WEATHER`, `NOT_ACTIVE`. Bez ovoga bi učenje (korak 3) moralo pogađati je li
praznina odluka ili kvar.

## 3. Cron: zašto više nije `0 0 * * *`

`sintaksa` `0 0 * * *` je **ponoć UTC**, ne 06:00 — i to je bio stvarni sadržaj
današnjeg koda, iako komentar kaže "svaki dan u 6:00". Uz to nema `timeZone`, pa
u kontejneru na UTC-u predlog za BiH nastaje u 07:00/08:00, a `localDate` bi bio
od jučer.

Jedan globalni cron ne može pogoditi lokalno jutro za više zona. Zato posao
kuca **svakih pet minuta** (`*/5 * * * *`) i za svaku kuću pita: je li lokalno
≥ 06:00 i postoji li zapis za `localDate` te zone? Ako ne — piše.

Tri posljedice, sve namjerne:

1. predlog stiže u **06:00–06:05 lokalno**, u svakoj zoni;
2. server ugašen u 06:00 **nadoknađuje se isti dan**, pri prvom narednom
   kucanju — do 12:00;
3. propušten cijeli dan se **ne izmišlja naknadno**. Prognoza na osnovu koje bi
   predlog nastao više ne postoji; zapis bi tvrdio odluku koja nije donesena.
   Zato nadoknada ne postoji, i to je jedina poštena opcija.

Cijena: 288 upita dnevno po tabeli kuća. Za hiljadu kuća to je mjerljivo ništa,
a prefilter (`selectDueHomes` pa jedan `findMany` za zapise) drži da u bazu
ode jedan upit po kucanju, ne po kući.

## 4. Četiri odluke koje su morale pasti u kodu

| Pitanje | Odluka | Zašto |
|---|---|---|
| Do kada se predlog još piše? | **do 12:00 lokalno** | predlog upravlja cijelim danom; prihvata se samo dok je veći dio dana pred nama. Poslije podneva dan ide u `MISSED_WINDOW` |
| Šta `AUTO` znači? | grije ako je **(min+max)/2 < 15 °C** | 15 °C je uobičajena grijna granica; nije zakon, pa je imenovana konstanta `AUTO_SEASON_LIMIT_C` na jednom mjestu |
| Koja zona? | **kuća → korisnik → `Europe/Sarajevo`** | bojler stoji u kući, ne tamo gdje je telefon. Numerički offset (`+02:00`) se odbija: nema ljetno vrijeme, pa bi zimi sat bio pogrešan pola godine |
| Nema prognoze? | `NO_WEATHER`, **bez predloga** | ranije se nedostatak tiho pretvarao u `0 °C` i davao predlog za vrijeme koje nije izmjereno |

## 5. Šta P0 **ne** radi

Mjerna polja (`nightMinC`, `cycles`, `medianCycleMin`, `dutyPercent`,
`overshootC`, `comfortOk`, `undershootC`, `gasM3`, `degreeDays`) postoje u šemi
i ostaju `null`. To nije propust: njih pune koraci 2 i 7 (`ThermostatObservation`
pa mjerenje ishoda). Do tada zapis nosi **odluku** (šta je predloženo i zašto),
ne **ishod**.

Takođe nije u P0: `ThermostatObservation`, `HomeModel`, noćni minimum,
kontroler. Raspon i dalje ostaje 30–55, a motor se ne dira.

## 6. Ograničenja koja ostaju i moraju se znati

1. **`flowSetC` je po korisniku, ne po kući.** `User.currentBoilerFlowTemp`
   postoji od ranije; dva doma dijele istu vrijednost. Zato je
   `flowSetSource` uvijek `USER` ili `UNKNOWN`, nikad `CARRIED`. Rješava se
   `FlowSetEvent`-om (`18` §0.2) — to je sljedeći korak, ne ovaj.
2. **`Recommendation` i `DailyRecord` nose isti predlog.** Prvi zato što ga
   klijenti čitaju, drugi zato što je zapis. Pišu se zajedno; `Recommendation`
   se ukida tek kad klijenti pređu na dnevni zapis.
3. **Deduplikacija obavijesti je po UTC danu**, ne po lokalnom. To je samo
   zaštita od dvostruke obavijesti; poslovna logika ne visi o tome.

## 7. Šta je provjereno, a šta nije

**Provjereno izvršavanjem:**

```
npx jest src/modules/DailyRecord                          → 34 testa prolaze
npx jest src/modules/Schedule/tests/daily-recommendation-fanout.spec.ts → 6 prolazi
npx jest src/modules/Dashboard/tests/analytics-export.spec.ts           → prolazi
```

Pokriveno testom: lomljenje dana po lokalnom vremenu (uključujući oba DST
prelaza i zonu sa pomakom od 45 minuta), prag 06:00 i prozor do 12:00, odbijanje
numeričkog offseta, redoslijed izvora zone, izbor aktivne kuće, `AUTO` granica,
idempotentnost preko `P2002`, i sve četiri `skipReason` grane.

**Nije provjereno i ne tvrdim da jeste:**

- `prisma validate` i `prisma generate` ne rade u ovom okruženju
  (`binaries.prisma.sh` nije dostupan), pa **šema nije mašinski provjerena** —
  pregledana je ručno, polje po polje, protiv migracije.
- `tsc` nije dostupan; tipovi su provjereni samo kroz `ts-jest` na fajlovima
  koje testovi učitavaju (`proposal-schedule`, `analytics-export`) i čitanjem
  za `daily-record.writer` i servis.
- Nijedan upit nije izvršen nad pravom bazom. Migracija nije primijenjena.
- `src/generated/prisma` ne postoji (`prisma generate` ne može dohvatiti
  engine), pa je za izvršavanje testova korišten privremeni stub. Stub je u
  `.gitignore`, **nije u ovom commitu** i vraćen je ručno u sandboxu; u CI-ju ga
  nikad nema, jer `npm run generate:prisma` daje pravi klijent.

Zato: prije nego ovo ode na ijedan bojler, obavezno `npm run generate:prisma`
pa `npx prisma migrate deploy` na praznu bazu i jedan dan u shadow režimu.

## 8. Sljedeći korak

`ThermostatObservation` (korak 2): serija svakih 5 minuta iz već postojećeg
pollinga od 60 s. Bez nje koraci 3–6 ne mogu početi, jer `a` i `b` nemaju iz
čega nastati.
