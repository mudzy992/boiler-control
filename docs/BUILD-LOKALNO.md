# Android build meni — mobilna i TV aplikacija

```bash
./scripts/build/build-menu.sh
```

Meni nudi obje aplikacije, a **verziju diže sam** prije builda.

## Meni

```
MOBILNA APLIKACIJA
  1) Dev server (Expo) — bez builda
  2) Debug build + instalacija na uređaj
  3) Release APK (lokalni gradle)
  4) Testovi + typecheck
  10) EAS production APK (cloud build)
  12) EAS production APK (localni build na ovom računaru)

TV APLIKACIJA
  5) Dev server (Expo, EXPO_TV=1)
  6) Debug build + instalacija na TV
  7) Release APK (lokalni gradle)
  8) Testovi + typecheck
  11) EAS production APK (cloud build)
  13) EAS production APK (localni build na ovom računaru)

OSTALO
  9) Provjeri okolinu (java, adb, SDK, node_modules)
  v) Samo digni verziju, bez builda
  q) Izlaz
```

Prije svakog builda (2, 3, 6, 7, 10–13) meni pita **kako dignuti verziju**:

- **3 i 7** su lokalni Gradle buildovi; bez vlastitog keystore-a release APK je debug-potpisan.
- **10 i 11** su EAS cloud buildovi; kompilacija se izvršava na EAS serverima.
- **12 i 13** su EAS local buildovi; kompilacija se izvršava na ovom računaru.
- Sva četiri EAS izbora koriste production profil i traže EAS prijavu/projekat i odgovarajuće credentials. I lokalni EAS build i dalje se povezuje na EAS radi projekta/credentials-a; to nije potpuno offline build.
- Mobilni EAS projekat je već povezan; TV prvo mora imati svoj EAS project ID i Android credentials. Ako TV ID nedostaje, meni ispiše uputu umjesto da pokrene build.
- Opcije 12/13 traže Linux/macOS, JDK i `ANDROID_HOME` ili `ANDROID_SDK_ROOT`.

| izbor | primjer | kada |
|---|---|---|
| `patch` | `2.0.0` → `2.0.1` | ispravka |
| `minor` | `2.0.1` → `2.1.0` | nova funkcionalnost (patch se resetuje) |
| `major` | `2.1.0` → `3.0.0` | velika promjena |
| bez dizanja | ostaje ista | rebuild bez većeg `versionCode`-a; Android ga ne tretira kao novu nadogradnju |

## Šta se mijenja

| fajl | mijenja se | zašto |
|---|---|---|
| `mobile/package.json` / `tv/package.json` → `version` | **da** | jedini izvor (MO2-2) |
| `package-lock.json` (oba mjesta) | **da** | `npm ci` pada ako se razilazi sa `package.json` |
| `versionCode` | **ne** | izvodi ga `app.config.js` iz `version` |
| `app.json` | ne | nema `version` od MO2-2 |

EAS profili koriste `appVersionSource: local` i `autoIncrement: false`; tako lokalni Gradle i EAS dobijaju isti `versionCode` iz `package.json`. Meni diže verziju prije builda. U aplikaciji se u Postavke prikazuje semver (`versionName`, npr. `2.2.1`); Androidov `versionCode` (`20201`) je interni broj za nadogradnje i ne prikazuje se kao verzija korisniku.

Formula `versionCode`-a je ista na obje aplikacije i na backendu:
**`major*10000 + minor*100 + patch`** (`2.1.0` → `20100`).

## EAS cloud buildovi

- Izaberi **10** za mobilni EAS production APK u cloudu ili **11** za TV EAS production APK u cloudu.
- Izaberi **12** za mobilni EAS production APK lokalno ili **13** za TV EAS production APK lokalno. Izlaz ide u `dist/mobile-<version>-eas-local.apk` ili `dist/tv-<version>-eas-local.apk`.
- Sva četiri profila prave APK; cloud opcije kompiliraju na EAS serverima, local opcije na ovom računaru. EAS credentials su i dalje vezani za EAS projekat; lokalni build nije offline build.
- Mobilna aplikacija je već povezana sa EAS projektom.
- TV mora imati svoj EAS projekat, zaseban od mobilnog. Prvo pokreni `cd tv && npx eas-cli init`, pa postavi generisani project ID kao `EAS_PROJECT_ID` (lokalno i u EAS production environmentu). TV config već čita tu varijablu. Meni odbije TV build ako ID nedostaje.
- Da bi APK mogao ažurirati već instaliranu aplikaciju, izaberi isti EAS projekat/keystore kojim je ranija verzija potpisana. EAS build credentials se ne dijele automatski između mobilne i TV aplikacije.

## Sigurnosna mreža

Verzija se diže **prije** builda, ali:

- ako build **padne** → verzija se vraća na prethodnu (i pri `Ctrl+C`);
- ako se izađe iz menija poslije uspješnog release builda → verzija **ostaje**.

Bez vraćanja bi propali build ostavio broj koji nijedan APK ne nosi, pa bi
sljedeći uspješan build preskočio broj. Stanje se drži u `.build-restore`
(gitignore).

## Šta se odbija, i zašto

**Verzija sa sufiksom (`2.0.0-beta.1`) se odbija.** Izmjereno: `app.config.js`
izvodi `versionCode` preko `split('.')`, a `parseInt('0-beta')` daje **0** — ne
`NaN`. Rezultat je `versionCode 20000`, **isti kao za `2.0.0`**, pa Android
odbije nadogradnju kao „već instalirano", bez poruke o verziji. Tihi sudar je
gori od greške, zato skripta stane odmah.

## Ne-interaktivni ulazi

```bash
./scripts/build/build-menu.sh --versions   # ispiši verzije i versionCode
./scripts/build/build-menu.sh --check      # provjeri okolinu i usklađenost lock fajla
./scripts/build/build-menu.sh --help
```

`--check` **uvijek izlazi sa 0**: nedostatak JDK-a ili `adb`-a je upozorenje, jer
dev server radi i bez njih. Neusklađen `package-lock.json` se prijavljuje kao
crveno u ispisu i povećava broj problema.

## „App not installed as package conflicts with an existing package"

Ova poruka **nije** o verziji — to je **potpis** (keystore).

Android za isti `applicationId` zahtijeva **isti ključ** za nadogradnju. Dva
builda iste aplikacije potpisana različitim ključevima ne mogu jedan preko
drugog:

| build | čime je potpisan |
|---|---|
| EAS build (`eas build`) | EAS-ovim ključem iz trezora |
| **lokalni** `gradlew assembleRelease` | **DEBUG ključem** (`debug.keystore`, šifra `android`) |

Izmjereno 17.11.: `expo prebuild` generiše
`release { signingConfig signingConfigs.debug }` — dakle lokalni release APK je
**uvijek** potpisan debug ključem, dok se ne postavi vlastiti keystore.

Razlika prema verziji: `versionCode` koji nije veći daje **drugu** poruku
(„already installed" / „App not installed"), a potpis daje upravo
„package conflicts with an existing package".

### Tri rješenja

1. **Odinstaliraj i instaliraj** (najbrže, gubi podatke aplikacije):
   ```bash
   adb uninstall com.boilercontrol.app    # mobilni
   adb uninstall com.boilercontrol.tv     # TV
   ```
2. **Postavi vlastiti keystore** — tada su lokalni i EAS build isti ključ:
   ```bash
   mobile/android/keystore.properties     # ili tv/android/
   ```
   ```properties
   storeFile=release.jks
   storePassword=…
   keyAlias=release
   keyPassword=…
   ```
   `storeFile` je **relativan na `android/`**. Meni tada automatski uskladi
   potpis poslije `prebuild`-a. Za EAS ista tajna ide u
   `eas credentials` (Android → Keystore), ne u repo.
3. **Koristi samo EAS buildove** za uređaje na kojima je već EAS verzija.

### Provjera

```bash
./scripts/build/build-menu.sh --signing
# mobile: release potpisan: debug   keystore.properties: nema
```

Meni prijavi debug potpis **prije** builda, a ne poslije neuspjele
instalacije.

> `keystore.properties`, `*.jks` i `*.keystore` su u `.gitignore`. Nikad u
> repo — `keystore.properties` sadrži lozinku, a `.jks` je privatni ključ.

## Zahtjevi

| alat | za šta |
|---|---|
| Node.js | sve (verzije, Expo CLI) |
| `node_modules` u `mobile/` i `tv/` | `npm install` u svakom |
| JDK 17+ i `ANDROID_HOME` / `ANDROID_SDK_ROOT` | lokalni Android buildovi (2, 3, 6, 7, 12, 13) |
| `adb` | instalacija na uređaj (2, 6) |

TV build uvijek ide sa `EXPO_TV=1`, jer bez njega `prebuild` generiše običnu
Android aplikaciju koja se **ne pojavljuje** na TV početnom ekranu.

## Provjereno u ovom okruženju

- `--versions`, `--check`, `--help`, izlaz iz menija: rade.
- Dizanje verzije u `package.json` + oba mjesta u `package-lock.json`: radi,
  `npm` diff je čist poslije vraćanja.
- Vraćanje verzije kad build padne (simulirano `false` kao build): radi.
- `expo config` vidi dignutu verziju i izvedeni `versionCode`: izmjereno za
  mobilni (`2.1.0` → `20100`) i TV.

## Nije provjereno

- Stvarni `gradlew assembleRelease` — u okruženju nema JDK-a ni Android SDK-a.
- Stvarna instalacija APK-a na uređaj (potpis je provjeren čitanjem
  generisanog `build.gradle`, ne instalacijom).
- Instalacija na uređaj/TV (`adb`).
- Stvarni EAS cloud/local build: meni nudi opcije 10–13, ali nijedan nije
  pokrenut u ovom okruženju (potrebni su korisnikov EAS nalog/credentials;
  TV EAS projekat još treba inicijalizovati i povezati; local build traži
  JDK/Android SDK).
