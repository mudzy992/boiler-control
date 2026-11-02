# Open-Meteo SDK javni fixture

`openmeteo-sdk-hourly.flatbuffers` sadrži bajtove iz prvog `Data([...])` u upstream javnom testu [`swift/Tests/OpenMeteoSdkTests/ApiTests.swift`](https://github.com/open-meteo/sdk/blob/7a3c6097fe803f55670b1da1411f6095a9ac0ee0/swift/Tests/OpenMeteoSdkTests/ApiTests.swift), commit `7a3c6097fe803f55670b1da1411f6095a9ac0ee0`. SHA-256: `4ac0f695e5cf3d71436a0ae14ffbecf0f376a7db9b8ca153486b6a90ac3c657d`.

Upstream test ima komentarisani primjer API zahtjeva i upotrebljava ove bajtove kao uspješni odgovor, ali ne dokazuje okolnosti ili datum originalnog snimanja. Fixture obuhvata dvije javne lokacije i samo 168 satnih temperatura po lokaciji; nema daily/sunrise/sunset. Nije odgovor sa produkcijskim korisničkim lokacijama ni odgovor koji je audit sam snimio od živog providera. Nije dovoljan za test pune aplikacijske weather obrade ili DST/sunrise semantike.

Upstream SDK licenca je MIT, copyright Open-Meteo, puni tekst u `OPEN-METEO-LICENSE.txt`. Licenca koda/fixturea ne zamjenjuje obavezu provjere uslova korištenja stvarnog Open-Meteo API-ja i podataka.

Iz korijena repozitorija: `node scripts/audit/openmeteo_fixture_replay.cjs --help` i `node scripts/audit/openmeteo_fixture_replay.cjs`. Skripta koristi instalirani `openmeteo` SDK i presreće `fetch` da posluži lokalne bajtove; nema mreže ni baze. Direktne reprodukcije logike aplikacije ostaju u `scripts/audit/weather_repro.cjs` i koriste sintetički fake SDK.

## Generisani current+hourly+daily DST fixturei

`openmeteo-generated-dst-spring.flatbuffers` i `openmeteo-generated-dst-fall.flatbuffers` su **sintetički, deterministic generisani SDK ulazi**, ne snimci živog providera. Ne sadrže korisničke podatke ni stvarni provider `location_id`. Generator je `scripts/audit/openmeteo_combined_fixture.cjs`; koristi instalirani `flatbuffers` 25.9.23 i shemu polja iz `open-meteo/sdk` commita `d806856d3e54232695a4587e54238ad5105ecab6`. Replay koristi stvarni `openmeteo` 1.2.3 / `@openmeteo/sdk` 1.28.0 parser i stvarni `OpenMeteoV2Provider`, samo je `fetch` stubovan.

| Scenario | Bajtova | SHA-256 |
|---|---:|---|
| proljeće | 7848 | `5ebc1684964dd1a7819ba1e82c45bc74314eeffcdc45dc56a0738e28846aba7f` |
| jesen | 7848 | `3aac17fdf4d78bb372c196be7e83d9ff3544239e637bd08e608015fe6445ada2` |

Provjera iz korijena: `node scripts/audit/openmeteo_combined_fixture.cjs` potvrđuje byte-identičnost; `--write` svjesno regeneriše fixture, a `--help` opisuje način rada. Backend regresija je `cd backend && npx jest src/modules/Weather/tests/openmeteo-v2.fixture.spec.ts --runInBand --no-cache`.

Oba fixturea imaju current, 168 satnih i 7 dnevnih uzoraka. Provider u replayu bira 72 sata i 7 dana. Pokriveni su prave nule, `NaN` → `null`, `valuesInt64` sunrise/sunset, `INT64_MAX` sentinel, proljetni preskok 02:00 → 03:00 i jesenja dva 01:00 s različitim ofsetima. Ovo dokazuje schema/parser/aplikacijsko mapiranje pod eksplicitno zadanim ulazom; **ne dokazuje** da živi Open-Meteo odgovor ima iste vrijednosti ili svaku produkcijsku DST/edge semantiku. Stvarni odobreni provider capture i dalje je zaseban otvoreni korak.
