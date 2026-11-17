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
| `EAS_PROJECT_ID` | ID posebnog EAS projekta za slug `boiler-control-tv` (ne mobilni ID); bez njega `getExpoPushTokenAsync` baca, pa TV ostaje bez push-a |
| `EXPO_TV=1` | uključuje TV plugin i TV manifest |

## Notifikacije

- Kanal `kvar-v1` sa `importance: MAX` — Android 8+ ne mijenja značaj kanala
  poslije kreiranja, pa se pojačanje značaja radi **novim imenom kanala**.
- `setNotificationHandler` vraća `shouldShowBanner: true` i `shouldShowList:
  true`. Bez toga bi notifikacija bila prikazana samo kad aplikacija **nije** u
  prvom planu — a TV najčešće **jeste** na analitici, pa bi korisnik propustio
  baš ono zbog čega aplikacija postoji.
- Push token se traži **prije** uparivanja i šalje uz zahtjev za kod. Ako TV
  nema Play usluga ili mreže, `getTvPushToken()` vraća `null` i uparivanje
  nastavlja bez notifikacija — TV je tada osakaćen, ali upotrebljiv.

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
