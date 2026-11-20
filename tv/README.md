# Boiler Control TV (Android TV / Google TV)

TV aplikacija za pregled doma: početna, analitika/zdravlje, grijanje, plin,
profil i raspored. Prijava se odobrava telefonom; svi ekrani nakon
uparivanja su read-only. Podaci dolaze iz postojećih GET API-ja, a TV prikazuje
stvarne vrijednosti bez demo mjerenja.

## Tri pravila koja se ne krše

| pravilo | gdje je sprovedeno | test |
|---|---|---|
| TV **ne mijenja** stanje (samo GET nakon uparivanja) | interceptor u `src/services/api/client.ts` + uklonjene `post`/`put`/`patch`/`delete` | `src/services/api/__tests__/client.test.ts` |
| Daljinska navigacija i fokus su prvi razred | glavni tabovi, podtabovi, čitljiv fokus, animirani prelazi | TV ekran testovi + ručna provjera na uređaju |
| prijavu **odobrava telefon**, TV nikad ne vidi lozinku | `POST /api/tv-pairing/sessions` + QR/kod | `src/lib/__tests__/pairing.test.ts` |
| TV mrežne rute se ne dupliraju | `EXPO_PUBLIC_API_URL` već završava sa `/api`; klijent dodaje samo putanju modula | `src/services/api/__tests__/client.test.ts` |

**Jedini POST koji TV šalje** je zahtjev za kod za uparivanje. TV aplikacija
trenutno ne registruje push tokene niti šalje ili učitava notifikacije.

> **Podsjetnik za sljedeći patch:** vrati TV notifikacije — uključujući FCM/Expo
> integraciju, push token prilikom uparivanja, prikaz/API dijelove ako su i dalje
> potrebni, te pripadajuće konfiguraciju i testove. Mobilne notifikacije ostaju
> zasebne i nisu uklonjene.

> **Najkraći put:** `./scripts/build/build-menu.sh` (opcije 5–8). Skripta digne
> verziju i popravi `package-lock.json` sama. Detalji: `docs/BUILD-LOKALNO.md`.

## Tihe nadogradnje unutar aplikacije

TV koristi `expo-updates` na EAS `production` kanalu. Kad se objavi kompatibilna
JavaScript/UI nadogradnja, aplikacija je u pozadini provjeri, preuzme i tiho
primijeni ponovnim pokretanjem svog procesa — bez linka, browsera, ručnog APK-a
ili sistemskog install dijaloga. Objavljivanje ide na isti kanal:

```bash
cd tv && eas update --channel production --message "Opis promjene"
```

OTA ažuriranje važi za JavaScript, stilove i assete. Promjena native modula,
Android dozvola ili konfiguracije i dalje zahtijeva novi APK. Android ne
odobrava tihu instalaciju van-prodavnica za običnu aplikaciju; za nju je potreban
system/device-owner privilegij. U tim slučajevima novi APK mora se isporučiti
putem upravljanog Play kanala ili instalirati uz Androidovu potvrdu.

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

## Uparivanje s telefonom

Na TV-u izaberi **Upari TV**. U mobilnoj aplikaciji otvori **Postavke → Uređaji → Poveži TV**, pa skeniraj TV QR kod kamerom ili ručno unesi osam znakova. Telefon odobrava prijavu; TV nikad ne traži lozinku. QR skener i unos koda vode u isti approval tok.

TV koristi API bazu koja već završava sa `/api` (`EXPO_PUBLIC_API_URL`). Zbog toga se rute u TV klijentu pišu bez ponovnog `/api` prefiksa — u suprotnom bi zahtjevi išli na `/api/api/...` i vraćali 404.

## Testovi

```bash
npm test          # Jest testovi za API, uparivanje, OTA konfiguraciju i TV ekrane
npm run typecheck
```

Testovi ne trebaju TV ni emulator. Provjeravaju odluke koje se na ekranu ne
vide: da `post` **ne ode** osim pairing zahtjeva, da pairing ne registruje push
token, da nedostajuće mjerenje nije nula i da istekao kod ne čeka vječno.

## Šta TV namjerno NE radi

- **Ne upravlja kotlom** i ne mijenja raspored. To ostaje na telefonu; API
  klijent bi odbio svaki takav zahtjev.
- **Ne kreira i ne mijenja podatke**: nema dodavanja očitanja, profilnih
  izmjene.
- **Ne izmišlja mjerenja.** Prazno ili nedostupno polje ostaje označeno kao
  nedostupno; istorijski graf se crta samo iz stvarnih očitanja.

## Nije provjereno u ovom okruženju

- `expo prebuild` i gradnja APK-a (traži Android SDK).
- Ponašanje fokusa daljinskog na uređaju (`hasTVPreferredFocus` postoji u
  forku, ali nije isproban na TV-u).
