# Mobile sigurnost, izdanja i build — Faza 3

## Otvorena pitanja za vlasnika

- Koja je najstarija verzija aplikacije koju backend mora podržavati i postoji li politika prisilnog ažuriranja? (MO-004)
- Koji je stvarni API host i ko postavlja TLS/ivične header-e? (MO-005; isto kao FE-009, B-029, S-009)
- Je li `RECORD_AUDIO` permisija namjerna i šta je upisano u Google Play „Data safety" obrazac? (MO-025)
- Smiju li se fakture/slike brojila čuvati u nešifriranom cacheu i koliko dugo? (MO-020)
- Planira li se iOS izdanje (App Store nalog, `scheme`, `submit` profil)? (MO-004, MO-024)
- Treba li push token brisati s backenda pri odjavi? (MO-003)

## Top 5 nalaza ovog dokumenta

1. **MO-004** — nema strategije izdanja: bez minimalne verzije, force-update i `submit` konfiguracije.
2. **MO-005** — tri različita API hosta u tri konfiguracijska izvora.
3. **MO-003** — push token se ne uklanja pri odjavi; registracija guta sve greške.
4. **MO-020** — fakture i slike brojila trajno u nešifriranom cacheu.
5. **MO-025** — `RECORD_AUDIO` i legacy storage permisije u finalnom Android buildu.

---

### [MO-003] Push token se ne poništava pri odjavi; registracija guta sve greške — Ozbiljnost: SREDNJE — Pouzdanost: VERIFIKOVANO (kod) / HIPOTEZA (posljedica)

- **Gdje:** `mobile/src/context/AuthContext.tsx:146-162` (`registerPushToken` efekt), `:122-132` (`logout` — samo `setUser(null)`, `setToken(null)`, `SecureStorage.removeToken()`, `apiClient.clearToken()`); `backend/src/modules/Notification/notifications.controller.ts:36-42` (`POST /api/notifications/register-token`); `mobile/src/services/notifications/notificationService.ts:48-106`.
- **Šta nije u redu i zašto je bitno:** Token se registruje pri svakoj promjeni `token` stanja, ali pri odjavi **nema poziva koji bi ga uklonio** s backenda. Ako korisnik A odjavi uređaj, a korisnik B se prijavi na isti uređaj, registracija će zamijeniti token (što je u redu), ali između odjave i sljedeće prijave backend i dalje šalje push korisniku A na taj uređaj — a notifikacije sadrže naslove/poruke o potrošnji plina i preporukama. Registracija je također „all-or-nothing" s `console.warn` (`:157`): ako `registerForPushNotifications` ili mrežni poziv padnu, korisnik nikad ne sazna da neće primati obavijesti, a nema ni ponovnog pokušaja.
- **Dokaz:** Kod na navedenim linijama; `grep -n "unregister\|deleteToken\|removeToken" mobile/src` → samo lokalno brisanje tokena, bez mrežnog poziva. Backend katalog (Faza 1, `02-api-catalog.md`) ne navodi endpoint za odjavu tokena — dakle ni backend ga nema.
- **Preporuka:** (1) Dodati backend endpoint `DELETE /api/notifications/register-token` (ili `POST /unregister`) i pozvati ga u `logout()` prije brisanja lokalnog tokena; (2) u mobilnom klijentu razlikovati „korisnik odbio dozvolu" (prikazati objašnjenje i voditi u postavke — `expo-intent-launcher` je već zavisnost) od „mrežna greška" (ponoviti pri sljedećem pokretanju); (3) evidentirati neuspjeh registracije u stanju koje `SettingsScreen` može prikazati (povezano s MO-008).
- **Kako provjeriti da je riješeno:** Integracijski test: registracija tokena → odjava → backend više ne šalje na taj token (assert nad `Notification`/push mockom); unit test: mrežni pad pri registraciji ne lomi prijavu, a stanje greške je vidljivo.
- **Trud:** M — **Zavisnosti:** backend Notification modul (Faza 1 nalaz R-006), MO-012.

---

### [MO-004] Nedostaje strategija izdanja i kompatibilnosti starih verzija — Ozbiljnost: VISOKO — Pouzdanost: VERIFIKOVANO

- **Gdje:** `mobile/eas.json` (profili `development` i `production`; `submit.production` je prazan `{}`); `mobile/app.config.js:9` (`version: config.version || '1.0.0'`), `:79` (`versionCode: config.android?.versionCode || 1`); `mobile/package.json:3` (`"version": "2.0.0"`); `mobile/src/screens/settings/SettingsScreen.tsx:368` (`subtitle="2.0.0"`); cijeli `src` — nema provjere verzije, nema `expo-updates`, nema `minVersion` poziva.
- **Šta nije u redu i zašto je bitno:** Ne postoji mehanizam kojim bi backend odbio ili upozorio staru verziju aplikacije. Kad se API ugovor promijeni (a Faza 1 plan predlaže verzioniranje `/v1`, OpenAPI tipove i promjene DTO-a), sve instalirane verzije **tiho pucaju** bez mogućnosti da se to detektuje. Tri izvora verzije se ne poklapaju: `package.json` 2.0.0, `app.json`/`app.config.js` 1.0.0, a `SettingsScreen` prikazuje hardcoded „2.0.0". `versionCode` je fiksno 1, pa se oslanja isključivo na `appVersionSource: "remote"` — bez toga build ne bi prošao Play proceduru. `eas.json` nema `preview` profil, a `submit.production` je prazan, što znači da ne postoji automatizovano objavljivanje ni definisana putanja do store-a.
- **Dokaz:** `npx expo config --type public --json` → `"version":"1.0.0"`, `"android":{"versionCode":1,…}`; `grep -rn "expo-updates\|minVersion\|forceUpdate\|checkUpdate" mobile/src mobile/package.json` → 0 pogodaka; sadržaj `eas.json`.
- **Preporuka:** (1) Uvesti jedan izvor verzije (`app.config.js` čita `package.json`), ukloniti hardcoded „2.0.0" iz `SettingsScreen`; (2) dodati backend endpoint `GET /api/app/version` (ili polje u `/api/auth/me`) s `minSupportedVersion` i `latestVersion`, te mobilni „update required" ekran iza kojeg se ne može dalje; (3) dodati `expo-updates` za OTA ispravke JS bundlea (uz jasnu granicu: native promjene i dalje zahtijevaju store build); (4) popuniti `eas.json` (`preview` profil, `submit` s pravim kredencijalima iz EAS secret-a, ne iz repozitorija); (5) svaku backend promjenu ugovora vezati uz bump minimalne verzije u planu.
- **Kako provjeriti da je riješeno:** Test: backend vraća `minSupportedVersion` višu od trenutne → aplikacija prikazuje update ekran i ne dozvoljava navigaciju; `npx expo config` i `SettingsScreen` prikazuju istu verziju; `eas build --profile preview --dry-run` prolazi.
- **Trud:** M — **Zavisnosti:** backend API (novi endpoint), odluka o store nalogu; usklađeno s backend planom verzioniranja `/v1`.

---

### [MO-005] Tri različita API hosta u tri konfiguracijska izvora — Ozbiljnost: VISOKO — Pouzdanost: VERIFIKOVANO

- **Gdje:** `mobile/eas.json` (oba profila: `EXPO_PUBLIC_API_URL: "https://api.boiler-control.ba101.top/api"`); `mobile/app.config.js:6` (isti URL); `mobile/app.json` (`extra.EXPO_PUBLIC_API_URL`, isti); `mobile/src/config/api.config.ts:29-34` (`__DEV__` fallback: `'https://boiler.ba101.top/backend/api'` za **obje** platforme, uz komentar o `10.0.2.2` koji se ne koristi); `mobile/.env.example` (`http://192.168.31.247:3020/api`); `mobile/docs/API_CONFIG.md` (tvrdi Android `http://10.0.2.2:3020/api`, iOS `http://localhost:3020/api`).
- **Šta nije u redu i zašto je bitno:** Četiri različite vrijednosti za istu postavku. Produkcijski build dobija `api.boiler-control.ba101.top/api`, dok dev fallback (koji se aktivira čim `EXPO_PUBLIC_API_URL` nije postavljen — npr. lokalni `expo start` bez `.env`) pokazuje na **drugi host i drugu putanju** (`boiler.ba101.top/backend/api`), što je host iz frontend audita (FE-009). Komentar u istom bloku govori o Android emulatoru i `10.0.2.2`, ali kod vraća produkcijski HTTPS URL — dakle developer nenamjerno radi protiv produkcije. `.env.example` s privatnim LAN IP-om i dokument s trećim vrijednostima upotpunjuju zbrku.
- **Dokaz:** `npx expo config --type public --json` → `"extra":{"EXPO_PUBLIC_API_URL":"https://api.boiler-control.ba101.top/api"}`; `sed -n '18,40p' mobile/src/config/api.config.ts`.
- **Preporuka:** (1) Vlasnik potvrđuje koji je host produkcijski (povezano s FE-009/B-029); (2) dev fallback zamijeniti eksplicitnom greškom ili `localhost`/`10.0.2.2` vrijednošću koja odgovara komentaru, nikad produkcijskim hostom; (3) `.env.example` bez privatne IP adrese (npr. `http://localhost:3020/api`); (4) `docs/API_CONFIG.md` uskladiti s kodom ili obrisati (vidjeti MO-007); (5) jedan izvor: `app.config.js` čita env, `api.config.ts` samo konzumira `Constants.expoConfig.extra`.
- **Kako provjeriti da je riješeno:** `grep -rn "ba101.top" mobile --include=*.ts --include=*.js --include=*.json --include=*.md` vraća samo potvrđeni produkcijski host; test: bez `EXPO_PUBLIC_API_URL` aplikacija pada s jasnom greškom umjesto da pogodi host.
- **Trud:** S — **Zavisnosti:** odluka vlasnika o topologiji (isto otvoreno pitanje kao u Fazi 1 i 2).

---

### [MO-020] Preuzete fakture i slike brojila ostaju trajno u nešifriranom app cacheu — Ozbiljnost: NISKO — Pouzdanost: VERIFIKOVANO (kod) / HIPOTEZA (stvarna izloženost)

- **Gdje:** `mobile/src/screens/gas/GasReadingsScreen.tsx:308-372` (`openProtectedFile`: `cacheDirectory || documentDirectory`, direktorij `downloads/`, `downloadAsync` s `Authorization`, `moveAsync`, `openLocalFile`), `:374-386` (`openLocalFile` → Android `IntentLauncher` / iOS `Linking.openURL`).
- **Šta nije u redu i zašto je bitno:** Zaštićeni dokumenti (PDF fakture, slike brojila — osobni podaci) preuzimaju se s Bearer tokenom i upisuju u `downloads/` unutar app cachea, **bez brisanja** nakon otvaranja i bez enkripcije. Cache na Androidu može biti dostupan backup mehanizmima i (na rooted uređajima) drugim procesima. Uz GDPR/retenciju iz Faze 1 (PRIV-1) ovo je dodatna kopija osjetljivog dokumenta na klijentu bez životnog vijeka.
- **Dokaz:** Kod na navedenim linijama; nema `deleteAsync` poziva nakon `openLocalFile` (`grep -n "deleteAsync" mobile/src/screens/gas/GasReadingsScreen.tsx` → 0).
- **Preporuka:** (1) Brisati datoteku nakon dijeljenja/otvaranja (npr. pri sljedećem pokretanju ekrana ili nakon `IntentLauncher` povratka); (2) koristiti `cacheDirectory` eksplicitno (ne `documentDirectory` fallback) i poddirektorij s predvidivim imenima; (3) dodati postavku „obriši preuzete dokumente" u `SettingsScreen` (trenutno `console.log('Clear cache')` — MO-019); (4) zabilježiti u politiku privatnosti.
- **Kako provjeriti da je riješeno:** Test s mockanim `FileSystemLegacy`: nakon `openLocalFile` pozvan je `deleteAsync` nad istim URI-jem; ručno: otvaranje fakture → `ls` cache direktorija prazan.
- **Trud:** S — **Zavisnosti:** MO-012; PRIV-1 iz Faze 1.

---

### [MO-024] `scheme: 'myapp'` placeholder; duplikat `app.json` i `app.config.js` — Ozbiljnost: NISKO — Pouzdanost: VERIFIKOVANO

- **Gdje:** `mobile/app.config.js:30` (`scheme: config.scheme || 'myapp'`); `mobile/app.json` (nema `scheme` ključa — `grep -n scheme mobile/app.json` → 0); `mobile/src/navigation/RootNavigator.tsx:29` (`prefixes: ['myapp://', 'exp://']`); `backend/src/modules/Schedule/gas.reminder.service.ts:64` (`myapp://gas/add-reading`).
- **Šta nije u redu i zašto je bitno:** URL shema aplikacije je generički placeholder iz Expo šablona. To znači da **bilo koja** druga aplikacija s istom shemom može primiti (ili presresti) link, a deep linkovi nisu brendirani niti stabilni. Dodatno, konfiguracija postoji na dva mjesta (`app.json` i `app.config.js`) — `app.config.js` nadograđuje `app.json`, pa se lako dogodi da se promjena unese samo na jedno mjesto (već se dogodilo: `scheme`, `plugins` i `ios.config` postoje samo u `app.config.js`).
- **Dokaz:** `npx expo config --type public --json` → `"scheme":"myapp"`; `npx expo config --type introspect --json` → `"ios":{"config":{"usesNonExemptEncryption":false}}` (potvrđuje da se `app.config.js` primjenjuje).
- **Preporuka:** (1) Postaviti brendiranu shemu (npr. `boilercontrol://`) u `app.config.js` i uskladiti backend `deepLink` stringove i `linking.prefixes`; (2) uvesti `BOILERCONTROL_`/`exp://` dualni period prije uklanjanja stare sheme, jer stare instalirane verzije očekuju `myapp://` (povezano s MO-004); (3) odlučiti jedan izvor konfiguracije (preporuka: `app.config.js`, a `app.json` svesti na minimum ili obrisati).
- **Kako provjeriti da je riješeno:** `npx expo config --type public --json` pokazuje novu shemu; test mapiranja deep linkova (MO-002) prolazi za obje sheme tokom prelaznog perioda.
- **Trud:** S — **Zavisnosti:** backend `gas.reminder.service.ts` (3 mjesta), MO-002, MO-004.

---

### [MO-025] Android build nosi `RECORD_AUDIO` i legacy storage permisije koje aplikacija ne koristi — Ozbiljnost: NISKO — Pouzdanost: VERIFIKOVANO (konfiguracija) / HIPOTEZA (politika trgovine)

- **Gdje:** rezultat `npx expo config --type introspect --json` → `android.permissions: ["android.permission.RECORD_AUDIO", "android.permission.READ_EXTERNAL_STORAGE", "android.permission.WRITE_EXTERNAL_STORAGE", "android.permission.INTERNET"]`; izvor: Expo autolinking/plugini (`expo-notifications`, `expo-image-picker`), `mobile/app.config.js:47-53` (`expo-build-properties` bez `android.permissions` konfiguracije).
- **Šta nije u redu i zašto je bitno:** Aplikacija ne snima zvuk (nema `expo-av`, nema `Audio` importa — `grep -rn "expo-av\|Audio\." mobile/src` → 0), a slika se bira kroz `expo-image-picker` koji na novijim Android verzijama koristi Photo Picker, ne `READ_EXTERNAL_STORAGE`. Nepotrebna `RECORD_AUDIO` permisija pojavljuje se korisniku pri instalaciji i zahtijeva objašnjenje u Google Play „Data safety" obrascu; neobjašnjene permisije su čest razlog odbijanja pregleda.
- **Dokaz:** Izlaz `expo config --type introspect` (pokrenuto 2026-10-29); `grep -rn "requestPermissionsAsync" mobile/src` → samo `ImagePicker.requestMediaLibraryPermissionsAsync` i `requestCameraPermissionsAsync`.
- **Preporuka:** Eksplicitno ukloniti nepotrebne permisije kroz `expo-build-properties` (`android: { permissions: [...] }` u `app.config.js`) ili kroz `AndroidManifest` merge pravila, zadržavši `INTERNET`, `CAMERA` i `POST_NOTIFICATIONS`; zatim provjeriti finalni `AndroidManifest.xml` u EAS buildu.
- **Kako provjeriti da je riješeno:** `npx expo config --type introspect --json` ne sadrži `RECORD_AUDIO` ni legacy storage permisije; `aapt dump permissions` nad izgrađenim APK-om pokazuje samo očekivani skup.
- **Trud:** S — **Zavisnosti:** MO-004 (izdanje), vlasnička odluka o Play obrascu.
