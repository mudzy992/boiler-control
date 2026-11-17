# Lokalni build — mobilna i TV aplikacija

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

TV APLIKACIJA
  5) Dev server (Expo, EXPO_TV=1)
  6) Debug build + instalacija na TV
  7) Release APK (lokalni gradle)
  8) Testovi + typecheck

OSTALO
  9) Provjeri okolinu (java, adb, SDK, node_modules)
  v) Samo digni verziju, bez builda
  q) Izlaz
```

Prije svakog builda (2, 3, 6, 7) meni pita **kako dignuti verziju**:

| izbor | primjer | kada |
|---|---|---|
| `patch` | `2.0.0` → `2.0.1` | ispravka |
| `minor` | `2.0.1` → `2.1.0` | nova funkcionalnost (patch se resetuje) |
| `major` | `2.1.0` → `3.0.0` | velika promjena |
| bez dizanja | ostaje ista | ponovni build iste verzije |

## Šta se mijenja

| fajl | mijenja se | zašto |
|---|---|---|
| `mobile/package.json` / `tv/package.json` → `version` | **da** | jedini izvor (MO2-2) |
| `package-lock.json` (oba mjesta) | **da** | `npm ci` pada ako se razilazi sa `package.json` |
| `versionCode` | **ne** | izvodi ga `app.config.js` iz `version` |
| `app.json` | ne | nema `version` od MO2-2 |

Formula `versionCode`-a je ista na obje aplikacije i na backendu:
**`major*10000 + minor*100 + patch`** (`2.1.0` → `20100`).

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

## Zahtjevi

| alat | za šta |
|---|---|
| Node.js | sve (verzije, Expo CLI) |
| `node_modules` u `mobile/` i `tv/` | `npm install` u svakom |
| JDK 17+ i `ANDROID_HOME` | debug/release build (opcije 2, 3, 6, 7) |
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
- Instalacija na uređaj/TV (`adb`).
- EAS build (`build:tv` u `tv/package.json` koristi EAS, ali skripta ga ne nudi
  jer traži nalog).
