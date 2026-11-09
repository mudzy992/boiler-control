# 26 — Shadow period: mjerenje prije nego odluka postane predlog

**Status:** realizacija. **Datum:** 2026-11-14. **Grana:** `arena/da41e5ba-boiler-control`.
**Ulazi:** `24` §6.5 (shadow upis), `17` §13 korak 6 (lestvica „simulacija → shadow → predlog"),
`25` (model bojlera), `23` §5 (tvrde granice).

---

## 0. Zašto mjerenje, a ne „pustimo pa ćemo vidjeti"

Kontroler danas **ne mijenja** predlog: računa svoju odluku uz njega i pamti je u
`DailyRecord.shadow*`. To je jedina prečka koja dijeli „dvije nedjelje testova" od
„korisniku se mijenja polazna na bojleru".

Bez mjerenja ta prečka nema uslov za prelaz. „Prošlo je 30 dana" nije uslov nego
kalendar. Zato shadow period mora odgovoriti na tri pitanja, i to **prije** puštanja:

1. koliko se često odluka razlikuje od formule,
2. u kojem smjeru — spušta ili podiže,
3. da li je **svaka** razlika objašnjiva razlogom iz `shadowReasons`.

Treće je jedino koje može biti greška. Prva dva su nalaz, i korisna su čak i kad su
„dosadna": ako se odluka nigdje ne razlikuje od formule, zamjena predloga ne bi promijenila
ništa, pa je i to razlog da se ne žuri.

## 1. Šta je napravljeno

| Fajl | Šta je |
|---|---|
| `src/modules/DailyRecord/shadow-report.ts` | čisto poređenje i presuda (bez baze, bez datuma „sada") |
| `src/modules/DailyRecord/shadow-report.service.ts` | čita `DailyRecord` za dom, provjerava vlasništvo |
| `src/modules/DailyRecord/shadow.report.controller.ts` | `GET /api/daily-record/shadow-report` |
| `tests/shadow-report.spec.ts`, `…service.spec.ts`, `…controller.spec.ts` | 31 test |

Servis **samo čita** i namjerno je odvojen od `ProposalShadowService`, koji piše. Servis koji
pravi izvještaj nad sopstvenim upisima lakše previdi dan koji nedostaje — a dan koji
nedostaje je upravo ono što izvještaj treba da nađe.

## 2. Šta izvještaj vraća

| Polje | Značenje |
|---|---|
| `days` | redova u periodu |
| `evaluated` | za koliko dana je shadow izračunat (`shadowAt` postoji) |
| `pending` | za koliko nije — nije greška, shadow se računa uz predlog |
| `withoutFormula` | dani bez formule; nema se šta porediti |
| `differences` | dani gdje se odluka razlikuje od formule |
| `lowered` / `raised` / `same` | smjer razlike |
| `changeSharePct` | udio razlika u uporedivim danima |
| `byReason` | koliko **dana** nosi koji razlog (sortirano) |
| `unexplained` | razlike bez ijednog razloga — greška, sa datumima i brojevima |
| `maxAbsDeltaC` / `meanAbsDeltaC` | kolika je razlika, u °C |
| `blockedByModel` | dani u kojima je `MODEL_UNVERIFIED` blokirao spuštanje |
| `verdict` / `verdictNote` | presuda i rečenica uz nju |

Poređenje je po danu: formula (`proposedFlowTemp`) prema odluci (`shadowFlowC`).
Razlika do 0,05 °C je zaokruživanje, ne razlika — odluka se zaokružuje na 0,5, formula
na 0,1.

## 3. Presuda — i zašto je redoslijed važan

```
NO_DATA              nema izračunatih dana
UNEXPLAINED_DIFFERENCES   bar jedan dan ima razliku bez razloga
NOT_ENOUGH_DAYS      < 21 dan
NO_DIFFERENCES       ≥ 21 dan, ali odluka se nigdje ne razlikuje od formule
READY                ≥ 21 dan i sve razlike objašnjene
```

**Neobjašnjena razlika je prva provjera**, prije broja dana. Nedostatak objašnjenja ne
postaje manji time što se čekalo duže, a presuda „još nema dovoljno dana" bi ga sakrila
iza roka. Isto tako `NO_DATA` nije `READY`: prazan period ne smije izgledati kao zelena
svjetlost.

`SHADOW_MIN_DAYS = 21` — tri sedmice pokrivaju i radne dane i vikende i bar jedno
hlađenje noću. Manje od toga je nagađanje, više nije potrebno da bi se vidjelo neslaganje.

## 4. Kako se čita (i kako se **ne** čita)

```
GET /api/daily-record/shadow-report?homeProfileId=1&from=2026-11-01&to=2026-11-30
```

- **`changeSharePct` visok** ne znači ni dobro ni loše; znači da se kontroler ne slaže sa
  formulom i da razloge treba pročitati.
- **`lowered` ≫ `raised`** je očekivano: kontroler spušta zbog udobnosti i kratkih ciklusa,
  a podiže samo kad je hladno. Obrnuta slika bi značila da granice gone polaznu gore.
- **`byReason` sa `MODEL_UNVERIFIED`** nije greška nego stanje: model bojlera nije potvrđen
  (`25` §3). Ti dani su dokaz da pravilo radi, ne da kontroler ne radi.
- **`unexplained` mora biti prazan.** Jedan dan tamo je jedan dan u kojem bi korisnik dobio
  broj bez objašnjenja.

Ono što ovaj izvještaj **ne** mjeri: da li je korisniku toplije ili jeftinije. To traži
mjerenje ishoda (sobna temperatura, potrošnja) i tvrdnju o uštedi sa baseline-om (`19` §5).
Izvještaj mjeri **dosljednost odluke**, ne korist od nje — i to piše u `verdictNote`, da se
broj ne prečita.

## 5. Provjere

`npx jest src/modules/DailyRecord src/modules/Schedule` → **169 testova, 169 prošlo**
(11 suite-a), od toga 31 nov:

- poređenje: smjer, tolerancija zaokruživanja, razlika bez razloga, dani koji se ne mogu
  porediti;
- brojevi: udio, prosjek i maksimum, razlog se broji **jednom po danu**, sortiranje po
  datumu bez obzira na redoslijed iz baze, prazan period bez greške;
- presuda: neobjašnjena razlika ima prioritet nad kratkim periodom, `NO_DATA` nije `READY`,
  dovoljno dana bez razlika nije `READY`;
- servis: tuđi dom je **404**, ne prazan izvještaj; period se prevodi u `gte`/`lte`; samo
  `from` ne dodaje `lte`;
- kontroler: aktivni dom kad parametar nedostaje, 400 za `abc`/`0`/`-3`/`1.5`, 400 za
  pogrešan format datuma i za `from > to`.

## 6. Šta ostaje

| Šta | Zašto |
|---|---|
| prikaz izvještaja u UI-u | backend vraća sve što treba; stranica još ne postoji |
| dnevni zapis izvještaja u log | sada se čita na zahtjev; za praćenje tokom perioda treba scheduled upis |
| zaborav granice iz kratkih ciklusa | `24` §7 — granica se danas pamti zauvijek; poslije 30 dana bez ponavljanja treba da oslabi |
| zamjena predloga odlukom | pušta se tek kad izvještaj vrati `READY` za stvaran dom, ne za simulaciju |
