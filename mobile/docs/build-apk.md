# Build APK-a — šta je spremno, šta blokira

Provjereno čitanjem `mobile/eas.json`, `mobile/app.json`, `package.json` i koda
za registraciju push tokena.

## Može se odmah

`eas.json` ima tri profila i `preview` već pravi **APK** (ne AAB):

```bash
cd mobile
npx eas-cli login
npx eas-cli build -p android --profile preview
```

- `preview`: `distribution: internal`, `android.buildType: apk` → fajл se skida
  linkom ili iz `eas build:list`.
- `EXPO_PUBLIC_API_URL` je već upisan u profil
  (`https://api.boiler-control.ba101.top/api`), pa APK ne zavisi od `.env`.
- Paket: `com.boilercontrol.app`.

Alternativa bez EAS-a (lokalno, traži Android SDK): `npx expo prebuild -p
android && cd android && ./gradlew assembleRelease`. APK izlazi u
`android/app/build/outputs/apk/release/`.

## Blokira: push obavijesti

Dvije stvari nedostaju i **obje se vide kao „obavijesti ne rade"**:

1. **`extra.eas.projectId` ne postoji** u `app.json`. `getExpoPushTokenAsync`
   traži `projectId` (`notificationService.getProjectId()` čita
   `extra.eas.projectId` ili `Constants.easConfig.projectId`). Bez njega token
   se ne registruje.
2. **Nema FCM kredencijala** (`android.googleServicesFile` nije postavljen).

Zašto je to ozbiljno: `NotificationsService.notifyUser()` se vraća **prije**
upisa u bazu ako korisnik nema token. Dakle bez tokena nema ni push-a **ni
zapisa** u listi obavijesti — korisnik ne vidi ni da je nešto propušteno.

Popravka (jednom, uz EAS nalog):

```bash
cd mobile
npx eas-cli init            # upisuje extra.eas.projectId u app.json
npx eas-cli credentials -p android   # FCM V1 service account (ili google-services.json)
```

Poslije toga `npm run type-check && npm test` pa build.

## Šta APK neće imati ni poslije toga

- **Web push** ne postoji; obavijesti su vezane na mobilne tokene.
- Promjena polazne **u toku** ciklusa ne šalje obavijest (samo uz početak
  ciklusa) — vidi `docs/audit/backend/32-locale-and-pagination.md` §3.
- Lista očitanja plina prikazuje prvih 200 (bez „učitaj još").

## Provjera prije objave

1. `npx tsc --noEmit` — čist.
2. `npx jest` — 347 testova, 51 suite.
3. Na uređaju: prijava, Dashboard, Analitika (mora pokazati historiju sa
   oznakama „izmjereno"/„rekonstruisano"), dodavanje očitanja sa slikom,
   promjena jezika pa **restart aplikacije** (jezik mora ostati).
