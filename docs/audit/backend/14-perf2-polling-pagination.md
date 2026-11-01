# PERF-2 — Bounded thermostat polling (#39)

Status: **implementirano i CI-verificirano**. Ovaj korak ograničava polling
listing uređaja; ne uvodi worker queue, ne mijenja HTTP API i ne dodaje
produkcijske tvrdnje o p95 bez stvarnog mjerenja.

## Obim i odluke

- Vlasnik je izabrao **`default_on`** rollout: novi polling put je aktivan
  nakon deploya, a rollback je `POLL_PAGINATION_ENABLED=off`.
- Stari `pollAll()` je učitavao sve uređaje odjednom i include-ovao
  `user`, `homeProfile` i `intervalLearnings`, iako `pollDevice()` ta polja
  ne koristi. Novi put učitava samo potrebna polja.
- Listing je **keyset** po stabilnom primarnom ključu:
  `where: { id: { gt: cursor } }`, `orderBy: { id: 'asc' }, take: batchSize`.
  Nema `skip`/offset paginacije.
- Svaki uređaj se u jednom ciklusu obrađuje najviše jednom. Novi uređaji s
  većim `id` mogu ući u tekući ciklus; obrisani uređaji se prirodno preskoče.
- Adaptive skip, snapshot guard, state machine grijanja i izolacija grešaka
  po uređaju ostaju nepromijenjeni.
- Nema DB migracije, nema compose izmjena, nema promjene OpenAPI ugovora.
  PERF-1 kompozitni indeksi su svjesno odgođeni dok se ne izmjeri
  `EXPLAIN (ANALYZE, BUFFERS)` na reprezentativnom datasetu.

## Zastavice

```env
POLL_PAGINATION_ENABLED=on
POLL_BATCH_SIZE=100
```

- `POLL_PAGINATION_ENABLED`: strogo `on`/`off`. Zadano **on**. Neispravna
  vrijednost ne gasi zaštitu nego koristi `on` i bilježi warning.
- `POLL_BATCH_SIZE`: cijeli broj **1..500**, zadano **100**. Neispravna
  vrijednost koristi default i bilježi warning.
- Rollback: postaviti `POLL_PAGINATION_ENABLED=off`. Tada se vraća legacy
  `findMany({ include: { user: true, homeProfile: { include: { intervalLearnings: true } } } })`.

## Selektovana polja

`POLL_DEVICE_SELECT` sadrži samo:

- `id`
- `userId`
- `deviceId`
- `roomCurrentTemp`
- `roomTargetTemp`
- `lastSnapshotAt`

Relacije `user`, `homeProfile` i `intervalLearnings` se ne učitavaju u
paginiranu listu. Podaci potrebni za preporuku/polaznu temperaturu i dalje se
dobavljaju postojećim putanjama po korisniku/uređaju.

## Metrike i greške

- `poll_runs_total` se incrementira na početku ciklusa.
- `poll_devices_*` brojači se ispisuju jednom, nakon stvarno obrađenih
  uređaja. Ako je listing pukao prije prvog uređaja, device brojači ostaju
  nula kao i prije.
- Ako listing pukne **usred** ciklusa, već obrađeni uređaji se iskreno
  zabilježe, ali se ciklus označava sa `poll_runs_failed`, ne sa uspjehom.
- `poll_runs_success` i dalje znači „listing/ciklus završio bez greške“, ne
  „svi uređaji uspješno obrađeni“. Za stvarnu uspješnost obrade gledati
  `poll_devices_*`.
- `poll_last_success_timestamp_seconds` se pomjera samo ako je barem jedan
  uređaj stvarno uspješno obrađen.

## Testovi i skripte

- `backend/src/modules/ThermostatPoll/tests/polling-pagination.spec.ts` —
  default-on, strogo on/off, neispravne vrijednosti, batch default/hard cap.
- `backend/src/modules/ThermostatPoll/tests/thermostat-polling-pagination.spec.ts`
  — keyset cursor, prazna lista, tačno djeljiv batch, legacy rollback,
  izolacija greške uređaja, partial listing failure i metrike.
- `backend/test/integration/thermostat-polling-pagination.integration.spec.ts`
  — izolovani PostgreSQL, 500 sintetičkih uređaja, svaki tačno jednom,
  bounded listing query count i provjera `select`/`take`/`orderBy`.
- `node scripts/audit/poll_pagination_repro.cjs` — lokalni fake-DB repro bez
  vanjskih servisa; postoji i u CI koraku `PERF-2 bounded polling regression`.
- `python3 scripts/audit/poll_pagination_mutations.py` — anchored mutation
  provjera; svaki anchor mora biti jedinstven i svaka mutacija mora pasti.

Lokalno: ciljni Jest **21/21**, repro **PASS**, mutacije **8/8 killed**,
ESLint **0 grešaka / 2 pre-existing warninga**. Potpuni lokalni `tsc` nije
mjerodavan bez generisanog Prisma klijenta; CI type-check je autoritativan.

## CI ishod

- Prvi run **`41255715186`** na `763df53` pao je samo zbog integration
  fixturea: `User` nema `firstName`/`lastName`, nego `name`. Ispravljeno u
  **`1b1330e`**.
- Run **`41256176723`** na **`1b1330e`**: backend **success**, mobile
  **success**. Backend: ESLint 0, tsc 0, build, OpenAPI sync, PERF-2 repro,
  **42 suite / 529 testova** i **4 integration suite / 53 testa**.
- Frontend je crven samo na pre-existing `Deploy config consistent (FE2-7)`:
  `traefik loadbalancer port mora biti 80, bilo undefined`. Compose i checker
  nisu mijenjani.

## Kompatibilnost i otvoreno

Instalirani mobile i frontend ne zovu polling direktno i ne vide promjenu
HTTP ugovora. Nema novog mobilnog builda potrebnog za ovaj korak.

Ostaje otvoreno: produkcijski p95/memorijski benchmark, PERF-1 indeksi nakon
mjerenja, te REL-2 preklapanje cron ciklusa / više replika. Ovaj korak ne
tvrdi da je riješio exactly-once obradu između procesa.
