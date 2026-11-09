# 33 — Šta CI stvarno provjerava (A1, A2)

Datum: 2026-11-08. Cilj: da „zeleno" znači nešto za sva tri klijenta, ne samo za
backend.

## Prije

| Workflow | Šta je pokrivao | Rupa |
|---|---|---|
| `backend-build.yml` | build, 1443 testa s Postgresom i Redisom, baseline | — |
| `frontend-ci.yml` | tsc, lint, 193 unit testa, openapi:check, build | **e2e se nije izvršavao** (Playwright konfigurisan, 2 speca, nula pokretanja); trigerovao se samo na dvije fiksne grane, jedna od njih arhivirana |
| — | ništa | **mobilni: 347 testova se vrtjelo samo lokalno** |

## Sada

### `mobile-ci.yml` (novo)

`npm ci --ignore-scripts` → `tsc --noEmit` → `eslint .` → `jest --ci` → `jest src/locales`.
Pokreće se na `push` za `mobile/**` i na `pull_request` ka `main`.

Namjerno **bez** EAS builda: on traži nalog i kredencijale, a ovdje je cilj da se
za ~2 minute sazna da li kod stoji. Build APK-a ostaje ručni korak
(`mobile/docs/build-apk.md`).

### `frontend-ci.yml` (dopunjeno)

Poslije `npm run build` dodati su:

- `npx playwright install --with-deps chromium`
- `npx playwright test` nad **sagrađenim** `dist/` (ne nad dev serverom)
- pri padu se čuva `test-results/` (trag), ne nepostojeći HTML izvještaj

Trigeri: `main`, `arena/**`, `pull_request` ka `main`, plus `workflow_dispatch`
sa `e2e_live`.

## Ključna odluka: dva nivoa e2e

| Spec | Treba backend? | Kada se vrti |
|---|---|---|
| `smoke.spec.ts` | **ne** — presreće sve pozive ka API hostu | uvijek |
| `auth.spec.ts` | **da** — stvarna prijava | samo uz `E2E_LIVE=1` + `E2E_USER_*` |

Zašto: test koji pada zato što tuđi server ne odgovara ne govori ništa o našem
kodu, a crveni znak koji se ignoriše je gori od nikakvog. Zato je live način
ručni prekidač, isti princip kao `baseline` u `backend-build.yml`.

## Prvi prolaz je odmah našao dva stara kvara

1. `smoke.spec.ts` je tražio `input#identifier`, a `LoginPage` ima
   `input#login-identifier` (i `login-password`). Test je godinama bio „zelen"
   jer se nije izvršavao.
2. `auth.spec.ts` je tražio `input[name="identifier"]` — `name` atributa nema.

Oba su popravljena na id-jeve koji stvarno postoje.

## Flaky test, popravljen prije nego što je ušao u CI

`gasOpenSheets.test.tsx` je čekao zadani 1 s da se sadržaj sheeta montira
(montira se poslije animacije). Na opterećenom runneru to padne kao „sheet se ne
otvara". Timeout je podignut na 5 s; tri uzastopna prolaza i dva puna prolaza
suitea (347/347) su zeleni.

## Šta ni ovo ne dokazuje

- **Nijedan e2e nije pokrenut lokalno** — sandbox ne može skinuti Chromium
  (mreža je ograničena). Dokaz je isključivo CI run.
- `auth.spec.ts` u live načinu **nikad nije izvršen** — nema kredencija u
  sandboxu. Selektori su popravljeni prema stvarnom markup-u, ali tok
  prijava → dashboard → odjava nije dokazan.
- Mobilni CI ne builduje APK; prolaz znači „kod i testovi stoje", ne „APK radi".
