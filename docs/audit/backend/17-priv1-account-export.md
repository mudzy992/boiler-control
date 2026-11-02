# PRIV-1A/B — ograničeni self-service export naloga

**Datum:** 2026-11-02
**Implementacija:** backend `5627eb0`; mobile `3fc4e1d`
**Status:** PRIV-1A backend i PRIV-1B mobile download su implementirani. Finalni code run `41442409308` na `efd20c9` ima backend success uz 56 suiteova / 608 testova i 5 integration suiteova / 60 testova, te mobile success uz 24 suitea / 136 testova. Frontend job je crven samo na vlasnikovom FE2-7 compose koraku, ne na exportu. Brisanje naloga nije implementirano, a `ACCOUNT_EXPORT_ENABLED=off` ostaje zadano stanje.

## Obim i vlasničke odluke

Odobren je samo read-only, verzioniran i ograničen JSON export podataka koji pripadaju prijavljenom korisniku. Ruta je:

```text
GET /api/auth/export
Authorization: Bearer <access-token>
```

`ACCOUNT_EXPORT_ENABLED=off` je zadano stanje. Vrijednost nije `true/false`: prihvaćaju se samo `on` i `off`, a neispravna vrijednost fail-closed znači `off`. Bez JWT-a odgovor je 401, dok je ruta uz isključen flag 404. Uspješan odgovor ima `Cache-Control: no-store` i attachment naziv `account-export-v1.json`.

Nema DB migracije, brisanja, anonimizacije, admin odabira tuđeg korisnika ni novog admin privilegija. ID vlasnika dolazi isključivo iz JWT `userId`, ne iz query ili body parametra.

## Format

Vrhu dokumenta dodati nova polja samo kroz dogovorenu verziju; ne mijenjati značenje postojeće verzije 1.

```json
{
  "format": "boiler-control.account-export",
  "version": 1,
  "generatedAt": "UTC ISO instant",
  "account": {},
  "collections": {}
}
```

`account` sadrži eksplicitno odabrana korisnička polja. `collections` ima ovih 13 stabilnih naziva:

1. `homeProfiles`
2. `heatingIntervalLearnings`
3. `thermostatDevices`
4. `thermostatPrograms`
5. `heatingEvents`
6. `recommendations`
7. `boilerHistories`
8. `gasReadings`
9. `gasPriceHistory`
10. `notifications`
11. `notificationPreferences`
12. `devices`
13. `sessions`

Programi, heating eventi i interval learning nemaju vlastiti `userId` u modelu, pa se filtriraju kroz vlasnički thermostat device odnosno home profile. Ostale kolekcije imaju direktni `where: { userId }`. Nijedan upit nije globalni `include` niti neograničeni `findMany` bez `select` i `take`.

## Redakcija i datoteke

| Podatak | Ponašanje |
|---|---|
| `User.passwordHash` | nije u `select` i nije u exportu |
| `RefreshToken.tokenHash` | nije u `select`; ostaju samo ID, vlasnik, istek, opoziv i sesijski metapodaci |
| globalni `TuyaToken` | nije vlasnička kolekcija i ne čita se |
| legacy i v2 weather cache | dijeljena keš infrastruktura, ne čita se |
| privatni storage path za sliku i račun | uklanja se iz gas reda |
| originalni upload | nije ugniježden u JSON; postojeći owner-only download ostaje zaseban |
| Expo push token | uključen kao podatak samog vlasnika |
| originalni naziv, MIME i vrijeme uploada | uključeni kao korisnički metapodaci |

Za postojeće gas privitke export daje relativne veze samo ako odgovarajući upload postoji:

```text
/api/gas/reading/:id/meter-image
/api/gas/reading/:id/invoice
```

Te rute i dalje posebno provjeravaju vlasništvo. Export ne otvara javni URL i ne kopira binaran sadržaj.

## Granice i greške

Svaka kolekcija čita najviše `limit + 1` redova. Ako dobije dodatni red, cijeli zahtjev vraća 413; ne vraća se djelimičan dokument i ne radi se tihi truncation.

| Postavka | Zadano | Dozvoljeni raspon |
|---|---:|---:|
| `ACCOUNT_EXPORT_MAX_ROWS_PER_COLLECTION` | 1000 | 1 do 10000 |
| `ACCOUNT_EXPORT_MAX_BYTES` | 5242880 | 1024 do 20971520 |

Byte granica mjeri UTF-8 serijalizirani kompletan dokument. Neispravan broj koristi siguran zadani limit i upisuje warning bez korisničkih podataka. 413 se koristi i za row i za byte prekoračenje.

## Test dokazi

Lokalna PRIV/OpenAPI komanda:

```bash
cd backend
npx jest src/modules/Auth/tests/account-export.spec.ts \
  test/account-export-openapi.spec.ts --runInBand
```

Rezultat: 2 suitea / 11 testova. Pokriveno je flag-off bez DB poziva, svih 13 kolekcija, direktni i relacijski owner filteri, redakcija, gas download metadata, row i UTF-8 byte granice, JWT `userId`, no-store, attachment i OpenAPI fragment.

Objedinjeni weather/PRIV/statički ugovorni prolaz je 10 suiteova / 84 testa. CI-ekvivalentni ESLint ima 0 errors i 2 postojeća warnings. `frontend/src/types/api.d.ts` je regenerisan iz ugovora i `npm run openapi:check` prolazi.

`test/integration/account-export.integration.spec.ts` koristi stvarni AppModule, JWT guard i PostgreSQL. Sija dva kompletna korisnička skupa, globalni Tuya token i oba weather cache zapisa s jedinstvenim markerima. Provjerava 401/404, kompletnost, dvokorisničku izolaciju, tajne i storage markere, no-store te row/byte 413. Taj rezultat se ne proglašava lokalnim jer baza ovdje nije dostupna.

**CI dokaz:** run `41432499480` na `309d95e` prijavljuje `tsc: 0`, `eslint: 0`, prolazne Build i OpenAPI sync korake, 56 suiteova / 608 testova i zasebno 5 integration suiteova / 60 testova. PRIV integration prolazi i u coverage i u integration dijelu, uključujući dvokorisničku izolaciju, redakciju i obje granice. Prethodna OpenAPI serializacija ispravljena je u `ab040ab` istim deep-sort algoritmom kao stvarni generator i byte-stabilnom regresijom.

## PRIV-1B — mobile Settings download

`mobile/src/types/AccountExport.ts` dijeli isti format, verziju i stabilnih 13 naziva kolekcija. `apiClient.getAccountExport()` koristi postojeći JWT axios klijent i `GET /auth/export`; ne dodaje se novi backend poziv niti mobilni flag.

`mobile/src/services/storage/accountExport.ts` odbija neispravan format, verziju, account/generatedAt ili nedostajuću/ne-nizovnu kolekciju prije pisanja. Potpuni JSON se prvo piše kao `.download`, zatim se u istom direktoriju atomski premješta u `.json`; neuspjeli pokušaj čisti obje putanje. Uspješna datoteka ostaje u postojećem downloads cacheu da je native share sheet može pročitati i da je postojeća Clear cache akcija može ukloniti. Sadržaj exporta se ne loguje.

Settings blokira ponovni tap dok je operacija u toku i koristi već instalirani `expo-sharing`. Backend 404 prikazuje nedostupnost, 413 prekoračenje granice, a neispravan odgovor i ostale greške generičku poruku bez backend payloada. Ako dijeljenje nije moguće, poruka razlikuje sačuvanu datoteku od potpuno neuspjelog exporta. Analytics CSV tok nije mijenjan.

Ciljani mobile rezultat je 2 suitea / 17 testova: format i svih 13 kolekcija, kreiranje direktorija, atomski zapis, čišćenje djelimičnih fajlova, native share, dvostruki tap, 404/413/generic i share fallback. Finalni CI `41442409308` potvrđuje 24 suitea / 136 testova, TypeScript i lint bez greške.

## Rollback i preostali rad

- Trenutni rollback: `ACCOUNT_EXPORT_ENABLED=off`; postojeće rute i podaci se ne mijenjaju.
- Code rollback: mobile `3fc4e1d` i backend `5627eb0` mogu se nezavisno revertovati; nema migracije ni backfill-a za poništiti. Stari instalirani klijent zadržava prethodno ponašanje; novi klijent uz flag off dobiva 404 i poruku da je export nedostupan.
- Produkcijsko uključivanje nije odobreno ovim dokumentom; potrebno je posebno provjeriti kapacitet i operativni rollout.
- Fizički native share/Clear cache QA na uređaju nije izveden; Jest ne dokazuje stvarni OS share sheet niti EAS manifest.
- Brisanje naloga ostaje neodobreno dok vlasnik ne da backup-retention i eventualnu legal-retention politiku.
- Asinhroni export, arhiviranje, checksum manifest i download s istekom nisu dio PRIV-1A.
