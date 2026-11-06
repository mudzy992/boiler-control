# Modul: home-profile

Faza 2. Datum: 2026-11-06. Ruta `/home-profile`.

Odgovor na provjeru: polja, granice i create/update grana mogu se ponovo složiti odavde. Fajl se ne može izvršiti: nedostaju `useTranslation`, `useCallback`, `useMemo` i `CreateHomeProfileDto`.

## 1. Svrha i tokovi

1. Učitavanje postojećeg profila u formu.
2. Izmjena građevinskih i temperaturnih polja, pa snimanje.
3. Ako profil ne postoji, forma je prazna i submit treba da kreira profil.

`seasonMode` je na tipu (`features/home-profile/types/index.ts` linija 66) i nije polje forme. Lokacija kuće nije na ovoj formi. Ostaje tako. Lokacija naloga je na Profile.

## 2. Struktura

`features/home-profile/pages/HomeProfilePage.tsx`, 504 linije. Ručni `useState`, ne React Query.

Import iz `antd` (linije 2–14): `Card`, `Input`, `InputNumber`, `Button` se koriste. `Form`, `Select`, `Switch`, `Row`, `Col`, `message`, `Spin` su neiskorišteni. ESLint to javlja.

JSX im daje propove lokalnog seta: `padding`, `elevated`, `label`, `error`, `variant`, `isLoading`. To nisu antd propovi. Labele na `Input`/`InputNumber` zato ne prolaze kroz antd API. `<select>` i checkbox imaju pravi `<label>`.

`schemas.ts` (Zod) i `homeProfileApi.ts` stranica ne zove. Stranica ide na `apiClient`.

## 3. Tok podataka

`useEffect` jednom zove `GET /api/home-profile` (73–106). Svaki `catch` ostavlja `profile === null` i praznu formu. Mrežna greška i "nema profila" izgledaju isto.

Submit (162–185): ako postoji `profile.id`, `PATCH /api/home-profile/:id`. Inače `POST` uz `as CreateHomeProfileDto`. Tip nije importovan.

Poslije uspjeha `setProfile` se ne zove. `isDirty` i dalje poredi formu sa starim profilom.

Redis nema. Nema optimističnog updatea. Dashboard i dalje drži `home-profile` u React Query. Ova stranica taj ključ ne invalidira.

## 4. UI

Loading je spinner. Nema posebnog error ekrana za učitavanje.

Obavezna polja: ime, površina, visina, godina, tri tipa. Poruka je literal `${label} je obavezno` (135), iako je label iz `t()`.

Žive granice su u `validate` (139–147), ne u Zodu:

| Polje | Forma | Zod (`schemas.ts`) |
|---|---|---|
| floorArea | 10–2000 | do 10000 |
| ceilingHeight | 2–5 | do 50 |
| constructionYear | 1800–2100 | do tekuće godine |
| insulationThickness | 0–50 | do 1000 |
| numberOfResidents | 1–20 | do 50 |
| temperature | 5–30 | 10–35 |

Zod se na ovoj ruti ne izvršava. Redizajn zadržava granice forme.

`isDirty` je false kad profil nije učitan (187–188). Save je `disabled` kad `!isDirty` (494). Prvi unos se ne može poslati.

Opcije selecta su engleski literali u `homeProfileEnums.ts`. `id="content"` se poklapa sa shellom.

## 5. Pristupačnost

Tekstualni i brojčani inputi ovise o `label` prop-u koji antd ne implementira kao `<label>`. Select ima `label` bez `htmlFor`. Checkbox label (416) nema `htmlFor`, input ima id. Klik na tekst ne pali checkbox.

Greške polja za select jesu `<p>`. Nisu `aria-describedby`. Status snimanja nema `role="status"`.

## 6. Usko grlo

Jedan GET i jedan POST ili PATCH. Nema liste. `useEffect` je stvarni load. N+1 nema.

## 7. Kvalitet

Nedostaju četiri simbola. `as InsulationType` i srodni castovi na selectu (307, 348, 372). `as CreateHomeProfileDto` i `as HomeProfileResponse`.

Zod i `homeProfileApi` su drugi, nekorišteni ugovor. Dva izvora granica.

Nema testa stranice.

## 8. Rizici

- Granice forme su poslovno pravilo ekrana. Prepis na Zod mijenja šta sme da se sačuva.
- `seasonMode` se ne šalje. PATCH ne smije da ga briše time što polje nije u formi.
- Invalidacija `queryKeys.homeProfile` treba da se doda jer dashboard čita isti profil. To nije novi endpoint.
- Enum vrijednosti moraju ostati iste kao Prisma (`homeProfileEnums.ts` komentar).

## 9. Nalazi

| ID | Opis | Dokaz | Ozbiljnost | Uticaj | Trud |
|---|---|---|---|---|---|
| HP-01 | Nedostaju `useTranslation`, `useCallback`, `useMemo`, `CreateHomeProfileDto` | linije 65, 108, 120, 162, 176, 187 | kritično | Modul se ne kompajlira | S |
| HP-02 | Antd kontrole dobijaju propove lokalnog inputa | import 2–14; JSX `label`/`padding`/`variant` | visoko | Labele i kartica ne rade kao zamišljeno | M |
| HP-03 | Prvi profil se ne može sačuvati | `isDirty` 187–188; dugme 494 | visoko | Create grana je mrtva | S |
| HP-04 | Svaki pad GET-a izgleda kao novi profil | 98–100 | visoko | Korisnik može poslati create umjesto retry | S |
| HP-05 | Zod i forma imaju različite granice, Zod se ne zove | `schemas.ts` naspram 139–147 | srednje | Dva izvora istine | S |
| HP-06 | Poslije snimanja profil u stanju ostaje star | 173–178 | srednje | `isDirty` ostaje true | S |
| HP-07 | React Query ključ profila se ne invalidira | stranica ne zove `queryClient` | srednje | Dashboard drži staro | S |
| HP-08 | Obavezna poruka je fiksni bosanski sufiks | linija 135 | nisko | Q7 | S |
| HP-09 | Checkbox label nije vezan | 416–426 | nisko | Klik na tekst | S |

## 10. Prijedlog

shadcn polja i jedna kartica. Importi koji nedostaju se ne krpe u antd.

Učitavanje: 404 ostaje prazna forma za create. Ostale greške imaju retry i ne otvaraju create. To je razlikovanje koje kod danas nema. Ako GET ne vraća poseban 404, create ostaje samo kad je tijelo prazno, a mrežni pad ostaje greška. Tačan status treba provjeriti na kontroleru u implementaciji, bez novog endpointa.

`isDirty` za novi profil je true čim su obavezna polja popunjena, ili Save nije vezan za dirty dok profil ne postoji.

Granice ostaju one iz `validate`. Zod se ne uključuje dok se brojevi ne usklade posebnom odlukom.

Poslije uspjeha upisati odgovor u `profile` i invalidirati `homeProfile`. `seasonMode` se ne dira.

Select opcije kroz `t()`, vrijednosti enuma ostaju.

## 11. Testovi

Nema testa. Prije izmjene dirty logike:

- bez profila, popunjena obavezna polja omoguće Save
- 10 i 2000 za površinu prolaze, 9 ne prolazi
- temperatura 5 prolazi, 4 ne prolazi

## 12. Otvoreno

Status kod kad profil ne postoji nije čitan u kontroleru u ovoj sesiji. HP-04 ostaje na ponašanju `catch`, ne na tvrđenju da je to baš 404.
