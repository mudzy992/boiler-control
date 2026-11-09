# Build APK-a — stanje

**Ispravka prethodne verzije ovog dokumenta:** ovdje je pisalo da push
obavijesti ne mogu raditi jer nedostaju `extra.eas.projectId` i FCM kredencijali.
To je bilo **netačno** — provjeravao sam `app.json`, a stvarna konfiguracija je u
`app.config.js`, koji se primjenjuje preko njega. Push je konfigurisan i radio je.

## Šta stvarno postoji

| Stvar | Gdje | Vrijednost |
|---|---|---|
| EAS projekat | `app.config.js` → `extra.eas.projectId` | `c875e85d-ad10-4eb6-bdae-fa5038133ee7` |
| OTA ažuriranja | `app.config.js` → `updates.url` | `https://u.expo.dev/c875e85d-…`, `checkAutomatically: ON_LOAD` |
| Runtime gate | `runtimeVersion` | `{ policy: 'appVersion' }` → OTA vrijedi samo za istu `package.json version` (2.0.0) |
| FCM | `android.googleServicesFile` → `assets/google-services.json` | projekt `boilercontrole` |
| Kanali | `eas.json` | `development`, `preview`, `production` — svi `buildType: apk` |
| API URL | `eas.json` profili + `app.config.js` | `https://api.boiler-control.ba101.top/api` |

## Build

```bash
cd mobile
npx eas-cli login
npx eas-cli build -p android --profile preview     # APK, interni link
```

Lokalno (traži Android SDK): `npx expo prebuild -p android && cd android && ./gradlew assembleRelease`.

## Važno za instaliranu aplikaciju

`runtimeVersion` je vezan na `package.json version` (**2.0.0**). Dok se ta
vrijednost ne mijenja, JS izmjene se mogu poslati **bez novog APK-a**:

```bash
npx eas-cli update --branch preview --message "…"
```

ali samo na kanal iz kojeg je instalirani build. Ako je instalirani APK stariji
od izmjene imena polja (`currentTemp` → `roomCurrentTemp`), taj build traži stara
polja i **neće** prikazati temperature dok se ne ažurira — OTA to rješava bez
ponovne instalacije, jer je promjena samo u JS-u.

## Šta APK neće imati ni poslije builda

- Lista očitanja plina prikazuje prvih 200 (bez „učitaj još").
- Promjena polazne **u toku** ciklusa ne šalje obavijest (samo uz početak ciklusa).
- Model učenja postoji na mobilnom; na webu ne.

## Provjera prije objave

1. `npx tsc --noEmit` — čist.
2. `npx jest` — 347 testova, 51 suite.
3. Na uređaju: prijava, Dashboard (temperature moraju biti brojevi, ne prazno),
   Analitika (historija sa oznakama „izmjereno"/„rekonstruisano"), dodavanje
   očitanja sa slikom, promjena jezika pa **restart** (jezik mora ostati),
   dolazak push obavijesti (npr. početak grijanja).
