# Mobile × backend/frontend plan — ukrštaj i zavisnosti (Faza 3)

Ovaj dokument povezuje mobilne nalaze s već postojećim planovima: `docs/audit/backend/09-improvements-backlog.md` + `10-implementation-plan.md` (Faza 1) i `docs/audit/frontend/06-improvements-backlog.md` + `07-implementation-plan.md` (Faza 2). **Nijedna stavka ovdje nije odobrenje za implementaciju.**

## Otvorena pitanja za vlasnika

- Redoslijed izdanja: smije li backend mijenjati ugovor prije nego mobile dobije gate za minimalnu verziju (MO-004)?
- Da li weather dobija posvećeni mobilni ekran ili ostaje kartica na dashboardu (kao i pitanje FE-009)?
- Treba li mobile prikazivati preporuke i „zašto ova temperatura" (backend FEAT-1/FORM-1, web FE2-10)?
- Koje notifikacijske kanale backend stvarno koristi? Mobile registruje 4 Android kanala, a backend `channelId` ponašanje nije potvrđeno u ovom auditu.

## 1. Vremenska prognoza (backend FEAT-1, REL-1, W-001–W-005; web FE2-9)

**Stanje na mobilnom:** jedini izvor je `dashboardData.system.weather` (`DashboardScreen.tsx:349`), tip `TodayWeather` (`src/types/Weather.ts`) s poljima `temp/feelsLike/condition/humidity/windSpeed/pressure/uvIndex/sunrise/sunset`. `WeatherCard.tsx:20-29` bira ikonu **string matchingom** nad `condition` (`includes('rain')`, `includes('cloud')`…), a `condition` je slobodan tekst iz backenda.

**Zavisnosti i rizici:**
- Backend W-002/W-003 (sat polja, sunrise semantika) direktno mijenjaju značenje `feelsLike`/`windSpeed`/`sunrise` koje mobile već prikazuje — promjena bez najave mijenja prikaz bez mobilnog release-a.
- Mobile nema izbor lokacije, satnu/dnevnu prognozu ni indikator starosti podataka (za razliku od plana FE2-9). Ako backend uvede `location`/koordinate (W-001), mobile mora dobiti ekran ili barem oznaku „podaci za: X, stara Y min".
- WMO kodovi: ako backend pređe s opisa na kodove, `getWeatherIcon` vraća `partly-sunny` za sve — tiha regresija.

**Preporuka:** uvesti mapiranje WMO → ikona/tekst u dijeljeni modul (isti za web i mobile), dodati polje `observedAt` u odgovor i prikazati starost; weather ekran staviti iza feature flaga `WEATHER_UI_V2` (isti flag kao FE2-9) kako bi web i mobile izlazili usklađeno.

## 2. Formule i preporuke (backend FORM-1, F-001–F-006; web FE2-10)

**Stanje na mobilnom:** `getRecommendations` je definisan (`client.ts`) ali **nikad pozvan**; `GET /api/recommendations` i `/recommendations/today` se ne koriste. `BoilerStatusCard` prikazuje `suggestedFlowTemp` bez ikakvog objašnjenja, a `DashboardScreen.tsx:32-33` ograničava ručni unos na 48–55 °C.

**Zavisnosti i rizici:**
- Kad backend uvede shadow mode i breakdown (FORM-1/2.x), mobile treba prikazati „zašto ova temperatura" — inače korisnik vidi broj koji se mijenja bez razloga.
- Granice 48–55 su **klijentske** i nisu povezane s backend validacijom; ako backend uvede sigurnosne granice po modelu kotla (`06-formulas.md`), mobile mora čitati te granice iz odgovora, ne iz konstanti (MO-015).

**Preporuka:** isto kao FE2-10 — komponenta `RecommendationBreakdown` iza flaga `RECOMMENDATION_BREAKDOWN_ENABLED`, s podacima isključivo iz backend odgovora (bez klijentske rekonstrukcije formule). Granice unosa čitati iz `system.boiler` (npr. `allowedFlowTempRange`).

## 3. Realtime, polling i push (backend REL-2, REL-3, REL-6, R-001–R-007)

| Tema | Backend nalaz | Mobilna strana | Usklađivanje |
|---|---|---|---|
| Polling preklapanje | REL-2 / R-007 | `HeatingScreen` `refetchInterval` 60 s bez `AppState` pauze (MO-027) | Smanjiti klijentski pritisak; nakon uvođenja workerа backend može nuditi `lastUpdatedAt` pa klijent preskače refetch |
| Push slanje i receipt | REL-3 (Expo ticket se ne obrađuje) | registracija tokena bez retry/vidljivosti (MO-003) | Backend outbox + receipt; mobile prikazuje stanje „obavijesti nisu aktivne" |
| Zamjena tokena po platformi | REL-6 | isti uređaj, više korisnika → token se prepiše | Odjava tokena (MO-003) + backend politika više instalacija |
| Deep link | `deepLink: 'myapp://gas/add-reading'` (3 mjesta) | cilja nepostojeći ekran, cold-start se ne obrađuje (MO-002), `scheme` je placeholder (MO-024) | Dogovoriti jednu shemu; backend je ne mijenja dok mobile ne podrži obje |
| Kanali | `channelId` ponašanje nije potvrđeno u Fazi 3 | 4 kanala: `default`, `daily`, `alerts`, `heating` (`notificationService.ts:70-103`) | Provjeriti koji `channelId` backend šalje; kanali se na Androidu ne mogu obrisati nakon izdavanja |
| Redis/BullMQ | R-001–R-003 | nema uticaja na ugovor | Nema mobilnih izmjena; mobilni testovi moraju ostati zeleni |

## 4. API ugovor, tipovi i verzioniranje (backend API-1, API-2, MAINT-4; web FE2-8)

- **Ručno pisani tipovi:** `src/types/Dashboard.ts` (106 linija), `src/types/Weather.ts`, `HomeProfile`/`ThermostatDevice` interface-i u API fajlovima, `SystemDashboard.weather: any`. Isto kao FE-016/FE2-8 → rješenje je zajednički **OpenAPI codegen** (API-2): jedan generator, dva izlaza (web + mobile), contract testovi u CI.
- **Defanzivni shape-ovi:** `HeatingScreen.tsx:94-97` čita i niz i `{events}`; `GasAnalysisScreen` ima 30+ opcionalnih polja. To je simptom nepouzdanog ugovora — nakon codegena ove fallbackove treba ukloniti.
- **Verzioniranje `/v1`:** bez MO-004 (min version gate) verzioniranje **lomi** stare instalirane verzije. Redoslijed mora biti: MO-004 (gate) → API-1/API-2 → uklanjanje stubova.
- **Stubovi:** `GET /api/weather` (B-002) mobile ne koristi; `getBoilerHistory`/`getDashboardHeatingStatus` su mrtve metode (MO-013) → mogu se ukloniti bez mobilnog release-a.

## 5. Sigurnost i privatnost (backend SEC-0…SEC-7, PRIV-1; web FE2-2, FE2-6)

| Backend/web stavka | Mobilna implikacija |
|---|---|
| SEC-4 (refresh tokeni, revokacija) | Mobile čuva JWT u SecureStore bez refresha; 401 → puna odjava (`client.ts:44-52`). Ako backend uvede kratki access + rotirani refresh, mobile treba tok tihog osvježavanja ili će korisnici biti česće odjavljivani. Uskladiti s FE2-2. |
| SEC-1/SEC-2 (IDOR) | Mobile poziva `POST /notifications/:id/read` i `PATCH /gas/reading/:id/reference` — nakon backend popravke ponašanje ostaje isto (403/404), ali mobile mora imati **poruku** za taj slučaj (MO-018). |
| SEC-5 (upload MIME/veličina) | Mobile šalje `type: 'application/pdf'` iz `DocumentPicker` metapodataka (`GasReadingsScreen.tsx:377-381`) — isti izvor koji backend ne može vjerovati. Nakon backend content-sniffinga mobile treba prikazati jasnu grešku za odbijen fajl. |
| SEC-6/OBS-1 (metrike, health) | Mobile nema admin ekran; nije potreban. |
| PRIV-1 (izvoz/brisanje) | `SettingsScreen` „Export data"/„Clear cache" su `console.log` (MO-019); PRIV-1 treba mobilne ulazne tačke. |
| — | Mobile-specifično: token se ne odjavljuje (MO-003), dokumenti u cacheu (MO-020), permisije (MO-025). |
| FE-002/FE2-2 (JWT u localStorage) | Mobile je u boljoj poziciji (SecureStore), ali web fallback na AsyncStorage poništava prednost (MO-010). |

## 6. Podaci i prikaz (backend FEAT-3, FEAT-5, FEAT-7, FEAT-8; web FE2-14)

- **FEAT-8 / B-019 (prva temperatura se pripisuje svim uređajima):** `DashboardScreen.tsx:357-368` radi **istu** stvar na klijentu — traži `recentHeatingEvents.find(e => e.deviceId === thermostat.id)` i prosljeđuje `currentTemp`. Dakle mobile ovisi o ispravku backenda; bez njega prikazuje pogrešnu temperaturu po termostatu.
- **FEAT-5 (m³/h kao „efficiency"):** `GasAnalysisScreen` i `GasAnalyticsCard` prikazuju backend polja; ako backend preimenuje/iskorijeni semantiku, mobilne labele moraju pratiti (i obrnuto).
- **FEAT-3 (obračun cijene, `Float`):** `ProfileScreen` računa `gasPriceIncVat` lokalno s hardcoded 0.17 (MO-009) — treba preći na backend vrijednost.
- **FEAT-7 (gas DTO: string `false` → `true`, negativan broj):** `client.ts:132-149` (`addGasReadingWithUpload`) šalje `counterValue` kao **string** u FormData; `GasForm.tsx:159-163` dopušta bilo koji `parseFloat ≥ 0` (bez provjere opsega/decimala). Backend validacija (FEAT-7) će odbijati unos koji mobile danas pušta → potrebna sinhronizovana validacija i jasna poruka (MO-018).
- **FE2-14 / MO-015:** health score i alert pragovi na tri mjesta — rješava se jednim backend izvorom.

## 7. Zajedničke infrastrukturne teme

| Tema | Backend | Web | Mobile | Zajednički korak |
|---|---|---|---|---|
| Test infrastrukture | 167 općih + 49 integracijskih (zeleno u branch CI) | 0 testova (FE2-11) | 0 testova, `jest: not found` (MO-012) | `scripts/test-all.sh` koji pokriva sva tri dijela |
| Lint/type-check | zeleno | type-check lažno zeleno (FE2-1) | type-check zeleno, lint exit 2 (MO-012) | isti CI obrazac, branch-only |
| Deploy/okruženje | B-011/B-028/B-029 | FE-009 tri compose varijante | MO-005 tri hosta | jedna potvrđena topologija (odluka vlasnika) |
| CI | `.github/workflows/backend-audit.yml` (push aktivna grana + `workflow_dispatch`) | predložen FE2-7 | predložen MO2-16 | svi workflowovi **bez** `pull_request` i **bez** `main` |

## 8. Redoslijed koji ne smije biti obrnut

1. **MO-004 (gate minimalne verzije)** prije bilo koje backend promjene ugovora (API-1/API-2/SEC-4/FEAT-7).
2. **MO-012 (testovi + lint)** prije MO-011 (NativeBase migracija) i MO-015 (seljenje logike u backend).
3. **MO-018 (prikaz grešaka)** prije backend pooštravanja validacije (SEC-1/SEC-2/FEAT-7), inače korisnik vidi tihi neuspjeh.
4. **MO-005 (jedan host)** prije uvođenja mobilnog CI-a, jer e2e/mock backend ovisi o poznatoj putanji.
5. **FE2-2 + SEC-4 (auth)** zajedno s MO-010/MO-014 — prelazak na cookie/refresh bez mobilne strane ostavlja mobile na starom toku.
