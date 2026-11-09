# 32 — Dvije „trenutne" temperature: koja je koja

U sistemu postoje **dvije potpuno različite** temperature koje se u razgovoru, a
djelimično i u kodu, zovu isto — „trenutna":

1. **vazduh u prostoriji** — ono što očitava termostat (`roomCurrentTemp`) i cilj
   koji se od njega očekuje (`roomTargetTemp`, fiksni ili iz programa);
2. **polazna voda u kotlu** — ono što je korisnik ručno podesio na kotlu i upisao
   u aplikaciju (`actualFlowTemp`), i ono što aplikacija predlaže proračunom
   (`suggestedFlowTemp`).

Obje su `number` u °C. Ako se pomiješaju, **ništa ne pada**: test prolazi, tip
prolazi, a na ekranu piše pogrešan broj. Zato ovo nije stvar stila imenovanja.

---

## 1. Kanonska tabela

| Pojam | DB kolona | Prisma polje | API polje | Ko piše | Šta znači |
|---|---|---|---|---|---|
| Soba, trenutno | `currentTemp` | `roomCurrentTemp` | `currentTemp` | termostat (poll) | temperatura vazduha koju termostat sada očitava |
| Soba, cilj | `targetTemp` | `roomTargetTemp` | `targetTemp` | termostat / program | temperatura koju soba treba da ima |
| Soba, cilj iz programa | `targetTemp` | `ThermostatProgram.targetTemp` | `program[].targetTemp` | program | cilj za taj interval, ne trenutno stanje |
| Polazna, na kotlu | `actualTemp` | `actualFlowTemp` | `actualFlowTemp` | **korisnik** (ručno, kroz aplikaciju) | stvarna polazna koju je korisnik podesio na kotlu i upisao |
| Polazna, predložena | `suggestedTemp` | `suggestedFlowTemp` | `suggestedFlowTemp` | proračun | polazna koju aplikacija predlaže |
| Polazna, dnevni zapis | — | `DailyRecord.flowSetC` | (interno) | pisac / backfill | koja je polazna tog dana stvarno bila na kotlu |
| Vanjska | `externalTemp` | `externalTemp` | `externalTemp` | uređaj / prognoza | napolju |

Pravilo: **ime mora nositi porodicu.** `room…` = soba, `…FlowTemp` = polazna,
`external…`/`outside…` = vanjska. Gola imena (`currentTemp`, `targetTemp`,
`suggestedTemp`, `actualTemp`) su dvosmislena i smiju samo nestajati.

Kanonska imena su i u kodu: `backend/src/common/temperature-semantics.ts`
(`TEMPERATURE_FIELDS`), sa tipovima `RoomTempC` / `FlowTempC` / `OutdoorTempC` za
novi kod.

## 2. Šta je stvarno bilo pogrešno na ekranu

Nađeno pregledom klijenta, popravljeno u istom commitu:

| Mjesto | Bilo | Problem | Sada |
|---|---|---|---|
| Web dashboard, kartica kotla | veliki broj = `actualFlowTemp`, bez etikete ispod naslova „Status kotla" | najveći broj na ekranu čita se kao temperatura sobe, a to je polazna voda | naslov „Polazna voda (upisana na kotlu)" |
| Web dashboard | `suggestedFlow: 'Predložena protok. temp.'` | „protok" je *flow rate*, ne *flow temperature* | „Polazna voda — predložena" |
| Web dashboard | `actualFlow: 'Stvarna protok. temp.'` | isto | „Polazna voda — na kotlu" |
| Web dashboard / kotao | `currentTemp: 'Trenutna temp.'` za **sobu** | ista riječ kao za polaznu | „Temperatura sobe" |
| Web kotao, tabela | kolone „Predložena" / „Stvarna" | ne kažu da je polazna | „Predložena polazna" / „Polazna na kotlu" |
| Web + mobile, dugme | „Postavi trenutnu temp." | zvuči kao da mijenja sobu; mijenja **zapis polazne** | „Upiši temperaturu polazne" |
| Mobile dashboard | veliki broj = `suggestedFlowTemp` (predlog), bez etikete | predlog izgleda kao stanje | etikete „Predložena" i „Na kotlu" uz oba broja |
| Mobile kotao | `actualNotSet: 'Trenutna temperatura još nije postavljena'` | nejasno šta nije postavljeno | „Temperatura polazne još nije upisana" |

Zadržana je odluka F7 (HOME-02): na mobilnoj Početnoj je istaknut **predlog**, jer
je to jedini broj na koji korisnik može uticati. Ono što je nedostajalo nije bila
veličina broja nego **etiketa** — sada je ima.

## 3. Mehanizam za buduća refaktorisanja

Tri sloja, svaki provjerljiv:

1. **Kanonski modul** — `backend/src/common/temperature-semantics.ts`: tabela
   polja, tipovi porodica, i tekst pravila na jednom mjestu.
2. **Ratchet test** — `backend/src/common/tests/temperature-semantics.spec.ts`
   skenira `backend/src`, `frontend/src` i `mobile/src` (produkcijski kod, bez
   testova) i poredi sa `temperature-semantics.baseline.json`. Novi fajl sa golim
   imenom ili veći broj u postojećem = **pad CI-ja**, sa porukom koje ime treba.
   Baseline danas: **27 fajlova / 175 pojava** (zatečeni dug). Broj smije samo
   padati; regeneriše se sa `UPDATE_TEMP_BASELINE=1 npx jest temperature-semantics`.
   Skeniranje preskače `generated/` (Prisma klijent sadrži imena **svih** kolona,
   pa bi ga brojalo kao naš kod — prvi CI run je pao upravo na tome), kao i
   `node_modules`, `dist`, `build`, `coverage`, `.next`, `.expo`, `android`, `ios`
   i testove.

3. **Test etiketa** — `frontend/src/locales/__tests__/temperature-labels.test.ts`
   provjerava da svaka etiketa polazne (en i bs) sadrži „polaz"/„flow", da dugme
   upisa ne glasi kao „postavi trenutnu temp.", i da se soba zove soba.

Zašto ratchet, a ne potpuna zabrana: 175 pojava su zatečeni dug i zabrana bi
blokirala CI dok se sve ne preimenuje — a tolerisan dug bez mjere bi rastao. Ovako
je stanje **zamrznuto** i vidi se tačno kad se pogorša.

## 4. Šta još nije preimenovano (i zašto)

API polja u `dashboard-response.dto.ts` i `frontend/src/types/api.d.ts` još nose
`currentTemp` / `targetTemp` za **sobu**, u istom odgovoru u kojem postoje
`suggestedFlowTemp` / `actualFlowTemp`. Preimenovanje u `roomCurrentTemp` /
`roomTargetTemp` je ispravan sljedeći korak, ali je **breaking change** za API:
traži izmjenu DTO-a, `contracts/openapi.json`, `api.d.ts`, web i mobile klijenata u
istom commitu. Zato je ostavljeno kao zaseban zadatak — sa baseline-om koji ga
drži na okupu dok se ne uradi.

Mobile ima svoje `mobile/src/types/Dashboard.ts` sa istim golim imenima; isto
važi.

## 5. Šta ovo ne dokazuje

- Ratchet ne dokazuje da su podaci **tačni** — samo da imena nisu gora. Zamjena
  dvije vrijednosti iste porodice (npr. `actualFlowTemp` ↔ `suggestedFlowTemp`)
  i dalje prolazi kroz sve testove; to hvata tek test ponašanja po ekranu.
- Etikete su provjerene na nivou i18n resursa, ne na snimku ekrana; mobilni
  snapshot je ažuriran ručno (`-u`) i potvrđuje samo dodane etikete.
- 175 zatečenih pojava nijesu sve greške — mnoge su legitimne (`program[].targetTemp`
  je zaista cilj sobe). Baseline mjeri **dvosmislenost imena**, ne ispravnost.
- API preimenovanje iz §4 nije urađeno.
