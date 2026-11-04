# HANDOFF — stanje na kraju turna (2026-11-03)

Radni dokument za nastavak. Nije dio audit nalaza; može se obrisati kad se
Talas D završi.

## S-002 — HomeProfile create/update četiri tekst-polja (2026-11-04)

**RIJEŠENO, TESTIRANO I PUSHANO: test-first `9c35642`, fix `015712e`.**
`origin/arena/c9961f17-boiler-control` je `015712e` prije ovog docs commita;
`origin/main` je posljednji put provjeren na `54c629b`. PR nije otvaran.

- Source review je potvrdio da globalna implicitna konverzija mijenja numeričke
  `homeName`, `location`, `boilerModel` i `preferredScheduleNotes` u string
  prije `@IsString`. Pregledani mobile i web create/update već šalju tekst;
  klijent nije mijenjan.
- Postojeći HTTP suite sada koristi stvarne DTO-e, oba registrovana controllera
  i produkcijske ValidationPipe opcije s mock guardom/servisom. Obje baseline
  varijante prolaze **10/10** uz privremene Prisma import stubove. Ovo nije
  real-DB, ownership, active-profile ili Prisma mutation dokaz.
- Test-only `9c35642` dodaje valjan pluralni create/update i osam numeričkih
  negativaca, uz nepromijenjenih deset path-ID kontrola. Lokalni repro je
  **12 prošlo / 8 palo / 20 ukupno**: valjani create zadržava 201, update 200,
  a pogrešni tipovi ranije dobijaju 201/200 umjesto 400.
- **Test-first CI `41916316275`:** backend **884 prošlo / 8 palo / 892 ukupno**,
  integration **119/119**, mobile **24/136** i frontend **4/4**; `tsc: 0`,
  `eslint: 0`. Svih osam backend failurea su ciljani text-body scenariji.
- Fix `015712e` dodaje samo raw-input transformacije za četiri tekst-polja u
  create/update DTO-u. Numerička i boolean polja, enumi, postojeći min/max,
  controller, servis, active/weather-location logika, Prisma mutacije, path ID
  i response ostaju nepromijenjeni; nema novog flaga, length/not-empty ili
  `null` politike.
- Lokalni HTTP suite prolazi **20/20**, a oba HomeProfile suitea **25/25**.
  Tačan CI ESLint opseg ima **0 errors / 2 poznata warnings**, a OpenAPI
  `--check` prolazi bez razlike. **Finalni code CI `41916970223`:** backend
  **87/892 + 13/119 integration**, mobile **24/136**, frontend **4/4**,
  `tsc: 0`, `eslint: 0`; sva tri joba su success i nema failure annotations.
- OpenAPI i frontend generated fajlovi nisu mijenjani; generated sync i
  type-check prolaze u CI. Nema migracije/backfilla, promjene flaga,
  mobile/compose izmjena ni deploya. Rollback production fixa je revert
  `015712e`; privremeni Prisma stubovi su uklonjeni.
- **Granica:** pluralni mock-controller scenariji dijele DTO s registrovanim
  singularnim rutama, ali nisu novi real-DB/create/update/ownership dokaz.
  Numerički i boolean raw tipovi, `null` semantika, string sadržaj, ID
  pozitivnost, S-004 i produkcijski rollout ostaju zasebni.

## S-002 — ThermostatDevice create/update body raw-tip validacija (2026-11-04)

**RIJEŠENO, TESTIRANO I PUSHANO: test-first `15dcdff`, fix `d54ade0`.**
`origin/arena/c9961f17-boiler-control` je `d54ade0` prije ovog docs commita;
`origin/main` je posljednji put provjeren na `54c629b`. PR nije otvaran.

- Source review je potvrdio da globalna implicitna konverzija mijenja pogrešne
  raw tipove za create/update string polja i `homeProfileId` prije validatora.
  Valjani stringovi/brojevi, `mode` enum, path ID i servisni ugovor ostaju isti.
  Pregledani mobile update već šalje tipizirane vrijednosti; create consumer
  nije pronađen i klijent nije mijenjan.
- Postojeći HTTP suite sada koristi stvarne DTO-e, controller i produkcijske
  ValidationPipe opcije s mock guardom/servisom. Obje baseline varijante su
  prolazile **8/8** uz privremene Prisma import stubove. Ovo nije real-DB,
  ownership, profil lookup ili Prisma mutation dokaz.
- Test-only `15dcdff` dodaje valjan create/update i osam pogrešnih raw-tip
  scenarija. Lokalni repro je **10 prošlo / 8 palo / 18 ukupno**: valjani create
  zadržava 201, update 200, a pogrešni tipovi ranije dobijaju 201/200 umjesto
  400 i dolaze do mock servisa.
- **Test-first CI `41913583688`:** backend **874 prošlo / 8 palo / 882 ukupno**,
  integration **119/119**, mobile **24/136** i frontend **4/4**; `tsc: 0`,
  `eslint: 0`. Svih osam backend failurea su ciljani body scenariji, bez drugih
  regresija.
- Fix `d54ade0` dodaje samo raw-input transformacije u dva DTO-a za
  `vendor`, `deviceId`, `alias` i `homeProfileId`. `mode`, controller, servis,
  ownership/profil lookupi, Prisma create/update, path ID i response ostaju
  nepromijenjeni; nema novog flaga, `IsInt`, `Min(1)`, length/not-empty ili
  `0/null` politike.
- Lokalni cijeli ThermostatDevice HTTP suite prolazi **18/18**, a tačan CI
  ESLint opseg ima **0 errors / 2 poznata warnings**. OpenAPI `--check` prolazi
  bez razlike. **Finalni code CI `41914703109`:** backend **87/882 + 13/119
  integration**, mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`;
  sva tri joba su success i nema failure annotations.
- OpenAPI i frontend generated fajlovi nisu mijenjani; generated sync i
  type-check prolaze u CI. Nema migracije/backfilla, promjene flaga,
  mobile/compose izmjena ni deploya. Rollback production fixa je revert
  `d54ade0`; privremeni Prisma stubovi su uklonjeni.
- **Granica:** mock controller dokazuje samo DTO/HTTP kompatibilnost, ne nove
  real-DB ownership ili mutation ishode. ID pozitivnost, string sadržaj,
  `0/null` semantika, S-004/session revokacija i produkcijski rollout ostaju
  zasebni.

## S-003 — User profile potvrda trenutne lozinke (2026-11-04)

**RIJEŠENO, TESTIRANO I PUSHANO: test-first `ab8c350`, fix `6345fc7`.**
`origin/arena/c9961f17-boiler-control` je `6345fc7` prije ovog docs commita;
`origin/main` je posljednji put provjeren na `34ded14`. PR nije otvaran.

- Source review je potvrdio da je profilni PUT hashirao i spremao novi password
  bez `currentPassword` provjere, dok je namjenski Auth tok već radio bcrypt
  compare. Poznati web i mobile ekrani ne šalju password kroz profil; mobile
  Settings koristi `/auth/change-password`.
- Test-only `ab8c350` dodaje servisne bcrypt/fake-DB i stvarne
  AppModule/JWT/Prisma/PostgreSQL scenarije, proširuje controller DTO suite i
  popravlja zastarjeli sintetički auth bootstrap. Lokalni repro je **16 prošlo /
  5 palo / 21 ukupno**, a audit repro nezavisno dobija 200 umjesto 400 za
  password bez stare lozinke.
- **Test-first CI `41905261533`:** backend **864 prošlo / 8 palo / 872 ukupno**,
  integration **116 prošlo / 3 pala / 119 ukupno**. Svih osam backend i sva tri
  integration failurea su samo S-003 scenariji; `tsc: 0`, `eslint: 0`, mobile
  **24/136** i frontend **4/4** ostaju zeleni.
- Fix `6345fc7` uslovno zahtijeva neprazan raw-string `currentPassword` uz
  `password`, servis radi bcrypt compare prije novog hasha i ne prosljeđuje
  `password`/`currentPassword` Prisma updateu. Bez stare lozinke je 400, za
  netačnu 401 bez DB promjene, a za tačnu 200 uz novi bcrypt hash. Običan
  profilni update bez password polja ostaje nepromijenjen.
- Lokalno ciljani suiteovi prolaze **21/21**, povezani Auth/User suiteovi
  **35/35**, a `auth_session_repro.cjs` potvrđuje 400/401/200 redom za
  missing/wrong/correct current password. Backend ESLint ima **0 errors / 2
  poznata warnings**. OpenAPI dodaje samo opcioni `currentPassword`; generated
  frontend tipovi, sync/type-check i frontend **92/92** prolaze.
- **Finalni code CI `41906152927`:** backend **87/872 + 13/119 integration**,
  mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba su
  success i nema failure annotations. Real-DB integration dokazuje da odbijeni
  zahtjevi ne mijenjaju hash niti ostala profilna polja.
- Mobile API tip dobiva samo opcioni `currentPassword`; postojeći ekrani i
  instalirani mobile password tok nisu mijenjani. Vanjski klijenti koji koriste
  profilni PUT za password moraju poslati i `currentPassword`.
- Nema migracije/backfilla, novog flaga, compose ni deploy izmjene. Rollback
  production fixa je revert `6345fc7`; privremeni Prisma stubovi su uklonjeni.
- **Granica:** S-003 old-password propust je zatvoren i real-DB/bcrypt dokazan.
  **S-004 nije riješen:** stari JWT i dalje prolazi nakon promjene lozinke u
  sintetičkom reproe; revokacija sesija i produkcijski rollout ostaju zasebni.

## S-002 — User profile password raw-tip validacija (2026-11-04)

**VERIFIKOVANO, TESTIRANO I PUSHANO: test-first `9935b63`, fix `0300400`.**
`origin/arena/c9961f17-boiler-control` je `0300400` prije ovog docs commita;
`origin/main` je posljednji put provjeren na `71fe5bf`. PR nije otvaran.

- Source review i DTO probe na čistom HEAD-u potvrđuju da numerički `123456`
  postaje string dužine šest i prolazi postojeći `@IsString`/`@MinLength(6)`.
  Valjani password string prolazi, a kraći numerički oblik i dalje pokazuje da
  postojeći minimum radi. Nije uvedena nova password politika.
- Postojeći `user-profile-http.spec.ts` baseline je **13/13** uz privremeni
  Prisma import stub. Suite pokreće stvarni controller/production ValidationPipe
  s mock guardom/servisom; nije real-DB/bcrypt/session dokaz.
- Test-only `9935b63` dodaje valjan password sa 200, responseom, JWT userId i
  cijelim servisnim argumentom, te numerički password koji mora dati 400 bez
  servisa. Lokalni repro je **14 prošlo / 1 pao / 15 ukupno**, bez promjene
  prethodnih 13 asserti.
- **Test-first CI `41902676553`:** backend **861 prošao / 1 pao / 862 ukupno**;
  samo numerički password pada jer dobija **200** umjesto 400. Svih **115/115
  integration**, mobile **24/136** i frontend **4/4** su zeleni, `tsc: 0`,
  `eslint: 0`.
- Fix `0300400` dodaje jedan postojeći raw-input transform na `password`.
  Controller, UserService, bcrypt/hash, `MinLength(6)`, ostalih devet DTO polja
  i postojeći profile-password tok ostaju nepromijenjeni; nema novog flaga.
- Lokalno cijeli profile HTTP suite prolazi **15/15**, a probe zadržava valjani
  string i odbija numerički password. **Finalni code CI `41903390817`:** backend
  **85/862 + 12/115 integration**, mobile **24/136**, frontend **4/4**, `tsc: 0`,
  `eslint: 0`; sva tri joba su success i nema failure annotations.
- OpenAPI i frontend generated output ostaju bajtno nepromijenjeni. Sync/
  type-check i frontend **92/92** prolaze. Backend ESLint ima **0 errors / 2
  poznata warnings**, a inventory ostaje bajtno nepromijenjen (**34**).
- Nema migracije/backfilla, promjene flaga, mobile/compose izmjena ni deploya.
  Rollback production fixa je revert `0300400`; privremeni Prisma stubovi su
  uklonjeni.
- **Granica:** svih deset `UpdateUserDto` polja sada čuva raw tip, ali ovo je
  samo S-002 tip validacija. **S-003 nije riješen:** valjani password string i
  dalje prolazi profilni PUT bez dodane provjere stare lozinke. Mock controller
  ne dokazuje real-DB update, bcrypt/hash ni session revokaciju.

## S-002 — User profile scalar DTO validacija (2026-11-04)

**VERIFIKOVANO, TESTIRANO I PUSHANO: test-first `a8cc316`, fix `9c72bba`.**
`origin/arena/c9961f17-boiler-control` je `9c72bba` prije ovog docs commita;
`origin/main` je posljednji put provjeren na `04ca203`. PR nije otvaran.

- Source review i DTO probe na čistom HEAD-u potvrđuju da string `"false"` i
  brojevi za `prefersDarkMode` prolaze implicitnu boolean konverziju, string i
  boolean za `gasPriceExVat` postaju brojevi, a numerički `20261104` za
  `gasPriceEffectiveFrom` postaje string koji prolazi ISO validator. Valjani
  `false`, `1.25` i ISO string prolaze. Web/mobile već šalju gas cijenu kao
  number; mobile ne šalje dark-mode/date u profile update.
- Postojeći `user-profile-http.spec.ts` baseline je **7/7** uz privremeni Prisma
  import stub. Suite pokreće stvarni controller/production ValidationPipe s mock
  guardom/servisom; nije real-DB/bcrypt/gas-price/session dokaz.
- Test-only `a8cc316` dodaje valjan scalar payload sa 200, responseom i cijelim
  servisnim argumentom, te pet negativaca: string/broj dark mode, string/boolean
  gas cijenu i numerički basic-ISO datum. Lokalni repro je **8 prošlo / 5 palo /
  13 ukupno**, bez promjene prethodnih sedam asserti.
- **Test-first CI `41899374788`:** backend **855 prošlo / 5 palo / 860 ukupno**;
  samo novi scalar negativci padaju jer dobijaju **200** umjesto 400. Svih
  **115/115 integration**, mobile **24/136** i frontend **4/4** su zeleni,
  `tsc: 0`, `eslint: 0`.
- Fix `9c72bba` dodaje postojeći raw-input transform samo na `prefersDarkMode`,
  `gasPriceExVat` i `gasPriceEffectiveFrom`. Password/S-003, prethodnih šest
  tekst polja, controller, UserService, bcrypt/hash i gas-price historija ostaju
  nepromijenjeni; nema novog flaga ni nove politike cijene/datuma.
- Lokalno cijeli profile HTTP suite prolazi **13/13**, a probe odbija sve
  pogrešne varijante i zadržava valjanu kontrolu. **Finalni code CI
  `41900213890`:** backend **85/860 + 12/115 integration**, mobile **24/136**,
  frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba su success i nema failure
  annotations.
- OpenAPI i frontend generated output ostaju bajtno nepromijenjeni. Sync/
  type-check i frontend **92/92** prolaze. Backend ESLint ima **0 errors / 2
  poznata warnings**, a inventory ostaje bajtno nepromijenjen (**34**).
- Nema migracije/backfilla, promjene flaga, mobile/compose izmjena ni deploya.
  Rollback production fixa je revert `9c72bba`; privremeni Prisma stubovi su
  uklonjeni.
- **Granica:** riješene su samo tri raw-type konverzije, ne password/S-003 niti
  semantičke politike cijene/datuma. Mock controller ne dokazuje real-DB update,
  bcrypt/hash, gas-price historiju ni session revokaciju.

## S-002 — User profile šest tekst polja DTO validacije (2026-11-04)

**VERIFIKOVANO, TESTIRANO I PUSHANO: test-first `af1ce37`, fix `63b23af`; CI-only recheck `6c3ba5d` nema source diff.**
`origin/arena/c9961f17-boiler-control` je `6c3ba5d` prije ovog docs commita;
`origin/main` je posljednji put provjeren na `d480f99`. PR nije otvaran.

- Source review i DTO probe na čistom HEAD-u potvrđuju da numerički `name`,
  `username`, `homeLocation`, `avatarUrl`, `timezone` i `locale` postaju string
  `"123456"` bez validator greške. Mobile već šalje string name/username/
  homeLocation; mobile i frontend consumeri nisu mijenjani.
- Novi `user-profile-http.spec.ts` pokreće stvarni UserController i produkcijske
  ValidationPipe opcije. Mock guard daje JWT `userId=42`, a mock `updateMe`
  provjerava 400-prije-servisa i valjani 200/argument. Ovo nije real-DB/bcrypt/
  gas-price/session dokaz.
- Test-only `af1ce37` dodaje valjan payload sa 200, cijelim responseom i
  servisnim argumentom, username trim/lowercase normalizaciju i šest numeričkih
  negativaca. Lokalni repro je **1 prošao / 6 palo / 7 ukupno**.
- **Test-first CI `41885089457`:** backend **848 prošlo / 6 palo / 854 ukupno**;
  samo šest ciljanih numeričkih polja pada jer dobija **200** umjesto 400.
  Svih **115/115 integration**, mobile **24/136** i frontend **4/4** su zeleni.
- Fix `63b23af` čuva raw input za šest tekst polja, a username trim/lowercase
  primjenjuje samo na raw string. Password/S-003, `prefersDarkMode`, gas-price/
  date polja, controller, UserService, bcrypt/hash i gas-price historija ostaju
  nepromijenjeni; nema novog flaga.
- Lokalno novi suite prolazi **7/7**, frontend **92/92**, a OpenAPI i frontend
  generated output ostaju bajtno nepromijenjeni. Backend ESLint ima **0 errors /
  2 poznata warnings**; controller i inventory (**34**) su nepromijenjeni.
- Prvi code CI `41885929193` imao je **851 prošlo / 3 palo / 854 ukupno** zbog
  tri timeouta u postojećim auth-refresh/duplicate-email integration testovima;
  novi profile suite i zasebni integration/mobile/frontend jobovi su prošli.
  Timeoutovi i asserti nisu mijenjani. CI-only `6c3ba5d` nema file diffa, a
  **recheck CI `41886589502`** je zelen: backend **85/854 + 12/115 integration**,
  mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`, sva tri joba success.
- Nema migracije/backfilla, promjene flaga, mobile/compose izmjena ni deploya.
  Rollback production fixa je revert `63b23af`; privremeni Prisma stubovi su
  uklonjeni.
- **Granica:** riješeni su samo numerički ulazi za šest tekst polja, ne cijeli
  `UpdateUserDto` niti S-003. Valjani stringovi, response, servisni argument i
  username normalizacija ostaju; mock controller ne dokazuje real-DB update,
  bcrypt/hash, gas-price historiju ni session revokaciju.

## S-002 — Auth register body DTO validacija (2026-11-04)

**VERIFIKOVANO, TESTIRANO I PUSHANO: test-first `4f6dd12`, fix `3ad9c55`.**
`origin/arena/c9961f17-boiler-control` je `3ad9c55` prije ovog docs commita;
`origin/main` je posljednji put provjeren na `3b3126a`. PR nije otvaran.

- Source review i DTO probe na čistom HEAD-u potvrđuju da numerički
  `username`, `password`, `name` i `homeLocation` postaju stringovi bez
  validator greške. Numerički i array email već imaju validator grešku zbog
  `IsEmail`, pa email nije mijenjan. Mobile već šalje četiri string polja.
- Novi `auth-register-http.spec.ts` pokreće stvarni controller i produkcijske
  ValidationPipe opcije s mock AuthService/refresh granicom. Postojeći Auth
  baseline je **19/19** uz privremene Prisma import stubove. Novi suite nije
  real-DB/bcrypt/uniqueness/create dokaz.
- Test-only `4f6dd12` dodaje potpun valjan payload sa 201, responseom,
  email/username normalizacijom i cijelim servisnim argumentom, te četiri
  numerička negativca. Novi repro je **1 prošao / 4 pala / 5 ukupno**, a sa
  postojećom Auth kontrolom **20 prošlo / 4 pala / 24 ukupno**.
- **Test-first CI `41882246091`:** backend **843 prošlo / 4 pala / 847 ukupno**,
  svih **115/115 integration** zeleno, `tsc: 0`, `eslint: 0`; samo numerički
  username/password/name/homeLocation padaju jer dobijaju **201** umjesto 400.
  Mobile **24/136** i frontend **4/4** su zeleni.
- Fix `3ad9c55` čuva raw password/name/homeLocation, a username normalizaciju
  primjenjuje na raw string bez implicitne konverzije ne-stringova. Email,
  `refreshTransport`, controller, AuthService, bcrypt hash, Prisma uniqueness/
  create i cookie/refresh logika ostaju isti; nema novog flaga.
- Lokalno sva četiri Auth HTTP/cookie suitea prolaze **24/24**. **Finalni code CI
  `41883133590`:** backend **84/847 + 12/115 integration**, mobile **24/136**,
  frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba su success i nema failure
  annotations.
- OpenAPI i frontend generated output ostaju bajtno nepromijenjeni. Sync/
  type-check i frontend **92/92** prolaze. Backend ESLint ima **0 errors / 2
  poznata warnings**. Controller nije mijenjan i inventory ostaje **34**.
- Nema migracije/backfilla, promjene flaga, AuthService/controllera,
  mobile/compose izmjena ni deploya. Rollback je revert `3ad9c55`; privremeni
  Prisma stubovi su uklonjeni.
- **Granica:** četiri numerička polja sada staju prije servisa, dok valjani
  payload, response, normalizacija i servisni argument ostaju. Mock controller
  ne dokazuje real-DB uniqueness/create, bcrypt hash ili refresh rollout.

## S-002 — Auth login body DTO validacija (2026-11-04)

**VERIFIKOVANO, TESTIRANO I PUSHANO: test-first `7e51bac`, fix `b6e4f0d`.**
`origin/arena/c9961f17-boiler-control` je `b6e4f0d` prije ovog docs commita;
`origin/main` je posljednji put provjeren na `c1df637`. PR nije otvaran.

- Source review i DTO probe na čistom HEAD-u potvrđuju da numerički
  `identifier`, `email` i `password` postaju stringovi bez validator greške.
  Mobile šalje string identifier/password i `refreshTransport: 'body'`, a web
  string identifier/password. Postojeća trim/lowercase normalizacija je sačuvana.
- Novi `auth-login-http.spec.ts` pokreće stvarni controller i produkcijske
  ValidationPipe opcije s mock AuthService/refresh granicom. Postojeći Auth
  cookie/change-password baseline je **14/14** uz privremene Prisma import
  stubove. Novi suite nije real-DB/bcrypt ili throttling dokaz.
- Test-only `7e51bac` dodaje valjan identifier sa 200, responseom,
  normaliziranim servisnim argumentima i mobile transport poljem, legacy email
  fallback, te tri numerička negativca. Novi repro je **2 prošla / 3 pala / 5
  ukupno**, a sa postojećom Auth kontrolom **16 prošlo / 3 pala / 19 ukupno**.
- **Test-first CI `41875464182`:** backend **839 prošlo / 3 pala / 842 ukupno**,
  svih **115/115 integration** zeleno, `tsc: 0`, `eslint: 0`; samo numerički
  identifier/email/password padaju jer dobijaju **200** umjesto 400. Mobile
  **24/136** i frontend **4/4** su zeleni.
- Fix `b6e4f0d` čuva raw password, a email/identifier normalizaciju primjenjuje
  na raw string bez implicitne konverzije ne-stringova. Controller, identifier
  fallback, AuthService, bcrypt/Prisma lookup, `refreshTransport` i cookie/refresh
  logika ostaju isti; nema novog flaga.
- Lokalno sva tri Auth HTTP/cookie suitea prolaze **19/19**. **Finalni code CI
  `41876377311`:** backend **83/842 + 12/115 integration**, mobile **24/136**,
  frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba su success i nema failure
  annotations.
- OpenAPI i frontend generated output ostaju bajtno nepromijenjeni. Sync/
  type-check i frontend **92/92** prolaze. Backend ESLint ima **0 errors / 2
  poznata warnings**. Controller nije mijenjan i inventory ostaje **34**.
- Nema migracije/backfilla, promjene flaga, AuthService/controllera,
  mobile/compose izmjena ni deploya. Rollback je revert `b6e4f0d`; privremeni
  Prisma stubovi su uklonjeni.
- **Granica:** numerički identifier/email/password sada staju prije servisa,
  dok valjani stringovi, response, trim/lowercase i email fallback ostaju. Mock
  controller ne dokazuje real-DB/bcrypt login, throttling ili refresh rollout.

## S-002 — Auth change-password body DTO validacija (2026-11-04)

**VERIFIKOVANO, TESTIRANO I PUSHANO: test-first `5aee897`, fix `e583a10`.**
`origin/arena/c9961f17-boiler-control` je `e583a10` prije ovog docs commita;
`origin/main` je posljednji put provjeren na `e6e9e7c`. PR nije otvaran.

- Source review je potvrdio da `ChangePasswordDto` ima `@IsString`,
  `IsNotEmpty` i `MinLength(6)`, ali ne čuva raw tip pri globalnoj implicitnoj
  konverziji. Servis radi postojeći bcrypt compare/hash i user update. Mobile
  već šalje current/new password kao stringove.
- Novi `auth-change-password-http.spec.ts` pokreće stvarni controller i
  produkcijske ValidationPipe opcije s mock servisom. Postojeći Auth cookie
  baseline je **11/11** uz privremene Prisma import stubove. Novi suite nije
  real-DB/bcrypt ili session-revocation dokaz.
- Test-only `5aee897` dodaje valjane lozinke sa 200, cijelim responseom i
  `changePassword(42,'current-secret','new-secret')`, te numerički current/new
  password koji moraju dati 400 bez servisa. Novi repro je **1 prošao / 2 pala
  / 3 ukupno**, a sa postojećom kontrolom **12 prošlo / 2 pala / 14 ukupno**.
- **Test-first CI `41850651413`:** backend **835 prošlo / 2 pala / 837 ukupno**,
  svih **115/115 integration** zeleno, `tsc: 0`, `eslint: 0`; samo numerička
  password polja padaju jer dobijaju **200** umjesto 400. Mobile **24/136** i
  frontend **4/4** su zeleni.
- Fix `e583a10` dodaje raw-input `@Transform` samo na `currentPassword` i
  `newPassword`, prije postojećih validatora. Controller, AuthService, bcrypt,
  `MinLength(6)` i Prisma update ostaju isti; nema nove password politike/flaga.
- Lokalno novi HTTP i postojeći cookie suiteovi prolaze **14/14**. **Finalni
  code CI `41851404905`:** backend **82/837 + 12/115 integration**, mobile
  **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba su success i
  nema failure annotations.
- OpenAPI i frontend generated output ostaju bajtno nepromijenjeni. Sync/
  type-check i frontend **92/92** prolaze. Backend ESLint ima **0 errors / 2
  poznata warnings**. Controller nije mijenjan i inventory ostaje **34**.
- Nema migracije/backfilla, promjene AuthService/controllera, mobile/compose
  izmjena ni deploya. Rollback je revert `e583a10`; privremeni Prisma stubovi
  su uklonjeni.
- **Granica:** numerička password polja sada staju prije servisa/bcrypt/DB
  updatea; valjani stringovi i postojeći hash tok ostaju. Mock controller ne
  dokazuje real-DB update ili revokaciju sesija, a rollout ostaje otvoren.

## S-002 — Notification register-token body DTO validacija (2026-11-04)

**VERIFIKOVANO, TESTIRANO I PUSHANO: test-first `0d3b414`, fix `eb3313d`.**
`origin/arena/c9961f17-boiler-control` je `eb3313d` prije ovog docs commita;
`origin/main` je posljednji put provjeren na `cacd879`. PR nije otvaran.

- Source review je potvrdio da `RegisterDeviceDTO.expoPushToken` ima samo
  `@IsString`, bez raw-input čuvanja pri globalnoj implicitnoj konverziji.
  Servis radi postojeći `userDevice` update/create. Mobile već šalje string
  token i tipiziranu android/ios platformu.
- Postojeći `notifications-read-http.spec.ts` pokreće stvarni controller i
  produkcijske ValidationPipe opcije s mock servisom. Baseline je bio **2/2**
  uz privremene Prisma import stubove. Ovo nije real-DB ili Expo dokaz.
- Test-only `0d3b414` dodaje valjan token sa 201, cijelim responseom i
  `registerToken(42,'ExponentPushToken[synthetic-token]','android')`, te
  numerički token koji mora dati 400 bez servisa. Lokalni repro je **3 prošlo /
  1 pao / 4 ukupno**.
- **Test-first CI `41843036696`:** backend **833 prošlo / 1 pao**, svih
  **115/115 integration** zeleno, `tsc: 0`, `eslint: 0`; samo numerički token
  pada jer dobija **201** umjesto 400. Mobile **24/136** i frontend **4/4** su
  zeleni.
- Fix `eb3313d` dodaje raw-input `@Transform` samo na `expoPushToken`, prije
  postojećeg `@IsString`. Platform enum, controller, servis i `userDevice`
  update/create ostaju isti; nema novog token formata, length pravila ni flaga.
- Lokalni Notification HTTP suite prolazi **4/4**. **Finalni code CI
  `41843715972`:** backend **81/834 + 12/115 integration**, mobile **24/136**,
  frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba su success i nema failure
  annotations.
- OpenAPI i frontend generated output ostaju bajtno nepromijenjeni. Sync/
  type-check i frontend **92/92** prolaze. Backend ESLint ima **0 errors / 2
  poznata warnings**. Controller nije mijenjan i inventory ostaje **34**.
- Nema migracije/backfilla, servis/DB/Expo/mobile/compose promjene ni deploya.
  Rollback je revert `eb3313d`; privremeni Prisma stubovi su uklonjeni.
- **Granica:** numerički token sada staje prije servisa/DB upisa; valjani string
  i postojeći update/create tok ostaju. Mock controller ne dokazuje real-DB
  upis, Expo dostavu ili token lifecycle, a rollout ostaje otvoren.

## S-002 — Weather v2 confirm body DTO validacija (2026-11-04)

**VERIFIKOVANO, TESTIRANO I PUSHANO: test-first `1d61859`, fix `4e037b0`.**
`origin/arena/c9961f17-boiler-control` je `4e037b0` prije ovog docs commita;
`origin/main` je posljednji put provjeren na `849119f`. PR nije otvaran.

- Source review je potvrdio da `ConfirmWeatherLocationDto` ima `@IsString` i
  `@Length`, ali ne čuva sirovi tip pri globalnoj implicitnoj konverziji.
  Servisni owner lookup, fresh geocoder, candidate provjera i `updateMany` nisu
  mijenjani. Mobile već šalje trimovan string query i string candidate ID.
- Postojeći `stub-endpoint.spec.ts` pokreće stvarni controller i produkcijske
  ValidationPipe opcije s mock servisom. Zajedno s Weather OpenAPI specom
  baseline je bio **35/35**. Ovo nije novi real-DB owner ili geocoder dokaz.
- Test-only `1d61859` dodaje valjan confirm sa 200, cijelim responseom i
  `confirmLocation(4242,17,'  Sarajevo  ','candidate-1')`, te numerički query i
  candidateId koji moraju dati 400 bez servisa. Lokalni repro je **33 prošlo /
  2 pala / 35 ukupno**.
- **Test-first CI `41839722716`:** backend **830 prošlo / 2 pala**, svih
  **115/115 integration** zeleno, `tsc: 0`, `eslint: 0`; samo numerički query i
  candidateId padaju jer dobijaju **200** umjesto 400. Mobile **24/136** i
  frontend **4/4** su zeleni.
- Fix `4e037b0` dodaje raw-input `@Transform` samo na `query` i `candidateId`,
  prije postojećih `@IsString`/`@Length` pravila. Controller, servis, owner
  lookup, fresh geocoder i `updateMany` ostaju isti; nema novog flaga.
- Lokalno HTTP i OpenAPI suiteovi prolaze **38/38**. **Finalni code CI
  `41840434457`:** backend **81/832 + 12/115 integration**, mobile **24/136**,
  frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba su success i nema failure
  annotations.
- OpenAPI i frontend generated output ostaju bajtno nepromijenjeni. Sync/
  type-check i frontend **92/92** prolaze. Backend ESLint ima **0 errors / 2
  poznata warnings**. Controller nije mijenjan i inventory ostaje **34**.
- Nema migracije/backfilla, servis/provider/mobile/compose promjene ni deploya.
  Rollback je revert `4e037b0`; privremeni Prisma stubovi su uklonjeni.
- **Granica:** numerički query/candidateId sada staju prije servisa/owner
  lookupa; postojeća length pravila i fresh-candidate tok ostaju. Mock controller
  ne dokazuje real-DB owner ili provider tok, a rollout ostaje otvoren.

## S-002 — Weather v2 location query DTO validacija (2026-11-04)

**VERIFIKOVANO, TESTIRANO I PUSHANO: test-first `0276912` + format `168d9cc`, fix `a441f90`.**
`origin/arena/c9961f17-boiler-control` je `a441f90` prije ovog docs commita;
`origin/main` je posljednji put provjeren na `1589db8`. PR nije otvaran.

- Source review je potvrdio da GET `/api/weather/v2/locations/:homeProfileId`
  koristi direktni `@Query('query')` bez runtime DTO-a. Servis prvo radi owner
  lookup, zatim `trim` i 2–100 provjeru. Mobile već šalje trimovan string, a web
  nema potrošača ove v2 location-search rute.
- Postojeći `stub-endpoint.spec.ts` pokreće stvarni controller i produkcijske
  ValidationPipe opcije s mock servisom. Zajedno s Weather OpenAPI specom
  baseline je bio **31/31**. Ovo nije novi real-DB owner ili live-provider dokaz.
- Test-only `0276912` dodaje valjan raw query sa 200, cijelim responseom i
  `getLocationCandidates(4242,17,'  Sarajevo  ')`, te missing, array i extra
  query koji moraju dati 400 bez servisa. Lokalni repro je **29 prošlo / 3 pala
  / 32 ukupno**. Prvi CI `41836668094` je uz tri ciljana failurea uhvatio dvije
  Prettier greške; format-only `168d9cc` ih uklanja bez promjene asserti.
- **Čisti test-first CI `41837152828`:** backend **826 prošlo / 3 pala**, svih
  **115/115 integration** zeleno, `tsc: 0`, `eslint: 0`; samo missing, array i
  extra query padaju jer dobijaju **200** umjesto 400. Mobile **24/136** i
  frontend **4/4** su zeleni.
- Fix `a441f90` dodaje `WeatherLocationQueryDto` s raw-input `@IsString`
  provjerom i koristi ga kao cijeli query DTO, pa globalni whitelist odbija extra
  ključeve. Postojeći `@ApiQuery` ostaje za isti OpenAPI parametar. Servis,
  owner lookup, `trim`, 2–100 pravila i provider nisu mijenjani; nema novog flaga.
- Lokalno HTTP i OpenAPI suiteovi prolaze **35/35**. **Finalni code CI
  `41838086198`:** backend **81/829 + 12/115 integration**, mobile **24/136**,
  frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba su success i nema failure
  annotations.
- OpenAPI i frontend generated output ostaju bajtno nepromijenjeni. Sync/
  type-check i frontend **92/92** prolaze. Backend ESLint ima **0 errors / 2
  poznata warnings**. Weather route linije i inventory (**34**) nepromijenjeni.
- Nema migracije/backfilla, servis/provider/mobile/compose promjene ni deploya.
  Rollback je revert `a441f90`; privremeni Prisma stubovi su uklonjeni.
- **Granica:** missing, array i extra query sada staju prije servisa/owner
  lookupa; string length i `trim` ostaju nakon owner provjere. Mock controller
  ne dokazuje real-DB owner ili provider tok, a rollout ostaje otvoren.

## S-002 — Notification mark-as-read path ID validacija (2026-11-04)

**VERIFIKOVANO, TESTIRANO I PUSHANO: test-first `bf04af0`, fix `bbf7ce0`.**
`origin/arena/c9961f17-boiler-control` je `bbf7ce0` prije ovog docs commita;
`origin/main` je posljednji put provjeren na `48dc7b5`. PR nije otvaran.

- Source review je potvrdio da POST `/api/notifications/:id/read` nema
  ParseIntPipe. Web i mobile `markNotificationAsRead(id: number)` već šalju
  numerički ID. Servisni atomski `updateMany` po id+userId, neotkrivajući 404 i
  naknadni `findUnique` nisu mijenjani.
- Postojeći `notifications-ownership.integration.spec.ts` već real-DB dokazuje
  anonymous 401, owner 201/response/`isRead=true`, te foreign/missing 404 bez
  side effecta. Taj suite je nepromijenjen. Novi controller suite koristi mock
  servis i nije novi real-DB ownership dokaz.
- Novi `notifications-read-http.spec.ts` pokreće stvarni controller i
  produkcijske ValidationPipe opcije. Test-only `bf04af0` dodaje valjan numeric
  ID sa 201, cijelim responseom i `markAsRead(17,42)`, te malformed ID koji mora
  dati 400 bez servisa. Lokalni repro je **1 prošao / 1 pao / 2 ukupno**:
  valjana kontrola prolazi, a malformed ID dobija **201**.
- **Test-first CI `41831732081`:** backend **824 prošlo / 1 pao**, svih
  **115/115 integration** zeleno, `tsc: 0`, `eslint: 0`; samo novi malformed
  notification read scenarij pada. Mobile **24/136** i frontend **4/4** zeleni.
- Fix `bbf7ce0` dodaje ParseIntPipe samo na mark-as-read `:id`. Nema Min(1),
  novog flaga ni izmjene servisne ownership/update logike ili baze. Novi import
  i Prettier format pomjeraju deset Notification route markera; svi su
  usklađeni u fix commitu i inventory ostaje **34**.
- Lokalno novi suite i postojeća SEC-3 kontrola prolaze **6/6**. **Finalni code
  CI `41832527612`:** backend **81/825 + 12/115 integration**, mobile **24/136**,
  frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba su success i nema failure
  annotations. Real-DB SEC-1 owner/foreign rezultat ostaje potvrđen.
- OpenAPI i frontend path `id` već su bili number; generated output je bajtno
  nepromijenjen. Sync/type-check i frontend **92/92** prolaze. Backend ESLint
  ima **0 errors / 2 poznata warnings**.
- Nema migracije/backfilla, novog flaga, servisne/mobile/compose promjene ni
  deploya. Rollback je revert `bbf7ce0`; privremeni Prisma stubovi su uklonjeni.
- **Granica:** mock controller ne zamjenjuje real-DB owner/foreign/missing
  dokaze; ID pozitivnost i rollout ostaju otvoreni.

## S-002 — ThermostatDevice remove path ID validacija (2026-11-04)

**VERIFIKOVANO, TESTIRANO I PUSHANO: test-first `c5fcc7c`, fix `ea5e860`.**
`origin/arena/c9961f17-boiler-control` je `ea5e860` prije ovog docs commita;
`origin/main` je posljednji put provjeren na `fd754f2`. PR nije otvaran.

- Source review je potvrdio da DELETE `/api/devices/:id` prima string i radi
  `+id`. U pregledanim mobile/web potrošačima nema direktnog DELETE poziva.
  Servisni findUnique, 403/404 ownership ponašanje i delete po ID-u nisu
  mijenjani; test ne izvršava stvarno brisanje.
- Postojeći `thermostat-device-http.spec.ts` pokreće stvarni controller i
  produkcijske ValidationPipe opcije s mock servisom. Baseline je bio **6/6**.
  Ovo je controller/path dokaz, ne novi real-DB ownership/delete dokaz.
- Test-only `c5fcc7c` dodaje valjan numeric ID sa 200, cijelim responseom i
  `remove(42,17)`, te malformed ID koji mora dati 400 bez servisa. Lokalni
  repro je **7 prošlo / 1 pao / 8 ukupno**: valjana kontrola prolazi, a
  malformed ID dobija **200**.
- **Test-first CI `41828837866`:** backend **822 prošlo / 1 pao**, svih
  **115/115 integration** zeleno, `tsc: 0`, `eslint: 0`; samo novi malformed
  DELETE scenarij pada. Mobile **24/136** i frontend **4/4** su zeleni.
- Fix `ea5e860` dodaje ParseIntPipe samo na remove DELETE `:id`. Nema Min(1),
  novog flaga ni izmjene servisne ownership/delete logike ili baze. Import već
  postoji, route markeri se ne pomjeraju i inventory ostaje **34**.
- Lokalno je cijeli ThermostatDevice HTTP suite **8/8**. **Finalni code CI
  `41829546605`:** backend **80/823 + 12/115 integration**, mobile **24/136**,
  frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba su success i nema failure
  annotations.
- Samo remove DELETE OpenAPI/frontend path `id` postaje number. Sva četiri
  ThermostatDevice `:id` parametra sada imaju ParseIntPipe i number ugovor.
  Sync/type-check i frontend **92/92** prolaze. Backend ESLint ima **0 errors /
  2 poznata warnings**.
- Nema migracije/backfilla, novog flaga, servisne/mobile/compose promjene ni
  deploya. Rollback je revert `ea5e860`; privremeni Prisma stubovi su uklonjeni.
- **Granica:** mock controller ne dokazuje real-DB owner/foreign/delete tok;
  ID pozitivnost i rollout ostaju otvoreni.

## S-002 — ThermostatDevice update path ID validacija (2026-11-04)

**VERIFIKOVANO, TESTIRANO I PUSHANO: test-first `77c23f8`, fix `88ff6aa`.**
`origin/arena/c9961f17-boiler-control` je `88ff6aa` prije ovog docs commita;
`origin/main` je posljednji put provjeren na `e07f83c`. PR nije otvaran.

- Source review je potvrdio da PATCH `/api/devices/:id` prima string i radi
  `+id`. Mobile `updateDevice(id: number)` već koristi numerički ID; web nema
  direktan poziv ove rute. Servisni findUnique, 403/404 ownership ponašanje,
  provjera profila i update po ID-u nisu mijenjani.
- Postojeći `thermostat-device-http.spec.ts` pokreće stvarni controller i
  produkcijske ValidationPipe opcije s mock servisom/DTO-om. Baseline je bio
  **4/4**. Sva polja stvarnog update DTO-a su opciona, pa je prazan JSON body
  valjana kontrola; ovo nije novi DTO, real-DB ownership ili mutation dokaz.
- Test-only `77c23f8` dodaje valjan numeric ID sa 200, cijelim responseom i
  `update(42,17,{})`, te malformed ID koji mora dati 400 bez servisa. Lokalni
  repro je **5 prošlo / 1 pao / 6 ukupno**: valjana kontrola prolazi, a
  malformed ID dobija **200**.
- **Test-first CI `41825600924`:** backend **820 prošlo / 1 pao**, svih
  **115/115 integration** zeleno, `tsc: 0`, `eslint: 0`; samo novi malformed
  PATCH scenarij pada. Mobile **24/136** i frontend **4/4** su zeleni.
- Fix `88ff6aa` dodaje ParseIntPipe samo na update PATCH `:id`. Nema Min(1),
  novog flaga ni izmjene DTO pravila, servisne ownership/update logike ili baze.
  Import već postoji, route markeri se ne pomjeraju i inventory ostaje **34**.
- Lokalno je cijeli ThermostatDevice HTTP suite **6/6**. **Finalni code CI
  `41826075816`:** backend **80/821 + 12/115 integration**, mobile **24/136**,
  frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba su success i nema failure
  annotations.
- Samo update PATCH OpenAPI/frontend path `id` postaje number; GET findOne i
  programs ostaju number, a DELETE ostaje string. Sync/type-check i frontend
  **92/92** prolaze. Backend ESLint ima **0 errors / 2 poznata warnings**.
- Nema migracije/backfilla, novog flaga, servisne/mobile/compose promjene ni
  deploya. Rollback je revert `88ff6aa`; privremeni Prisma stubovi su uklonjeni.
- **Granica:** mock controller ne dokazuje real-DB owner/foreign/mutation tok;
  ID pozitivnost, DELETE ID ruta i rollout ostaju otvoreni.

## S-002 — ThermostatDevice programs path ID validacija (2026-11-04)

**VERIFIKOVANO, TESTIRANO I PUSHANO: test-first `a891aff`, fix `498e100`.**
`origin/arena/c9961f17-boiler-control` je `498e100` prije ovog docs commita;
`origin/main` je posljednji put provjeren na `4649287`. PR nije otvaran.

- Source review je potvrdio da GET `/api/devices/:id/programs` prima string i
  radi `+id`. Mobile `getDevicePrograms(deviceId: number)` već koristi numerički
  ID; web nema direktan poziv ove rute. Servisni findUnique, program findMany i
  ordering, 403/404 ownership ponašanje i findOne/update/delete nisu mijenjani.
- Postojeći `thermostat-device-http.spec.ts` pokreće stvarni controller i
  produkcijske ValidationPipe opcije s mock servisom. Baseline je bio **2/2**.
  Novi dokaz je controller/path granica, ne novi real-DB ownership dokaz.
- Test-only `a891aff` dodaje valjan numeric ID sa 200, cijelim programs
  responseom i `getPrograms(42,17)`, te malformed ID koji mora dati 400 bez
  servisa. Lokalni repro je **3 prošla / 1 pao / 4 ukupno**: valjana kontrola
  prolazi, a malformed ID dobija **200**.
- **Test-first CI `41821805924`:** backend **818 prošlo / 1 pao**, svih
  **115/115 integration** zeleno, `tsc: 0`, `eslint: 0`; samo novi malformed
  programs GET scenarij pada. Mobile **24/136** i frontend **4/4** su zeleni.
- Fix `498e100` dodaje ParseIntPipe samo na getPrograms GET `:id`. Nema Min(1),
  novog flaga ni izmjene DTO pravila, servisne ownership/program logike ili baze.
  Import već postoji, route markeri se ne pomjeraju i inventory ostaje **34**.
- Lokalno je cijeli ThermostatDevice HTTP suite **4/4**. **Finalni code CI
  `41822404446`:** backend **80/819 + 12/115 integration**, mobile **24/136**,
  frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba su success i nema failure
  annotations.
- Samo programs GET OpenAPI/frontend path `id` postaje number; findOne ostaje
  number, a PATCH/DELETE ostaju string. Sync/type-check i frontend **92/92**
  prolaze. Backend ESLint ima **0 errors / 2 poznata warnings**.
- Nema migracije/backfilla, novog flaga, servisne/mobile/compose promjene ni
  deploya. Rollback je revert `498e100`; privremeni Prisma stubovi su uklonjeni.
- **Granica:** mock controller ne dokazuje real-DB owner/foreign tok; ID
  pozitivnost, PATCH/DELETE ID rute i rollout ostaju otvoreni.

## S-002 — ThermostatDevice findOne path ID validacija (2026-11-04)

**VERIFIKOVANO, TESTIRANO I PUSHANO: test-first `9c99fde`, fix `46fbbbd`.**
`origin/arena/c9961f17-boiler-control` je `46fbbbd` prije ovog docs commita;
`origin/main` je posljednji put provjeren na `00ec393`. PR nije otvaran.

- Source review je potvrdio da GET `/api/devices/:id` prima string i radi `+id`.
  Mobile `getDeviceById(id: number)` već koristi numerički ID; web nema direktan
  poziv ove rute. Servisni findUnique, 403/404 ownership ponašanje i programs,
  update/delete rute nisu mijenjani.
- Novi `thermostat-device-http.spec.ts` pokreće stvarni controller i produkcijske
  ValidationPipe opcije s mock servisom. Ovo je controller/path dokaz, ne novi
  real-DB ownership dokaz. Postojeći real-DB numeric-missing 404 contract test i
  integration tokovi su nepromijenjeni.
- Nije postojao dedikovani controller suite. Test-only `9c99fde` dodaje valjan
  numeric ID sa 200, cijelim nested responseom i `findOne(42,17)`, te malformed
  ID koji mora dati 400 bez servisa. Lokalni repro je **1 prošao / 1 pao / 2
  ukupno**: valjana kontrola prolazi, a malformed ID dobija **200**.
- **Test-first CI `41819704031`:** backend **816 prošlo / 1 pao**, svih
  **115/115 integration** zeleno, `tsc: 0`, `eslint: 0`; samo novi malformed GET
  scenarij pada. Frontend je zelen. Mobile nezavisno ima poznati
  `weatherV2NativeWind` timeout (**135/136**), bez mobile diffa i bez izmjene
  timeouta, asserti ili paralelizma.
- Fix `46fbbbd` dodaje ParseIntPipe samo na findOne GET `:id`. Nema Min(1),
  novog flaga ni izmjene DTO pravila, servisne ownership logike ili baze. Novi
  import pomjera šest ThermostatDevice route markera za jednu liniju; svi su
  usklađeni u fix commitu i inventory ostaje **34**.
- Lokalno je novi suite **2/2**. **Finalni code CI `41820151042`:** backend
  **80/817 + 12/115 integration**, mobile **24/136**, frontend **4/4**,
  `tsc: 0`, `eslint: 0`; sva tri joba su success i nema failure annotations.
- Samo findOne GET OpenAPI/frontend path `id` postaje number; programs, PATCH i
  DELETE ostaju nepromijenjeni. Sync/type-check i frontend **92/92** prolaze.
  Backend ESLint ima **0 errors / 2 poznata warnings**.
- Nema migracije/backfilla, novog flaga, servisne/mobile/compose promjene ni
  deploya. Rollback je revert `46fbbbd`; privremeni Prisma stubovi su uklonjeni.
- **Granica:** mock controller ne dokazuje real-DB owner/foreign tok; ID
  pozitivnost, programs/update/delete ID rute i rollout ostaju otvoreni.

## S-002 — Legacy Weather current path ID validacija (2026-11-04)

**VERIFIKOVANO, TESTIRANO I PUSHANO: test-first `3c709be`, fix `816e537`.**
`origin/arena/c9961f17-boiler-control` je `816e537` prije ovog docs commita;
`origin/main` je posljednji put provjeren na `23857da`. PR nije otvaran.

- Source review je potvrdio da legacy GET `/api/weather/current/:homeProfileId`
  prima string i radi `Number(homeProfileId)`; sve tri v2 ID rute već imaju
  ParseIntPipe. Web helper već koristi `homeProfileId: number`, a mobile koristi
  nepromijenjenu v2 current rutu. Owner/location Prisma upit i WeatherService
  poziv ostaju nepromijenjeni.
- Postojeći `stub-endpoint.spec.ts` pokreće stvarni controller i produkcijske
  ValidationPipe opcije s mock Prismom i weather servisom. Novi dokaz je
  controller/path granica, ne real-DB ownership, missing-location ili
  live-provider dokaz. Integration i STUB_ENDPOINTS_MODE ponašanje su isti.
- Baseline je bio **26/26**. Test-only `3c709be` dodaje valjan numeric ID sa
  200, responseom, upitom `id:17,userId:4242`, location selectom i
  `getTodayWeather('Sarajevo')`, te malformed ID koji mora dati 400 bez oba
  poziva. Lokalni repro je **27 prošlo / 1 pao / 28 ukupno**: valjana kontrola
  prolazi, a malformed ID dobija **200**.
- **Test-first CI `41817823362`:** backend **814 prošlo / 1 pao**, svih
  **115/115 integration** zeleno, `tsc: 0`, `eslint: 0`; samo novi malformed
  legacy Weather current scenarij pada. Frontend i mobile **24/136** su zeleni.
- Fix `816e537` dodaje ParseIntPipe samo na legacy current `homeProfileId`.
  Time sve Weather current/location ID rute imaju numeric parsing. Nema Min(1),
  novog flaga ni izmjene v2 ruta, providera, WeatherServicea, cachea ili baze.
  Import već postoji, route markeri se ne pomjeraju i inventory ostaje **34**.
- Lokalno je fokusirani suite **28/28**, a sa Weather OpenAPI specom **31/31**.
  **Finalni code CI `41818244510`:** backend **79/815 + 12/115 integration**,
  mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba su
  success i nema failure annotations.
- Samo legacy current OpenAPI/frontend path `homeProfileId` postaje number.
  Sync/type-check i frontend **92/92** prolaze. Backend ESLint ima **0 errors /
  2 poznata warnings**.
- Nema migracije/backfilla, novog flaga, servisne/provider/mobile/compose
  promjene ni deploya. Rollback je revert `816e537`; privremeni Prisma stubovi
  su uklonjeni.
- **Granica:** mock controller ne dokazuje stvarni owner/missing-location tok
  ili provider; ID pozitivnost, ThermostatDevice ID rute i rollout ostaju
  otvoreni.

## S-002 — HomeProfile singular update path ID validacija (2026-11-04)

**VERIFIKOVANO, TESTIRANO I PUSHANO: test-first `af926f7`, fix `12ea42e`.**
`origin/arena/c9961f17-boiler-control` je `12ea42e` prije ovog docs commita;
`origin/main` je posljednji put provjeren na `d31b687`. PR nije otvaran.

- Source review je potvrdio da singularni PATCH `/api/home-profile/:id` prima
  string i radi `Number(id)`. Web `updateHomeProfile(id: number)` i singularni
  mobile helper već koriste numerički ID; njihovo ponašanje nije mijenjano.
  Servisni findOne owner lookup, update po ID-u i `mapProfile` ostaju isti.
- HTTP spec sada uključuje oba stvarna controllera, produkcijske ValidationPipe
  opcije i mock servis. Prazan body izoluje path parsing i valjan je sa stvarnim
  UpdateHomeProfileDto jer su sva polja opciona; ovo nije novi DTO, real-DB
  update ili ownership dokaz. Integration je nepromijenjen.
- Baseline je bio **13/13**. Test-only `af926f7` dodaje valjan numeric ID sa
  200, cijelim `mapProfile` responseom i `update(42,17,{})`, te malformed ID
  koji mora dati 400 bez servisa. Lokalni repro je **14 prošlo / 1 pao / 15
  ukupno**: valjana kontrola prolazi, a malformed ID dobija **200**.
- **Test-first CI `41814974102`:** backend **812 prošlo / 1 pao**, svih
  **115/115 integration** zeleno, `tsc: 0`, `eslint: 0`; samo novi malformed
  singularni PATCH scenarij pada. Frontend i mobile **24/136** su zeleni.
- Fix `12ea42e` dodaje ParseIntPipe samo na singularni update `:id`. Time svi
  registrovani HomeProfile `:id` parametri imaju numeric parsing. Nema Min(1),
  novog flaga ni izmjene DTO pravila, `mapProfile`, servisne logike ili baze.
  Import već postoji, route markeri se ne pomjeraju i inventory ostaje **34**.
- Lokalno su oba HomeProfile suitea **15/15**. **Finalni code CI `41815572210`:**
  backend **79/813 + 12/115 integration**, mobile **24/136**, frontend **4/4**,
  `tsc: 0`, `eslint: 0`; sva tri joba su success i nema failure annotations.
- Samo singularni PATCH OpenAPI/frontend path `id` postaje number. Sync/type-check
  i frontend **92/92** prolaze. Backend ESLint ima **0 errors / 2 poznata warnings**.
- Nema migracije/backfilla, novog flaga, servisne/mobile/compose promjene ni
  deploya. Rollback je revert `12ea42e`; privremeni Prisma stubovi su uklonjeni.
- **Granica:** mock controller ne dokazuje DTO payload ili real-DB update i
  ownership; ID pozitivnost, ThermostatDevice/Weather ID rute i rollout ostaju
  otvoreni. Neregistrovani duplikat controllera nije mijenjan.

## S-002 — HomeProfile delete path ID validacija (2026-11-04)

**VERIFIKOVANO, TESTIRANO I PUSHANO: test-first `0513d3b`, fix `e3a8195`.**
`origin/arena/c9961f17-boiler-control` je `e3a8195` prije ovog docs commita;
`origin/main` je posljednji put provjeren na `abae11a`. PR nije otvaran.

- Source review je potvrdio da pluralni DELETE `/api/home-profiles/:id` prima
  string i radi `+id`. Mobile ekran koristi `deleteHomeProfile(id: number)`;
  web nema direktan DELETE poziv. Servisna zabrana brisanja aktivnog profila,
  findOne owner lookup i Prisma delete nisu mijenjani.
- Postojeći HTTP spec pokreće stvarni controller i produkcijske ValidationPipe
  opcije s mock servisom. Novi dokaz je controller/path granica, ne real-DB
  delete, active-profile guard ili ownership dokaz. Integration je nepromijenjen.
- Baseline je bio **11/11**. Test-only `0513d3b` dodaje valjan numeric ID sa
  200/response/`remove(42,17)` i malformed ID koji mora dati 400 bez servisa.
  Lokalni repro je **12 prošlo / 1 pao / 13 ukupno**: valjana kontrola prolazi,
  a malformed ID dobija **200** i dolazi do servisa.
- **Test-first CI `41811782707`:** backend **810 prošlo / 1 pao**, svih
  **115/115 integration** zeleno, `tsc: 0`, `eslint: 0`; samo novi malformed
  DELETE scenarij pada. Frontend i mobile **24/136** su zeleni.
- Fix `e3a8195` dodaje ParseIntPipe samo na pluralni DELETE `:id`. Time svi
  pluralni HomeProfile `:id` parametri imaju numeric parsing. Nema Min(1),
  novog flaga ni izmjene singularne rute, servisne logike ili baze. Import već
  postoji, route markeri se ne pomjeraju i inventory ostaje **34**.
- Lokalno su oba HomeProfile suitea **13/13**. **Finalni code CI `41812292302`:**
  backend **79/811 + 12/115 integration**, mobile **24/136**, frontend **4/4**,
  `tsc: 0`, `eslint: 0`; sva tri joba su success i nema failure annotations.
- Samo DELETE OpenAPI/frontend path `id` postaje number. Sync/type-check i
  frontend **92/92** prolaze. Backend ESLint ima **0 errors / 2 poznata warnings**.
- Nema migracije/backfilla, novog flaga, servisne/mobile/compose promjene ni
  deploya. Rollback je revert `e3a8195`; privremeni Prisma stubovi su uklonjeni.
- **Granica:** mock controller ne dokazuje stvarno brisanje ili active/owner
  guard; ID pozitivnost, singularni PATCH, ThermostatDevice/Weather ID rute i
  rollout ostaju otvoreni.

## S-002 — HomeProfile plural update path ID validacija (2026-11-04)

**VERIFIKOVANO, TESTIRANO I PUSHANO: test-first `4f1016f`, fix `5ebd6e0`.**
`origin/arena/c9961f17-boiler-control` je `5ebd6e0` prije ovog docs commita;
`origin/main` je posljednji put provjeren na `91c8448`. PR nije otvaran.

- Source review je potvrdio da pluralni PATCH `/api/home-profiles/:id` prima
  string i radi `+id`. Mobile ekran koristi `updateHomeProfile(id: number)`;
  web koristi singularni `/api/home-profile/:id`, koji nije mijenjan. Servisni
  findOne owner lookup i update po ID-u ostaju nepromijenjeni.
- Postojeći HTTP spec pokreće stvarni controller i produkcijske ValidationPipe
  opcije s mock servisom. Prazan body izoluje path parsing i valjan je i sa
  stvarnim UpdateHomeProfileDto jer su sva polja opciona; ovo nije novi DTO,
  real-DB update ili ownership dokaz. MO2-20 integration je nepromijenjen.
- Baseline je bio **9/9**. Test-only `4f1016f` dodaje valjan numeric ID sa
  200/response/`update(42,17,{})` i malformed ID koji mora dati 400 bez servisa.
  Lokalni repro je **10 prošlo / 1 pao / 11 ukupno**: valjana kontrola prolazi,
  a malformed ID dobija **200** i dolazi do servisa.
- **Test-first CI `41809377585`:** backend **808 prošlo / 1 pao**, svih
  **115/115 integration** zeleno, `tsc: 0`, `eslint: 0`; samo novi malformed
  PATCH scenarij pada. Frontend i mobile **24/136** su zeleni.
- Fix `5ebd6e0` dodaje ParseIntPipe samo na pluralni update `:id`. Nema Min(1),
  novog flaga ni izmjene singular update/delete/findOne/activate ruta, DTO
  pravila, servisne ownership/update logike ili baze. Import već postoji, pa
  route markeri ostaju na istim linijama i inventory ostaje **34**.
- Lokalno su oba HomeProfile suitea **11/11**. **Finalni code CI `41809891813`:**
  backend **79/809 + 12/115 integration**, mobile **24/136**, frontend **4/4**,
  `tsc: 0`, `eslint: 0`; sva tri joba su success i nema failure annotations.
- Samo pluralni PATCH OpenAPI/frontend path `id` postaje number; singularni
  PATCH ostaje nepromijenjen. Sync/type-check i frontend **92/92** prolaze.
  Backend ESLint ima **0 errors / 2 poznata warnings**.
- Nema migracije/backfilla, novog flaga, servisne/mobile/compose promjene ni
  deploya. Rollback je revert `5ebd6e0`; privremeni Prisma stubovi su uklonjeni.
- **Granica:** mock controller ne dokazuje DTO payload ili real-DB update;
  ID pozitivnost, singular/delete, ThermostatDevice/Weather ID rute i rollout
  ostaju otvoreni.

## S-002 — HomeProfile findOne path ID validacija (2026-11-04)

**VERIFIKOVANO, TESTIRANO I PUSHANO: test-first `95f9244`, fix `904e14c`.**
`origin/arena/c9961f17-boiler-control` je `904e14c` prije ovog docs commita;
`origin/main` je posljednji put provjeren na `91c8448`. PR nije otvaran.

- Source review je potvrdio da GET `/api/home-profiles/:id` prima string i
  radi `+id` u controlleru. Mobile API helper `getHomeProfileById(id: number)`
  već koristi numerički ID; web nema direktan poziv ove GET rute. Servisni
  findOne filter po ID-u i userId-u nije mijenjan.
- Postojeći `home-profile-http.spec.ts` pokreće stvarni controller i
  produkcijski ValidationPipe s mock servisom. Novi GET dokaz nije real-DB
  ownership dokaz; postojeći MO2-20 integration tok ostaje nepromijenjen.
- Baseline je bio **7/7**. Test-only `95f9244` dodaje valjan numeric ID sa
  200/response/`findOne(42,17)` i malformed ID koji mora dati 400 bez servisa.
  Lokalni repro je **8 prošlo / 1 pao / 9 ukupno**: valjana kontrola prolazi,
  a malformed ID dobija **200** i dolazi do servisa.
- **Test-first CI `41807701616`:** backend **806 prošlo / 1 pao**, svih
  **115/115 integration** zeleno, `tsc: 0`, `eslint: 0`; jedini backend failure
  je novi GET scenarij. Mobile job je nezavisno pao na poznatom weather
  timeoutu; mobile izvorni kod i testovi nisu mijenjani.
- Fix `904e14c` dodaje ParseIntPipe samo na findOne GET `:id`. Nema Min(1),
  novog flaga ni izmjene activate/update/delete/singular ruta, servisne
  ownership logike ili baze. Import već postoji, pa route markeri ne mijenjaju
  linije i inventory ostaje **34**.
- Lokalno su oba HomeProfile suitea **9/9**. **Finalni code CI `41808450482`:**
  backend **79/807 + 12/115 integration**, mobile **24/136**, frontend **4/4**,
  `tsc: 0`, `eslint: 0`; sva tri joba su success i nema failure annotations.
- Samo GET OpenAPI/frontend path `id` postaje number. Sync/type-check i
  frontend **92/92** prolaze. Backend ESLint ima **0 errors / 2 poznata warnings**.
- Nema migracije/backfilla, novog flaga, servisne/mobile/compose promjene ni
  deploya. Rollback je revert `904e14c`; privremeni Prisma stubovi su uklonjeni.
- **Granica:** mock controller ne dokazuje novi real-DB GET ownership tok; ID
  pozitivnost, preostale HomeProfile/ThermostatDevice/Weather ID rute i rollout
  ostaju otvoreni.

## S-002 — HomeProfile activate path ID validacija (2026-11-04)

**VERIFIKOVANO, TESTIRANO I PUSHANO: test-first `263f689`, fix `fe22937`.**
`origin/arena/c9961f17-boiler-control` je `fe22937` prije ovog docs commita;
`origin/main` je posljednji put provjeren na `abc1080`. PR nije otvaran.

- Source review je potvrdio da activate prima string ID i radi `+id` tek u
  controlleru. Mobile `switchActiveHome(id: number)` već šalje numerički ID;
  web nema poseban activate poziv, ali generated tip prati ugovor. Servisni
  findOne owner lookup, user update i activeHomeProfileId nisu mijenjani.
- Novi `home-profile-http.spec.ts` pokreće stvarni controller i produkcijski
  ValidationPipe s mock servisom. To nije novi real-DB dokaz; postojeći MO2-20
  integration aktivacije i upis aktivnog profila ostaju zasebni i nepromijenjeni.
- Baseline postojećih HomeProfile testova bio je **5/5**. Test-only `263f689`
  dodaje valjan numeric ID sa 200/response/`activate(42,17)` i malformed ID koji
  mora dati 400 bez servisa. Novi suite dao je **1 prošao / 1 pao / 2 ukupno**:
  valjana kontrola prolazi, a malformed ID dobija **200** i dolazi do servisa.
- **Test-first CI `41801773939`:** **804 prošlo / 1 pao**, svih **115/115
  integration** zeleno, `tsc: 0`, `eslint: 0`; samo novi invalid-ID scenarij
  pada. Asserti i postojeći testovi nisu mijenjani za ispravku.
- Fix `fe22937` dodaje ParseIntPipe samo na activate `:id`. Nema Min(1), novog
  flaga ni izmjene servisne ownership/activation logike ili drugih ID ruta.
  Novi import pomjera deset HomeProfile route markera za jednu liniju; svi su
  mehanički usklađeni u istom commitu i inventory je ponovo **34**.
- Lokalno su oba HomeProfile suitea **7/7**. **Code run `41802431050`:**
  backend **79/805 + 12/115 integration** i frontend **4/4** zeleni su,
  `tsc: 0`, `eslint: 0`. Mobile je **135/136** zbog postojećeg
  `weatherV2NativeWind` timeouta; nema mobile diffa. Isti suite lokalno prolazi
  **3/3** bez promjene timeouta, asserti ili paralelizma. Run nije proglašen
  potpuno zelenim; finalni docs HEAD dobija novi puni CI.
- Samo activate OpenAPI/frontend path `id` postaje number. Sync/type-check i
  frontend **92/92** prolaze. Backend ESLint ima **0 errors / 2 poznata warnings**.
- Nema migracije/backfilla, novog flaga, servisne/mobile/compose promjene ni
  deploya. Rollback je revert `fe22937`; privremeni Prisma stubovi su uklonjeni.
- **Granica:** mock controller ne dokazuje novi DB upis; ID pozitivnost, ostale
  HomeProfile/ThermostatDevice/Weather ID rute i rollout ostaju otvoreni.

## S-002 — Gas invoice download path ID validacija (2026-11-04)

**VERIFIKOVANO, TESTIRANO I PUSHANO: test-first `1be2cc3`, fix `6dc7e90`.**
`origin/arena/c9961f17-boiler-control` je `6dc7e90` prije ovog docs commita;
`origin/main` je posljednji put provjeren na `c51b641`. PR nije otvaran.

- Source review je potvrdio da je invoice GET bio posljednji GasReading `:id`
  bez ParseIntPipe i da radi `+id` tek u controlleru. Web/mobile već koriste
  numerički ID; servisni owner lookup, private PDF stream i headeri su isti.
- Postojeći HTTP suite pokreće stvarni controller i produkcijski ValidationPipe
  s mock servisom i synthetic Readable streamom. To je controller/stream/header
  dokaz, ne novi real-filesystem/DB dokaz; postojeći integration tok je zaseban.
- Baseline je bio **22/22**. Test-only `1be2cc3` dodaje valjan numeric ID koji
  zadržava 200, PDF bajtove/headere i servisne argumente, te malformed ID koji
  mora dati 400 bez servisa. Lokalni repro dao je **23 prošla / 1 pao / 24
  ukupno**: valjana kontrola prolazi, a malformed ID dobija **200**.
- **Test-first CI `41799552405`:** **802 prošlo / 1 pao**, svih **115/115
  integration** zeleno, `tsc: 0`, `eslint: 0`; samo novi invalid-ID scenarij
  pada. Asserti, stream/header očekivanja i postojeći testovi nisu mijenjani.
- Fix `6dc7e90` dodaje postojeći ParseIntPipe samo na invoice GET `:id`. Nema
  Min(1), novog flaga ni izmjene servisnog owner lookupa, private streama,
  filename sanitizerja, headera ili responsea.
- Lokalno je isti suite nakon ispravke **24/24**, a sva tri Gas suitea **57/57**.
  **Finalni code CI `41800096690`:** backend **78/803 + 12/115 integration**,
  mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri
  joba/koraci success i nula failure annotations. Provjereno preko API anotacija.
- Samo GET invoice OpenAPI/frontend path `id` postaje number. Sync/type-check i
  frontend **92/92** prolaze. ESLint ima **0 errors / 2 postojeća warnings**.
  Route markeri i inventory baseline od 34 poznate razlike ostaju stabilni.
- Svih sedam GasReading `:id` ruta sada koristi ParseIntPipe; to zatvara samo
  numeric parsing za taj controller, ne Min(1)/pozitivnost ili druge module.
- Nema migracije/backfilla, novog flaga, servisne/mobile/compose promjene ni
  deploya. Rollback je revert `6dc7e90`; privremeni Prisma stubovi su uklonjeni.
- **Granica:** synthetic stream nije novi real-filesystem/DB dokaz; ID
  pozitivnost, drugi moduli, cijeli DTO inventar i rollout ostaju otvoreni.

## S-002 — Gas meter-image download path ID validacija (2026-11-04)

**VERIFIKOVANO, TESTIRANO I PUSHANO: test-first `4a9ba4b`, fix `9abe486`.**
`origin/arena/c9961f17-boiler-control` je `9abe486` prije ovog docs commita;
`origin/main` je posljednji put provjeren na `a6a8784`. PR nije otvaran.

- Source review je potvrdio da meter-image GET prima string ID i radi `+id`
  tek u controlleru. Web/mobile već koriste numerički ID; servisni owner lookup,
  private stream, MIME i Content-Disposition logika nisu mijenjani.
- Postojeći HTTP suite pokreće stvarni controller i produkcijski ValidationPipe
  s mock servisom i synthetic Readable streamom. To dokazuje controller/stream/
  header granicu, ne stvarni filesystem/DB; postojeći integration tok je zaseban.
- Baseline je bio **20/20**. Test-only `4a9ba4b` dodaje valjan numeric ID koji
  zadržava 200, tačne bajtove/headere i servisne argumente, te malformed ID koji
  mora dati 400 bez servisa. Lokalni repro dao je **21 prošao / 1 pao / 22
  ukupno**: valjana kontrola prolazi, a malformed ID dobija **200**.
- **Test-first CI `41795655135`:** **800 prošlo / 1 pao**, svih **115/115
  integration** zeleno, `tsc: 0`, `eslint: 0`; samo novi invalid-ID scenarij
  pada. Asserti, stream/header očekivanja i postojeći testovi nisu mijenjani.
- Fix `9abe486` dodaje postojeći ParseIntPipe samo na meter-image GET `:id`.
  Nema Min(1), novog flaga ni izmjene servisnog owner lookupa, private streama,
  filename sanitizerja, headera, responsea ili invoice download rute.
- Lokalno je isti suite nakon ispravke **22/22**, a sva tri Gas suitea **55/55**.
  **Finalni code CI `41796151794`:** backend **78/801 + 12/115 integration**,
  mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri
  joba/koraci success i nula failure annotations. Provjereno preko API anotacija.
- Samo GET meter-image OpenAPI/frontend path `id` postaje number; GET invoice i
  druge operacije nisu mijenjane. Sync/type-check i frontend **92/92** prolaze.
  ESLint ima **0 errors / 2 postojeća warnings**. Route markeri i inventory
  baseline od 34 poznate razlike ostaju stabilni.
- Nema migracije/backfilla, novog flaga, servisne/mobile/compose promjene ni
  deploya. Rollback je revert `9abe486`; privremeni Prisma stubovi su uklonjeni.
- **Granica:** synthetic stream nije novi real-filesystem/DB dokaz; ID
  pozitivnost, invoice download ID, drugi moduli i rollout ostaju otvoreni.

## S-002 — Gas invoice DELETE path ID validacija (2026-11-04)

**VERIFIKOVANO, TESTIRANO I PUSHANO: test-first `5b6edf0`, fix `f0a3664`.**
`origin/arena/c9961f17-boiler-control` je `f0a3664` prije ovog docs commita;
`origin/main` je posljednji put provjeren na `caadb83`. PR nije otvaran.

- Source review je potvrdio da invoice DELETE prima string ID i radi `+id` tek
  u controlleru. Web/mobile već koriste numerički ID; servisni owner lookup,
  file deletion i DB update nisu mijenjani.
- Postojeći HTTP suite pokreće stvarni controller i produkcijski ValidationPipe
  s mock servisom. Novi dokaz je controller/path granica, ne real-DB/file dokaz;
  postojeći Gas integration ownership/file tok ostaje zaseban i nepromijenjen.
- Baseline je bio **18/18**. Test-only `5b6edf0` dodaje valjan numeric ID koji
  zadržava 200/response/`deleteInvoice(42,17)` i malformed ID koji mora dati
  400 bez servisa. Lokalni repro dao je **19 prošlo / 1 pao / 20 ukupno**:
  valjana kontrola prolazi, a malformed ID dobija **200** i dolazi do servisa.
- **Test-first CI `41791150307`:** **798 prošlo / 1 pao**, svih **115/115
  integration** zeleno, `tsc: 0`, `eslint: 0`; samo novi invalid-ID scenarij
  pada. Asserti i postojeći testovi nisu mijenjani za ispravku.
- Fix `f0a3664` dodaje postojeći ParseIntPipe samo na invoice DELETE `:id`.
  Nema Min(1), novog importa/flaga ni izmjene drugih ID ruta, servisnog owner
  lookupa, file deletiona, DB updatea ili responsea.
- Lokalno je isti suite nakon ispravke **20/20**, a sva tri Gas suitea **53/53**.
  **Finalni code CI `41791663202`:** backend **78/799 + 12/115 integration**,
  mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri
  joba/koraci success i nula failure annotations. Provjereno preko API anotacija.
- Samo DELETE invoice OpenAPI/frontend path `id` postaje number; upload i obje
  download rute nisu mijenjane. Sync/type-check i frontend **92/92** prolaze.
  ESLint ima **0 errors / 2 postojeća warnings**. Route markeri i inventory
  baseline od 34 poznate razlike ostaju stabilni.
- Nema migracije/backfilla, novog flaga, servisne/mobile/compose promjene ni
  deploya. Rollback je revert `f0a3664`; privremeni Prisma stubovi su uklonjeni.
- **Granica:** novi test ne dokazuje stvarni DB/file delete side effect, ID
  pozitivnost, meter/invoice download ID-eve, druge module ni rollout.

## S-002 — Gas invoice upload path ID validacija (2026-11-04)

**VERIFIKOVANO, TESTIRANO I PUSHANO: test-first `da4b941`, fix `2bfa4e3`.**
`origin/arena/c9961f17-boiler-control` je `2bfa4e3` prije ovog docs commita;
`origin/main` je posljednji put provjeren na `222c4cc`. PR nije otvaran.

- Arena je ponovo vratila grafted HEAD `179d171` i prividni masovni diff.
  Dogovoreni fetch + `git reset --mixed` na remote `222c4cc` vratio je čisto
  stablo, bez `--hard`; HEAD/main/radna grana su tada bili usklađeni. Backend
  (894) i frontend (664) dependencies vraćeni su npm ci bez lockfile izmjena.
- Source review je potvrdio da invoice POST prima string ID i radi `+id` tek u
  controlleru. Web/mobile već šalju numerički ID, `invoicePdf` i optional DTO
  cijenu; servisni owner lookup, storage, transakcija i price history nisu dirani.
- Postojeći HTTP suite pokreće stvarni controller, FileInterceptor, DTO i
  produkcijski ValidationPipe s mock servisom. To je controller/multipart dokaz;
  postojeći real-DB/file integration tok ostaje zaseban i nepromijenjen.
- Baseline je bio **16/16**. Test-only `da4b941` dodaje valjan numeric ID s
  201/response/DTO cijenom/file argumentima i malformed ID koji mora dati 400
  bez servisa. Lokalni repro dao je **17 prošlo / 1 pao / 18 ukupno**: valjana
  kontrola prolazi, a malformed ID dobija **201** i dolazi do mock servisa.
- **Test-first CI `41788986551`:** **796 prošlo / 1 pao**, svih **115/115
  integration** zeleno, `tsc: 0`, `eslint: 0`; samo novi invalid-ID scenarij
  pada. Asserti, DTO, PDF i postojeći testovi nisu mijenjani za ispravku.
- Fix `2bfa4e3` dodaje postojeći ParseIntPipe samo na invoice POST `:id`.
  Nema Min(1), novog importa/flaga ni izmjene FileInterceptor, UploadInvoiceDto,
  file-limit, content-signature, storage, ownership, transakcije ili responsea.
- Lokalno je isti suite nakon ispravke **18/18**, a sva tri Gas suitea **51/51**.
  **Finalni code CI `41789558574`:** backend **78/797 + 12/115 integration**,
  mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri
  joba/koraci success i nula failure annotations. Provjereno preko API anotacija.
- Samo POST invoice OpenAPI/frontend path `id` postaje number; GET invoice i
  multipart/DTO shema nisu mijenjani. Sync/type-check i frontend **92/92**
  prolaze. ESLint ima **0 errors / 2 postojeća warnings**. Route markeri i
  inventory baseline od 34 poznate razlike ostaju stabilni.
- Nema migracije/backfilla, novog flaga, servisne/mobile/compose promjene ni
  deploya. Rollback je revert `2bfa4e3`; privremeni Prisma stubovi su uklonjeni.
- **Granica:** novi test ne dokazuje stvarni storage/DB/price-history side effect,
  ID pozitivnost, invoice-delete/download ID-eve, druge module ni rollout.

## S-002 — Gas meter-image upload path ID validacija (2026-11-04)

**VERIFIKOVANO, TESTIRANO I PUSHANO: test-first `89f0e78`, fix `6c0947b`.**
`origin/arena/c9961f17-boiler-control` je `6c0947b` prije ovog docs commita;
`origin/main` je posljednji put provjeren na `1e4e4e5`. PR nije otvaran.

- Na ulazu je Arena vratila grafted HEAD `179d171`, pa se mergeovan rad prikazao
  kao necommitovan. Oporavak je urađen dogovorenim fetch + `git reset --mixed`
  na remote `1e4e4e5`, bez `--hard`; HEAD/remote i radno stablo su zatim čisti.
  Backend (894) i frontend (664) dependencies vraćeni su npm ci iz lockfilea,
  bez manifest/lockfile izmjena.
- Source review je potvrdio da meter-image POST prima string ID i radi `+id`
  tek u controlleru. Web/mobile već šalju numerički ID i multipart `meterImage`.
- Postojeći `gas-upload-http.spec.ts` pokreće stvarni controller, FileInterceptor
  i produkcijski ValidationPipe kroz HTTP, sa synthetic JWT korisnikom i mock
  servisom. Zato dokaz pokriva controller/multipart granicu, ne stvarni storage/DB.
- Baseline je bio **14/14**. Test-only `89f0e78` dodaje valjan numeric ID s
  201/response/file argumentima i malformed ID koji mora dati 400 bez servisa.
  Lokalni test-first dao je **15 prošlo / 1 pao / 16 ukupno**: valjana kontrola
  prolazi, a malformed ID dobija **201** i dolazi do mock servisa.
- **Test-first CI `41779354108`:** **794 prošlo / 1 pao**, svih **115/115
  integration** zeleno, `tsc: 0`, `eslint: 0`; samo novi invalid-ID scenarij
  pada. Asserti, multipart i postojeći testovi nisu mijenjani za ispravku.
- Fix `6c0947b` dodaje postojeći ParseIntPipe samo na meter-image POST `:id`.
  Nema Min(1), novog importa/flaga ni izmjene FileInterceptor, content-signature,
  file-limit, storage, ownership, response ili servisne logike.
- Lokalno je isti suite nakon ispravke **16/16**, a sva tri Gas suitea **49/49**.
  **Finalni code CI `41779782667`:** backend **78/795 + 12/115 integration**,
  mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri
  joba/koraci success i nula failure annotations. Provjereno preko API anotacija.
- Samo POST meter-image OpenAPI/frontend path `id` postaje number; GET na istoj
  putanji i multipart shema nisu mijenjani. Sync/type-check i frontend **92/92**
  prolaze. ESLint ima **0 errors / 2 postojeća warnings**. Route markeri i
  inventory baseline od 34 poznate razlike ostaju stabilni.
- Nema migracije/backfilla, novog flaga, servisne/mobile/compose promjene ni
  deploya. Rollback je revert `6c0947b`; privremeni Prisma stubovi su uklonjeni.
- **Granica:** stvarni storage/DB/file side effecti, ID pozitivnost, invoice i
  download ID parametri, ostali moduli i produkcijski rollout nisu obuhvaćeni.

## S-002 — Gas reading DELETE path ID validacija (2026-11-03)

**VERIFIKOVANO, TESTIRANO I PUSHANO: test-first `de896a8`, fix `d922323`.**
`origin/arena/c9961f17-boiler-control` je `d922323` prije ovog docs commita;
`origin/main` je posljednji put provjeren na `89514f4`. PR nije otvaran.

- Source review je potvrdio da `DELETE /api/gas/reading/:id` prima string i
  radi `+id` tek u controlleru. Web i mobile već šalju numerički ID;
  servisni owner lookup, file deletion i DB delete nisu mijenjani.
- Postojeći `gas-upload-http.spec.ts` pokreće stvarni controller kroz HTTP s
  produkcijskim ValidationPipe opcijama i synthetic JWT guard korisnikom.
  Servisni delete je mockan na DI boundaryju, pa ovo nije real-DB/file dokaz.
- Baseline je bio **12/12**. Test-only `de896a8` dodaje valjan numeric ID koji
  zadržava 200/response/argumente i malformed ID koji mora dati 400 bez servisa.
  Lokalni test-first dao je **13 prošlo / 1 pao / 14 ukupno**: valjana kontrola
  prolazi, a malformed ID dobija 200 i dolazi do mock servisa.
- **Test-first CI `41734916905`:** **792 prošlo / 1 pao**, svih **115/115
  integration** zeleno, `tsc: 0`, `eslint: 0`; samo novi invalid-ID scenarij
  pada. Asserti i postojeći testovi nisu mijenjani za ispravku.
- Fix `d922323` dodaje postojeći ParseIntPipe samo na DELETE `:id`, mijenja
  lokalni tip u number i uklanja `+id`. Nema Min(1), novog importa/flaga ni
  izmjene drugih ID ruta, servisa, responsea ili stvarnog brisanja fajlova.
- Lokalno je isti suite nakon ispravke **14/14**, a sva tri Gas suitea **47/47**.
  **Finalni code CI `41735480831`:** backend **78/793 + 12/115 integration**,
  mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri
  joba/koraci success i nula failure annotations. Provjereno preko API anotacija.
- OpenAPI i frontend DELETE path tip su number, što postojeći klijenti već
  koriste. Sync/type-check i frontend **92/92** prolaze. ESLint ima **0 errors /
  2 postojeća warnings**. Route markeri i inventory baseline od 34 poznate
  formalne razlike ostaju nepromijenjeni; privremeni Prisma stubovi su uklonjeni.
- Nema migracije/backfilla, novog flaga, servisne/mobile/compose promjene ni
  deploya. Rollback je revert `d922323`.
- **Granica:** real-DB ownership/delete, filesystem side effecti, ID
  pozitivnost, preostali Gas/HomeProfile/ThermostatDevice/Weather ID parametri
  i produkcijski rollout nisu obuhvaćeni.

## S-002 — Gas reference path ID validacija (2026-11-03)

**VERIFIKOVANO, TESTIRANO I PUSHANO: test-first `0763bb9`, fix `56955be`.**
`origin/arena/c9961f17-boiler-control` je `56955be` prije ovog docs commita;
`origin/main` je posljednji put provjeren na `a021c04`. PR nije otvaran.

- Source review je potvrdio da `PATCH /api/gas/reading/:id/reference` prima ID
  kao string i tek u controlleru radi `+id`. Web i mobile već šalju numerički
  ID i postojeći boolean body DTO; `GAS_STRICT_VALIDATION` nije mijenjan.
- Postojeći `gas-upload-http.spec.ts` pokreće stvarni controller kroz HTTP s
  produkcijskim ValidationPipe opcijama i synthetic JWT guard korisnikom.
  `updateReference` je mockan na DI boundaryju, pa je dokaz controller/path
  granica bez baze, ne real-DB vlasnički ili transakcijski test.
- Baseline je bio **10/10**. Test-only `0763bb9` dodaje valjan numeric ID koji
  mora zadržati 200/response/argumente i malformed ID koji mora dati 400 bez
  servisnog poziva. Lokalni test-first dao je **11 prošlo / 1 pao / 12 ukupno**:
  valjana kontrola prolazi, malformed ID dobija 200 i dolazi do servisa.
- **Test-first CI `41732729676`:** **790 prošlo / 1 pao**, svih **115/115
  integration** zeleno, `tsc: 0`, `eslint: 0`; samo novi invalid-ID scenarij
  pada. Asserti i postojeći testovi nisu mijenjani za ispravku.
- Fix `56955be` dodaje postojeći `ParseIntPipe` samo na reference `:id`, mijenja
  lokalni tip u number i uklanja suvišni `+id`. Nema `Min(1)` ili drugih novih
  pravila, niti izmjena ostalih Gas ID ruta, servisa, body DTO-a ili responsea.
- Lokalno je isti suite nakon ispravke **12/12**, a sva tri Gas suitea **45/45**.
  **Finalni code CI `41733423596`:** backend **78/791 + 12/115 integration**,
  mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri
  joba/koraci success i nula failure annotations. Provjereno preko API anotacija.
- OpenAPI path `id` je sada number, a generisani frontend tip prati istu
  promjenu; oba postojeća klijenta već koriste number. Sync/type-check i frontend
  **92/92** prolaze. ESLint ima **0 errors / 2 postojeća warnings**. Privremeni
  generated Prisma stubovi su uklonjeni i nisu commitovani.
- Nema migracije/backfilla, novog flaga, servisne/mobile/compose promjene ni
  deploya. Rollback je revert `56955be`. Novi import pomjera Gas route markere
  za jednu liniju; svi su usklađeni, a inventory baseline ostaje 34 poznate
  formalne razlike.
- **Granica:** drugi Gas/HomeProfile/ThermostatDevice/Weather ID parametri,
  pozitivnost ID-a, real-DB reference transakcija/ownership i produkcijski
  rollout nisu obuhvaćeni ovim sliceom.

## S-002 — Gas analysis query DTO validacija (2026-11-03)

**VERIFIKOVANO, TESTIRANO I PUSHANO: test-first `2ff5f02`, DTO `0f45b90`.**
`origin/arena/c9961f17-boiler-control` je `0f45b90` prije ovog docs commita;
`origin/main` je posljednji put provjeren na `4e0305b`. PR nije otvaran.

- Source review je potvrdio da `GET /api/gas/analysis` koristi pojedinačne
  `@Query('from')`/`@Query('to')` stringove i direktni `new Date`. Web šalje
  `YYYY-MM-DD` kada su oba polja zadana, installed mobile ne šalje parametre,
  a servis zadržava fallback kada nedostaje jedan ili oba datuma.
- Postojeći `gas-upload-http.spec.ts` već pokreće stvarni controller kroz HTTP
  s produkcijskim ValidationPipe opcijama i synthetic JWT guard korisnikom.
  Servis je mockan na DI boundaryju; nema DB poziva. Baseline je **2/2** nakon
  privremenog gitignored PrismaClient stuba koji samo omogućava učitavanje modula.
- Test-only `2ff5f02` dodaje osam scenarija: bez parametara, web raspon, samo
  from, nevažeći from/to, prazan i ponovljeni from te dodatni query parametar.
  Lokalni test-first dao je **5 prošlo / 5 palo / 10 ukupno**: sve tri valjane
  kontrole prolaze, dok svih pet nevažećih oblika dobija 200 i dolazi do servisa.
- **Test-first CI `41730527365`:** **784 prošla / 5 palo**, svih **115/115
  integration** zeleno, `tsc: 0`, `eslint: 0`; samo novi query scenariji padaju.
  Asserti i postojeći multipart testovi nisu mijenjani za ispravku.
- Fix `0f45b90` dodaje `GetGasAnalysisDto` s optional `IsDateString` poljima.
  Globalni whitelist odbija dodatni parametar, a array/empty/malformed vrijednost
  ne prolazi validaciju. Nema novog zahtjeva da from i to dolaze u paru niti
  pravila o redoslijedu/maksimalnom intervalu; servis i response su nepromijenjeni.
- Lokalno je isti suite nakon ispravke **10/10**, a sva tri Gas suitea **43/43**.
  **Finalni code CI `41731170925`:** backend **78/789 + 12/115 integration**,
  mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri
  joba/koraci success i nula failure annotations. Provjereno preko API anotacija.
- OpenAPI je regenerisan; vidljiva razlika su primjeri postojećih optional string
  parametara. Frontend tipovi ostaju nepromijenjeni jer je generisani oblik isti;
  sync/type-check i frontend **92/92** prolaze. ESLint ima **0 errors / 2
  postojeća warnings**. Route markeri i inventory baseline ostaju nepromijenjeni.
- Nema migracije/backfilla, novog flaga, servisne/mobile/compose promjene ni
  deploya. Validni status, response i Date/fallback argumenti ostaju; nevažeći
  query sada daje 400 prije servisa. Rollback je revert `0f45b90`; privremeni
  generated Prisma stubovi su uklonjeni i nisu commitovani.
- **Granica:** stvarni HTTP controller je dokazan s mock servisom, ne real-DB
  analizom. Redoslijed i maksimalni raspon datuma, preostali `:id` parametri,
  produkcijski rollout i drugi neDTO ulazi nisu obuhvaćeni.

## S-002 — Heating event stub DTO validacija (2026-11-03)

**VERIFIKOVANO, TESTIRANO I PUSHANO: test-first `b4652e1`, DTO `ffd1624`.**
`origin/arena/c9961f17-boiler-control` je `ffd1624` prije ovog docs commita;
`origin/main` je posljednji put provjeren na `4e0305b`. PR nije otvaran.

- Source review je potvrdio inline `@Body()` tip na `POST /api/heating-events`.
  Ruta je zadano eksplicitni 501 stub, dok `STUB_ENDPOINTS_MODE=legacy` vraća
  stari sintetički response. Repo frontend/mobile nema POST potrošača; nije
  implementiran stvarni upis niti su dodana fizička temperaturna ograničenja.
- Postojeći `stub-endpoint.spec.ts` pokreće stvarni controller kroz HTTP.
  Harness je dopunjen produkcijskim ValidationPipe opcijama i synthetic JWT
  guard korisnikom; Prisma i vanjske granice ostaju mockane jer ruta ne čita DB.
  Baseline prije izmjene bio je **16/16** zelen.
- Test-only `b4652e1` dodaje deset scenarija: validan legacy response, jedan
  default-invalid i osam legacy-invalid oblika (četiri missing, tri ne-broj/null
  i extra polje). Lokalni test-first dao je **17 prošlo / 9 palo / 26 ukupno**:
  default-invalid 501 umjesto 400 i svih osam legacy-invalid 201 umjesto 400.
- **Test-first CI `41727970087`:** **772 prošla / 9 palo**, svih **115/115
  integration** zeleno, `tsc: 0`, `eslint: 0`; samo novi stub HTTP scenariji
  padaju. Testovi nisu mijenjani za ispravku.
- Fix `ffd1624` dodaje `CreateHeatingEventDto` s obavezna četiri brojčana polja,
  `IsInt` za deviceId i `IsNumber` za temperature. Raw-input transform sprječava
  implicitnu konverziju null/string vrijednosti; nema min/max temperaturne
  politike. Globalni pipe i postojeći stub režimi nisu mijenjani.
- Lokalno je isti suite nakon ispravke **26/26**. **Finalni code CI
  `41728674581`:** backend **78/781 + 12/115 integration**, mobile **24/136**,
  frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba/koraci success i nula
  failure annotations. Provjereno preko runs/jobs/annotations API.
- OpenAPI i frontend tipovi su regenerisani; sync/type-check i frontend **92/92**
  prolaze. Tačan ESLint ima **0 errors / 2 postojeća warnings**. Dokaz je
  stvarni HTTP controller s mock boundaryjima, ne real-DB test.
- Validan default i dalje daje 501, a validan legacy 201 s istim poljima;
  nevažeći DTO sada daje 400 u oba režima. Nema migracije/backfilla, novog flaga,
  mobile/compose promjene ni deploya. `STUB_ENDPOINTS_MODE` je nepromijenjen;
  rollback je revert `ffd1624`.
- **Granica:** stvarno kreiranje/pohrana događaja, ownership uređaja, fizički
  rasponi, produkcijski rollout i drugi neDTO query/param ulazi nisu obuhvaćeni.

## S-002 — notification preferences DTO validacija (2026-11-03)

**VERIFIKOVANO, TESTIRANO I PUSHANO: test-first `32e4e96`, DTO `b7d713c`.**
`origin/arena/c9961f17-boiler-control` je `b7d713c` prije ovog docs commita;
`origin/main` je posljednji put provjeren na `56bb37c`. PR nije otvaran.

- Na ulazu u turn Arena base reset oporavljen je dogovorenim fetch +
  `git reset --mixed` na udaljenu granu. Preostali diff je bio stari pre-S-002
  snapshot koji bi poništio već zeleni manual rad, pa nije commitovan; samo te
  staze su usklađene s HEAD-om. Radno stablo je bilo čisto prije novog testa.
- Source review je potvrdio da `PATCH /api/notifications/preferences` još uvijek
  koristi inline TypeScript tip bez runtime metapodataka. Postojeći frontend i
  mobile šalju samo `{ type, enabled }`, pa validni ugovor nije mijenjan.
- Test-only `32e4e96` dodaje deset stvarnih AppModule/JWT/Prisma/PostgreSQL
  scenarija: anonymous 401, validan true/false upsert uz JWT vlasnika i osam
  nevažećih oblika koji moraju dati 400 bez DB upisa. Pokriveni su nepoznat i
  ne-string/missing type, missing/string/number/object enabled i extra polje.
- **Test-first CI `41723699149`:** **107/115 integration**, tačno osam očekivanih
  padova i zelene obje kontrole. Nevažeći/missing type daje 500, a missing
  enabled čak 200; `tsc: 0`, `eslint: 0`, mobile i frontend zeleni. Asserti
  nisu mijenjani niti ublaženi za ispravku.
- Fix `b7d713c` dodaje `UpdateNotificationPreferenceDTO` s `IsEnum` i
  `IsBoolean`. DTO-lokalni raw-input transform za enabled sprječava da globalni
  `enableImplicitConversion` pretvori string `"false"` u boolean prije
  validacije; globalni pipe i drugi DTO-ovi nisu mijenjani.
- **Finalni code CI `41724589209`:** backend **78/771 + 12/115 integration**,
  mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri
  joba/koraci success i nula failure annotations. Provjereno preko
  runs/jobs/annotations API.
- Lokalni actual-DTO probe s produkcijskim ValidationPipe opcijama prolazi za
  true/false i odbija svih osam nevažećih oblika. OpenAPI i frontend tipovi su
  regenerisani; sync/type-check i frontend **92/92** prolaze. Tačan ESLint ima
  **0 errors / 2 postojeća warnings**. Lokalni real-DB Jest nije pokretan;
  PostgreSQL dokaz je CI.
- Nema migracije/backfilla, novog flaga, mobile/compose promjene ni deploya.
  Validni PATCH response i JWT owner upsert ostaju isti; nevažeći oblici sada
  daju 400 prije Prisma upisa. Rollback je revert `b7d713c`, čime se vraća
  nedostatak runtime validacije.
- **Granica:** drugi inline/interface ulazi, proizvoljni manual `data`,
  length/payload-size politika, token lifecycle i produkcijski deploy nisu
  obuhvaćeni. Ovo ne zatvara cijeli S-002/DTO inventar.

## S-002 — manual notification DTO validacija (2026-11-03)

**VERIFIKOVANO, TESTIRANO I PUSHANO: test-first `da40cab` + `d989849`, DTO `ce1a2cf`, string-tip dopuna `4efede1`.**
`origin/arena/c9961f17-boiler-control` je `4efede1` prije ovog docs commita.
Arena base reset je oporavljen isključivo fetch + `git reset --mixed` na
udaljenu sesijsku granu; radno stablo je bilo čisto prije novog rada. PR nije
otvaran niti je ijedan produkcijski flag/deploy mijenjan.

- Source review je potvrdio S-002: manual DTO je bio interface bez runtime
  metapodataka. Postojeći `CreateNotificationDTO` nije reuseovan jer zahtijeva
  `userId`; novi `dto/manual-notification.dto.ts` prihvaća opcioni legacy
  `userId` samo radi kompatibilnosti, dok controller i dalje koristi JWT userId.
- `notifications-ownership.integration.spec.ts` sada ima deset dodatnih
  stvarnih AppModule/JWT/Prisma/PostgreSQL scenarija: anonymous 401, validan
  response/push/DB upis, JWT ownership uz redundantni userId i sedam nevažećih
  DTO oblika s očekivanim 400 bez push/DB upisa. ExpoPushService je mockan samo
  na DI boundaryju. Device token i korisnici su sintetički; nema stvarnog pusha.
- Test-only CI `41693193798` dao je **96/105 integration** i devet padova.
  Dvije pozitivne kontrole pale su zbog postojećeg SYSTEM_ALERT debouncea, ne
  zbog production regressiona. `d989849` mijenja samo fixture u
  GAS_READING_REMINDER; CI `41693806959` zatim daje **98/105 integration**,
  tačno sedam očekivanih DTO padova i zelene pozitivne kontrole. Oba runa imaju
  `tsc: 0` i `eslint: 0`; asserti nisu ublaženi.
- Prvi DTO code CI `41694883756` dao je **103/105 integration**: preostala su
  samo number-title i object-message kao 201. Uzrok je globalni
  `enableImplicitConversion`, ne nedostatak `@IsString`. `4efede1` vraća raw
  root polje samo za title/message prije validacije; globalni pipe, type enum,
  userId konverzija i ostali DTO-ovi nisu mijenjani.
- **Finalni code CI `41695612403`:** backend **78/761 + 12/105 integration**,
  mobile **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri
  joba/koraci success i nula failure annotations. Provjereno preko
  runs/jobs/annotations API.
- Prvi docs run `41696454679` potvrdio je iste backend/frontend rezultate, ali
  mobile bilježi samo poznati `weatherV2NativeWind` timeout (**135/136**).
  Timeout, asserti i paralelizam nisu mijenjani; svježi puni run slijedi ovim
  evidencijskim pushom bez code/test promjene.
- Lokalni actual-DTO probe pokriva validan/legacy success i number-title,
  object-message, unknown-type, extra-field odbijanje. Swagger probe je korišten
  za tačan oblik sheme; OpenAPI i frontend tipovi su regenerisani, frontend
  sync/type-check i **92/92** prolaze. ESLint: **0 errors / 2 postojeća
  warnings**. Lokalni real-DB Jest nije pokretan; PostgreSQL dokaz je CI.
- Validni manual response i JWT primalac ostaju isti; nevažeći oblici sada 400.
  Nema migracije/backfilla, novog flaga, mobile/compose promjene. Rollback je
  revert `4efede1` i `ce1a2cf` uz zadržavanje testova kao dokaza starog nedostatka.
- **Historijska granica tog slicea:** drugi interface/inline ulazi, proizvoljni
  `data`, length/payload-size politika, token lifecycle i produkcijski deploy
  nisu obuhvaćeni. Preferences je naknadno riješen u gore navedenom `b7d713c`.

## SEC-4 — atomska rotacija refresh tokena (2026-11-03)

**VERIFIKOVANO, TESTIRANO I PUSHANO: test-first `a4607f8` + `6d0f4a5`, fix `de635ad`.**
`origin/arena/c9961f17-boiler-control` je `de635ad` prije ovog docs commita;
vlasnik je SEC-2 docs `21bbbac` već mergeovao u `origin/main`. PR nije otvaran.

- Source review obuhvatio je controller, cookie/refresh DTO, JWT guard,
  `RefreshTokenService`, Prisma model/migraciju, runbook i postojeće testove.
  Pravilo izvora nije slijepo preuzeto: izolovana sonda stvarnog servisa je na
  čistom kodu dala dva fulfilled ishoda, tri vlasnikova reda i dva aktivna
  različita nasljednika. Vrijednosti tokena nisu ispisane.
- Novi `backend/test/integration/auth-refresh.integration.spec.ts` pokreće
  stvarni `RefreshTokenService` s Prisma/PostgreSQL. Postojeći sequential reuse
  slučaj čuva revoke-all i foreign-session izolaciju; barrier-kontrolisani
  konkurentni slučaj zahtijeva jedan fulfilled i jedan rejected
  `UnauthorizedException`, samo stari i jedan novi red, nula aktivnih vlasnikovih
  tokena nakon reusea i jednu aktivnu sesiju drugog korisnika.
- Test-only CI `41668103008` reproducirao je race, ali i prijavio dvije greške
  tipizacije test harnessa. Commit `6d0f4a5` popravio je samo harness; CI
  `41668760579` zatim je dao **750/751 ukupno, 94/95 integration**, `tsc: 0` i
  `eslint: 0`, s očekivanim padom samo konkurentnog testa. Asserti nisu ublaženi.
- Fix `de635ad` koristi conditional `updateMany({ id, revokedAt: null })` i
  kreira nasljednika u istoj transakciji. Samo count=1 dobiva claim; gubitnik ide
  kroz postojeći reuse cleanup i `UnauthorizedException`. `issue()` i dalje ima
  isti javni potpis, a privatni writer prima obični ili transaction-scoped
  Prisma klijent. Unit fake Prisma podržava `$transaction` i uslovni updateMany.
- **Finalni CI `41669534608`:** backend **78/751 + 12/95 integration**, mobile
  **24/136**, frontend **4/4**, `tsc: 0`, `eslint: 0`; sva tri joba/koraci
  success i nula failure annotations. Provjereno preko runs/jobs/annotations API.
- `scripts/audit/refresh_token_concurrency_repro.cjs` koristi stvarni servis i
  barrier fake DB. Prije fixa izlazi sa statusom 1 na `fulfilled, fulfilled`;
  poslije prolazi s `fulfilled, rejected`, `ownerActiveRows: 0` i
  `otherActiveRows: 1`. Fake transakcija serijalizuje claim do završetka da
  modelira PostgreSQL row lock; helper nije dokaz stvarne baze ili HTTP toka.
  ESLint: **0 errors / 2 postojeća warnings**. Lokalni Auth unit bez generated
  Prisma nije pokrenut; svi testovi i generated Prisma prolaze u CI-ju.
- Nema nove migracije/backfilla, novog flaga, DTO/cookie/Bearer/SecureStore/
  access-TTL/frontend/mobile promjene. `AUTH_COOKIE_REFRESH_ENABLED` ostaje
  zadano **off**; nije produkcijski uključen. Rollback ima postojeći flag, dok
  bi revert `de635ad` vratio race. Instalirani mobile ugovor nije mijenjan.
- **Granica:** real-DB spec testira servis, ne AppModule/HTTP/browser i ne
  SecureStore fizički uređaj. `isActive`, access-token revokacija, stari
  password tok, 2FA i produkcijski rollout nisu obuhvaćeni ni odobreni.

## Nastavak 2026-11-03 — SEC-2/B-009/B-010 anomaly ownership i validacija

- **Verificirani test/fix HEAD:** `971c8f9` + `0bbb5db`; udaljena sesijska grana je na `0bbb5db` prije završnog docs upisa. `origin/main` je posljednji put provjeren na `665289c`, nakon vlasnikovog mergea SEC-3 slicea. Vlasnik ručno radi merge, PR se ne otvara.
- **SEC-2 runtime dopuna i minimalna ispravka:** source review je potvrdio postojeći JWT `userId`, owner scope u `findFirst` i `updateMany`, DTO `@IsBoolean`/`@Type(() => Date)`/`@IsDate` i 14 postojećih unit testova. Nije ponovo implementirana owner zaštita. Novi `anomalies-ownership.integration.spec.ts` koristi stvarni AppModule/JWT/Prisma/PostgreSQL s dva korisnika; `HeatingRecommendationService` je mockan samo na DI boundaryju.
  - Sedam scenarija dokazuje anonymous 401 bez side effecta; owner confirm, ISO proposedEndTime i prazan body s postojećim response oblikom i DB read-backom; identičan foreign/missing `200 {success:false,error:"Event not found"}` bez izmjene ili recommendation poziva; malformed datum i podvaljeno `userId` polje 400; te nevažeći eventId 400 prije DB upita.
  - Test-only CI `41662817605` namjerno je pokrenut prije production ispravke: **92/93** real-DB testova prolazi, a jedini pad je invalid ID (**expected 400, received 200**), čime je `NaN` mismatch potvrđen i na stvarnom HTTP/DB toku. Test nije prilagođen starom odgovoru.
  - `0bbb5db` dodaje samo `ParseIntPipe` na postojeći parametar. Finalni code CI `41663389051`: backend **77/749 + 11/93 integration**, `tsc: 0`, `eslint: 0`; mobile **24/136**, frontend **4/4**, sva tri joba/koraci success i nula failure annotations. Porast je +1 suite/+7 testova.
  - Lokalne kontrole: DTO unit **7/7**, oba postojeća offline helpera, integration discovery, izolovani controller/pipe probe **400 / serviceCalled 0** i tačan ESLint **0 errors / 2 postojeća warnings**. Stvarni HTTP/DB dokaz je CI; lokalna baza nije pokretana.
  - Nema migracije/backfilla, flaga, DTO/OpenAPI/compose/deployment promjene. Validni installed-mobile request/response ostaje isti; samo nevažeći ID sada dobija 400. Rollback je revert `0bbb5db` i test/docs slicea, bez uklanjanja postojeće owner zaštite.
  - **Granica dokaza:** recommendation/push nije stvarno izvršen; GET anomalija, konkurentni ownership race, produkcijski proxy/deploy i produkcijski podaci nisu obuhvaćeni.

## Raniji nastavak 2026-11-03 — SEC-3/B-007 admin authorization

- **Verificirani test/helper HEAD:** `54b7de2`; udaljena sesijska grana je istog SHA-a prije završnog docs upisa. `origin/main` je posljednji put provjeren na `0a00e5a`, nakon vlasnikovog mergea SEC-1 slicea. Vlasnik ručno radi merge, PR se ne otvara.
- **SEC-3 runtime dopuna (`54b7de2`):** source review potvrdio je postojeći `@Roles(ADMIN)` + `RolesGuard`; nije bilo production ispravke. Postojeći notification integration spec sada pored SEC-1 dokazuje i masovni reminder kroz stvarni AppModule/JWT/Prisma/PostgreSQL, dok je `GasReminderService` mockan samo na DI boundaryju da ne može poslati stvarni push.
  - Dva nova scenarija dokazuju anonymous 401 i USER 403 bez ijednog delegation poziva, te ADMIN 201 s tačno jednim mock pozivom. Role dolaze iz stvarnih sintetičkih DB korisnika preko JWT guarda; postojeća tri SEC-1 scenarija ostaju nepromijenjena.
  - CI `41658825259`: backend **76/742 + 10/86 integration**, `tsc: 0`, `eslint: 0`; mobile **24/136**, frontend **4/4**, sva tri joba/koraci success i nula failure annotations. Porast je +2 testa bez novog suitea. Postojeći PostgreSQL rollback helper prolazi, a njegov zastarjeli opis otvorenog B-007 nalaza ispravljen je bez promjene izvršavanja.
  - Postojeći throttle dokazi ostaju: `seconds(60)` i stvarni `ThrottlerGuard` s **100 uspješnih + 5×429**. Lokalno prolaze SEC-1 unit **4/4**, throttle **2/2**, helper syntax/help, integration discovery i tačan ESLint **0 errors / 2 postojeća warnings**. Admin unit suite lokalno ne učitava gitignored generated Prisma; CI ga izvršava u zelenom backendu.
  - Nema production code, API/DTO/OpenAPI, migracije/backfilla, flag, compose/deployment, throttle-default ili installed-mobile promjene. Rollback je revert test/helper/docs slicea i ne uklanja admin zaštitu.
  - **Granica dokaza:** nema stvarnog Expo/push slanja niti produkcijskog proxy/IP/deploy dokaza. Pojedinačni `test-gas-reminder`, preferences, token lifecycle i druge notification rute nisu prošireni.

## Raniji nastavak 2026-11-03 — SEC-1/B-006 vlasništvo notifikacija

- **Verificirani test HEAD:** `bc7b847`; udaljena sesijska grana je istog SHA-a prije završnog docs upisa. `origin/main` je posljednji put provjeren na `d3350c7`, nakon vlasnikovog mergea prethodnog export slicea. Vlasnik ručno radi merge, PR se ne otvara.
- **SEC-1 runtime dopuna i korekcija evidencije (`bc7b847`):** source review potvrdio je da zaštita već postoji — kontroler prosljeđuje JWT `userId`, servis radi atomski `updateMany` po `id+userId`, a `count=0` daje isti `Notification not found` za tuđi i nepostojeći zapis. Nije napravljena production ispravka; zastarjeli backlog/API nalaz usklađen je s izvorom.
  - Novi `notifications-ownership.integration.spec.ts` koristi stvarni `AppModule`, `JwtAuthGuard` i Prisma/PostgreSQL s dva korisnika. Tri scenarija dokazuju anonymous 401 bez DB promjene, owner 201 s nepromijenjenim response poljima i `isRead=true`, te identičan foreign/missing 404 bez owner sadržaja i uz nepromijenjeni tuđi zapis.
  - CI `41653900831`: backend **76/740 + 10/84 integration**, `tsc: 0`, `eslint: 0`; frontend **4/4**. Postojeći `http_postgres_repro.cjs --ci` takodjer prolazi s rollbackom. Mobile bilježi samo poznati `weatherV2NativeWind` timeout (**135/136**); timeout, asserti i paralelizam nisu mijenjani. Svježi puni run pokreće se docs pushom bez code/test promjene.
  - Lokalne kontrole: postojeći SEC-1 unit **1 suite / 4 testa**, integration discovery i tačan ESLint **0 errors / 2 postojeća warnings**. Stvarni DB dokaz je CI; lokalna baza nije pokretana.
  - Nema production code, API/DTO/OpenAPI, migracije/backfilla, flag, compose/deployment ili installed-mobile promjene. Rollback je revert test/docs slicea, uz zadržavanje postojeće sigurnosne zaštite.
  - **Granica dokaza:** potvrđen je samo `POST /api/notifications/:id/read`; token lifecycle, preferences, mark-all i masovni reminder nisu prošireni ovim specom. Produkcijski deploy i logovi nisu provjeravani.

## Raniji nastavak 2026-11-03 — FEAT-6/B-020 export stvarni HTTP/PostgreSQL dokaz

- **Verificirani test HEAD:** `9b1a9ea`; udaljena sesijska grana je istog SHA-a prije završnog docs upisa. `origin/main` je posljednji put provjeren na `e291a74`. Vlasnik ručno radi merge, PR se ne otvara.
- **B-020 export runtime dopuna (`9b1a9ea`):** postojeći export izvor već je imao legacy/v2 agregaciju, IANA zonu i offset bucket labele, pa nije bilo produkcijske ispravke. Dva nova scenarija u postojećem `analytics-export.integration.spec.ts` koriste stvarni `AppModule`, `JwtAuthGuard` i Prisma/PostgreSQL.
  - Dva februarska događaja u istom UTC satu na različite dane daju legacy jedan `10:00` bucket sa 75 minuta, dva ciklusa i prosjecima 21/19, dok v2 UTC daje dva hronološka date-hour bucketa s pojedinačnih 30 i 45 minuta. Summary/stats agregati i `sourceRows` su tačno provjereni.
  - V2 `Europe/Sarajevo` scenarij dokazuje ponovljeni DST sat redom `2026-10-25T02:00:00+02:00` pa `2026-10-25T02:00:00+01:00`, s trajanjima 20 i 40 minuta. Februarski/oktobarski fixture je izvan postojećeg januarskog opsega, pa stari owner-scope i maxRows rezultati ostaju nepromijenjeni.
  - CI `41644670775`: backend **75/737 + 9/81 integration**, `tsc: 0`, `eslint: 0`; mobile **24/136**, frontend **4/4**, sva tri joba/koraci success i nula failure annotations. Porast je tačno +2 testa u obje backend brojke, bez novog suitea.
  - Lokalne kontrole: postojeći **6 Dashboard suitea / 57 testova**, export HTTP helper, mutation checks **5/5 killed uz jedinstvene anchor-e**, integration discovery i tačan ESLint **0 errors / 2 postojeća warnings**. Stvarni DB dokaz je CI; lokalna baza nije pokretana.
  - `ANALYTICS_EXPORT_V2_ENABLED=on` postavlja se samo za v2 zahtjeve uz postojeće čišćenje/vraćanje okruženja. `DASHBOARD_BUCKET_V2_ENABLED`, defaulti, production code, API/DTO/OpenAPI, migracije, compose/deployment i installed mobile nisu mijenjani. Rollback je revert test/docs slicea.
  - **Granica dokaza:** ovo ne aktivira export niti summary/stats v2 i ne odabire konačni hour-profile-vs-series ili timezone ugovor. V2 rollout, budući mobile/web JSON potrošači, asinhroni export i produkcijski deploy ostaju otvoreni; PRIV-1 je zaseban.

## Raniji nastavak 2026-11-03 — FEAT-8/B-019 live-vs-historical vremenska kontrola

- **Verificirani test HEAD:** `d4f8d0e`; udaljena sesijska grana je istog SHA-a prije završnog docs upisa. `origin/main` je posljednji put provjeren na `f36a8b4`. Vlasnik ručno radi merge, PR se ne otvara.
- **B-019 live/historical dopuna (`d4f8d0e`):** postojeći izvor već razdvaja historijska event polja `currentTemp/targetTemp` od live thermostat polja `curretTempThermostat/targetTempThermostat`. Peti scenario u postojećem integration specu sada to dokazuje vremenski kroz dva stvarna HTTP/PostgreSQL čitanja istog događaja.
  - Prije device updatea odgovor sadrži historijske `20/22` i live `25/26`. Nakon promjene device reda na `7/30`, historijska polja i trajanje ostaju nepromijenjeni, a live polja postaju `7/30`. Device se vraća na `25/26` u `finally`, a ostali fixture/asserti nisu mijenjani.
  - CI `41638063116`: backend **75/735 + 9/79 integration**, `tsc: 0`, `eslint: 0`; mobile **24/136**, frontend **4/4**, sva tri joba/koraci success i nula failure annotations. Porast je tačno +1 test u obje backend brojke.
  - Lokalne kontrole: postojeći **6 Dashboard suitea / 57 testova**, helper, integration discovery i tačan ESLint **0 errors / 2 postojeća warnings**. Stvarni dokaz je CI; lokalna baza nije pokretana.
  - Nema production code, migracije/backfilla, API/DTO/OpenAPI, compose/deployment, flag ili installed-mobile promjene. Rollback je revert test/docs slicea.
  - **Granica dokaza:** ovo karakterizira sadašnje ponašanje i ne odobrava ga kao konačni ugovor. Odluka o nazivu/semantici live naspram historijskog snapshot polja, njenim klijentima i eventualnom verzioniranju i dalje zahtijeva vlasnika; nije provedena nijedna takva promjena.

## Raniji nastavak 2026-11-03 — FEAT-8/B-020 summary/stats stvarni HTTP/PostgreSQL dokaz

- **Verificirani test HEAD:** `eed8830`; udaljena sesijska grana je istog SHA-a prije završnog docs upisa. `origin/main` je posljednji put provjeren na `f36a8b4`, nakon vlasnikovog mergea cijelog B-019 slicea. Vlasnik ručno radi merge, PR se ne otvara.
- **B-020 runtime dopuna (`9478a9e` + `15694e4` + `eed8830`):** izvor je već imao zadani v1 i opt-in v2 helper/unit ugovor, pa nije bilo produkcijske ispravke. Novi `dashboard-buckets.integration.spec.ts` koristi stvarni `AppModule`, `JwtAuthGuard`, Prisma/PostgreSQL, dva korisnika i potpuno čišćenje sintetičkih fixturea.
  - Šest scenarija dokazuje: anonymous 401 za summary/stats; v1 spajanje dva dana u jedan `10:00` bucket s tačnim agregatima; v2 hronološke UTC date-hour bucket-e; zajednički v2 UTC dan oko ponoći; v2 razdvajanje ponovljenog Europe/Sarajevo DST sata; te identične foreign/missing/no-data odgovore bez skrivanja postojećeg tuđeg fixturea od njegovog vlasnika.
  - CI `41630712262`: backend **75/734 + 9/78 integration**, `tsc: 0`, `eslint: 0`; frontend **4/4**. Mobile je u tom runu zabilježio samo poznati `weatherV2NativeWind` timeout (**135/136**); timeout, asserti i paralelizam nisu mijenjani. Svježi puni run pokreće se docs pushom bez code/test promjene.
  - Prvi pokušaj `41629612657` za `9478a9e` stao je prije HTTP zahtjeva zbog nevažećih polja u novom test fixtureu. `15694e4` usklađuje fixture s aktualnom Prisma shemom i već zelenim B-019 integration obrascem; to nije produkcijski defect.
  - Lokalne kontrole: postojeći **6 Dashboard suitea / 57 testova**, fokusirani bucket unit **1/8**, helper, integration discovery i tačan ESLint **0 errors / 2 postojeća warnings**. Lokalna baza nije pokretana; stvarni HTTP/DB dokaz je navedeni backend CI, ne discovery.
  - Test privremeno postavlja `DASHBOARD_BUCKET_V2_ENABLED=on` samo za v2 zahtjeve i vraća originalnu vrijednost. Default ostaje `off`; nema production code, migracije/backfilla, API/DTO/OpenAPI, compose/deployment, export ili installed-mobile promjene. Rollback je revert test/docs slicea.
  - **Ograničenje i preostalo:** v1 kolaps Sarajevo DST para zavisi od server-local zone i ostaje helper/unit dokaz jer je CI server UTC; novi HTTP/DB DST dokaz vrijedi za v2. Export nije proširen ovim specom. Konačna hour-profile-vs-series i timezone odluka, v2 rollout, live-vs-historical snapshot ugovor i produkcijski deploy ostaju otvoreni.

## Raniji nastavak 2026-11-03 — FEAT-8/B-019 stvarni HTTP/PostgreSQL dokaz

- **Verificirani test HEAD:** `13b0b2e`; udaljena sesijska grana je istog SHA-a prije završnog docs upisa. `origin/main` je posljednji put provjeren na `518ec1a`, nakon vlasnikovog mergea prethodnog SEC-5 owner-only slicea. Vlasnik ručno radi merge, PR se ne otvara.
- **B-019 runtime dopuna (`13b0b2e`):** izvor je već imao per-device mapiranje i owner-scope, pa nije bilo produkcijske ispravke. Novi integration spec koristi stvarni `AppModule`, `JwtAuthGuard` i Prisma/PostgreSQL s dva korisnika, dva vlasnikova uređaja i novijim tuđim događajem.
  - Četiri scenarija dokazuju: anonymous 401; tačne live current/target vrijednosti po uređaju uz pravu nulu i legacy nazive; tačno jedan owner-scoped device `findMany`; foreign/missing filter bez curenja podataka; praznu stranicu bez device lookupa.
  - Lokalne kontrole: postojeći **6 Dashboard suitea / 57 testova**, helper, OpenAPI bez diffa i tačan ESLint **0 errors / 2 postojeća warnings**. Novi spec je u integration discovery; lokalna baza nije pokretana.
  - CI `41583943166`: backend **74/728 + 8/72 integration**, `tsc: 0`, `eslint: 0`; mobile **24/136**, frontend **4/4**, sva tri joba success i nula failure annotations. Porast je tačno +1 suite/+4 testa u obje relevantne Jest brojke.
  - Nema production code, migracije/backfilla, API/DTO/OpenAPI, compose/deployment, flag ili installed-mobile promjene. `DASHBOARD_BUCKET_V2_ENABLED` nije diran. Rollback je revert test/docs slicea.
  - **Preostalo:** live-vs-historical snapshot ugovor, B-020 v2 rollout/timezone odluka i produkcijski deploy. Test ne dokazuje summary/stats/export niti historijske vrijednosti događaja.

## Raniji nastavak 2026-11-02 — SEC-5 owner-only Gas fajlovi

- **Tadašnji SEC-5 owner-only test HEAD:** `08391fc`; udaljena sesijska grana je bila istog SHA-a prije završnog docs upisa. `origin/main` je tada posljednji put provjeren na `d83cdfe`, nakon vlasnikovog mergea prvog SEC-5 slicea. Vlasnik ručno radi merge, PR se ne otvara.
- **SEC-5 owner-only verifikacija (`08391fc`):** izvor je već imao `findFirst({ id, userId })` za Gas download/upload/delete, pa nije bilo produkcijske ispravke. Novi integration spec koristi stvarni `AppModule`, `JwtAuthGuard`, PostgreSQL i privremeni storage s dva korisnika.
  - Pet scenarija dokazuje: anonimno 401; owner 200 s tačnim PDF/JPEG bajtovima i postojećim headerima; identičan foreign/missing 404 za obje download rute; foreign upload/invoice delete/reading delete bez file ili DB side effecta; te owner upload/download kroz puni HTTP tok.
  - Lokalne kontrole: postojeći **4 suitea / 47 testova**, helper, OpenAPI bez diffa i tačan ESLint **0 errors / 2 postojeća warnings**. Novi spec je potvrđen u integration discovery; lokalna baza nije pokretana.
  - CI `41536884218`: backend **73/724 + 7/68 integration**, `tsc: 0`, `eslint: 0`; mobile **24/136**, frontend **4/4**, sva tri joba success i nula failure annotations. Novi spec je uključen u obje relevantne Jest brojke.
  - Prvi docs-only run `41537509573`: backend i frontend su prošli; mobile je zabilježio samo poznati `weatherV2NativeWind` timeout (**135/136**). Timeout, asserti i paralelizam nisu mijenjani; svježi puni run pokreće se dodatnim docs pushom bez code/test promjene.
  - Nema production code, migracije/backfilla, API/DTO/OpenAPI, storage-schema, compose/deployment, flag ili installed-mobile promjene. Rollback je revert test/docs slicea.
  - **Preostalo:** puni parser/antivirus/polyglot, stari fajlovi, retention/restore, filesystem/symlink/deploy i već dokumentovani TOCTOU/reconciliation. Ovaj test ne dokazuje produkcijsku infrastrukturu niti brisanje po odobrenoj retention politici.

## Raniji nastavak 2026-11-02 — SEC-5 upload content-signature

- **Tadašnji SEC-5 signature code HEAD:** `5d14a8b`; udaljena sesijska grana je bila istog SHA-a prije završnog docs upisa. `origin/main` je tada posljednji put provjeren na `8123b3c`, nakon vlasnikovog mergea SEC-7B. Vlasnik ručno radi merge, PR se ne otvara.
- **SEC-5 prvi dio (`5d14a8b`):** zajednički `FileStorageService.storeFile` sada prije kreiranja odredišnog direktorija i upisa provjerava osnovni potpis PDF, JPEG, PNG i WebP sadržaja. Za lažni/mismatched sadržaj i sadržaj kraći od potpisa servis vraća 400; postojeće MIME allowliste i metadata size limit ostaju ispred novih provjera, a random storage naziv i sanitizacija originalnog naziva su nepromijenjeni.
  - Na čistom HEAD-u helper je reproducirao `nonPdfWithPdfMimeStored: true`. Prvih deset testova je test-first dalo **4 očekivana pada / 6 kontrola**; nakon dopune truncated PDF/PNG slučajeva, mutation guard bez `validateContent` daje **6 očekivanih padova / 6 kontrola**, a vraćeni kod prolazi **12/12**.
  - Lokalni završni relevantni skup je **22 suitea / 292 testa + 8 skip**, uključujući postojeći multipart controller/`FileInterceptor` HTTP test. Helper sada potvrđuje validan PDF, sanitizovan naziv i 400 za lažni PDF, nedozvoljen MIME, preveliku metadata veličinu i parent traversal. Tačan ESLint ima **0 errors / 2 postojeća warnings**, a OpenAPI check nema diff.
  - CI `41533224216`: backend **72/719 + 6/63 integration**, `tsc: 0`, `eslint: 0`; mobile **24/136**, frontend **4/4**, sva tri joba success i nula failure annotations.
  - Prvi docs-only run `41534079785` zabilježio je samo poznati `weatherV2NativeWind` timeout (**135/136**); backend **72/719 + 6/63** i frontend **4/4** prošli su. Timeout, asserti i paralelizam nisu mijenjani; završna provjera radi se novim docs pushom bez code promjene.
  - Nema migracije/backfilla, storage-schema, postojećeg fajla/download, API/DTO/OpenAPI, compose/deployment, flag ili installed-mobile promjene. Rollback je revert `5d14a8b`.
  - **Ograničenje:** magic bytes nisu puni parser, antivirus ni dokaz protiv malware/polyglot sadržaja. Stari fajlovi nisu retroaktivno provjereni; download/ownership/retention, filesystem/symlink i produkcijski deploy ostaju izvan ovog slicea. SEC-5 u cjelini nije zatvoren.

## Raniji nastavak 2026-11-02 — SEC-7/7B dependencies, OBS-1/MAINT-3 i raniji koraci

- **Tadašnji SEC-7B code HEAD:** `cc39769`; udaljena sesijska grana je bila istog SHA-a prije završnog docs upisa. `origin/main` je tada posljednji put provjeren na `f426b35`. Vlasnik ručno radi merge, PR se ne otvara.
- **SEC-7B dev/tooling (`cc39769`):** lock-only ne-force refresh uklanja preostale critical/high zapise iz development grafa. Handlebars je 4.7.10, Jest 30.5.2, ts-jest 29.4.15 i typescript-eslint 8.72.1; svih 97 verzijskih promjena je dev-only, a production direct verzije i overridei iz `b6b4fed` su nepromijenjeni. Production audit ostaje exit 0 / nula paketa.
  - Konačni full audit ima **34 zapisa** (0 critical, 0 high, 31 moderate, 3 low): stvarni preostali korijeni su `deepmerge`, `glob` i `minimatch` plus propagirani roditelji. npm za njih traži `@nestjs/cli@12.0.11` preko `--force`, što je major i nije primijenjeno. Nema novih overridea, `package.json` ni source promjena.
  - `npm ci`, ciljani **8 suiteova / 64 testa + 1 skip**, OpenAPI check i ESLint **0 errors / 2 postojeća warnings** prolaze. CI `41528411640`: backend **71/707 + 6/63 integration**, `tsc: 0`, `eslint: 0`; mobile **24/136**, frontend **4/4**, sva tri joba success i nula failure annotations.
  - Nema migracije, API/OpenAPI/mobile promjene ni flaga. Rollback je revert samo `cc39769`, čime production fix iz `b6b4fed` ostaje. Container image scan i produkcijski deploy/audit i dalje nisu izvedeni.
- **SEC-7 production dependencies (`b6b4fed`):** ne-force npm fix i dva ciljana same-major overridea zatvaraju tadašnjih 14 produkcijskih audit zapisa. Axios je 1.21.0, platform-express 11.2.8, Prisma CLI/client/adapter 7.10.1; `multer@2.5.0` je ograničen na platform-express, a `js-yaml@5.5.0` samo na Swagger. Direktni Nest/Prisma/axios major nije mijenjan. `npm ci` je reproducibilan, a `npm audit --omit=dev` vraća exit 0 i nula označenih paketa.
  - Novi stvarni controller/`FileInterceptor` HTTP test dokazuje multipart DTO/file predaju i postojeći 413 file-size limit; prolazio je 2/2 i prije overridea na multer 2.4.0 i poslije na 2.5.0. OpenAPI check prolazi bez diffa, a tačan ESLint ima 0 errors / 2 postojeća warnings.
  - Konačni code CI `41525320585`: backend **71/707 + 6/63 integration**, `tsc: 0`, `eslint: 0`; mobile **24/136**, frontend **4/4**, sva tri joba success i nula failure annotations. Nema migracije, API/OpenAPI/mobile promjene ni flaga; rollback je revert `b6b4fed` i `npm ci` na starom locku.
  - Docs-only run `41526511728` zabilježio je samo poznati `weatherV2NativeWind` timeout (**135/136**); backend i frontend su prošli. Isti puni mobile Jest/coverage oblik lokalno prolazi **24/136** bez promjene timeouta, asserta ili paralelizma, pa se završna provjera radi novim docs pushom, ne izmjenom Weather testa.
  - Na production HEAD-u puni/dev audit je imao **37 označenih paketa** (1 critical, 2 high, 33 moderate, 1 low); SEC-7B ih je naknadno smanjio na 34 bez critical/high. Container image scan, stvarni provider pozivi i produkcijski deploy/audit nisu izvedeni.
- **OBS-1/MAINT-3 health probes (`95789ab` + `6da831e` + `5f0247e`):** dodani su javni `GET /health/live` i `GET /health/ready`. Liveness ne čita bazu ni Redis; readiness izvodi samo `SELECT 1` kroz isti Prisma pool, ograničava čekanje odgovora na 1000 ms i pri grešci/timeoutu vraća generički 503 `{status:'error',timestamp}` bez SQL-a, connection stringa ili interne poruke. Postojeći `/health` i `/dashboard/health` nisu mijenjani, a opciono Redis polje ostaje kompatibilno s `REDIS_URL` i bez njega.
  - Test-first je na neizmijenjenom kodu dao očekivana 3 nova 404 i 2 prošle legacy kontrole. Lokalno: fokusirano **2 suitea / 8 testova + 1 Redis skip**, širi common skup **18/245 + 8 skip**, frontend **11/92**. Integracija u CI dokazuje stvarni PostgreSQL ready 200; kontrolisani 503 koristi `DatabaseHealthService` granicu, ne stvarni PostgreSQL outage.
  - Konačni CI `41512728985` za `5f0247e`: backend **70/705 + 6/63 integration**, `tsc: 0`, `eslint: 0`; mobile **24/136**, frontend **4/4**, sva tri joba success i nula failure annotations. OpenAPI i frontend tipovi su regenerisani; postojeće operacije su nepromijenjene, pa instalirani mobilni klijenti ne dobijaju obaveznu promjenu.
  - Nema migracije, backfilla, novog flaga, compose/deployment healthchecka ni rollouta. Rollback je prestati koristiti nove rute ili revertovati ovaj aditivni slice. Per-instance metrike, queue-lag alarmi, Dockerfile/image smoke i stvarni produkcijski DB outage ostaju otvoreni.
- **MO2-14:** NativeWind migracija završena je kroz `6d540e8`; nema `native-base`, NativeBaseProvider, NativeBase LogBox suppression ni BackHandler polyfilla. CI `41425004414`: backend/mobile success. Fizički vizuelni QA na tri veličine ekrana ostaje otvoren.
- **Weather v2:** osnovna implementacija i ispravke su `aa921fe`, `5627eb0`, `ab040ab`, `309d95e`. Nakon cold-start timeouta u runovima `41438917708` i `41439567029`, `344f6e4` memoizira forecast, a `efd20c9` mountuje location modal tek na zahtjev; timeout, asserti i paralelizam nisu mijenjani. Finalni code CI `41442409308`: backend i mobile success. Backend ima 56 suiteova / 608 testova i 5 integration suiteova / 60 testova; mobile ima 24 suitea / 136 testova.
- **Weather combined SDK/DST replay:** `223193d` dodaje deterministic generator, proljetni/jesenji FlatBuffers fixture i stvarni SDK/provider replay bez mreže. Pokriveni su current, 72 sata/7 dana, sunrise/sunset `valuesInt64`, `INT64_MAX`, prave nule, `NaN` → `null`, preskok i ponavljanje DST sata. To su generisani SDK ulazi, ne live provider capture. CI `41449372725`: sva tri joba success; backend 57 suiteova / 612 testova + 5/60 integration, mobile 24/136, frontend 4/4 E2E.
- **Weather legacy refresh:** `cd0db32` sadrži ispravku za prijavljeni Visoko polling simptom u starom `WeatherService`. HTTP status i FlatBuffers okviri provjeravaju se prije SDK čitanja, nepotpuni blokovi imaju precizniji log, cache do ukupne starosti 60 minuta preživljava privremeni kvar, a uspješan refresh ažurira postojeći red bez prethodnog brisanja. Nema migracije, novog flaga ni API promjene. CI `41453819055`: sva tri joba success; backend 58 suiteova / 620 testova + 5/60 integration, mobile 24/136, frontend 4/4 E2E. Stvarni produkcijski status/tijelo za Visoko nije snimljen i rollout se ne smatra dokazanim.
- **Weather v2 transport:** `34b0024` prebacuje i `OpenMeteoV2Provider` na istu striktnu HTTP/FlatBuffers provjeru, zadržavajući `AbortSignal`, adapter, 72 sata/7 dana, UTC/DST i postojeće flagove. Stubovani 503 više nije lažni `missing forecast blocks`; validni generated fixture i sva mapiranja prolaze. CI `41457554020`: sva tri joba success; backend 58 suiteova / 621 test + 5/60 integration, mobile 24/136, frontend 4/4 E2E. Nema migracije, API promjene ni live capture tvrdnje.
- **Weather legacy timeline:** `2444a7b` + test-only typing ispravka `1747bc0` uklanjaju server-wall-clock/`.at(-1)` izbor trenutnih hourly polja, čine lokalni 06–15 prosjek nezavisnim od server `TZ`, zadržavaju Unix sunrise/sunset instant bez offset pomaka i mapiraju `INT64_MAX` u postojeće nullable polje. Prije ispravke početni synthetic regression suite je imao 8/10 u svakoj od tri stvarne `TZ` zone; poslije prošireni suite prolazi 11/11 u svakoj, a svi Weather testovi 6/38. Finalni CI `41461729530`: sva tri joba success i nula failure annotations; backend 58 suiteova / 624 testa + 5/60 integration uz `tsc: 0` i `eslint: 0`, mobile 24/136, frontend 4/4 E2E. Nema migracije, flag/API/compose/mobile promjene; synthetic SDK dokaz nije live capture ni produkcijski rollout.
- **Weather legacy cache scope:** `747048b` uklanja globalni najnoviji cache kao izvor za Dashboard, HeatingRecommendation i ThermostatPoll. Dashboard fallback ograničen je na njegov postojeći fiksni grad, preporuka koristi `HomeProfile.location`, a polling isti `User.homeLocation` kao BoilerService, uključujući paginated `select`. Na neizmijenjenom production kodu novih 8 testova dalo je 4 očekivana pada i 4 kontrolna prolaza; nakon ispravke focused prolazi 3 suitea / 8 testova, širi relevantni skup 12/82, a svi Weather testovi 6/38. CI `41482048206`: sva tri joba success i nula failure annotations; backend 60 suiteova / 630 testova + 5/60 integration uz `tsc: 0` i `eslint: 0`, mobile 24/136, frontend 4/4 E2E. Formule, persistence, missing-weather ponašanje, API, flagovi, compose i mobile nisu mijenjani; nema migracije, rollouta, profile-aware Dashboard routinga ni v2 consumer enablementa.
- **Recommendation v2 read-only routing (`df980c5` + DI fix `be248ab`):** poseban `WEATHER_RECOMMENDATION_V2=off` i postojeći `WEATHER_LOCATION_V2=on` moraju biti uključeni za novi put. `HeatingRecommendationService` i `DailyRecommendationService` pokušavaju read-only resolver samo uz potvrđeni profil; nedostatak potvrde, cache reda ili v2 min/max vrijednosti i `null` temperature vraćaju consumeru `null`, nakon čega se izvodi neizmijenjeni consumer-specific legacy grad-scoped fallback. Resolver koristi `WeatherV2Service.getCachedWeather`; recommendation event/cron ne može zatražiti refresh niti upsert. V2 datum i tekst dolaze iz timezone potvrđenog profila, bez Dashboard/global mappinga. Formule, nullable semantika, persistencija, API i instalirani mobile klijent ostaju isti.
  - Test-first polazak je dao **2 nova delegation fail / 3 postojeće kontrole pass**; to nije novi regression u već zelenom legacy ponašanju. Konačno lokalno: fokusirani **7/32**, širi Weather/recommendation/Dashboard/ThermostatPoll **22/134**, oba offline helpera, Prettier i diff-check prolaze; tačan ESLint **0 errors / 2 postojeće warnings**.
  - Prvi CI `41485977639` za `df980c5` pao je nakon lint/type/build zbog nedostajućeg `RecommendationWeatherService` resolvera u direktnom `HeatingAnomalyModule` grafu. `be248ab` dodaje `WeatherModule` import i AppModule compile regresiju s mockovanim vanjskim boundaryjima. Konačni CI `41487067378`: backend **64/644 + 5/60**, `tsc: 0`, `eslint: 0`; mobile **24/136**, frontend **4/4**, nula failure annotations.
  - Flag nije produkcijski uključen. Bez već upisanog potvrđenog v2 cache reda novi put ne radi provider fetch, već zadržava legacy fallback. Nema migracije, compose izmjene, rollouta ni produkcijskog dokaza.
- **Boiler v2 read-only routing (`bb9658f`):** poseban `WEATHER_BOILER_V2=off` i postojeći `WEATHER_LOCATION_V2=on` moraju biti uključeni za novi put. `BoilerService` učitava isti prvi `HomeProfile` koji već koristi za proračun i `BoilerWeatherService` za taj profil poziva isključivo `WeatherV2Service.getCachedWeather`. Shared daily mapper zadržava profile-local dan, prave nule i `null` za neupotrebljive podatke; tada se izvodi neizmijenjeni legacy `User.homeLocation`/anonimni `Visoko` fallback. Nema automatskog activate/write, provider refresha ni cache upserta.
  - Test-first polazak na `734ae42`: **1 novi delegation fail / 3 legacy kontrole pass**. Konačno lokalno: fokusirani **9/43**, širi Weather/Boiler/recommendation/Dashboard/ThermostatPoll **25/163**, oba offline helpera, Prettier i diff-check prolaze; tačan ESLint **0 errors / 2 postojeće warnings**. CI `41490920044`: backend **66/655 + 5/60**, `tsc: 0`, `eslint: 0`; mobile **24/136**, frontend **4/4**, nula failure annotations.
  - Docs-only run `41491503218` zabilježio je jedan mobile `weatherV2NativeWind` timeout (**135/136**), dok su backend/frontend prošli; kod je neizmijenjen i code run `41490920044` ima mobile **24/136**. Isti spec lokalno prolazi **3/3** bez promjene timeouta, asserta ili paralelizma. GitHub `rerun-failed` nije dostupan, pa se završna provjera radi novim pushom ovog evidencijskog upisa.
  - Formule, persistence, API/DTO/OpenAPI i instalirani mobile klijent ostaju isti. Poll može indirektno primiti Boiler flow rezultat po ovom flagu, ali njegov zaseban `externalTemp` upis ostaje legacy; Dashboard nije mijenjan. Flag nije produkcijski uključen, nema migracije/backfilla, compose izmjene ni rollouta. Rollback je `WEATHER_BOILER_V2=off`.
- **Poll v2 read-only routing (`c2ef913`):** zaseban `WEATHER_POLL_V2=off` i postojeći `WEATHER_LOCATION_V2=on` moraju biti uključeni za novi put. `ThermostatPollingService.handleHeatingStart` koristi samo `device.homeProfileId` već pridružen uređaju; paginated `select` dobija taj skalar bez vraćanja `homeProfile` relacije. `PollingWeatherService` poziva isključivo `WeatherV2Service.getCachedWeather`, prihvaća samo konačan `current.temperatureC` i zadržava pravu nulu. Hladan cache, nepotvrđena lokacija, skrivena/nedostajuća ili nevažeća vrijednost i isključen flag daju `null` i neizmijenjeni city-scoped legacy fallback; uspješan v2 rezultat preskače legacy weather-cache read.
  - Test-first polazak na neizmijenjenom production kodu: **2 nova pagination-mode delegation fail / 3 legacy kontrole pass**. Konačno lokalno: fokusirani **6/58**, širi Weather/Boiler/recommendation/Dashboard/ThermostatPoll **27/195**, production-mode `AppModule` compile s aktivnim Scheduler Poll providerom prolazi, kao i oba offline helpera, Prettier i diff-check; tačan ESLint **0 errors / 2 postojeća warnings**.
  - CI `41494696373`: backend **67/674 + 5/60**, `tsc: 0`, `eslint: 0`; mobile **24/136**, frontend **4/4**, nula failure annotations. Heating-event idempotency, transakcijske granice, formule, ostala persistencija, recommendation/notification ponašanje i instalirani klijentski ugovori nisu mijenjani. Boiler flow i dalje zavisi samo od `WEATHER_BOILER_V2`; Dashboard nije mijenjan. Nema migracije/backfilla, provider refresh/upserta, flag enablementa ni rollouta. Rollback je `WEATHER_POLL_V2=off`.
- **Dashboard v2 read-only routing (`2cec5fc` + audit harness fix `c407764`):** zaseban `WEATHER_DASHBOARD_V2=off` i postojeći `WEATHER_LOCATION_V2=on` moraju biti uključeni za novi put. Samo autentificirani `GET /api/dashboard` → `system.weather` koristi prvi već učitani profil, isti koji se vraća kao `homes[0]`; nema active-profile upisa. Anonimni Dashboard i `GET /api/weather/current/:id` ostaju na legacy putu. `DashboardWeatherService` poziva isključivo `getCachedWeather`, zadržava postojeći response shape i `WMO_<code>` condition, prave nule i profile-local daily izbor. V2 uspjeh preskače Dashboard legacy weather read; `null` zadržava neizmijenjeni Visoko fallback.
  - Test-first polazak: **3 očekivana delegation/wiring fail / 3 legacy i anonymous kontrole pass**. Konačno lokalno: fokusirani **8/57**, širi Weather/Boiler/recommendation/Dashboard/ThermostatPoll **28/216**, production-mode `AppModule` compile, oba offline weather helpera, Prettier i diff-check prolaze; tačan ESLint **0 errors / 2 postojeća warnings**.
  - Prvi CI `41497907891` pao je samo na zasebnom FEAT-6 repro koraku jer standalone Nest harness nije imao novi resolver; lint/type/OpenAPI/unit/integration, mobile i frontend su prošli. `c407764` dodaje fake resolver u `analytics_export_repro.cjs` i usklađuje `dashboard_repro.cjs`, bez production izmjene; oba helpera zatim prolaze lokalno. Konačni code CI `41498631507`: backend **68/695 + 5/60**, `tsc: 0`, `eslint: 0`; mobile **24/136**, frontend **4/4**, nula failure annotations.
  - Nema migracije/backfilla, API/DTO/OpenAPI/mobile/frontend/compose promjene, provider refresh/upserta, flag enablementa ni rollouta. Recommendation, Boiler i Poll flagovi ostaju neovisni. Rollback je `WEATHER_DASHBOARD_V2=off`.
- **REL-8 konkurentnost (`e76bd07` repro + `cc8622c` + `d91cced`):** test-only clean-HEAD CI `41503819683` deterministički je reproducirao **P2002** kada dva nezavisna Prisma klijenta istovremeno upisuju prazan `deviceId + dayType`. Atomska grana sada u istoj interaktivnoj transakciji uzima `pg_advisory_xact_lock` po uređaju/danu, ponovo čita redove/hash i tek zatim radi create/upsert/cleanup. Oba poziva završavaju, a rezultat je cjelovit program A ili B. Postojeći `PROGRAM_SYNC_ATOMIC_ENABLED=off` ostaje rollback na legacy granu.
  - Privremeni `pg_sleep` trigger u integration specu vrijedi samo za sintetički testni uređaj i ne ulazi u migracije. Prvi lock pokušaj `41504828757` dao je **P2010** jer `$queryRaw` čita `void` rezultat; `d91cced` koristi `$executeRaw` za isti parametrizovani upit. Atomic probe i dalje dokazuje rollback/retry/legacy kontrolu, ciljani Tuya unit je **1 suite / 8 testova**, a tačan ESLint ima **0 errors / 2 postojeća warnings**.
  - Konačni code CI `41505358553`: backend **69/696 + 6/61 integration**, `tsc: 0`, `eslint: 0`; mobile **24/136**, frontend **4/4**, nula failure annotations. Nema migracije/backfilla, API/DTO/OpenAPI/mobile/frontend/compose promjene ni rollouta. Stara miješana stanja se ne popravljaju automatski; stvarni provider/production uticaj nije tvrdnja ovog testa.
- **PRIV-1A:** `5627eb0` dodaje samo read-only `GET /api/auth/export`, zadano `ACCOUNT_EXPORT_ENABLED=off`, nalog i 13 eksplicitno selektovanih vlasničkih kolekcija, no-store, row/byte 413 i verzionirani JSON. Dvokorisnički PostgreSQL test, redakcija i obje granice prolaze u CI. Hashovi, globalni Tuya token, weather cache i privatni storage pathovi su isključeni; gas originali ostaju na owner-only download rutama. Nema migracije ni brisanja.
- **PRIV-1B / MO2-16:** `3fc4e1d` povezuje Settings sa stvarnim backend JSON exportom, ne s Analytics. Mobile validira format/verziju i svih 13 kolekcija, zapisuje `.download` pa atomski preimenuje u `.json` u postojećem dijeljenom downloads cacheu i otvara `expo-sharing`. Dvostruki tap je blokiran; 404, 413, neispravan odgovor i ostale greške imaju različite poštene poruke bez logovanja sadržaja. Clear cache pokriva istu datoteku. Nema novog mobile flaga, backend/DB promjene ni produkcijskog uključivanja.
- **CI dijagnostika koja ostaje korisna:** OpenAPI artefakt koristi rekurzivno sortiranu serializaciju i byte-stabilnu regresiju. Mobile CI koristi postojeći sigurni `jest_report.cjs` uz očuvan originalnog exit koda. Weather async testovi koriste real timers, a 72h/7d formatteri bounded cache.
- **Frontend / FE2-7:** `4543e6c` uklanja sve provjere Traefik labela iz offline checkera jer njima automatski upravlja Coolify. Korijenski compose nije mijenjan i labele nisu vraćane. Zadržane su provjere compose servisa/parsiranja, nginx/expose porta, `VITE_API_URL`, CORS `FRONTEND_URL`, localhost fallbacka, uklonjenog duplicate frontend composea i ugrađenog bundle basea. Temp-copy mutacije daju 9/9 očekivanih ishoda: compose bez labela i compose s proizvoljnim Traefik labelama prolaze, a sedam namjernih compose/API/CORS/localhost/duplicate regresija i dalje pada. CI run `41447108866` je potpuno zelen: backend 56 suiteova / 608 testova + 5 integration suiteova / 60 testova, mobile 24 suitea / 136 testova, a frontend prolazi i Build, embedded-base, bundle evaluaciju/render te 4/4 Playwright E2E testa.
- **Detalji:** `backend/05-weather.md`, `backend/17-priv1-account-export.md`, `mobile/07-implementation-plan.md`. Generisani current+hourly+daily SDK/DST replay je CI-verificiran. Stvarni provider current+hourly+daily/DST capture, produkcijski rollout/migracija, distribuirani SWR, fizički vizuelni QA i fizički native share/Clear cache QA nisu dokazani.
- **Sljedeće vlasničke odluke:** ručni merge i eventualno uključivanje flagova nakon rollout provjere. Ne počinjati brisanje naloga bez backup-retention i eventualne legal-retention politike.

## Stanje na kraju sesije (2026-11-01, VERIFICIRANO)

- Arena sesijska grana `arena/c9961f17-boiler-control`. Vlasnik i dalje ručno
  pull/merge, **PR se ne otvara**. `origin/main` je zadnji provjeren na
  `8735c6c` (PERF-1 merged); compose nije mijenjan.
- **SEC-6 je završen**: svih četiri `/metrics*` rute štiti dedicated
  `METRICS_AUTH_TOKEN` Bearer guard (fail-closed), reporting izvoz koristi
  worst-case agregate bez ID labela, reporting logovi/alert tekst su minimizirani,
  a Prometheus/Grafana stack artefakti obrisani su iz repoa. Implementacija
  **`6845060`**; CI run **`41323254765`**: backend/mobile success, frontend samo
  pre-existing FE2-7. Detalji: `backend/16-sec6-metrics-auth.md`.
- **FE2-10 je završen**: aditivni `Recommendation.breakdown` JSONB snapshot,
  tipiziran `GET /api/recommendations` odgovor i read-only „Razlog preporuke“
  prikaz na Dashboard/Reports ekranima. Formula i vrijednost preporuke nisu
  mijenjani; stari redovi imaju `breakdown: null`. Implementacija
  **`ab08519`** + CI ispravka **`c9fe88c`**; CI run **`41339126329`**:
  backend/mobile success, frontend samo pre-existing FE2-7. Detalji:
  `frontend/09-fe2-10-recommendation-breakdown.md`.
- **FE2-3 je završen**: shared `QueryClient` i query key-ovi, notification/gas
  cache se dijele, ručni `setInterval` polling zamijenjen je React Query
  intervalom koji pauzira u skrivenom tabu. Implementacija **`29ce3c7`**;
  CI run **`41343423105`**: backend/mobile success, frontend samo pre-existing
  FE2-7. Detalji: `frontend/10-fe2-3-react-query.md`.
- **MO2-12 je završen**: mobilni dashboard čita health score i upozorenja iz
  postojećeg `GET /api/dashboard/health`; lokalna health formula i alert
  pragovi su uklonjeni. Implementacija **`5914c9f`**; CI run **`41347741131`**:
  backend/mobile success, frontend samo pre-existing FE2-7. Detalji:
  `mobile/08-mo2-12-health-alerts.md`.
- **MO2-13 je završen**: gas readings lista je virtualizirana (`FlatList`),
  dashboard kartice su memoizirane, Dashboard/Heating dijele isti
  `['dashboard']` key, a polling pauzira kad aplikacija nije aktivna.
  Implementacija **`07acc30`**; CI run **`41351779085`**: backend/mobile
  success, frontend samo pre-existing FE2-7. Detalji:
  `mobile/09-mo2-13-lists-polling.md`.
- **MO2-15 je završen**: mobilni dashboard prikazuje „razlog preporuke“ iz
  backend breakdown snapshota, bez lokalne rekonstrukcije formule; granice
  unosa trenutne temperature centralizirane su i usklađene s backendom.
  Implementacija **`d21a8a4`**; CI run **`41353900211`**: backend/mobile
  success, frontend samo pre-existing FE2-7. Detalji:
  `mobile/10-mo2-15-recommendation-breakdown.md`.
- **MO2-20 je završen**: `GET /api/home-profiles` više ne upisuje
  `user.activeHomeProfileId`, `name`/`location` vraćaju `null` umjesto
  placeholder teksta, a mobilna forma čuva `0`, `false` i `''` kroz `??`.
  Implementacija **`0b0c25d`**; CI run **`41356375190`**: backend/mobile
  success, frontend samo pre-existing FE2-7. Detalji:
  `mobile/11-mo2-20-home-profile-contract.md`.
- **PERF-1 (#38) je završen za prihvaćeni indeks**: sintetički CI benchmark
  prije migracije, standardna migracija `HeatingEvent(deviceId, timestampStart DESC)`,
  legacy `deviceId` indeks zadržan, weather `(city, fetchedAt DESC)` odgođen.
  Implementacija **`579e58c`** + **`d9831c9`**.
- CI run **`41303090502`** na `d9831c9`: backend **success** (eslint/tsc 0,
  OpenAPI sync, PERF-1 benchmark + rollback regresija, 43 suite/535 testova,
  4 integration suite/53 testa), mobile **success**. Frontend je crven samo
  na pre-existing `Deploy config consistent (FE2-7)`. Detalji:
  `backend/15-perf1-index-benchmark.md`.
- **PERF-2 (#39) je završen**: bounded keyset thermostat polling,
  `POLL_PAGINATION_ENABLED` zadano **on** (vlasnik `default_on`),
  `POLL_BATCH_SIZE=100` (1..500), select samo potrebna polja, legacy rollback
  `off`. Implementacija **`763df53`** + CI ispravka **`1b1330e`**.
- FEAT-6 (#35) ostaje završen: bounded synchronous analytics export,
  owner 404, spreadsheet-safe CSV, opt-in v2 JSON/IANA zona/DST, row/range
  limit. `PRIV-1` postoji i ostaje otvoren; asinhroni jobovi nisu rađeni.
  Detalji: `backend/13-feat6-analytics-export.md`.
- Vlasnikove odluke: `analytics_only`, `bounded_sync`, `preserve_compose`,
  `perf2`, `default_on`, `synthetic_ci`, `standard`, `token_fail_closed`,
  `aggregate_worst`, `minimize_reporting`, `keep_metrics_remove_stack`,
  `backend_breakdown`. Root/app compose i FE2-7 checker nisu mijenjani.

## Završeno u ovoj sesiji (sve CI zeleno)

| Stavka | Commiti | CI run |
|---|---|---|
| FE2-2 (#32) auth migracija | `3193f3c` + `3978b66` | `41218607380`, `41218925886` |
| REL-7 (#33) Tuya snapshot | `62977ab` + `83bd15a` + `e0b4e8b` | `41226811814`, `41227022427` |
| TempSet /2 (nastavak REL-7) | `0e544bf` | `41231364645` |
| REL-8 (#34) atomski upis programa | `799a011` + `30188de` + `48a3b41` | `41233788265`, `41233970069` |
| REL-8 dokumentacija | `817b264` | `41236341153` |

## FEAT-6 (#35) — implementirano

**Analytics only + bounded sync.** Iz `backend/09-improvements-backlog.md:48` i
`MASTER-ROADMAP.md:128`, uz vlasnikove odluke:

- Postojeći `GET /api/dashboard/export` sada provjerava vlasništvo prije
  analytics čitanja; tuđi i nepostojeći profil imaju identičan 404.
- CSV neutralizira `=`, `+`, `-`, `@` i vodeće praznine/kontrolne znakove,
  pravilno citira zareze/navodnike/newline, a negativne brojeve ne pretvara u
  tekst.
- Legacy bez `version=2` zadržava omotnicu, kolone, LF i legacy bucket
  semantiku. V2 je iza `ANALYTICS_EXPORT_V2_ENABLED=off` i donosi JSON,
  eksplicitnu IANA zonu, DST-offset satne labele i `meta`.
- Limit: 366 dana i `ANALYTICS_EXPORT_MAX_ROWS` default 10000, hard cap 50000.
  Prekoračenje vraća 413, bez truncation-a.
- **PRIV-1 postoji** (`backend/09-improvements-backlog.md:33`,
  `MASTER-ROADMAP.md:149`) i ostaje otvoren. FEAT-6 nije GDPR export naloga.
- Testovi: CSV/helper/servis/HTTP/PostgreSQL integration, mutation checks 5/5,
  OpenAPI contract i frontend generisani tipovi.
- Datoteke: `backend/src/common/csv.ts`,
  `backend/src/modules/Dashboard/analytics-export.ts`, Dashboard DTO/servis/
  kontroler, `contracts/openapi.json`, `frontend/src/types/api.d.ts`,
  `scripts/audit/analytics_export_repro.cjs`,
  `scripts/audit/analytics_export_mutations.py`,
  `scripts/audit/openapi_dashboard_fragment.cjs`.

## Ostalo otvoreno

- REL-8: **konkurentnost nije verificirana** (PostgreSQL nedostupan); **nema
  jest testa**, verifikacija je samo `program_sync_atomic_probe.cjs`
- `test/unit/tuya-adapter.spec.ts:67,189` koristi `TempSet: 44` ali **ne
  assertuje apsolutnu ciljnu temperaturu**, pa ne štiti TempSet ispravku
- FE2-2: CSRF defense-in-depth i datum uključivanja
  `AUTH_COOKIE_REFRESH_ENABLED` čekaju odluku vlasnika
- Talas D: svi traženi koraci su gotovi (SEC-6, FE2-10, FE2-3, MO2-12,
  MO2-13, MO2-15, MO2-20). Blokirani: MO2-7 (#29), FORM-1 (#31)
- MO2-20: duplikat `name`/`homeName` namjerno zadržan radi instaliranih
  klijenata; generisani tipovi za `homeProfile.api.ts` ostaju otvoreni

## Git stanje (VERIFICIRANO)

- Grana: `arena/c9961f17-boiler-control`
- Implementacijski HEAD: **`0b0c25d`** — MO2-20 home-profile read ugovor.
  Dokumentacijski commit ovog turna je iznad njega.
- `origin/main` je zadnji provjeren na `8735c6c` (PERF-1 merged); compose
  nije mijenjan.
- Zadnji CI run: **`41356375190`** na `0b0c25d`: `test` i `mobile` success,
  `frontend` failure samo na pre-existing FE2-7 deploy config koraku.

**UPOZORENJE — lokalni git ref se vraća na base `179d171` između turnova.**
Desilo se **6 puta**. Prvo u svakom turnu:

```
git rev-parse HEAD          # mora biti 0b0c25d ili novije
git status --short | wc -l  # mora biti 0
```

Ako HEAD pokaže `179d171` i status ~44 fajlova, oporavak je:

```
git fetch origin arena/c9961f17-boiler-control
git reset --mixed origin/arena/c9961f17-boiler-control   # NE --hard; oporavak SHA: 0b0c25d
```

`--mixed` ne dira radno stablo, pa ne-commitovani rad preživi.

## Završeno u ovom turnu

### FE2-2 (#32) — access token iz `localStorage` u memoriju
Commiti `3193f3c` + `3978b66`. CI `41218607380` i `41218925886` oba success.
Detalji u `STATUS.md` sekcija „FE2-2 — Auth migracija".

### REL-7 (#33) — Tuya snapshot: nepoznato nije nula (B-026)
Commiti `62977ab` + `83bd15a` + `e0b4e8b`. CI `41226811814` i `41227022427`
oba success. Detalji u `STATUS.md` sekcija „REL-7 — Tuya snapshot".

Ključno: aplikacija **ne upravlja** Tuya termostatom (read-only API, 0 PUT/POST
pogodaka), pa B-026 nije fizički sigurnosni rizik nego integritet podataka.
Ispravka ne uvodi fail-safe stanje nego princip *ne bilježiti promjenu koju ne
možemo posmatrati*. Zastavica `INCOMPLETE_SNAPSHOT_GUARD_ENABLED`, zadano
UKLJUČENO.

## NALAZ `TempSet /2` — RIJEŠEN (vlasnik potvrdio uslov)


**RJEŠENJE (2026-10-31).** Vlasnik je potvrdio uslov: *ako `TempSet` dolazi iz
Tuya adaptera, a ne iz baze, i on treba `/2`*. Provjereno u kodu —
`tuya.adapter.ts:303` čita `status['TempSet']` (odgovor Tuya API-ja iz
`fetchStatus`), **nije** iz baze. Nasuprot tome `activeInterval.targetTemp`
dolazi iz `prisma.thermostatProgram` i **već je normalizovan** jer
`decodeTuyaProgram` dijeli s 2 na `:393` prije `syncProgram` upisa — tamo se ne
dijeli ponovo. Ispravka primijenjena samo na Tuya granu.

Regression guard ažuriran na realistične duplirane vrijednosti (`TempSet:42`
→ `targetTemp:21`); `TempSet:0` ostaje kao kontrola stvarne nule. Guard EXIT=0,
jest 18/18, eslint (CI komanda) 0 errors, type-check 0 grešaka izvan Prisma
kaskade.

**OTVORENO (nije verificirano):** `test/unit/tuya-adapter.spec.ts:67,189`
koristi `TempSet: 44` ali **ne assertuje apsolutnu ciljnu temperaturu** (testira
brojanje zahtjeva i cache), pa ne štiti ovu ispravku. Vrijedi dodati test koji
assertuje jedinice.

---

## (historijski) NOVI NALAZ — bio otvoren, čeka vlasnika

### (historijski) `TempSet` se ne dijeli s 2 dok se `TempCurrent` dijeli — HIPOTEZA

Vlasnik je potvrdio da Tuya vraća duplirane vrijednosti (44 → 22 °C).

| Linija | Kod | Dijeli s 2? |
|---|---|---|
| `tuya.adapter.ts:333` | `rawCurrentTemp / 2` | **da** |
| `tuya.adapter.ts:393` | `i.temp / 2` (program) | **da** |
| `tuya.adapter.ts:303` | `toNullableNumber(status['TempSet'])` | **NE** |

Dokaz da je i `TempSet` dupliran: `test/unit/tuya-adapter.spec.ts:66-67`
koristi `TempCurrent: 40, TempSet: 44` (40/2=20 °C, 44/2=22 °C).

**Zašto je HIPOTEZA, ne VERIFIKOVANO:** nema pristupa stvarnom Tuya API-ju, a
navedeni test ne assertuje ciljnu temperaturu (testira brojanje zahtjeva), pa
nije dokaz namjere.

**Posljedica ako je tačno:** fallback grana (`Mode !== '0'` ili bez programa)
vraća cilj 44 umjesto 22, pa `resolveHeatingState` (`polling.service.ts:467-468`)
vidi `20 < 44` i **uvijek grije**.

**Namjerno NIJE dirano** u REL-7 — bila bi promjena ponašanja bez odobrenja, a
vlasnik ima stvarni uređaj da to potvrdi.

**Idući korak kad vlasnik potvrdi:** podijeliti `TempSet` s 2 na `:303`, dodati
test koji assertuje jedinice, i provjeriti da li `Mode === '0'` grana (koja
čita cilj iz baze, `activeInterval.targetTemp`) već ima °C — miješanje jedinica
između te dvije grane je isto moguće.

## REL-8 (#34) — historijski zapis atomskog dijela

**Stanje:** commitovano i pushano. Commiti `799a011` (implementacija) +
`30188de` (TS2345 fix) + `48a3b41` (Prettier fix). CI run **`41233788265`** =
`completed success`, sva tri joba (`test` 21, `frontend` 18, `mobile` 10).

**Tada je nedostajalo (historijski zapis):**
- `docs/audit/STATUS.md`: nema REL-8 sekciju
- `docs/audit/backend/09-improvements-backlog.md`: REL-8 red (linija 54, 6
  ćelija) NIJE označen kao riješen
- `docs/audit/backend/04-findings.md`: B-027 nema razrješenje
- Novi jest test NE postoji — verifikacija je samo `program_sync_atomic_probe.cjs`
- Provjera homoglyfa u HANDOFF-u će naći cirilicu/CJK: to su **citirani
  primjeri** u odjeljku o non-ASCII zamkama, NE defekti.

**Šta je urađeno:**
- Dodan `PROGRAM_SYNC_ATOMIC_FLAG` + `programSyncAtomicEnabled()` (zadano ON)
- `syncDay` grana 3 je sada uslovna: atomski put ili stari put
- Nova metoda `applyDayAtomically()` — upsert svih intervala + `deleteMany`
  cleanup u jednom `this.prisma.$transaction(operations)`
- Type-check: **nula novih grešaka**. Jedina greška u fajlu (`TS2538` na
  `tuyaProgram[dayType]`) je **pre-postojeća** — verificirano na čistom HEAD-u
  u worktreeu, gdje je na `:24` (pomaknuta na `:41` mojim umetnutim blokom).

**ATOMICNOST JESTE VERIFICIRANA** — proba `program_sync_atomic_probe.cjs`
(EXIT=0) dokazuje: pad na 2. upsertu ostavlja bazu netaknutu, retry završava
posao i briše `orderIndex 2`, a kontrola sa zastavicom `off` i dalje ostavlja
miješano stanje (što dokazuje da proba nešto hvata).

**Šta NIJE verificirano — konkurentnost:**

**Dvije CI lekcije (oba pada su bila moja):**
1. `TS2345` na `operations.push(deleteMany)` — **lokalno se nije pojavio** jer
   nedostaje generisani Prisma klijent pa je `upsert` tipa `any`. U CI-ju je
   klijent generisan. **Lokalni `tsc` NE može zamijeniti CI type-check za
   Prisma tipove.**
2. Prettier grešku sam pushao jer sam commitovao ne provjerivši koju grešku
   eslint javlja (vidio sam samo `errors=1`). **Uvijek ispisati greške, ne samo
   broj.**

`scripts/audit/program_sync_partial_repro.cjs` **pada** (EXIT=1), ali NE zato
što je ispravka pogrešna. Njen fake repozitorij definiše `upsert` kao običnu
`async` funkciju koja se **izvršava odmah pri pozivu**. Moj kod gradi niz
operacija preko `.map()`, pa se u fake-u svi upserti izvrše **prije** nego što
`$transaction` uopće bude pozvan — sintetički pad izbaci tokom izgradnje niza.

Stvarni Prisma se ponaša drugačije: `prisma.thermostatProgram.upsert(...)`
vraća `PrismaPromise` koji se **ne izvršava** dok se ne await-uje ili preda
`$transaction`. Dakle kod je ispravan za stvarni Prisma, ali **fake harness ne
modelira lazy PrismaPromise**, pa njime nije moguće dokazati all-or-nothing.

**Idući korak:** proširiti fake da vraća lazy opise operacija i implementira
`$transaction(ops)` koji izvršava redom i **poništava** na padu (rollback u
memoriji). Tek tada se može assertovati da pad ostavlja bazu netaknutom.
Alternativno: pravi integracijski test na PostgreSQL-u — ali PostgreSQL ovdje
nije dostupan.

**Tada konkurentnost NIJE bila riješena.** `$transaction` daje atomičnost, ne
izolaciju protiv dva paralelna procesa. Kriterij je kasnije zatvoren stvarnim
PostgreSQL testom i advisory lockom; aktualni rezultat i commiti su u vrhu
dokumenta pod „REL-8 konkurentnost".

## Sljedeće po redoslijedu (Talas D)

`docs/audit/MASTER-ROADMAP.md`. Traženi redoslijed ovog turna je zatvoren:
SEC-6, FE2-10, FE2-3, MO2-12, MO2-13, MO2-15 i MO2-20 su gotovi i
CI-verificirani.

Gotovo: REL-4, MAINT-2, MAINT-4, REL-7, REL-8, FEAT-6, PERF-2, PERF-1, SEC-6,
FE2-10, FE2-3, MO2-12, MO2-13, MO2-15, MO2-20.

Sljedeći kandidati iz reda u `docs/audit/mobile/06-improvements-backlog.md`
i `docs/audit/backend/09-improvements-backlog.md` traže novu vlasničku odluku
(npr. MO2-14 NativeBase migracija, MO2-17 weather v2, PRIV-1).

Blokirani: MO2-7 (#29), FORM-1 (#31 — vlasnik traži referentne senzorske
uzorke).

## Obavezujuće konvencije (iz prethodnih turnova)

- Nikad PR na ovoj grani — vlasnik ručno radi pull/merge. Commit+push odobreni.
- **Provjeriti CI ishod prije nego se korak proglasi gotovim.** Poll
  `gh api .../actions/runs/{id}` do `completed`, pa provjeriti jobove i
  anotacije. `gh run view --log-failed` NE radi (host nije na allowlistu).
- CI lint korak pokreće eslint **bez** `--fix`. Lokalni `npm run lint` ima
  `--fix`. Provjera mora koristiti CI-jevu tačnu komandu:
  `npx eslint 'src/**/*.ts' 'test/**/*.ts' --ignore-pattern 'src/generated/**'`
- Svaki korak plana: cilj, fajlovi, migracija/rollback, feature flag, obavezni
  testovi s komandom, pomoćne skripte, kriterij prihvatanja, procjena truda,
  kompatibilnost unazad.
- Dokumenti na bosanskom, identifikatori na engleskom.
- Backlog redovi se označavaju `**RIJEŠENO U KODU <datum> (ID, sha):** …
  **OSTAJE OTVORENO:** …`. Tabela ima **6 ćelija** — pazi na `|` u tekstu
  (REL-7 je imao `number | null` i razbio tabelu na 7).
- `MASTER-ROADMAP.md` je čista ICE rang-lista, bez oznaka napretka.
- Nakon commita koji dokument pokazuje na SHA: **ne amendati**, napraviti novi
  commit.

## Okruženje — šta radi, šta ne

**Radi:** `npm ci` (backend/frontend/mobile), `npx jest <path>`,
`npx tsc --noEmit`, `npx eslint`, 9 audit skripti (`scripts/audit/*.py`),
`gh api`, repro skripte (`node scripts/audit/*.cjs`).

**NE radi (ne pokušavaj ponovo):**
- `binaries.prisma.sh` → Prisma klijent se ne može generisati ⇒
  `src/generated/prisma/` nedostaje ⇒ `tsc` daje ~2000 grešaka kaskade.
  **Mjerodavno je brojati samo greške u svojim fajlovima, isključujući
  TS2307 i TS2339.**
- `tuya-adapter.spec.ts` i `thermostat-polling-metrics.spec.ts` padaju lokalno
  (nedostaje Prisma klijent) — **potvrđeno da padaju identično na čistom
  HEAD-u**, dakle pre-postojeće.
- Playwright browser CDN, `eas-cli`, `docker`, `nginx`, postgres, redis,
  emulator, `apt-get` (PEP 668 / dpkg lock).
- `node_modules` i `/tmp` se brišu između turnova ⇒ prvo `npm ci`.
- **Bash heredoc izobličava `š`/`č`/`ž`** ⇒ koristiti `write_file` ili Python.
- **Non-ASCII zamke:** tri puta nađen homoglyph (`иначе` u `api.ts`, `gutа`
  U+0430, `о` U+043E u `STATUS.md:468`, `е` U+0435 u `04-findings.md:246`) i
  kineski `事件` u komentaru. Uvijek skenirati:
  `re.findall(r'[\u0400-\u04FF\u4E00-\u9FFF]+', s)`

## Metode koje su se pokazale nužnim

1. **Mutacijska provjera s asertacijom na anker.** „Test prolazi" ne znači
   „test nešto provjerava". Python `assert s.count(old)==1` prije mutacije —
   bez toga mutacija tiho ne bude primijenjena. REL-7: 4/4. FE2-2: 6/6.
2. **Provjeri na čistom HEAD-u prije nego tvrdiš „ja sam ovo slomio"**
   (`git worktree add /tmp/x <sha>`). Više puta se ispostavilo da je pad
   pre-postojeći.
3. **CI-jeva tačna komanda, ne lokalni alias.** REL-7 je pao u CI-ju upravo
   zbog `--fix` razlike.
4. **Poređenje anotacija s prethodnim runom** da se dokaže „nula novih".
5. **Ne vjerovati dokumentaciji bez provjere.** `12-sec4-refresh-token.md:41`
   je preporučivao `SameSite=none` što je vodilo u nesigurniju konfiguraciju.
