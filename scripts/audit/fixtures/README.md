# Open-Meteo SDK javni fixture

`openmeteo-sdk-hourly.flatbuffers` sadrži bajtove iz prvog `Data([...])` u upstream javnom testu [`swift/Tests/OpenMeteoSdkTests/ApiTests.swift`](https://github.com/open-meteo/sdk/blob/7a3c6097fe803f55670b1da1411f6095a9ac0ee0/swift/Tests/OpenMeteoSdkTests/ApiTests.swift), commit `7a3c6097fe803f55670b1da1411f6095a9ac0ee0`. SHA-256: `4ac0f695e5cf3d71436a0ae14ffbecf0f376a7db9b8ca153486b6a90ac3c657d`.

Upstream test ima komentarisani primjer API zahtjeva i upotrebljava ove bajtove kao uspješni odgovor, ali ne dokazuje okolnosti ili datum originalnog snimanja. Fixture obuhvata dvije javne lokacije i samo 168 satnih temperatura po lokaciji; nema daily/sunrise/sunset. Nije odgovor sa produkcijskim korisničkim lokacijama ni odgovor koji je audit sam snimio od živog providera. Nije dovoljan za test pune aplikacijske weather obrade ili DST/sunrise semantike.

Upstream SDK licenca je MIT, copyright Open-Meteo, puni tekst u `OPEN-METEO-LICENSE.txt`. Licenca koda/fixturea ne zamjenjuje obavezu provjere uslova korištenja stvarnog Open-Meteo API-ja i podataka.

Iz korijena repozitorija: `node scripts/audit/openmeteo_fixture_replay.cjs --help` i `node scripts/audit/openmeteo_fixture_replay.cjs`. Skripta koristi instalirani `openmeteo` SDK i presreće `fetch` da posluži lokalne bajtove; nema mreže ni baze. Direktne reprodukcije logike aplikacije ostaju u `scripts/audit/weather_repro.cjs` i koriste sintetički fake SDK.
