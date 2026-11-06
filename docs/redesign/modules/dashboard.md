# Modul: dashboard

Faza 2. Datum: 2026-11-06. Ruta `/dashboard`. Fajl se ne parsira. Ponašanje ispod je iz čitljivih dijelova, ne iz pokrenute stranice.

Odgovor na provjeru: ekran se može ponovo složiti iz ovog dokumenta. Ne krpati `DashboardPage.tsx`. Dva UI-a su spojena u jedan return.

## 1. Svrha i tokovi

Operater na jednom ekranu vidi:

1. Health score, stopu anomalija, trenutnu i ciljnu sobnu temperaturu.
2. Vrijeme napolju i stanje kotla. Može upisati trenutnu temperaturu polaza, 48–55 °C.
3. Razlaganje preporuke, upozorenja, dnevni raspored termostata.
4. Graf i tabelu događaja grijanja za raspon datuma, sa oznakom da li grijanje traje.
5. Nepročitane notifikacije i prekidače tipova notifikacija.

Health score se ne računa na klijentu. Izvor je `GET /api/dashboard/health` (`dashboard.controller.ts` linije 65–69, komentar u `api.ts` 372–377).

Anomalija na karticama nije ista kao tabela. `processDashboardData` (`DashboardPage.tsx` 149–172) uzima `homes[0]`, njegov prvi termostat i `recentHeatingEvents`. Backend za taj niz uzima 5 zadnjih događaja (`dashboard.service.ts` 113–118).

## 2. Struktura

| Fajl | Uloga |
|---|---|
| `features/dashboard/pages/DashboardPage.tsx` | stranica, oko 1205 linija |
| `features/dashboard/hooks/useDashboardHeatingRange.ts` | 46 linija, poll 60 s |
| `components/StatCard.tsx` | KPI kartica |
| `features/heating/components/RecommendationBreakdown.tsx` | preporuka |
| `features/notifications/hooks/useNotifications.ts` | lista i preference |
| `constants/boilerLimits.ts` | 48 i 55 |

Importi na vrhu su dupli i pokvareni:

- linija 2: antd `Card`, `Button`, `InputNumber`
- linija 14: `../components/index` → `features/dashboard/components/index`, fajl ne postoji
- linije 15–18 i 139–142: `MIN_CURRENT_FLOW_TEMP` se importuje dvaput. Drugi put iz pravog `../../../constants/boilerLimits`. Prvi put iz `../constants/boilerLimits`, kojeg nema.

`useEffect` je importovan (linija 1) i nema poziva. `columns` (457–515) služi samo za naslove tabele. Render funkcije u tom nizu se ne pozivaju. Tijelo tabele je ručno, linije 872–896.

`NotificationItem` (1155) koristi antd `List`. Tailwind grana (981–1008) ima drugi, kopirani red. `AlertRow` (1200) je antd `Alert`.

## 3. Tok podataka

| Poziv | Ključ | Svježina |
|---|---|---|
| `GET /api/dashboard` | `dashboard` | default 30 s |
| `GET /api/home-profile` | `home-profile` | 5 min |
| `GET /api/weather/current/:id` | `weather-current` | 10 min, tek kad postoji `id` |
| `GET /api/dashboard/health` | `dashboard-health` | 1 min |
| heating events, summary, status | `dashboard-heating-range` | poll 60 s, ne u pozadini |
| notifikacije i preference | zajednički ključevi | hook |

Events odgovor je `{ data: [...] }` sa `startedAt` (`dashboard.service.ts` 284–288). Hook to čita (`useDashboardHeatingRange.ts` 38).

Status je niz `{ deviceId, isHeatingNow }` (`dashboard.service.ts` 412–437, controller linija 83 tip je niz). Hook čita `statusResponse?.isHeatingNow` (linija 40). Na nizu to svojstvo ne postoji, pa je `isHeatingNow` uvijek `false` i bedž ostaje "Idle / Not Heating".

`submitSetTemp` (297–325) zove `refetchDashboard()`. Taj simbol ne postoji u fajlu. Poslije uspjeha `PATCH /api/boiler/current-temp` stranica baca `ReferenceError`. Greška se samo loguje (321). Nema `message` za neuspjeh. Vrijednost van 48–55 se tiho odbija (303–308), iako `isWithinFlowTempRange` već postoji u `boilerLimits.ts`.

Označavanje pročitanim invalidira `notifications` i `notifications-unread-count`. Preference invalidira `notificationPreferences`. Nema optimističnog updatea.

Redis ključeva nema. `capabilities: any` (linija 89) se ne čita.

Dva izvora vremena: `weather/current` ima prednost, inače `system.weather` iz dashboarda (`weatherDisplay`, 232–263).

## 4. UI

Ako `dashboardQuery.isLoading`, cijela stranica je spinner (441–446). Ako nema `data`, tekst "No data available" (449–454). `isError` se ne gleda, pa mrežna greška izgleda kao prazan ekran. Nema ponovnog pokušaja.

Uspješan ekran, redom: naslov, bedž grijanja, četiri KPI, vrijeme, kotao, breakdown, upozorenja (samo ako ih ima), raspored, graf, tabela.

Raspon je jedan `input type="date"` (773–781). Mijenja samo `range[0]`. `range[1]` ostaje `dayjs()` iz prvog rendera. `defaultValue` nije `value`, pa kontrola ne prati stanje. Ako je početak isti kalendarski dan kao taj zamrznuti kraj, bucket je `hour`, inače `day` (327–332).

Fioka notifikacija i postavke postoje dvaput: antd `Drawer`/`Modal` (912–970) i Tailwind fixed paneli (1014–1097). JSX se lomi na liniji 937 (`</Drawer>` poslije `div`) i na liniji 971 (`:` usred fragmenta). `tsc` i ESLint to prijavljuju.

Prazne preference pišu "Loading settings..." i kad upit nije u toku (1036–1038).

Tekst je uglavnom engleski, van `t()`. Antd grana ima bosanski. Graf tooltip miješa "Trajanje" i "Ciklusa".

Light/dark klase postoje. Graf boji stubove heksom `#f59e0b` i `#60a5fa` (817–818). Ikone imaju `#d9d9d9`, `#faad14`, `#ff4d4f`, `#52c41a`, `#1890ff`.

`id="content"` (518) se poklapa s `id` u shellu. Skip link i dalje traži `main-content`.

## 5. Pristupačnost

- Datum nema `<label>`.
- Tabela nema `<caption>`. Graf nema tekstualnu alternativu. Tooltip je HTML iz `@ant-design/plots`.
- KPI boja je samo boja (`valueStyle`). Trend nije tekstualno razdvojen od vrijednosti.
- Notifikacija je `div` sa `onClick` (982). Nema dugme ni tastaturu.
- Checkbox preference (1073) nije vezan za `<label>`.
- Modali nemaju `role="dialog"`, focus trap ni Escape. Overlay je `div` sa `onClick`.
- `AlertRow` prosleđuje `w.level` u antd `type` preko `as` (1201). Ako backend pošalje nivo van tog unija, tip je laž.

## 6. Usko grlo

Svakih 60 s, tri poziva, events sa `limit: 500`. Tabela crta sve redove, bez paginacije i bez `@tanstack/react-virtual` (paket je u `package.json`, u `src` nema importa).

`getHeatingStatus` na backendu radi `findFirst` po svakom termostatu (421–435). Klijent to ponavlja svakih 60 s. Shema se ne mijenja. Ovo je opterećenje koje dashboard već pravi.

`@ant-design/plots` je u lazy čipu rute (`App.tsx`), ali stranica se ne može izgraditi, pa kilobajti nisu ponovo mjereni.

`startTransition` oko `invalidateQueries` (276) ne skraćuje mrežu. `React.memo` na `NotificationItem` ne vrijedi dok se ta komponenta ne renderuje iz razbijenog antd stabla.

`lastUpdate` se računa (166) i nigdje ne čita.

## 7. Kvalitet

- Fajl se ne parsira. Dupli import granica. Pogrešne relativne putanje.
- `as Promise<DashboardResponse>`, `as unknown as HeatingEvent[]`, `as HeatingSummaryResponse`, `items: any[]`, `capabilities: any`.
- `refetchDashboard` nije definisan. Zavisnosti `submitSetTemp` su `[dashboardQuery, setTempValue]`, bez `startTransition`.
- `useEffect` je mrtav import. `columns` renderi su mrtvi.
- Nema testa za stranicu ni za hook.
- `RecommendationBreakdown` koji dashboard ugrađuje zove `useTranslation` bez importa. Četiri testa padaju (`03-baseline.md`).

## 8. Rizici

- `PATCH /api/boiler/current-temp` je isti ugovor kao Boiler stranica. Granice ostaju 48–55. 46 u strategiji grijanja nije korisnički unos (`boilerLimits.ts` komentar).
- Health formula ostaje na serveru. Klijent ne smije vratiti `100 - anomalije×15`.
- Anomalija na kartici je zadnjih 5 događaja prvog doma, ne filtrirana tabela. Spajanje ta dva broja mijenja značenje.
- Samo `homes[0]` i `thermostats[0]`. Ako API vrati više profila, ostali se ne vide.
- Notifikacije dijele query ključeve sa `/notifications`. Drugačiji ključ duplira listu.
- Uklanjanje antd i `@ant-design/plots` je odluka Q1. Graf treba zamjena koja i dalje veže hover na red tabele (`activeBucket`).

## 9. Nalazi

| ID | Opis | Dokaz | Ozbiljnost | Uticaj | Trud |
|---|---|---|---|---|---|
| DA-01 | Dva UI-a, JSX se ne parsira | linije 912–971; `tsc` TS17002/TS17008 | kritično | Stranica se ne pokreće | L |
| DA-02 | `isHeatingNow` se čita s niza | hook linija 40; servis 431–437 | visoko | Bedž grijanja je uvijek Idle | S |
| DA-03 | `refetchDashboard` ne postoji | linija 315 | visoko | Snimanje temperature puca poslije uspjeha | S |
| DA-04 | Greška dashboard upita izgleda kao prazan ekran | 441–454, nema `isError` | visoko | Nema retry | S |
| DA-05 | Raspon datuma mijenja samo početak, kraj je zamrznut | 178–180, 773–781 | visoko | Graf i tabela lažu period | S |
| DA-06 | Dupli i nepostojeći importi | linije 14–18 i 139–142 | visoko | Modul se ne razrješava | S |
| DA-07 | Do 500 redova bez paginacije, poll 60 s | hook 4–5, 32; tabela 863 | srednje | INP i mreža | M |
| DA-08 | Status poll radi N upita na serveru | `getHeatingStatus` 421–435 | srednje | Opterećenje svakih 60 s | M, van API ugovora |
| DA-09 | Hex u grafu i ikonama, tekst van `t()` | 817–818, 923, 1166–1173 | srednje | Q1 i Q7 | M |
| DA-10 | Fioka i modal nisu dijalog | 982, 1014–1104 | srednje | Tastatura | M |
| DA-11 | KPI trend prikazuje sam score, ne promjenu | 557–558 | nisko | Pogrešno čitanje | S |
| DA-12 | `currentTemp \|\| 0` pretvara nedostatak u 0 °C | linija 164 | nisko | Lažan KPI | S |

## 10. Prijedlog

Stranica se piše iznova, jedan layout, shadcn primitivi, bez antd i bez `@ant-design/plots`.

- Zadržati pet upita i postojeće query ključeve. Ne dodavati endpoint.
- Status: `isHeatingNow` je true ako bilo koji element niza ima `isHeatingNow`. To je čitanje postojećeg odgovora, ne novi ugovor.
- Poslije `setBoilerCurrentTemp` zvati `dashboardQuery.refetch()`, ne nepostojeću funkciju. Van raspona prikazati `flowTempRangeMessage()`.
- `isError` na dashboard, health i heating upitima: poruka i retry. Loading je skeleton kartica, ne spinner preko stranice.
- Raspon: dva datuma, kontrolisana, kraj ne stariji od početka. Bucket pravilo ostaje: isti dan → `hour`, inače `day`.
- Tabela: paginacija ili virtualizacija postojećim `@tanstack/react-virtual`. Prazan raspon ostaje "No heating events...".
- Graf: pristupačan prikaz istih `buckets` (tabela je već alternativa). Hover i dalje označava `activeBucket`. Boje iz tokena `accent` i jedne neutralne serije. Bez heksa.
- Notifikacije: jedan drawer. Klik je dugme. Preference su switch uz pravi label. Tekst kroz `t()`.
- KPI anomalije i health ostaju odvojeni, sa kratkim opisom šta broj znači (zadnjih 5, odnosno serverski score).

DA-08 se ne rješava novim upitom bez odobrenja. Klijent može prestati da zove status češće od ostalih podataka tek kao zaseban prijedlog.

## 11. Testovi

Nema testa stranice ni hooka. `RecommendationBreakdown` testovi padaju i blokiraju ugrađeni blok.

Prije prepisa, karakterizacija čistih funkcija (mogu se izdvojiti bez rendera slomljenog JSX-a):

- `processDashboardData` na jednom domu i praznom `homes`
- bucket `hour` kad su oba kraja isti dan, inače `day`
- status niz `[{ isHeatingNow: true }]` daje aktivan bedž
- 47.9 i 55.1 se ne šalju, 48 i 55 se šalju

## 12. Otvoreno

Nema novog pitanja za vlasnika. Više domova se i dalje svodi na prvi. To je postojeće ponašanje, ne pretpostavka.

`[PRETPOSTAVKA]` nema za kilobajte `@ant-design/plots`. Mehanizam je import na liniji 8. Broj čeka build.
