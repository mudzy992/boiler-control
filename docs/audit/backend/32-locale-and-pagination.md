# 32 — Jezik se nije mogao sačuvati, i liste koje rastu bez granice

Datum: 2026-11-08. Ulazi: dva prijavljena kvara iz stvarne upotrebe (jezik na
profilu, straničenje) + provjera da li se sva upozorenja stvarno trigeruju.

---

## 1. „Ne mogu sačuvati jezik na profilu"

### Šta je stvarno bilo

Backend je `locale` primao i čuvao od prije (`UpdateUserDto.locale`,
`user.locale`). Kvar je bio na klijentu i to **nije bio kvar jezika**:

- Web `ProfilePage` je slao cijeli `form` objekat na `PUT /api/user`. U njemu je
  bio i `id`, koji u DTO-u ne postoji.
- Backend ima `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`,
  pa je svaki takav zahtjev vraćao **400** — za svako polje, ne samo jezik.
- Klijent je grešku gutao u `catch { setSaveStatus('error') }` i prikazivao
  generičko „nije uspjelo". Zato je izgledalo kao da je problem u jeziku.

Dodatno: mobilna aplikacija je jezik čuvala **samo lokalno**
(`AppStorage.set('app.language', …)`). `App.tsx` ga je čitao pri pokretanju, ali
`user.locale` na serveru nikad nije bio ažuriran — jezik je preživljavao restart,
ali ne i drugi uređaj ili reinstalaciju.

### Šta je popravljeno

| Mjesto | Promjena |
|---|---|
| `frontend/…/ProfilePage.tsx` | `id` se izuzima iz tijela zahtjeva; poruka servera se prikazuje uz generičku |
| `mobile/…/SettingsScreen.tsx` | poslije lokalnog spremanja šalje i `PUT /user { locale }`; neuspjeh sinhronizacije ne poništava izbor na uređaju, javlja se posebnom porukom |
| `mobile/…/client.ts` | `updateUserProfile` prima `locale` |
| `backend/…/update-user.dto.ts` | `locale` se validira: `^(bs|en)(-[A-Za-z]{2})?$` |

Zašto ne strogi `IsIn(['bs-BS','en-US'])`: zatečeni zapisi (i testovi) nose
`bs-BA`. Strog spisak bi odbio spremanje **profile** korisniku sa starom
vrijednošću — isti kvar, drugi povod. Pravilo zato prihvata jezik + opcionu
regiju, a odbija `fr-FR`, `BS`, `bosanski`.

### Šta ovo ne dokazuje

Nisam pozvao živ `PUT /api/user` sa produkcijskim tokenom. Dokaz je: DTO testovi
(prihvata/odbija), HTTP testovi kroz pravi `ValidationPipe`, i to što je uzrok
(400 zbog `id`) dokazan čitanjem koda i konfiguracije, a ne nagađanjem.

---

## 2. Straničenje na strani backend-a

### Zašto

| Endpoint | Prije | Problem |
|---|---|---|
| `GET /api/gas/readings` | svi redovi | lista raste svaki mjesec; 132 danas, 1.500 za deset godina |
| `GET /api/recommendations` | `take: 100`, bez oznake | korisnik sa 299 preporuka vidio je 100 i **nije imao način da sazna** da ima još |

### Ugovor

- `limit` (gas: 1–500, zadano 100; preporuke: 1–200, zadano 50) i `offset`
  (≥ 0). Neispravne vrijednosti su **400**, ne tiho rezanje.
- Tijelo odgovora ostaje **niz** — postojeći klijenti se ne lome.
- Ukupan broj ide u zaglavlje **`X-Total-Count`**. Bez njega klijent ne zna da
  postoji strana 2; to je isti kvar kao tihi `take: 100`, samo drugačije
  upakovan.
- Implementacija: `backend/src/common/pagination.ts` (`parsePage`,
  `setTotalCount`, `slicePage`) + 18 unit testova.

### Klijenti

| Klijent | Ponašanje |
|---|---|
| Web · Reports | traži 50, dugme „Učitaj još" diže limit do 200; ispod piše „Prikazano N od M" |
| Web · Plin (lista) | 500 (gornja granica servera) u jednom zahtjevu; ako je na serveru više, zaglavlje stranice to kaže |
| Web · Analitika plina | ista dohvatna granica; ako je `total >` dohvaćenog, iznad grafa stoji upozorenje da analiza ne pokriva sve |
| Mobile | `getGasReadings({ limit: 200 })` — odgovor više ne raste bez granice |

### Šta ostaje otvoreno

- Mobilna lista očitanja **nema** „učitaj još": prikazuje prvih 200. Dok je
  očitanja 132, to je cijela lista; kad ih bude više, ekran mora dobiti dugme.
  Zapisano ovdje da se ne otkrije kao „nestala očitanja".
- Analiza plina na webu se računa na dohvaćenim očitanjima, ne na serveru. Sa
  više od 500 očitanja graf bi bio nepotpun — zato upozorenje, ali pravo rješenje
  je računanje na serveru (`/gas/analysis` to već radi za period).

---

## 3. Upozorenja: šta se stvarno trigeruje

Provjereno u kodu (ko emituje `NotificationType`), ne po dokumentaciji:

| Tip | Emituje se? | Odakle |
|---|---|---|
| `HEATING_STARTED` | ✅ | `ThermostatPoll` — početak ciklusa |
| `HEATING_ENDED` | ✅ | `ThermostatPoll` — kraj ciklusa |
| `SYSTEM_ALERT` | ✅ | `HeatingAnomalyCheckerService`, cron `*/5 * * * *` (intervali otvoreni i nedavno zatvoreni) |
| `DAILY_RECOMMENDATION` | ✅ | `Schedule/daily.recommendation.service`, cron `*/5 * * * *`, debounce 24 h |
| `GAS_READING_REMINDER` | ✅ | `Schedule/gas.reminder.service`, cron `30 6 * * *` (isključen u dev/test) |
| `FLOW_TEMP_CHANGED` | ❌ → ✅ | **nije se emitovao nigdje.** Prekidač je postojao u web podešavanjima i u debounce tabeli, pa se mogao ukljuČiti a da se ništa ne dogodi. Sada se emituje uz početak ciklusa kad se polazna razlikuje ≥ 1 °C od prethodne |

`notifyUser` poštuje i uključenost tipa i debounce — provjereno čitanjem, ne
pretpostavkom.

### Dvije stvarne granice (nisu kvarovi, ali ih treba znati)

1. **Bez push tokena nema ni zapisa.** `notifyUser` se vraća prije
   `notification.create` ako korisnik nema registrovan token. Web preglednik
   token ne registruje, pa web korisnik ne vidi obavijesti koje su „poslane".
2. **Promjena polazne u toku ciklusa** (npr. nova maksimalna polazna u profilu
   doma) ne šalje obavijest — samo promjena uz početak grijanja.

---

## 4. Šta nije provjereno

- Nijedan od ovih endpointa nije pozvan preko mreže na živom API-ju poslije
  deploya; provjera je unit/HTTP testovima i čitanjem koda.
- Straničenje nije testirano sa > 500 očitanja (nema ih toliko).
- `X-Total-Count` kroz CORS **nije** provjeren u pregledniku. Zaglavlje je
  izloženo (`exposedHeaders` u `main.ts`), ali to je tvrdnja iz koda, ne iz
  mreže. Prvi znak problema bio bi „Prikazano 50 od 0" i odsutno dugme
  „Učitaj još".
