# 28 — Istraživanje: jedina promjena koja nije popravka

**Status:** realizacija. **Datum:** 2026-11-16. **Grana:** `arena/da41e5ba-boiler-control`.
**Ulazi:** `17` §8.5 (pravila istraživanja), `24` (kontroler), `26` (mjerenje shadow
perioda), `27` (`u_day`).

---

## 0. Zašto je ovo uopšte potrebno

Nagib `s` se identificira iz **varijacije** polazne: bez nje regresija ima jedan `x` i
beskonačno rješenja. A kontroler po konstrukciji teži stanju u kojem se polazna ne mijenja
— spusti korak, pa čeka. To je dobro za komfor i loše za učenje: kuća koja 40 dana radi na
istoj polaznoj daje model koji se ne može poboljšati.

Istraživanje je jedina promjena koja se pravi **bez** izmjerenog problema. Zato je i
najopasnija stvar u sistemu, pa ima više uslova od ijednog drugog pravila.

## 1. Pravila (`17` §8.5) i gdje su u kodu

| Pravilo | Vrijednost | Zašto tako |
|---|---|---|
| rezerva | prebačaj > 1 K u **3 od 5** zadnjih dana | jedan topao dan nije rezerva; tri od pet jeste |
| amplituda | **1 K** | manje se ne vidi u podacima, više je već rizik |
| nikad dva dana zaredom | `shadowExplorationDirection` juče ⇒ blok | dva koraka zaredom su nova konvergencija, ne varijacija |
| nikad kad je noć hladna | `nightMinC < 0` ⇒ blok | noć je dio dana kad grešku nema ko primijetiti |
| nikad bez prognoze noći | `nightMinC == null` ⇒ blok | ne zna se pokriva li noć |
| nikad bez prethodne polazne | `previousFlowC == null` ⇒ blok | nema se oko čega varirati |
| zapis | `shadowExploration`, `shadowExplorationDirection` | da se istraživanje ne pomiješa sa konvergencijom |

Red provjera je dio odluke: **sigurnost** (noć) → **svrha** (juče) → **dokaz** (rezerva).
Hladna noć poništava rezervu sa dana; obrnuto ne vrijedi.

## 2. Smjer je samo prema dolje — i zašto

`17` §8.5 kaže „nikad dva dana uzastopno u istu stranu", što podrazumijeva oba smjera.
Implementiran je **samo `LOWER`**:

- varijacija prema dolje daje isti podatak o nagibu kao i varijacija prema gore;
- naplaćuje se iz rezerve koja je **već dokazana** (kuća je bila pretopla 3 od 5 dana);
- varijacija prema gore trošila bi komfor da bi kupila isti podatak.

Pravilo „nikad dva dana zaredom" ostaje u kodu i za budući smjer: `explorationFor` vraća
smjer, a `exploredYesterday` blokira ponavljanje bez obzira na smjer.

## 3. Gdje se primjenjuje — i zašto baš tu

```
… pravila 1–6 (konvergencija) …
   if (intended < base) intended = base      ← „nikad ispod ravnotežne"
   → ISTRAŽIVANJE, samo ako je intended === previous
   → tvrde granice (noć, kratki ciklusi, ±2 K/dan, plafoni)
```

Tri stvari su namjerne:

1. **Samo kad bi odluka stala.** Ako redovno pravilo već mijenja polaznu, istraživanje ne
   dodaje ništa — varijacija već postoji.
2. **Ispod ravnotežne polazne.** To je poenta: rezerva je dokaz da je `base` za ovu kuću
   precijenjen. Da istraživanje ostaje iznad `base`, ne bi nikad ništa naučilo.
3. **Prije tvrdih granica.** Noćni minimum i granica iz kratkih ciklusa su **mjerenja**, ne
   procjene — vrijede i za istraživanje. Isto važi za `±2 K/dan` i plafone.

Posljedica koju treba znati: istraživanje **može** prekršiti „nikad ispod `base`". To nije
greška nego definicija — ali je zato rezerva uslov, a granice ostaju.

## 4. Zapis: `shadowExploration`, ne `exploration`

`17` §8.5 traži kolonu `exploration`. Napravljene su `shadowExploration` i
`shadowExplorationDirection`, jer odluka **još ne dira bojler**: kolona `exploration` koja
opisuje nešto što se nije dogodilo bila bi lažan zapis. Kad odluka zamijeni predlog, ime se
mijenja u `exploration` u istoj migraciji koja to i omogući.

## 5. Šta je provjereno

`npx jest src/modules/DailyRecord` → **197 testova, 197 prošlo**, od toga 15 novih:

- `exploration.spec.ts` (11): svaki blok ima svoj test; granica tačno 1 K nije rezerva;
  prozor od 5 dana; dani bez mjerenja se preskaču; hladna noć pobjeđuje sve ostalo;
- `proposal-controller.spec.ts` (4): istraživanje pomjera **samo** `HOLD` odluku, 1 K niže,
  sa razlogom `EXPLORE_LOWER`; tvrde granice ga i dalje drže; bez zahtjeva nema promjene;
- `proposal-shadow.service.spec.ts` (4): rezerva + `HOLD` ⇒ 44 °C i zapis `exploration`;
  jučerašnje istraživanje ⇒ `DWELL`; hladna noć i bez rezerve ⇒ bez istraživanja;
- `shadow-report.spec.ts` (1): izvještaj broji dane istraživanja (`explored`).

## 6. Šta ostaje

| Šta | Zašto |
|---|---|
| istraživanje prema gore | treba razlog koji nadjačava cijenu komfora; zasad ga nema |
| mjerenje koristi istraživanja | koliko je `s` poboljšan zbog varijacija — traži duži shadow period |
| istraživanje u noćnom predlogu | noć je isključena pravilom; dnevni predlog je jedini nosilac |
| prelazak `shadowExploration` → `exploration` | u migraciji koja pušta odluku na bojler |
