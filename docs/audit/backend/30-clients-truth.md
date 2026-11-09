# 30 — Klijenti govore ono što backend stvarno zna

**Status:** realizacija. **Datum:** 2026-11-18. **Grana:** `arena/da41e5ba-boiler-control`.
**Ulazi:** `18` §5 (nema izmišljenih brojeva), `19` §1–§2, `24` §6.5 (shadow), `25` (katalog).

---

## 0. Pitanje na koje ovaj dokument odgovara

Korisnik je postavio uslov: *„sada mora definitivno frontend i mobile da priča
upotpunosti sa backend, i da vraća prave istinite podatke."*

Zato dokument nije spisak ekrana nego **spisak mjesta gdje je klijent tvrdio
nešto što backend nije rekao** — i šta je urađeno sa svakim. Nalazi su nađeni
grepom i čitanjem koda, a ne pregledom; svaki nosi fajl i liniju ponašanja, da
se može provjeriti.

## 1. Nalazi i ishodi

| # | Gdje | Šta je klijent tvrdio | Stvarno stanje | Ishodi |
|---|---|---|---|---|
| 1 | `frontend/.../process-dashboard-data.ts` | `currentTemp: thermostat?.currentTemp \|\| 0` → „0.0 °C" | nema mjerenja | `null`, prikaz „—"; stvarna 0 °C ostaje 0 |
| 2 | isto | `lastUpdate: new Date().toISOString()` | vrijeme *računanja*, nikad se nije prikazivalo | zamijenjeno sa `lastSeen` (zadnje javljanje termostata) |
| 3 | isto | `home = raw.homes[0]` | aktivan dom nije nužno prvi | traži se profil po `homeProfileId` |
| 4 | `HomeProfilePage.tsx` | traži `homeName`, ne traži tri ciljne temperature; dozvoljava 0 cm izolacije, 1800. godinu | DTO traži ciljne temperature, `homeName` je opciono, izolacija 5–30 cm, godina 1900–2100 | validacija poravnata sa DTO-om; poruka „je obavezno" ide kroz i18n (bila je bosanska u engleskom UI-u) |
| 5 | `HomeProfilePage.tsx` | nema polja za `maxHeatingFlowC` | polje postoji u šemi, DTO-u, servisu, kontroleru i dokumentaciji | dodano u formu (30–55, prazno = granica kotla) |
| 6 | `HomeProfilePage.tsx` | jedan padajući spisak modela | porodica pokriva više snaga | trostepeni izbor: marka → porodica/varijanta → snaga |
| 7 | `mobile/.../HomeManagementScreen.tsx` | `boilerModel` slobodan tekst | backend ga ne koristi ni za jednu odluku | zamijenjen katalogom, isti tri koraka i ista pravila kao web |
| 8 | isto | nema `maxHeatingFlowC` | isto kao #5 | dodano (30/35/40/45/50/55 ili „nije postavljeno") |
| 9 | `mobile/.../HeatingScreen.tsx` | `Number(currentTemp ?? 0)` → „0.0 → 21.0 °C", Δ izmišljena | nema mjerenja | `null`-svjesno: „— → 21.0", „Δ —" |
| 10 | `ReportsPage.tsx` | `expectedHeatTimeMin` kao „0 min" | backend upisuje 0 jer motor nema procjenu | prikaz „—"; ispravka na izvoru je otvorena (v. §3) |
| 11 | `ReportsPage.tsx` | shadow izvještaj nije bio dostupan | ruta `GET /api/daily-record/shadow-report` postoji | panel sa presudom, razlozima i neobjašnjenim razlikama |

## 2. Pravila koja su ostala ista, i zašto

- **Nula i „nema podatka" nisu isto.** Svuda gdje mjerenje može izostati, tip je
  `number | null`, a prikaz „—". Testovi u `process-dashboard-data.test.ts`
  provjeravaju oba smjera: da `null` ne postane 0 **i** da stvarna 0 °C ne
  postane „—".
- **Prazno polje se ne popunjava zadanom vrijednošću.** `maxHeatingFlowC` prazno
  znači „granica kotla", a ne 55. Upisana vrijednost izgledala bi kao
  korisnikov podatak, a to je granica koju je neko drugi odredio.
- **Klijent ne donosi zaključak iz brojeva.** Shadow panel prikazuje
  `verdictNote` sa backenda; prazan izvještaj kaže „nema zapisa" ili „nije
  izračunato", nikad „0 razlika". Udio razloga se računa prema danima **sa
  razlikom**, ne prema svim danima — inače čest razlog izgleda rijedak.

## 3. Šta ostaje otvoreno (i zašto nije „popravljeno" u UI-u)

| Šta | Zašto nije urađeno sada |
|---|---|
| `Recommendation.expectedHeatTimeMin` je 0, a ne `null` | traži nullable kolonu + migraciju + regeneraciju ugovora (`contracts/openapi.json` → `api.d.ts`). UI prikazuje „—", ali **zapis u bazi još tvrdi 0**. Prvo sljedeće: kolona `Float?` i upis `null`. |
| shadow izvještaj nije u `contracts/openapi.json` | tipovi su ručno pisani (`frontend/src/features/reports/types.ts`) sa napomenom; kad ruta uđe u ugovor, fajl se briše |
| mobile nema ekran za shadow izvještaj | odluka se donosi za kuću i prati na webu; mobilni prikaz bi trebao svoj period-birač |
| `holiday`/`gas` ekrani koriste `?? 0` na iznosima | kod novca i količina 0 je legitimna vrijednost (nema potrošnje), ali nije provjereno za svako polje — ostaje za zaseban prolaz |

## 4. Provjere

- web: `npx vitest run` → **171 prolazi** (25 fajlova; +25 u odnosu na 146 prije
  ovog rada), `tsc --noEmit`, `eslint` bez grešaka, produkcijski build prolazi;
- i18n: **430 ključeva** u oba jezika (406 + 8 za katalog/snagu + 16 za shadow);
- mobile: `npx jest` → **347 prolazi** (51 suite; +15 za katalog), `tsc --noEmit`
  bez grešaka;
- backend: v. `25` §6 (katalog i snaga) i `Backend build` workflow (build +
  migracije + 1362 testa na stvarnoj bazi).

## 5. Šta ovo **ne** dokazuje

- nema E2E testa koji prolazi kroz pretraživač ili uređaj — provjereno je
  ponašanje funkcija i tipova, ne klik;
- shadow panel nije viđen sa stvarnim podacima: u produkciji je jedan
  `DailyRecord`, pa izvještaj za 30 dana danas vraća „nema zapisa" (što je tačno,
  i to je poenta);
- `maxHeatingFlowC` se čuva i vraća, ali **uticaj na predlog** mjeri se tek kad
  ima dnevnih zapisa sa mjerenjima.
