# Odluke poslije GATE 1

Datum: 2026-11-06. Izvor: odgovori na `open-questions.md`.

| ID | Odluka |
|---|---|
| Q1 | Ant Design se uklanja iz web aplikacije. Primitivi su shadcn/ui (`frontend/src/shared/components/ui`). |
| Q2 | Vizuelni pravac bira analiza, ne Figma. Radni jezik ispod. Puni zapis ide u Fazu 4 (`06-design-direction.md`). |
| Q3 | Trenutno stablo je izvor ponašanja. Shell i dashboard se ne krpe: grade se iznova jer se ne parsira. Stariji zeleni commit se ne traži. |
| Q4 | `npm ci` u `frontend/` je odobren. |
| Q5 | Opseg je responzivni web dashboard. `mobile/` je zaseban posao. |
| Q6 | Meni smije pratiti ulogu. Pravilo ispod. |
| Q7 | Korisnički tekst ide kroz postojeći i18n (`t()`), BS + EN. |

## Vizuelni jezik (radna odluka, Q2)

Referenca: gust, miran operaterski dashboard u duhu Linear/Vercel, uz postojeće projektno pravilo Apple-linear. Desktop je primaran. Od 1024px naniže navigacija je drawer. Cilj širine je od 360px.

Boje su postojeće vrijednosti iz koda, ne nova marka:

| Token | Vrijednost | Izvor |
|---|---|---|
| primary | `#ff6b3d` | `ThemeContext.tsx` `colorPrimary` |
| background | `#f6f7fb` / `#0b0f1a` | isti fajl, `colorBgBase` |
| text | `#111827` / `#e5e7eb` | isti fajl, `colorTextBase` |
| accent | `#f59e0b` | `frontend/index.html` `theme-color` |
| success | `#10b981` | `frontend/src/design/tokens.css` `--success` |
| danger | `#ef4444` | `tokens.css` `--error` |

`tokens.css` se danas ne učitava. U implementaciji ove vrijednosti postaju CSS varijable koje Tailwind tema čita. Hex u komponentama ostaje zabranjen.

## Uloge (Q6)

Devet trenutnih ruta ostaje vidljivo ulogama `USER`, `SUPPORT` i `ADMIN`. Backend ih štiti samo sa `JwtAuthGuard`. Jedini `@Roles(UserRole.ADMIN)` u `backend/src` je `POST /api/notifications/test-trigger-all-gas-reminders` (`notifications.controller.ts`). Taj test endpoint ne dobija stavku u meniju.

Shell prikazuje ulogu. `POST /api/auth/login` vraća `user.role` (`auth-response.dto.ts`). `GET /api/user` je takođe selectuje (`user.service.ts` `getMe`). `AuthContext` tip `User` to polje nema, pa ga shell danas ne može tipizirano pročitati.

Nova admin stavka dolazi tek uz endpoint koji već ima `@Roles`. Skrivanje operativne stranice samo u meniju nije autorizacija.
