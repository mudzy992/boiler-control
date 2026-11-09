# 22 — P2/P3: model kuće (`HomeModel`), nagib `s` sa intervalom

**Status:** realizacija. Koraci 3–4 iz `17` §13.
**Datum:** 2026-11-10. **Grana:** `arena/da41e5ba-boiler-control`.
**Ulazi:** `17` §6 (metoda), §5.3 (polja), §11 (prihvatni kriteriji), `21` (serija).

---

## 0. Odstupanje od redoslijeda u `17` §13 — i zašto

`17` §13 redi: korak 3 „identifikacija **b** iz perioda mirovanja", korak 4 „**a** i `s`".
Istraživanje u `17` §6.2 je izmjerilo da su prozori mirovanja ≥ 45 min **odsutni**
u dvije od tri kuće (light: 0, medium: 0), dakle `b` iz derivacija tamo ne postoji.
Dnevni bilans, s druge strane, daje `s` u sve tri.

Zato je redoslijed izvršen **suprotno od plana**: prvo `s` iz dnevnog bilansa (radi
svuda), a `a` i `b` apsolutno ostaju za sekundarnu metodu koja radi samo kad
prozori postoje. Ovo nije skraćenje — to je ono što mjerenje dopušta.

Posljedica koju treba znati: **apsolutni `a` i `b` danas ne postoje.** Kolone su
u šemi, ali se ne pune; ono što kontroler koristi (`17` §8) je `s` i **ishod**
dana, ne apsolutna vremenska konstanta.

## 1. Šta je napravljeno

| Fajl | Šta je |
|---|---|
| `prisma/schema.prisma` | `HomeModel` (jedan red po kući), enum `HomeModelState` |
| `prisma/migrations/20261110100000_home_model/migration.sql` | aditivna migracija (tabela + tip) |
| `src/modules/HomeModel/daily-balance.ts` | čista matematika: dan → red, filteri, fit, robusnost, interval |
| `src/modules/HomeModel/home-model.service.ts` | agregacija serije po lokalnom danu, izbor primarnog uređaja, upis, noćni cron |
| `src/modules/HomeModel/home-model.module.ts` | modul; izvozi servis |
| testovi | `daily-balance.spec.ts` (18), `home-model.service.spec.ts` (17) |

## 2. Jednačina koja se rješava

Za dan u ravnoteži (`17` §6.1), podijeljeno sa `k1·1440`:

```
y = s·x − c          s = k2/k1        c = q_int/k1
y = (1/N)·Σ grijanje(t)·(F(t) − R(t))                x = R̄ − Ō
```

`y` se ne računa iz dnevne prosječne polazne, nego iz **svakog uzorka pod
grijanjem**:

```
y = (Σ_pairs (F−R) / pairs) · (heatingSamples / samples)
```

To je isto kao klasična formula kad je polazna stalna, a ispravno je i kad se
promijeni usred dana (`18` §0.3). Test to zakucava: pola dana 50 °C, pola 40 °C
daje `y = 0,5·24`, ne `0,5·29` ni `0,5·19`.

## 3. Koji dan ulazi u fit

| Filter | Vrijednost | Zašto |
|---|---|---|
| pokrivenost dana | ≥ 80 % od 288 uzoraka | `y` je prosjek po uzorku; dan sa 30 uzoraka nosi nepoznatu težinu |
| vanjska prisutna | ≥ 1 uzorak | bez `Ō` nema `x` |
| grijanje prisutno | > 0 uzoraka | bez grijanja `y = 0` i nema informacije |
| polazna poznata | ≥ 90 % uzoraka pod grijanjem | inače je `y` izveden iz pristrasnog podskupa |
| udio grijanja | 0,05–0,98 | dan bez kontrasta ne nosi nagib |
| signal | `|R̄ − Ō| ≥ 5 K` | mali signal → šum pojede nagib |
| ravnoteža | `|R̄ − cilj| ≤ 2 K` | bilans pretpostavlja stacionarno stanje |
| cilj poznat | medijana `targetTempC` dana | bez cilja se ravnoteža ne može provjeriti |

Zadnji red je jedina razlika prema doslovnom tekstu `17` §6.1, gdje piše
`|R − 21| ≤ 2`. Fiksni 21 je bio zamjena za „cilj sobe"; u aplikaciji cilj
postoji po danu (`targetTempC` u seriji), pa se koristi stvarni. Kuća koja drži
20 °C nije „izvan ravnoteže" samo zato što nije 21.

## 4. Procjena, robusnost, interval

1. **Najmanji kvadrati** `y = s·x − c` po danima.
2. **Odbacivanje outliera**: dani sa rezidualom > 3·MAD se izbacuju i fit se
   ponavlja (otvoren prozor, gosti, sunce — ne kuća).
3. **Interval**: bootstrap po danima, 300 uzoraka, 5–95 percentil, sa **fiksnim
   seedom**. Isti dani daju isti interval, uvijek (`17` §11, reproducibilnost).
4. **Granice**: `s ∈ [0,2; 1,5]`. Izvan granica procjena se **odbacuje**, ne
   steže — stegnuta vrijednost bi izgledala kao izmjeren podatak.
5. **Minimum**: 8 dana.

## 5. Stanja

| Stanje | Kada | Šta se piše |
|---|---|---|
| `TRACKING` | fit prihvaćen | svi brojevi + `lastFitAt` |
| `COLD_START` | premalo dana i nikad nije bilo fita | samo stanje, razlog, `days` |
| `DEGRADED` | fit odbijen, ili premalo dana a stari fit postoji | **nijedan broj se ne dira** |

Zadnje je pravilo iz `17` §6.4 („nedostatak podataka ≠ nula") i ono je jedino
koje čuva znanje: ljeti, kad nema grijanja, model ne smije izgubiti nagib
izmjeren zimi. Test to provjerava direktno — u `DEGRADED` update **nema** ključa
`slopeS`.

`lastAttemptAt` i `lastFitAt` su zato dva polja: prvo kaže kad je fit pokušan,
drugo koliko je stara procjena koja još važi.

## 6. Primarni uređaj

Kuća sa dva termostata u dvije sobe **nije jedan model** — prosjek dvije sobe
nije ni jedna od njih. Zato fit koristi isključivo **primarni uređaj**: onaj sa
najviše uzoraka u prozoru, kod izjednačenja manji `id` (determinizam). Izbor se
pamti u `sourceDeviceId`, da se zna odakle model dolazi.

Više zona traži model po zoni; to danas nije ni projektovano ni potrebno, jer
sistem ima jedan predlog za cijelu kuću.

## 7. Prozor

60 dana. Duži prozor miješa sezone i kvari uporedivost `u_day`; kraći daje
preširok interval. Dani se broje po **lokalnom** danu kuće, a današnji dan se
preskače jer nije završen — istom funkcijom kao dnevni zapis (`20` §3).

## 8. Rezultat na kući sa poznatim parametrima

Ista fizika kao `scripts/audit/learning_sim.cjs`: jedan kapacitet, histereza
1,0 K cijela ispod cilja, senzor zaokružen na 0,5 °C, polazna zamrznuta po danu,
30 dana, pa se pušta **stvarni kod** (agregacija u zoni → filteri → fit).

| Kuća | Istina `s` | Procjena | Interval (5–95 %) | Dani u fitu |
|---|---:|---:|---|---:|
| medium (C=6 MJ/K, k1=212, k2=200) | 0,9434 | **0,9387** | 0,9214–0,9560 | 29 od 31 |
| light (C=4 MJ/K, k1=212, k2=160) | 0,7547 | **0,7475** | 0,7342–0,7636 | 27 od 31 |

Greška je −0,005 i −0,007, dakle **unutar ±0,01**, a kriterij iz `17` §11 je
±0,1. Interval u oba slučaja sadrži pravu vrijednost.

**Šta ovo dokazuje, a šta ne:** dokazuje da lanac (serija → dnevni bilans →
filteri → robustni fit) vraća pravi nagib na kući čija je fizika poznata. Ne
dokazuje da će stvarna kuća imati tako uzak interval: model nema sunce, DHW,
promjenu ponašanja ni nelinearnost radijatora (eksponent ≈1,3). Zato se prvi
stvarni fit gleda, ne slavi.

## 9. Šta je provjereno, a šta nije

**Provjereno izvršavanjem:**

```
npx jest src/modules/HomeModel → 35 testova
cijeli suite                   → 791 prošla; 12 padaju i padali su prije
```

Pokriveno: ponderisanje promjene polazne usred dana; svih devet razloga
odbacivanja dana; pronalazak nagiba i intervala koji ga sadrži; reproducibilnost
(isti ulaz → isti interval); jedan divlji dan ne pomjera nagib i biva odbačen;
premalo dana → `insufficient`, ne nula; nagib izvan granica → `rejected`, ne
stegnut; dan u pogrešnoj zoni; današnji dan se ne broji; par = i polazna i
sobna; primarni uređaj i njegovo pamćenje; `DEGRADED` ne dira brojeve.

**Nije provjereno:**

- `prisma validate`/`generate` ne rade u sandboxu → **šema nije mašinski
  provjerena**, pregledana je ručno protiv migracije.
- Nijedan upit nije izvršen nad pravom bazom; migracija nije primijenjena.
- Cron (`0 3 * * *`) nije pokrenut; testovi zovu `fitHome` direktno.
- Test sa simuliranom kućom koristi Eulerov korak od 1 min — dovoljno za ove
  vremenske konstante, ali to je model, ne instalacija.

## 10. Sljedeći korak

Noćni minimum i tvrda granica (korak 5), pa kontroler (korak 6). Kontroleru
treba `s` sa intervalom — sada postoji — i **ishod** dana (kratki ciklusi,
podbačaj), koji se još ne mjeri u `DailyRecord`. Zato korak 5 uvodi mjerenje
ishoda prije nego što se ijedan broj počne spuštati.
