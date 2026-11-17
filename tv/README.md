# Boiler Control TV (Android TV / Google TV)

Aplikacija za TV: prijava uparivanjem sa telefonom, jedan ekran analitike i
**sistemske notifikacije** o kvarovima.

## Tri pravila koja se ne krše

| pravilo | gdje je sprovedeno | test |
|---|---|---|
| TV **ne mijenja** stanje (samo GET) | interceptor u `src/services/api/client.ts` + uklonjene `post`/`put`/`patch`/`delete` | `src/services/api/__tests__/client.test.ts` |
| notifikacije su **sistemske**, rade i u pozadini | FCM `notification` payload + `setNotificationHandler` | v. „Notifikacije" |
| prijavu **odobrava telefon**, TV nikad ne vidi lozinku | `POST /api/tv-pairing/sessions` + QR/kod | `src/lib/__tests__/pairing.test.ts` |

**Jedini POST koji TV šalje** je zahtjev za kod za uparivanje. Njime putuje i
push token — zato što bi registracija tokena inače bila drugi POST. Server
upisuje token u `UserDevice` tek kad telefon odobri.

> **Najkraći put:** `./scripts/build/build-menu.sh` (opcije 5–8). Skripta digne
> verziju i popravi `package-lock.json` sama. Detalji: `docs/BUILD-LOKALNO.md`.

## Pokretanje

TV **ne radi u Expo Go** (Expo Go ne podržava Android TV). Potreban je
`prebuild` i gradnja:

```bash
npm install
EXPO_TV=1 npx expo prebuild --platform android --clean
npx expo run:android        # ili: EXPO_TV=1 eas build --platform android
```

`EXPO_TV=1` dodaje `@react-native-tvos/config-tv` plugin (u `app.config.js`),
koji u manifest upisuje `LEANBACK_LAUNCHER` — bez toga se aplikacija **ne
pojavljuje** na TV početnom ekranu.

`react-native` u `package.json` je alias na `react-native-tvos@0.87.1-1`.
To je **namjerno**: Expo SDK 58 mapira na RN-TV `0.87-stable`. `.npmrc` ima
`legacy-peer-deps=true` jer npm tretira sufiks `-1` kao prerelease i odbija
peer zahtjeve paketa koji traže običan `react-native`.

### Okolina

| varijabla | značenje |
|---|---|
| `EXPO_PUBLIC_API_URL` | adresa API-ja (razvoj: `http://<ip-racunara>:3000`) |
| `EXPO_TV=1` | uključuje TV plugin i TV manifest |

## Notifikacije

TV koristi Expo push token + Expo Push Service, koji isporučuje Android notifikaciju preko Firebase Cloud Messaginga (FCM). Backend šalje notification payload (naslov/tijelo/zvuk); Android ga prikazuje kao **sistemsku notifikaciju** u pozadini i kad je TV aplikacija ugašena. `setNotificationHandler` prikazuje je i dok je aplikacija otvorena.

TV registracija mora postojati i u Firebaseu, sa package ID-jem tačno `com.boilercontrol.tv`. Ona može biti u istom Firebase projektu kao telefon, ali je zasebna Android app registracija i koristi svoj `google-services.json`. Firebase projekat/FCM nije isto što i TV-ov zasebni EAS project ID.

### Jednokratno podešavanje prije prvog TV builda

1. U Firebase Console dodaj Android app `com.boilercontrol.tv` u željeni Firebase projekat i preuzmi njen `google-services.json`.
2. Kopiraj fajl u `tv/assets/google-services.json`. Build meni provjerava da fajl postoji i da sadrži client `com.boilercontrol.tv`.
3. TV EAS projekat već je kreiran. Njegov ID (`5e53f78e-129d-4505-94f5-880fde2867cc`) je sada postavljen direktno u `tv/app.config.js`: to je javni project ID, ne tajna. Pošto je config dinamičan, `eas init` ne može ga upisati sam; nema potrebe da ga dodaješ u `.env` ili EAS environment. `EXPO_PUBLIC_API_URL` je već podešen u `tv/eas.json` za production build.
4. U Firebase/Google Cloudu uključi Firebase Cloud Messaging API v1 i napravi service-account key s FCM slanjem. U EAS TV projektu pokreni `cd tv && npx eas-cli credentials --platform android` i dodaj taj ključ kao **FCM V1 service-account credential**. Ovo je privatni ključ: ne stavljati u Git, `.env` ni chat. Ne mijenja Android signing keystore.
5. Pokreni TV EAS build iz menija (11 cloud ili 13 local). Lokalni build traži EAS prijavu, JDK i Android SDK.

### Tok poruke i Android kanali

- TV traži Expo push token **prije** prikaza koda i šalje ga uz jedini pairing POST. Tek kad telefon odobri uparivanje, backend poveže token sa korisnikom.
- Backend šalje preko Expo Push Service; TV koristi `expo-notifications`/FCM i OS prikazuje sistemsku poruku.
- Android kanali su `daily`, `alerts` i `heating` — isti ID-jevi koje backend šalje. `alerts` je na TV-u `MAX` značaja; ostali su `DEFAULT`. Android čuva izbor korisnika za svaki kanal.
- Ako TV nema Play usluge, mrežu ili korisnik odbije dozvolu, pairing i analitika i dalje rade, ali push može izostati.
- TV još nije potvrđen na fizičkom uređaju; poslije builda testirati pairing, dozvolu za notifikacije, pa poslati stvarni alert dok je aplikacija otvorena, u pozadini i ugašena.

> `expo-notifications` u SDK 58 još prikazuje data-only FCM poruke sa
> naslovom, ali **SDK 59 to ukida**. Backend zato mora slati `notification`
> payload (naslov + tijelo), a ne samo `data` — inače notifikacije prestanu
> raditi pri nadogradnji, bez greške.

## Testovi

```bash
npm test          # jest, 52 testa u 7 suita
npm run typecheck
```

Testovi ne trebaju TV ni emulator. Provjeravaju odluke koje se na ekranu ne
vide: da `post` **ne ode**, da token ide uz zahtjev za kod, da nedostajuće
mjerenje nije nula, da istekao kod ne čeka vječno.

## Šta TV namjerno NE radi

- **Ne upravlja kotlom.** Nema režima, temperature, ni rasporeda. To ostaje na
  telefonu — a i da želi, klijent bi odbio zahtjev.
- **Nema navigaciju.** Jedan ekran; više ekrana traži uputstvo za daljinski.
- **Ne prikazuje sve metrike.** Šest najviše (`MAX_TV_METRICS`), sa natpisom
  koliko ih je još u telefonu.

## Nije provjereno u ovom okruženju

- `expo prebuild` i gradnja APK-a (traži Android SDK).
- Dostava push-a na stvarni TV (traži uređaj i Google Play usluge).
- Ponašanje fokusa daljinskog na uređaju (`hasTVPreferredFocus` postoji u
  forku, ali nije isproban na TV-u).
