# AppRelease — kako se verzija diže i kako se provjerava

> **Status dokaza.** Svaka tvrdnja ispod je **izmjerena** u repou 16.11.2026, ne
> prepisana iz namjere. Gdje nešto nije moglo biti izmjereno (EAS server, stvarni
> APK iz `eas build`), to izričito piše.

## 1. Jedan izvor verzije

| gdje                                            | šta            | čita se?                      |
| ----------------------------------------------- | -------------- | ----------------------------- |
| `mobile/package.json` → `version`               | `2.0.0`        | **DA — jedini izvor** (MO2-2) |
| `mobile/app.config.js` → `version: pkg.version` | izvedeno       | da, ugrađuje se u APK         |
| `mobile/app.json` → `version`                   | **ne postoji** | ne — izbačen u MO2-2          |
| `mobile/app.json` → `android.versionCode`       | **ne postoji** | ne — v. §3                    |
| `mobile/app.config.js` → `versionCode`          | izvedeno (§3)  | da, ugrađuje se u APK         |

Razlog za jedan izvor: prije MO2-2 postojala su **tri** broja koja se ne slažu
(`package.json` 2.0.0, `app.json` 1.0.0, hardkodovano `"2.0.0"` u
`SettingsScreen.tsx`).

### Kako se diže verzija (postupak)

> **Najkraći put:** `./scripts/build/build-menu.sh` — meni digne `version` i
> popravi `package-lock.json` sam, a vrati broj ako build padne.
> Detalji: `docs/BUILD-LOKALNO.md`. Ručni postupak ostaje ispod.

1. **`mobile/package.json` → `version`** — jedina promjena koja je potrebna.
   `app.config.js` je čita i postavlja `expo.version` i `android.versionCode`.
2. Trenutno `eas.json` koristi `appVersionSource: local` i
   `production.autoIncrement: false`: meni digne semver, a `app.config.js`
   izvodi `versionCode` iz njega. EAS ne održava zaseban brojač (§3).
3. Objava na server ide kroz **admin dashboard** (`POST /api/app-releases`), ne
   kroz EAS update kanal. Detalji u §2.
4. Ne dirati `app.json` — nema `version`.

> **Ne mjeriti `version` iz `app.json`.** Tamo je nema, i `expo config` je ne
> prikazuje iz tog fajla. Provjereno `npx expo config --type public --json`.

## 2. Kako radi objava (AppRelease)

```
mobilni build ──APK──> admin upload ──> assets/app.config se čita ──> baza
                                                                    │
  GET /api/app/config  <──────────────────────────────────────────┘
        │
        └─> klijent: version gate (blokada) + ponuda za update
```

### Odakle server zna verziju

`readVersionFromApk(buffer)` (`backend/src/common/app-release.service.ts`):

1. APK je ZIP → nađe centralni direktorij (skenira od kraja, jer komentar
   arhive stoji iza EOCD potpisa). Podržava `deflate` (metoda 8) i `stored`
   (metoda 0).
2. Pročita zapis **`assets/app.config`**. Taj zapis stvarno postoji u APK-u:
   `expo-constants` ga generiše pri **svakom** buildu preko
   `node_modules/expo-constants/scripts/get-app-config-android.gradle` →
   `getAppConfig.js`.
3. `JSON.parse` zapisa i čita **tačno top-level `version`** i
   **tačno `android.versionCode`**.
4. Ako ne pročita: `{version: null, buildNumber: null}` — **ne baca**. Admin
   tada unosi verziju ručno, a server je i dalje validira.

### Validacija pri objavi

| provjera                                  | odbija                             |
| ----------------------------------------- | ---------------------------------- |
| semver `MAJOR.MINOR.PATCH`                | `2.0.0-beta.1`, prazno             |
| verzija **veća** od posljednje objavljene | ponovno objavljivanje iste/starije |
| APK ≤ `APK_MAX_SIZE_BYTES`                | prevelik fajl                      |
| fajl se briše ako upis u bazu padne       | siroče na disku                    |

`buildNumber` se uzima: ručno → iz APK-a → izvedeno (`major*10000+minor*100+patch`).
**Nijedan današnji ekran ga ne čita** — koristi se u nazivu fajla i u odgovoru.

### Šta klijent radi sa tim

`mobile/src/config/version.config.ts` — **fail-open**:

| situacija                                           | ishod                       |
| --------------------------------------------------- | --------------------------- |
| backend nedostupan / timeout 8 s / nevaljan odgovor | **pusti aplikaciju**        |
| lokalna verzija nije strogi semver                  | **pusti aplikaciju**        |
| `minSupportedVersion` > instalirana                 | **blokada** (`mustUpdate`)  |
| `latestRelease.version` > instalirana               | trajna ponuda (ne blokada)  |
| `versionGateEnabled: false` (kill switch)           | nema blokade, ponuda ostaje |

Fail-open je namjeran: gate koji pada na „zatvoreno" pretvorio bi svaki backend
kvar u neupotrebljivu aplikaciju.

## 3. Ispravke od 16.11. (izmjerene, ne pretpostavljene)

### 3.1. Čitanje verzije je uzimalo **prvi** `"version"` u tekstu

Stari kod je koristio regex `/"version"\s*:\s*"([^"]+)"/` bez obzira na to čiji
je ključ. EAS/config serijalizuje `extra` **prije** top-level polja:

```json
{
  "extra": { "someTool": { "version": "0.0.1" } },
  "version": "2.0.0",
  "android": { "versionCode": 156 }
}
```

```
regex      -> 0.0.1
JSON.parse -> 2.0.0
```

**Posljedica nije tiha.** Upload odbija verziju koja nije veća od posljednje
objavljene, pa bi APK `2.0.0` bio odbijen porukom „nije veća od 2.0.0" — a
uzrok bi izgledao kao greška u APK-u, ne u čitaču. Popravljeno na `JSON.parse`;
`versionCode` se sada čita **samo** iz `android.versionCode`.

### 3.2. Testovi su vježbali oblik koji se u APK-u ne pojavljuje

Fixture je pravio `{"expo":{"version":…}}`. To je oblik **`app.json`**, ne
ugrađenog `app.config`. Provjereno na generisanom zapisu (`npx expo config
--type public --json`): top-level ključevi su `android`, `extra`, `icon`,
`name`, `version` … i **nema** ključa `expo`. Fixture je ispravljen.

### 3.3. `versionCode` je bio `1` za svaki build

`app.config.js` je imao `versionCode: config.android?.versionCode || 1`, a
`app.json` to polje ne sadrži:

```
EAS bi upisao (autoIncrement: true):  1, 2, 3, 4, 5
app.config.js je stvarno davao:       1, 1, 1, 1, 1
```

`appVersionSource: remote` i `autoIncrement: true` su se pokazali neusklađenim
sa aplikacionom formulom. Stvarni EAS local-build log je pokazao da EAS
inkrementira svoj udaljeni brojač `22 → 23`, dok je build meni za istu promjenu
verzije prikazao `20200 → 20201`. Remote izvor je zato davao drugi Android
`versionCode` od lokalnog Gradle builda i od broja koji admin izvodi iz APK
konfiguracije.

**Trenutna politika:** `mobile/eas.json` i `tv/eas.json` koriste
`appVersionSource: local` i `production.autoIncrement: false`. Build meni
mijenja semver u `package.json`; app config izvodi Android `versionCode` iz te
iste verzije. EAS ne inkrementira drugi, nezavisan brojač.

| verzija | Android `versionCode` (Gradle + EAS) |
| ------- | ------------------------------------ |
| 2.0.0   | 20000                                |
| 2.0.1   | 20001                                |
| 2.1.0   | 20100                                |
| 3.0.0   | 30000                                |

Korisniku se u Postavke prikazuje `expo.version` / Android `versionName` (npr.
`2.2.1`). `versionCode` (`20201`) je Androidov interni broj za prihvatanje
nadogradnji, ne verzija prikazana u UI-ju.

Poslije promjene je `APP_VERSION_CODE` namjerno uklonjen iz mobilnog configa:
ni EAS env varijabla ni ručno zadana vrijednost ne smiju razići APK kod sa
semverom.

## 4. Šta je provjereno i **ispravno** (ne dirati)

- `assets/app.config` **postoji** u APK-u — gradle zadatak ga generiše pri
  svakom buildu (`outputs.upToDateWhen { false }`).
- ZIP čitač radi na **stvarnom** zip-u (ne samo na fixture-u): pročitao
  `{"version":"2.0.0","buildNumber":1}` iz zip-a napravljenog `zip` alatom, i
  isto sa ZIP komentarom na kraju.
- ZIP64 markeri (`0xFFFF` / `0xFFFFFFFF`) i pokvarena arhiva daju **`null`**,
  ne pogrešnu verziju.
- Semver poređenje je **isto** na oba kraja (`compareVersions` u backendu i u
  `version.config.ts`) — da se ne raziđu u odluci o istoj verziji.

## 5. Šta NIJE izmjereno (ograničenja)

- **Stvarni APK iz `eas build`** nije dostupan u sandboxu. Dokaz je rađen na
  zip-u sa stvarnim sadržajem `app.config` i na izvoru `expo-constants` gradle
  zadatka. Prvi upload kroz dashboard treba potvrditi da admin vidi
  `2.0.0` bez ručnog unosa.
- **Postojeća EAS remote verzija** na serveru nije više izvor za nove buildove.
  Nakon prelaska na `appVersionSource: local`, formula daje `20200+`, što je
  veće od ranijeg remote broja (`23` u izmjerenom buildu); stari EAS brojač se
  ignoriše. Prije prihvatanja budućeg `versionCode`-a većeg od Android limita
  treba provjeriti semver formulu i instaliranu bazu korisnika.
- **Nema automatskog podizanja verzije u CI-ju.** Ne postoji skripta ni workflow
  koji mijenja `package.json`; podizanje je ručno (§1).
