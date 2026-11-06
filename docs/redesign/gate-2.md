# GATE 2 — sažetak nalaza

Datum: 2026-11-06. Svi moduli iz odobrenog redoslijeda imaju dokument u `docs/redesign/modules/`. Produkcijski kod nije mijenjan.

Faza 3 ne počinje dok ovo ne bude odobreno.

## Stanje sistema

Web dashboard se ne pokreće. `tsc` staje na `MainLayout.tsx` i `DashboardPage.tsx`. ESLint: 20 grešaka, 36 upozorenja. Vitest: 54 prolazi, 4 padaju, 3 fajla se ne učitavaju. Build staje prije Vite-a. Bundle i Lighthouse nisu izmjereni.

Ant Design je i dalje u importima, a odluka Q1 ga uklanja. shadcn set postoji i stranice ga ne koriste.

## Obrasci koji se ponavljaju

1. Stranica se ne kompajlira ili ne renderuje: nedostajući import, antd komponenta sa propovima lokalnog dugmeta/inputa, ili dva UI-a u jednom fajlu.
2. Pad upita izgleda kao prazan ekran. Retry skoro nigdje ne postoji.
3. Tekst je djelimično u `t()`, djelimično literal. Obavezna poruka home profila je fiksni bosanski sufiks.
4. `id="content"` na stranicama i u shellu. Skip link traži `main-content`.
5. Dijalog temperature, notifikacije i brisanje nisu pravi modal. Izuzetak koji treba sačuvati je `GasForm` (Escape i povrat fokusa).
6. React Query ključevi su već dijeljeni (gas, notifikacije, home profile). Ručni `useEffect` na home profile i profile te ključeve ne invalidira.

## Poslovna pravila koja redizajn ne smije promijeniti

- Temperatura polaza koju korisnik šalje je 48–55. Clamp preporuke na 46 nije isti broj.
- Health score dolazi sa `GET /api/dashboard/health`. Anomalija na kartici je zadnjih 5 događaja prvog doma.
- Heating stranica je `GET /api/heating-events`, najviše 100, polje `timestampStart`. Dashboard events su drugi ugovor (`startedAt`, limit 500).
- `isHeatingNow` je na elementu niza, ne na nizu.
- Potrošnja plina je novije stanje minus starije. Susjed u listi je noviji zapis.
- Referentna analiza plina ide bez `from`/`to`.
- Breakdown preporuke se ne računa na klijentu. Generate preporuke se ne vraća.
- Home profile granice su one u `validate` na stranici, ne širi Zod.
- PUT naloga smije imati samo polja iz `UpdateUserDto`. Email se ne šalje.
- Devet ruta ostaje svim ulogama. Admin test endpoint nije stavka menija.

## Kritično i visoko

| ID | Modul |
|---|---|
| SH-01, SH-02, SH-03, SH-04 | Shell ne parsira, antd u prvom grafu, meni nije link, skip link |
| AU-01, AU-02, AU-03 | Login 401 briše poruku, pogrešan import, uloga se gubi na tipu |
| DA-01 … DA-06 | Dashboard ne parsira, bedž grijanja, `refetchDashboard`, prazan error, datum, importi |
| BO-01, BO-02 | Boiler kontrole nisu importovane, greška izgleda prazno |
| HE-01, HE-02, HE-03 | Heating `Card`, breakdown `useTranslation`, prazan error |
| GR-01, GR-02 | Gas importi i `message` |
| GA-01, GA-02, GA-03 | Analitika `Card`, greška postaje nule, antd dugme |
| RE-01, RE-02, RE-03 | Reports importi i prazan error |
| NO-01, NO-02, NO-03 | Notifikacije `Card`, antd dugme, mutacija samo u konzoli |
| HP-01 … HP-04 | Home profile se ne kompajlira, antd propovi, create zaključan, GET pad izgleda kao novi profil |
| PR-01 … PR-04 | Profile se ne kompajlira, antd propovi, PUT van DTO, prazan username |

Puni nalazi su u modulima. Srednji i niski ostaju tamo.

## Sljedeće

Faza 3: obrasci, zajedničke komponente, redoslijed implementacije. Čeka odobrenje.
