# Modul: shell

Faza 2. Datum: 2026-11-06. Obuhvata layout, navigaciju, temu, skip link, zaštitu rute i fallback dok se stranica učitava.

Odgovor na provjeru: shell se može ponovo izgraditi iz ovog dokumenta. Ne može se redizajnirati krpanjem `MainLayout.tsx`, jer se fajl ne parsira.

## 1. Svrha i tokovi

Prijavljen korisnik vidi isti omot na svakoj zaštićenoj ruti (`frontend/src/App.tsx`).

1. Otvara stavku menija i mijenja rutu.
2. Na uskom ekranu otvara i zatvara navigaciju.
3. Mijenja svijetlu i tamnu temu. Izbor ostaje u `localStorage` ključu `boiler.theme`.
4. Odjavljuje se i dolazi na `/login`.
5. Tastaturom preskače navigaciju i ulazi u sadržaj.

`/` radi `Navigate` na `/dashboard`. `/login` nema ovaj omot.

## 2. Struktura koda

| Fajl | Neprazne linije | Uloga |
|---|---:|---|
| `frontend/src/components/MainLayout.tsx` | 239 | Meni, header, sadržaj, footer |
| `frontend/src/context/ThemeContext.tsx` | 73 | Tema + antd `ConfigProvider` |
| `frontend/src/components/ProtectedRoute.tsx` | 38 | Token gate, antd `Spin` |
| `frontend/src/App.tsx` | 181 | Rute, `RouteFallback` |
| `frontend/src/shared/components/SkipLink.tsx` | 17 | Skip link |
| `frontend/src/shared/components/Announcer.tsx` | 22 | Nije montiran |
| `frontend/index.html` | 49 | FOUC skripta, `theme-color` |

`MainLayout` importuje samo React, `@ant-design/icons`, `useNavigate`, `useAuth`, `useThemeMode` i `SkipLink`. U JSX-u koristi `Layout`, `Sider`, `Menu`, `Button`, `Tooltip` i `Header` bez importa.

U fajlu su dva omota:

- linije 109–166: antd `Layout`. `items={menuItems}` (linija 125) ne postoji; konstanta je `MENU_ITEMS` (linija 35). Zatvara se `</Tooltip>`, `</div>`, `</header>`.
- linije 167–248: Tailwind sidebar, overlay i `<main id="content">`.

`tsc` (2026-11-06): TS17002 na linijama 159, 165, 166 i 248.

`App.tsx` statički importuje `MainLayout`, `ProtectedRoute` i `ThemeProvider`. Stranice su `lazy`.

## 3. Tok podataka

Shell ne zove API. Čita `user` i `logout` iz auth konteksta, `mode` i `toggleMode` iz teme.

`POST /api/auth/login` vraća `user.role` (`backend/src/modules/Auth/dto/auth-response.dto.ts`). `GET /api/user` selectuje `role` i `prefersDarkMode` (`user.service.ts`, `getMe`). Tip `User` u `AuthContext.tsx` ima `id`, `email`, `username`, `name`. `role` i `prefersDarkMode` se na tipu gube. Header čita samo `user?.name` (`MainLayout.tsx` linija 143).

Tema ne zove API. `useEffect` u `ThemeContext.tsx` (linije 29–37) stavlja ili skida klasu `dark` i piše `localStorage`. `index.html` linije 31–42 rade isto prije Reacta, samo za vrijednost `dark`.

Redis ključeva nema.

## 4. Trenutni UI

Meni od 9 stavki je engleski niz, linije 35–90. Nema aktivne stavke: nema `useLocation`. Desktop grana je `aside` sa `hidden lg:flex` (linija 170). Ispod `lg` overlay i fioka ovise o `collapsed` (linije 198–237). `collapsed` počinje kao `false`, a `true` znači "fioka otvorena". Ime je obrnuto od antd značenja.

Skip link cilja `#main-content` (linija 111). Taj `id` je u antd grani (linija 162). Tailwind grana ima `id="content"` (linija 239). Poslije parse greške ostaje jedan od ta dva, i skip link može ostati bez mete.

`RouteFallback` u `App.tsx` (linije 61–76) je centriran tekst "Učitavanje…" i inline `style`. Nije skeleton.

Svijetlo/tamno: klasa `dark` na `<html>`. Antd tokeni su zaseban hex skup (`ThemeContext.tsx` linije 48–65). `theme-color` u `index.html` je `#f59e0b`. Antd primary je `#ff6b3d`.

`prefersDarkMode` s profila i `prefers-color-scheme` se ne čitaju. Inicijalno stanje je `light` osim ako je ključ tačno `dark` (`ThemeContext.tsx` linije 24–27).

## 5. Pristupačnost

- Skip link postoji i ima bosanski tekst van `t()`. Komponenta koristi `sr-only`, ne klasu `.skip-link` iz `index.css` (linije 135–150). Ta CSS klasa je mrtva.
- `*:focus-visible` u `index.css` (linije 129–131) je `rgb(var(--brand))`. `--brand` je samo u `design/tokens.css`, koji se ne importuje. Prsten nema definisanu boju.
- Stavke menija su `Button`, ne linkovi. Nema `aria-current`. Srednji klik i "otvori u novom tabu" ne rade.
- Overlay (linija 198) je `div` sa `onClick` i `aria-hidden="true"`. Tastatura ga ne zatvara. Escape handlera nema.
- Fioka nema `role="dialog"`, labelu ni focus trap.
- `Announcer` opisuje `announce()`, ali tu funkciju ne eksportuje i niko ga ne montira (grep po `frontend/src` nalazi samo definiciju).
- `ProtectedRoute` za init koristi antd `Spin` bez tekstualne alternative (`ProtectedRoute.tsx` linije 31–35).
- Komentar u `index.html` linija 29 pominje `themeFouc.test.ts`. Taj fajl ne postoji. Provjera ključa je u `accessibility.test.tsx` linije 204–210.

## 6. Usko grlo

`App.tsx` linija 5 drži `MainLayout` u početnom grafu. `MainLayout` vuče `@ant-design/icons`. `ThemeContext.tsx` linija 2 vuče `antd` `ConfigProvider`. `ProtectedRoute.tsx` linija 4 vuče `antd` `Spin`. Lazy rute zato ne izbacuju Ant Design iz prvog učitavanja.

Veličina tog čipa nije izmjerena: `npm run build` staje na `tsc` prije Vite-a (`03-baseline.md`).

`z-fixed` i `z-popover` (`MainLayout.tsx` linije 200 i 207) nisu u `tailwind.config.js`. Jedine definicije su sirove varijable u neučitanom `tokens.css`. Overlay i fioka nemaju z-index iz te klase.

Nema liste koja traži virtualizaciju. Nema upita, pa nema N+1.

## 7. Kvalitet koda

- Fajl se ne parsira. Dva omota, nepostojeći identifikatori `Layout`, `menuItems`, `Button`, `Tooltip`.
- `Announcer` je nedovršen i nemontiran.
- `.skip-link` i `tokens.css` su nekorišteni.
- `useEffect` u temi dira DOM i `localStorage`. To je stvarni efekat, nije suvišan.
- `any` u ovim fajlovima nema.
- Testova za `MainLayout` nema. Postoje testovi za `ProtectedRoute` i FOUC ključ.

## 8. Rizici redizajna

- Svaka ruta dijeli ovaj omot. Pogrešan shell kvari sve module.
- Ključ `boiler.theme` mora ostati. Inače FOUC test i inline skripta se razilaze.
- Odjava mora i dalje zvati `logout()` pa `navigate('/login')` (`MainLayout.tsx` linije 103–106).
- Uklanjanje antd `ConfigProvider` mijenja temu svake stranice koja još koristi antd. To je namjerno (odluka Q1) i ide skupa sa stranicama, ne kao izolovan shell deploy koji ostavlja antd stranice bez teme.
- `collapsed` se koristi i kao antd prop i kao "fioka otvorena". Pri prepisu ime treba biti `isNavOpen`.

## 9. Nalazi

| ID | Opis | Dokaz | Ozbiljnost | Uticaj | Trud |
|---|---|---|---|---|---|
| SH-01 | Dva omota u jednom fajlu, JSX se ne parsira | `MainLayout.tsx` 109–248; `tsc` TS17002 | kritično | Shell se ne može pokrenuti | M |
| SH-02 | Antd je u početnom grafu preko teme, ikona i `Spin` | `App.tsx:5`, `ThemeContext.tsx:2`, `ProtectedRoute.tsx:4` | visoko | Bundle i Q1 | M |
| SH-03 | Meni nije link, nema aktivnu stavku | `MainLayout.tsx` 180–191, nema `useLocation` | visoko | Navigacija i a11y | S |
| SH-04 | Skip link i `id` sadržaja se ne poklapaju između grana | linije 111, 162, 239 | visoko | Tastatura | S |
| SH-05 | Etikete menija i "Welcome" su van i18n | linije 35–90, 143 | srednje | Q7 | S |
| SH-06 | Uloga stiže s API-ja, tip je odbacuje, meni je ne čita | `auth-response.dto.ts`; `AuthContext` `User`; `getMe` select | srednje | Q6 | S |
| SH-07 | `Announcer` nema `announce()` i nije montiran | `Announcer.tsx`; grep | srednje | Status poruke | S |
| SH-08 | Tri palete: antd hex, `theme-color`, mrtav `tokens.css` | `ThemeContext.tsx` 49–54; `index.html:21` | srednje | Tema | M |
| SH-09 | Fioka bez Escape, focus trapa i semantičkog dijaloga | `MainLayout.tsx` 198–237 | srednje | Mobilni a11y | S |
| SH-10 | `z-fixed` / `z-popover` nisu Tailwind tokeni | linije 200, 207; `tailwind.config.js` | srednje | Overlay ispod sadržaja | S |
| SH-11 | Profil `prefersDarkMode` se ignoriše | `user.service.ts` select; `ThemeContext` init | nisko | Tema na novom uređaju | S |

## 10. Prijedlog

Shell se piše iznova, u jednom omotu.

- `lg+`: fiksni sidebar. Ispod toga: drawer, fokus u fioci, Escape zatvara, pozadina je `button` ili ima tastaturni ekvivalent.
- Stavke su `NavLink` sa `aria-current="page"`.
- Sadržaj ima jedan `id="main-content"`. Skip link ostaje prvi fokusabilni element.
- Tema: klasa `dark`, ključ `boiler.theme`, bez antd `ConfigProvider`. Boje iz `decisions.md`.
- Uloga se čita s `user.role` nakon što auth tip proširi postojeći login/`getMe` odgovor. Devet ruta ostaje svim ulogama. Admin test endpoint se ne stavlja u meni (`decisions.md`).
- Tekstovi kroz `t()`, uključujući skip link.
- `Announcer` se montira u shell tek kad postoji stvarni `announce()`. Do tada se ne ostavlja prazan live region koji ništa ne objavljuje.
- `RouteFallback` postaje skeleton traka u tokenima, bez inline hex/style.

Alternativa "samo obrisati antd granu i ostaviti Tailwind granu" i dalje ostavlja neimportovan `Button`, mrtve z-index klase i antd ikone. Zato se fajl ne krpi.

## 11. Testovi prije izmjene

Postoje: `ProtectedRoute` (token i init) i FOUC ključ u `accessibility.test.tsx`.

Prije prepisa dodati karakterizaciju koja ne zavisi od antd-a:

- bez tokena i poslije inita, zaštićena ruta ide na `/login`
- `logout` čisti token i vodi na `/login`
- `boiler.theme=dark` i dalje stavlja klasu `dark` prije i poslije Reacta
- skip link `href` postoji kao `id` na sadržaju
- svaka stavka menija vodi na rutu iz `App.tsx`

`MainLayout` se danas ne može renderovati u Vitestu dok se JSX ne parsira. Ti testovi dolaze uz novi shell, ne nad slomljenim fajlom.

## 12. Otvoreno

Nema blokirajućeg pitanja. Q1–Q7 su u `decisions.md`.

`[PRETPOSTAVKA]` nema: veličina antd čipa u prvom loadu. Mehanizam je dokazan importima. Broj kilobajta čeka build koji prođe `tsc`.
