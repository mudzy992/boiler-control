# Modul: auth

Faza 2. Datum: 2026-11-06. Obuhvata `/login`, `AuthContext`, token u `apiClient` i granicu sa `ProtectedRoute`. Shell je zaseban dokument.

Odgovor na provjeru: tok prijave, tokena i uloge može se ponovo složiti iz ovog dokumenta. Stranica se ne može renderovati dok import na liniji 5 ne pokazuje na postojeći modul.

## 1. Svrha i tokovi

1. Korisnik unese identifikator i lozinku, pošalje formu, dobije token i ide na `/dashboard`.
2. Pogrešni podaci trebaju ostaviti poruku `auth.loginError`.
3. Reload sa httpOnly refresh cookie-jem, kad je taj tok uključen, ne smije baciti korisnika na `/login` prije nego što `refreshSession` završi. To pokriva `ProtectedRoute`, ne forma.
4. Odjava je u shellu. Auth daje `logout()`.

Registracija, zaboravljena lozinka i promjena lozinke nemaju rutu u `App.tsx`. Ključevi `auth.register`, `auth.forgotPassword`, `auth.signUp` postoje u `locales/config.ts` i niko ih na login stranici ne zove.

## 2. Struktura

| Fajl | Uloga |
|---|---|
| `frontend/src/features/auth/pages/LoginPage.tsx` | Forma, 71 neprazna linija |
| `frontend/src/features/auth/AuthContext.tsx` | token, user, init, login, logout |
| `frontend/src/features/auth/hooks/useAuth.ts` | čitanje konteksta |
| `frontend/src/services/api.ts` | axios, Bearer, refresh, CSRF, 401 |
| `frontend/src/components/ProtectedRoute.tsx` | gate, analiziran u shellu |

`LoginPage.tsx:5` importuje `../components/index`. Iz `features/auth/pages` to je `features/auth/components/index`. Tog fajla nema. `Card`, `Input` i `Button` koji odgovaraju propsima (`padding`, `elevated`, `label`, `isLoading`, `fullWidth`) jesu u `frontend/src/components/`. Ispravan relativni put je `../../../components`.

`tsc` ovu grešku nije ispisao 2026-11-06 jer je stao na parse greškama shella i dashboarda.

## 3. Tok podataka

`POST /api/auth/login` (`auth.controller.ts` linija 100, `@HttpCode(200)`). Tijelo: `identifier`, `password`. Servis (`auth.service.ts` linije 77–112) traži email ili username, baca `UnauthorizedException` (401) za prazan identifikator, nepoznat nalog ili lošu lozinku. Odgovor: `user` (uključujući `role`, `plan`, `prefersDarkMode`) i `token`.

`login()` u kontekstu (linije 99–108) sprema token i `data.user`. Tip `User` (linije 3–8) ima `id: string` i nema `role`. Prisma `id` je `Int`. Runtime objekat ima ulogu; tip je nema. To je SH-06.

Poslije reloada, efekat (linije 51–80) zove `detectAuthMode()`. Ako je cookie tok ugašen, init staje. Ako je uključen i memorija prazna, zove `refreshSession()`. `ProtectedRoute` čeka dok nema tokena i `isInitializing` je true.

`GET /api/user` se zove tek kad token postoji (linije 84–97), ne sa login forme. `getMe` vraća `role`.

401 interceptor (`api.ts` linije 108–140): refresh se pokušava samo jednom, i preskače `/auth/login` i `/auth/refresh`. Blok na liniji 135 i dalje hvata svaki 401, uključujući login: `clearToken()` i `window.location.href = '/login'`.

Redis nema. Lozinka se ne kešira.

## 4. UI

Cijeli ekran, kartica `max-w-md`, naslov "🔥 Boiler Control" van `t()`. Ostali stringovi forme jesu `t('auth.*')`. Nema linka na registraciju. Nema provjere praznih polja, iako `auth.identifierRequired` i `auth.passwordRequired` postoje. Već prijavljen korisnik može otvoriti `/login`. Stranica ne čita token.

Greška je `div` bez `role="alert"`. Zbog 401 preusmjeravanja ta poruka se na neuspjeloj prijavi ne zadržava.

Loading je `isLoading` na dugmetu. Nema skeletona. Stranica je uska i centrirana, nema poseban mobilni layout.

## 5. Pristupačnost

`Input` veže `label` preko `htmlFor` (`components/Input.tsx` linije 44–48). Login prosleđuje stabilne `id`. Polja nemaju `autoComplete` (`username` / `current-password`). Dugme je `type="submit"`. Forma nema `aria-describedby` ka grešci. Naslov je `h1`.

## 6. Performanse

Jedan POST po slanju. Nema liste. Stranica je lazy (`App.tsx`). I dalje dijeli početni graf sa antd temom (SH-02), jer je `ThemeProvider` iznad routera.

`className` na `Input` ide i na omot i na polje (`Input.tsx` linije 32 i 42). To duplira utility na dva elementa. Nije mjereno kao usko grlo.

## 7. Kvalitet

- Pogrešan import, stranica se ne može razriješiti.
- `User.id: string` ne prati `Int`.
- `as Ctx` u `ProtectedRoute.test.tsx` linija 34.
- `login()` ne tipizira `data` (`api.ts` `login` vraća `response.data` bez tipa).
- Mrtvi i18n ključevi za register/forgot na ovoj stranici.
- `useEffect` u kontekstu je stvarni init, nije suvišan.

## 8. Rizici

- 401 pravilo dijeli login, istekao token i refresh. Uska izmjena može ili ostaviti neuspjelu prijavu bez poruke, ili prestati slati istekle sesije na `/login`.
- Cookie i `localStorage` tok moraju oba ostati dok je `AUTH_COOKIE_REFRESH_ENABLED` konfiguracija backenda. Web je ne smije hardkodirati.
- `ProtectedRoute` testovi zaključavaju "init bez tokena ne vodi na login". Novi shell ih ne smije slomiti.
- Uloga se ne smije izgubiti pri tipiziranju `user`, inače Q6 nema izvor.

## 9. Nalazi

| ID | Opis | Dokaz | Ozbiljnost | Uticaj | Trud |
|---|---|---|---|---|---|
| AU-01 | Neuspješan login (401) radi puni reload na `/login` i briše poruku | `api.ts` 135–140; `auth.service.ts` 78–95; `LoginPage.tsx` 22–24 | visoko | Korisnik ne vidi zašto prijava pada | S |
| AU-02 | Import komponente ne postoji | `LoginPage.tsx:5`; nema `features/auth/components` | kritično | Ruta se ne učitava | S |
| AU-03 | Tip `User` odbacuje `role` i laže tip `id` | `AuthContext.tsx` 3–8; `auth.service.ts` 98–110 | visoko | Meni po ulozi | S |
| AU-04 | Prazna polja idu na API; postojeći required ključevi se ne koriste | `LoginPage.tsx` 16–24; `config.ts` 38–39 | srednje | Suvišan 401 | S |
| AU-05 | Greška nema `role="alert"` | `LoginPage.tsx` 40–43 | srednje | Čitač ekrana | S |
| AU-06 | Nema `autoComplete` na lozinci | `LoginPage.tsx` 53–60 | nisko | Menadžer lozinki | S |
| AU-07 | Prijavljen korisnik može ostati na `/login` | `LoginPage.tsx` nema čitanje tokena | nisko | Suvišan ekran | S |

## 10. Prijedlog

- Ispraviti import na postojeći `components` set, pa u implementaciji zamijeniti taj set shadcn poljima. Antd se ovdje ne uvodi.
- U interceptoru ne raditi `window.location` za URL koji je već `/auth/login`. Forma zadržava `auth.loginError` u `role="alert"`.
- Proširiti tip `User` poljima koja login već vraća: `id: number`, `role`, `plan`, `prefersDarkMode`. Bez novog endpointa.
- Prazan identifikator ili lozinka: ne slati zahtjev, koristiti postojeće `t()` ključeve.
- Ako token postoji, `/login` vodi na `/dashboard`.
- `autoComplete="username"` i `autoComplete="current-password"`.

Registracija se ne dodaje. Nema rute ni odluke da se pravi.

## 11. Testovi

Postoje: `ProtectedRoute.test.tsx` (init, token, redirect), `authTokenStorage.test.ts`, `apiBaseUrl.test.ts`. Nema testa forme.

Prije izmjene interceptora dodati karakterizaciju:

- 401 sa `/auth/login` ne postavlja `window.location.href`
- 401 sa drugog URL-a i ugašenim cookie tokom i dalje čisti token i vodi na `/login`
- login odgovor sa `role` ostaje na `user.role`

## 12. Otvoreno

Nema novog pitanja. Q1 i Q7 važe: bez antd-a, tekst kroz `t()`.
