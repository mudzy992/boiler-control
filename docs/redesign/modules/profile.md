# Modul: profile

Faza 2. Datum: 2026-11-06. Ruta `/profile`. Nalog i cijena plina bez PDV-a. Nije Home profile.

Odgovor na provjeru: polja i PDV prikaz mogu se ponovo složiti odavde. `useCallback` nije importovan. `Card`, `Input`, `InputNumber` i `Button` dolaze iz antd-a, a JSX koristi lokalne propove.

## 1. Svrha i tokovi

1. Učitavanje naloga.
2. Izmjena imena, username, lokacije, zone, jezika i cijene plina bez PDV-a.
3. Email se vidi i ne šalje se u izmjeni.
4. Prikaz cijene sa PDV-om, datuma i izvora. To su izračun i čitanje, ne poseban unos.

Lozinka se ne mijenja na ovoj formi. `UpdateUserDto` ima `password` i `currentPassword`. Stranica ih ne šalje.

## 2. Struktura

`features/profile/pages/ProfilePage.tsx`, 202 linije. `useEffect` plus lokalni state.

Import iz `antd` (linija 2). `Form`, `message`, `Spin`, `Typography` se ne koriste. ESLint to javlja.

`useCallback` se zove na linijama 51 i 59 i nije importovan.

## 3. Tok podataka

`GET /api/user` i `PUT /api/user`. `updateUserProfile` prima `any` (`api.ts` 425).

Tijelo je forma bez emaila (64–66). `setForm({ ...loaded })` (40) ubaci i `id`, `gasPriceIncVat`, `gasPriceLastUpdatedAt`, `gasPriceSource`. Ta polja nisu na `UpdateUserDto`. Globalni pipe ima `whitelist` i `forbidNonWhitelisted` (`backend/src/main.ts` 37–38). Snimanje naloga koji je učitan sa tim poljima dobija 400.

Prazan `username: ''` ne prolazi `@MinLength(3)` na DTO (linije 38–39). Forma šalje prazan string.

PDV na ekranu je `gasPriceExVat * 1.17` (85–88). Backend računa istu stopu `0.17` i vraća `gasPriceIncVat` i `gasPriceVatRate` (`user.service.ts` 12, 157–161). Stranica serverski iznos ne prikazuje.

Redis nema. Keš profila u React Query ne postoji. Auth `user` se poslije snimanja ne osvježava, pa header i dalje može pokazati staro ime.

## 4. UI

Loading je spinner. Pad GET-a ostavlja praznu formu i nema poruke. `onFinish` izlazi ako `profile` nije postavljen (60), pa se sa te prazne forme ne može snimiti. To je bolje od home profile create grane, ali korisnik ne vidi zašto.

Uspjeh i greška snimanja imaju engleski tekst (103, 108). Nema `t()`. Nema retry.

Email je `disabled`. Nema oznake da je samo za čitanje osim što se ne može kucati.

`id="content"` se poklapa sa shellom.

## 5. Pristupačnost

Isti problem kao home profile: `label` na antd `Input` nije veza `<label htmlFor>`. Status nema `role="status"`.

Cijena sa PDV-om je tekst, ne samo broj u inputu.

## 6. Usko grlo

Jedan GET i jedan PUT. Nema liste.

## 7. Kvalitet

`as Omit<UserProfile, 'email'>` (66) krije suvišna polja. `useCallback` nedostaje. Nema testa. `message` je mrtav antd import.

## 8. Rizici

- Ne slati `id` i gas meta polja. `forbidNonWhitelisted` će odbiti cijeli PUT.
- Ne uvoditi promjenu lozinke. Nije na ekranu.
- Stopa 0.17 je danas ista na serveru i na stranici. Prikaz treba čitati `gasPriceVatRate` iz odgovora kad postoji, da se literal ne raziđe. To nije nova formula.
- Email ostaje van tijela.

## 9. Nalazi

| ID | Opis | Dokaz | Ozbiljnost | Uticaj | Trud |
|---|---|---|---|---|---|
| PR-01 | `useCallback` nije importovan | linije 51, 59 | kritično | Fajl se ne kompajlira | S |
| PR-02 | Antd kontrole sa lokalnim propovima | linija 2; JSX `label`, `padding`, `variant`, `isLoading` | visoko | Labele ne rade kroz antd | M |
| PR-03 | PUT šalje polja van DTO | 40, 64–66; `main.ts` 37–38; DTO nema `id` ni `gasPriceIncVat` | visoko | Snimanje vraća 400 | S |
| PR-04 | Prazan username ne prolazi MinLength 3 | DTO 38–39; forma šalje `''` | visoko | 400 i kad je username prazan namjerno | S |
| PR-05 | PDV je literal 1.17, serverski iznos se ignoriše | 85–88; `user.service.ts` 157–161 | srednje | Dva izračuna | S |
| PR-06 | Pad GET-a je prazna forma bez poruke | 41–45 | srednje | Nema retry | S |
| PR-07 | Header ime se ne osvježava | 67 ne zove auth `setUser` | nisko | Staro ime do reloada | S |
| PR-08 | Tekst van `t()` | 94–108, 195 | nisko | Q7 | S |

## 10. Prijedlog

shadcn polja. Tijelo PUT-a je samo `name`, `username`, `homeLocation`, `timezone`, `locale`, `gasPriceExVat`. Prazan username se ne šalje.

PDV prikaz: `gasPriceExVat * (1 + gasPriceVatRate)` kad odgovor ima stopu, inače 0.17 kao današnji fallback. Ne fiksirati drugi broj.

`isError` na učitavanju ima retry. Uspjeh i greška snimanja kroz `t()` i `role="status"`. Poslije uspjeha osvježiti auth ime ako `setUser` već postoji. Bez novog endpointa.

## 11. Testovi

Nema testa. Prije izmjene tijela:

- objekat za PUT nema `id`, `email`, `gasPriceIncVat`, `gasPriceLastUpdatedAt`, `gasPriceSource`
- prazan username nije u tijelu
- 1.5 bez PDV-a i stopa 0.17 daju 1.7550

## 12. Otvoreno

Nema novog pitanja. Promjena lozinke ostaje van ekrana.
