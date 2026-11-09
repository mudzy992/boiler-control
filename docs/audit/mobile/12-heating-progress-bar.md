# 12 — Traka ciklusa grijanja na mobilnoj

Datum: 2026-11-08. Zahtjev vlasnika (`36`): „progres bar koji će se prikazati
kada je grijanje aktivno", sa rasponom 0–120 min, označenim predviđenim
vremenom, zeleno do predviđenog, žuto do idealnog, crveno preko idealnog.

## Zašto je ovo nova traka, a ne popravka stare

Do sada su na mobilnoj bile dvije trake i **nijedna nije bila napredak
grijanja**, iako su obje tako izgledale:

| Traka | Gdje | Šta je stvarno mjerila |
| --- | --- | --- |
| `GaugeBar` polazne vode | Početna, hero | stvarna polazna u rasponu 48–55 °C |
| `GaugeBar` sobne temperature | Grijanje, red termostata | sobna temperatura na fiksnoj skali 0–30 °C |

Obje ostaju na svom mjestu (prva ima svoje objašnjenje ispod trake, druga se
prikazuje kad uređaj ne grije), ali **dok grijanje traje** njihovo mjesto
zauzima `HeatingProgressBar`.

## Model (`mobile/src/lib/heating-progress.ts`)

- `IDEAL_HEAT_MINUTES = 120` — idealno trajanje ciklusa.
- `predictedMin` — **proračunato vrijeme dogrijavanja**:
  1. `system.recommendation.breakdown.expectedHeatTimeMin` (naučeni
     `avgReachTimeMin` za interval iz `HeatingIntervalLearning`), ili
  2. medijana **stvarnih završenih ciklusa** iz istog odgovora
     (`medianCycleMinutes`), ako motor još nema procjenu.
  Nikad izmišljena vrijednost: ako nema ni jednog ni drugog, traka piše
  „procjena još nije naučena" i nema markera.
- Zone: `elapsed <= predicted` → zelena, `predicted < elapsed <= 120` → žuta,
  `elapsed > 120` → crvena („probijanje").
- Skala nikad nije manja od 120; kad ciklus probije, **raste** (npr. 150), da
  crvena zona bude vidljiva, a ne da se traka samo napuni i stane.

Medijana, a ne prosjek, za rezervnu procjenu: jedan zaboravljen ciklus od 9
sati pomjerio bi prosjek, a medijanu ne.

## Komponenta (`mobile/src/ui/HeatingProgressBar.tsx`)

Tri zone su nacrtane kao slabe podloge u punoj širini, napunjenost je solidna
boja *trenutne* zone, a marker pokazuje proračunato vrijeme. Da je obojena
samo napunjenost, korisnik ne bi vidio gdje počinje crvena dok ne uđe u nju.

Pristupačnost: `accessibilityRole="progressbar"` sa `accessibilityValue`
`{min: 0, max: scaleMax, now: elapsed}` — TalkBack izgovori „65 od 120", ne
samo „traka".

## Gdje se prikazuje

- **Početna, hero „Status kotla"** — samo kad je `heatingStart` postavljen i
  `heatingEnd` prazan. Ispod trake: „Grijanje u toku · 65 min proteklo",
  „predviđeno ~45 min · idealno 120 min" i rečenica koja objašnjava zone.
- **Grijanje, red termostata** — samo za uređaj sa **otvorenim** heating
  događajem (znamo početak). Ako uređaj javlja „grije" ali nema događaja,
  ostaje sobna traka: minute se ne izmišljaju.

Sat se osvježava svakih 30 s i **samo dok nešto grije** — nema tajmera kad nema
šta mjeriti.

## Popravka koja je ispala usput

`RecommendationBreakdown` je rušila cijelu Početnu na zapisu bez
`appliedOffsets` (`Cannot read properties of undefined (reading 'home')`), a
`types/Dashboard.ts` izričito kaže da stariji zapisi mogu izostaviti polje.
Offseti se sada izostavljaju, a `samples`/`expectedHeatTimeMin` se provjeravaju
sa `!= null` (ranije je `undefined` prolazio i ispisivao „NaN").

## Provjere

- `src/lib/__tests__/heating-progress.test.ts` — 16 testova: pragovi na granici
  (119/120/121), rast skale preko 120, nula kao „nema procjene", medijana
  (neparan/paran broj, otvoren ciklus, jedan dug ciklus).
- `src/ui/__tests__/heatingProgressBar.test.tsx` — 5 testova: marker procjene,
  granica idealnog vidljiva tek kad skala poraste, `accessibilityValue`
  `{min: 0, max: 120, now: 80}`, traka bez labele se skriva od čitača ekrana.
- `src/screens/__tests__/heatingProgressSource.test.ts` — 4 testa na izvoru:
  traka na Početnoj samo uz `isHeating`, procjena iz preporuke ili medijane,
  traka po uređaju samo uz otvorean događaj, sat samo dok nešto grije.
- `RecommendationBreakdown.test.tsx` — zapis bez `appliedOffsets` ne ruši ekran.
- mobile: `tsc` čist, `jest --ci` **377 / 55 suite**, proces izlazi sam.

### Zašto izvor, a ne render ekrana

Svaki render `DashboardScreen`-a u jestu ostavlja otvoren handle: proces poslije
testova ispiše `Jest did not exit one second after the test run has completed`.
To **nije** posljedica ove izmjene — dokazano tako što je na nepromijenjen ekran
(prije ovih izmjena) dodat još jedan render u postojeći `f2Screens.test.tsx` i
proces i dalje nije izašao. Zato se ponašanje mjeri na modelu i komponenti, a
povezivanje na ekranima čuva test nad izvorom. Handle ostaje dug za odvojen
zadatak; nije maskiran sa `--forceExit`.

## Šta nije provjereno

Nije otvoreno na uređaju. Pragovi i render su pokriveni testovima, ali stvarni
izgled (visina 8 u herou, 4 u redu) i to da li TalkBack čita vrijednost
provjerava vlasnik na telefonu. Isto važi za `expectedHeatTimeMin`: ako u
produkcijskoj bazi `HeatingIntervalLearning.avgReachTimeMin` još nije popunjen,
traka će koristiti medijanu stvarnih ciklusa ili reći da procjene nema.
