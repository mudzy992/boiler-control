# FORMULA — toplotni bilans kuće, u jednom dokumentu

> Ovaj dokument je **referenca, ne plan**. Plan je
> `docs/plans/PLAN-formula-v2.md`. Ako se brojevi ovdje i u kodu raziđu, kod je
> tačan a dokument je greška — i to se hvata automatski:
> `node scripts/audit/formula_doc_check.cjs` poredi svaku vrijednost iz tabele
> „Konstante" sa stvarnim izvozom iz koda.

---

## 1. Šta se računa

Sistem ne „šalta bojler po krivoj". On traži **ravnotežnu polaznu**: temperaturu
vode na ulazu u radijatore pri kojoj kuća u najhladnijem satu dana drži ciljanu
sobnu temperaturu uz neprekidno grijanje.

To je jedna relacija, izvučena iz dnevnog bilansa energije:

```
D·(F − R) = s·(R − O) − c
```

gdje su `F`, `R`, `O` dnevni prosjeci polazne, sobne i vanjske temperature, `D`
udio dana pod grijanjem, `s = b/a` nagib kuće (koliko polazna mora rasti po
stepenu vanjske), a `c` unutrašnji dobici izraženi u stepenima polazne.

Iz toga, za trenutak kad je kuća u ravnoteži (`R = T_cilj`) i dan ne grije
neprekidno (`D = 1`):

```
F_eq = T_cilj + s·(T_cilj − O_ref) − (c + u_day)
```

---

## 2. Izraz

`backend/src/modules/DailyRecord/equilibrium-flow.ts` (`EQUILIBRIUM_VERSION`)

```
O_ref  = (1 − w)·nightMinC + w·dayMaxC        w = 0,3
         bez dayMaxC  →  O_ref = nightMinC
s      = slopeCiHigh   dok je days < 20
         slopeS        inače
         nepoznat days → tretira se kao mlad (konzervativno)
c      = internalGainC   (null → 0, ne izmišlja se)
u_day  = uDayC           (null → 0; **isključen iz predloga**, v. §2a)
```

**Zašto `O_ref` nije samo noć.** Polazna upravlja cijelim danom. Noć je
najhladniji sat i zato nosi 70 %; dnevni maksimum nosi 30 % jer dan koji je
topao po podne ne traži punu polaznu, a dan koji je hladan i po podne traži
višu. Kada `dayMaxC` nema, izraz se **ne pogađa** — vraća se na noć samo i to se
zapisuje kao izvor (`NIGHT` vs `NIGHT_DAY_BLEND`).

**Zašto `s` uzima gornju granicu intervala dok je model mlad.** Potcijenjen `s`
daje prenisku polaznu, a preniska polazna je hladna kuća. Dok model ima manje
od 20 dana, greška nagiba je velika, pa se bira granica koja grije više. Poslije
20 dana koristi se tačka procjene (`slopeS`).

**§2a — `u_day` je izmjeren, ali ne ulazi u predlog (2026-11-12).**

Odluka vlasnika poslije mjerenja F3.3 (`docs/plans/PLAN-formula-v2.md` §10.14).
Prekidač je `DAY_GAIN_IN_PROPOSAL` u `proposal-shadow.service.ts` i sada je
`false` — dakle izraz se u proizvodnji računa kao
`F_eq = T_cilj + s·(T_cilj − O_ref) − c`.

Mjerenje koje je dovelo do toga: `u_day` popravlja **najgori** podbačaj na
lakoj kući (1,70 → 1,29 K) i ne pogoršava ga na teškoj, ali na srednjoj
povećava **broj** dana sa podbačajem (4 → 5 od 50) i spušta polaznu 1,1 K bez
dokaza da je bila previsoka. Član trguje prosječnom marginom za dane sa
dobitkom — a to je trgovina koju treba dokazati na stvarnim podacima (F3.1),
ne u simulaciji.

Procjena se **nastavlja računati** (`HomeModel.uDayC`) i log je ispisuje uz
oznaku „(ne ulazi u predlog)", da se odluka može provjeriti iz zapisa. `null` a
ne `0` je namjerno: `null` znači „nema člana", dok bi `0` tvrdio izmjereni
nulti dobitak.

**Zašto `− (c + u_day)` a ne `− c − u_day`.** Oba člana su **dobici** i oba
spuštaju polaznu. Pišu se kao jedan član namjerno: razdvojeno se lako desi da se
jedan primijeni dvaput (postoji test „`c` i `u_day` se ne oduzimaju dvaput").

**Kada nema broja.** Nedostatak noći (`nightMinC`) ili nagiba (`s`) daje
`flowC = null` i razlog `NO_NIGHT` / `NO_SLOPE`. Kontroler tada drži prošlu
vrijednost (`HOLD`). Bolje ne predložiti ništa nego predložiti broj bez osnova.

---

## 3. Kontroler

`backend/src/modules/DailyRecord/proposal-controller.ts`

Redoslijed pravila **je dio odluke**, ne stil:

1. nema osnova (`DEGRADED`, nema ishoda, nema modela) → ne mijenjaj;
2. **podbačaj** (dan ili noć) → gore, bez obzira na dwell — komfor je sigurnosna
   stvar, ne udobnost;
3. **prebačaj** → dolje;
4. **kratki ciklusi** → gore (spuštanje ih je i proizvelo);
5. **udobno i dugi ciklusi** → dolje jedan korak;
6. **dwell** — samo za promjene koje nijesu iz nužbe;
7. **tvrde granice** — uvijek na kraju.

Nikad se ne ide **ispod ravnotežne polazne**: to nije konzervativnost nego
fizika. Iznad nje se troši gas uzalud; ispod nje se troši komfor.

Spuštanje traži **dokaz**: `flowAdviceAllowed` (model bojlera potvrđen iz
kataloga), `modelState = TRACKING`, i poredljivu noć. Bez toga odluka ostaje na
prošloj vrijednosti, a razlog to imenuje (`MODEL_UNVERIFIED`, `NO_MODEL`,
`NO_NIGHT_EVIDENCE`).

---

## 4. Tvrde granice

`backend/src/modules/DailyRecord/flow-constants.ts` — **jedno mjesto, jedan
vlasnik po granici**.

| granica | vrijednost | vlasnik |
|---|---|---|
| `BOILER_FLOW_MIN_C` | 30 | bojler (fizički) |
| `BOILER_FLOW_MAX_C` | 55 | bojler (fizički) |
| `CURVE_MIN_FLOW_C` | 46 | stara kriva (uklanja se u F4) |
| `CURVE_MAX_FLOW_C` | 55 | stara kriva |
| `HOME_MIN_FLOW_C` | 30 | korisnik (unos) |
| `HOME_MAX_FLOW_C` | 55 | korisnik (unos) |
| `MAX_DAILY_CHANGE_K` | 2 | kontroler (protiv oscilacije) |
| `UNDERSHOOT_TOLERANCE_K` | 1 | mjerenje (šum senzora) |
| `THERMOSTAT_DEAD_ZONE_K` | 1 | termostat (histereza) |

Razlika 30 vs 46 **je namjerna**: kriva je nastala za radijatore i ispod 46 °C
nema smisla za nju; model može predložiti niže, jer računa ravnotežu, a ne
krivu. Prije F5.1 ta razlika nije bila zapisana nigdje osim u dva broja u dva
fajla.

---

## 5. Učenje modela

`backend/src/modules/HomeModel/daily-balance.ts`

Dan ulazi u fit samo ako prođe **sve** filtere — svaki odbija sa imenovanim
razlogom, nikad tiho:

| filter | prag | razlog |
|---|---|---|
| pokrivenost dana | uzoraka ≥ 80 % od 288 | `INCOMPLETE` |
| vanjska temperatura | ≥ 1 uzorak | `NO_OUTDOOR` |
| grijanje | ≥ 1 uzorak pod grijanjem | `NO_HEATING` |
| polazna | poznata na > 10 % uzoraka grijanja | `FLOW_MISSING` |
| cilj sobe | postoji | `NO_TARGET` |
| udio grijanja | 5–98 % | `DUTY` |
| signal | soba − vani ≥ 5 K | `WEAK_SIGNAL` |
| ravnoteža | soba ≤ 2 K od cilja | `NOT_IN_BALANCE` |

Fit traži **8 dana**; dani sa rezidualom većim od 3·MAD se odbacuju i fit se
ponavlja (otvoren prozor, gosti, sunce — ne kuća). Interval pouzdanosti dobija
se bootstrap-om (300 resample-ova, fiksni seed — isti podaci daju isti model).

**Nagib se ograničava na 0,2–1,5.** Ispod 0,2 kuća ne bi reagovala na vanjsku
temperaturu; iznad 1,5 bi svaki stepen vani tražio više od stepena polazne, što
za stambenu kuću nije fizički.

---

## 6. Noćni minimum

`backend/src/modules/DailyRecord/flow-bounds.ts`

Noć je ono što predlog mora pokriti: ako je kuća u 04:00 podbacila, polazna je
bila preniska bez obzira na to kako je bilo po podne.

- poredljiva noć: izmjerena noć nije više od **2 K** hladnija od predviđene
  (`NIGHT_COMPARABLE_TOLERANCE_K`) — inače dokaz ne važi;
- podignuta granica: polazna koja je podbacila + **1 K** (`NIGHT_MARGIN_K`);
- granica se **pamti** (`HomeModel.shortCycleFloorC` za kratke cikluse, noćni
  minimum se izvodi iz historije), jer bi se inače polazna vraćala na istu
  grešku svaki drugi dan.

---

## 7. Ključ intervala

`backend/src/modules/Heating/interval-key.ts`

Učenje se pamti po `(homeProfileId, intervalKey)`. Ključ je
`<weekday|weekend>_<night|morning|late_morning|afternoon|evening>` i računa se
**u zoni kuće**, ne servera.

| dio dana | satovi (lokalno) |
|---|---|
| `night` | 22–06 |
| `morning` | 06–09 |
| `late_morning` | 09–12 |
| `afternoon` | 12–17 |
| `evening` | 17–22 |

Server u UTC-u bi za kuću u BiH pomjerio granicu za 1–2 h, a greška je **tiha**:
ključ izgleda ispravno, samo pripada pogrešnom dijelu dana. Zato `timeZone` nije
opciona — pozivalac mora odlučiti.

Stariji format (`1_afternoon`, dan u sedmici kao broj) se **čita**, ali novi
zapisi uvijek idu u kanonski. Mjereno: u produkciji **nema intervala u oba
formata**, pa migracija ključeva nije potrebna.

---

## 8. Konstante — mašinski provjereno

Tabela ispod se poredi sa stvarnim izvozima iz koda
(`scripts/audit/formula_doc_check.cjs`). Ako se kod promijeni a dokument ne,
provjera pada.

| konstanta | vrijednost | fajl |
|---|---|---|
| `DAY_REFERENCE_WEIGHT` | 0.3 | `equilibrium-flow.ts` |
| `DAY_GAIN_IN_PROPOSAL` | 0 | `proposal-shadow.service.ts` |
| `SLOPE_CONSERVATIVE_MAX_DAYS` | 20 | `equilibrium-flow.ts` |
| `STEP_UP_K` | 1.5 | `proposal-controller.ts` |
| `STEP_DOWN_K` | 1.0 | `proposal-controller.ts` |
| `DWELL_DAYS` | 3 | `proposal-controller.ts` |
| `OVERSHOOT_TOLERANCE_K` | 1.5 | `proposal-controller.ts` |
| `SHORT_CYCLE_MIN` | 6 | `proposal-controller.ts` |
| `UNDERSHOOT_TOLERANCE_K` | 1.0 | `day-outcome.ts` |
| `NIGHT_START_LOCAL_HOUR` | 22 | `day-outcome.ts` |
| `NIGHT_END_LOCAL_HOUR` | 6 | `day-outcome.ts` |
| `NIGHT_COMPARABLE_TOLERANCE_K` | 2 | `flow-bounds.ts` |
| `NIGHT_MARGIN_K` | 1.0 | `flow-bounds.ts` |
| `MIN_DAYS_FOR_FIT` | 8 | `daily-balance.ts` |
| `MIN_DAY_COVERAGE_RATIO` | 0.8 | `daily-balance.ts` |
| `MIN_SIGNAL_K` | 5 | `daily-balance.ts` |
| `SLOPE_MIN` | 0.2 | `daily-balance.ts` |
| `SLOPE_MAX` | 1.5 | `daily-balance.ts` |
| `RESIDUAL_REJECTION_FACTOR` | 3 | `daily-balance.ts` |
| `BOILER_FLOW_MIN_C` | 30 | `flow-constants.ts` |
| `BOILER_FLOW_MAX_C` | 55 | `flow-constants.ts` |
| `CURVE_MIN_FLOW_C` | 46 | `flow-constants.ts` |

---

## 9. Šta ovaj sistem **ne** tvrdi

- Ne tvrdi da je kuća jednokapacitivna. Model pretpostavlja jedan volumen i
  jedan nagib; kuća sa dvije zone ima dva.
- Ne modeluje sunce, PTV, otvoren prozor ni unutrašnje izvore po satu. Zato
  postoji `u_day` kao **jedan dnevni član**, a ne satni profil — i taj član
  trenutno ne ulazi u predlog (§2a).
- Ne tvrdi da je interval pouzdanosti kalibrisan dok to nije izmjereno (F3.1).
- Ne tvrdi da minimalna modulacija kotla postoji u modelu — nema je.

Ono što tvrdi: svaki broj u predlogu može se rekonstruisati iz zapisa, član po
član (`EquilibriumResult.terms`), i nijedan broj se ne izmišlja kad nema
osnova.

---

## 10. Kako provjeriti

```bash
# brojevi u ovom dokumentu == brojevi u kodu
node scripts/audit/formula_doc_check.cjs

# zlatni brojevi kontrolera (F2)
node scripts/audit/formula_v2_golden.cjs

# osjetljivost na pragove (traje ~7 min)
node scripts/audit/controller_sensitivity.cjs
```
