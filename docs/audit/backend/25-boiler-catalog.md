# 25 — Katalog bojlera: model umjesto slobodnog teksta

**Status:** realizacija. Odluka vlasnika 2026-11-08, odluka #1.
**Datum:** 2026-11-14. **Grana:** `arena/da41e5ba-boiler-control`.
**Ulazi:** `19` §1–§3 (katalog, sigurnosna pravila), `18` §2.1 (PTV blokada), `24` (kontroler).

---

## 0. Šta je problem, u jednoj rečenici

Na kombi bojleru **dva** podešavanja nose skoro isto ime: polazna grijanja i temperatura
PTV-a. Ako aplikacija savjetuje „spusti na 45" a na uređaju to bude PTV, korisnik ostaje
bez tople vode. Zato model bojlera nije podatak za ljepši prikaz — on je **uslov da se
bilo šta savjetuje**.

Do sada je `HomeProfile.boilerModel` bio slobodan tekst. Iz teksta se ne može odgovoriti
na jedino pitanje koje je važno: *jesu li krugovi grijanja i PTV-a odvojeni?*

## 1. Šta je napravljeno

| Fajl | Šta je |
|---|---|
| `backend/src/modules/BoilerCatalog/catalog.json` | katalog (13 zapisa: Vaillant, Bosch), premješten iz `docs/`; 2026-11-18 dodan `vaillant-ecotec-pro-vuw` (VUW 246/5-3) |
| `backend/src/modules/BoilerCatalog/boiler-catalog.ts` | tipovi, provjera integriteta, `isFlowAdviceAllowed`, `effectiveCeilingC` |
| `backend/src/modules/BoilerCatalog/tests/boiler-catalog.spec.ts` | 13 testova |
| `prisma/migrations/20261114100000_boiler_catalog_id/migration.sql` | `HomeProfile.boilerCatalogId` |
| `GET /api/home-profiles/boiler-catalog` | katalog za odabir u klijentu (`flowAdviceAllowed` po zapisu) |
| DTO + servis | `boilerCatalogId` se validira protiv kataloga; `boilerModel` označen zastarjelim |
| `proposal-controller.ts` | pravilo `MODEL_UNVERIFIED`: bez potvrđenog modela **nema spuštanja** |

## 2. Zašto katalog u kodu, a ne u bazi

Predlog iz `19` §7 je bio „JSON + seed u bazu, da se dopuna radi bez deploya". Odustalo
se, i to namjerno:

- katalog je **sigurnosni** podatak; ako se mijenja bez deploya, mijenja se i ponašanje
  koje niko nije pregledao u istom commitu;
- isti fajl čitaju **tri** mjesta: aplikacija, Python gate u CI-u
  (`scripts/audit/boiler_catalog_check.py`) i testovi. Tri čitaoca jednog fajla u git-u
  su jednostavniji od baze sa seed-om i sinhronizacijom;
- dopuna kataloga je izmjena **jednog JSON fajla** — to je jeftino i sa deployom.

Cijena: dopuna traži deploy. Za 9 zapisa koji čekaju priručnik to ionako nije dnevni posao.

## 3. Sigurnosno pravilo — i gdje je primijenjeno

```
isFlowAdviceAllowed(model) =
      model ∈ katalog
  AND model.specStatus === 'VERIFIED_MANUAL'
  AND model.separateHeatingDhwSettings === true
```

Sve ostalo — nepoznat model, nepotvrđen model, potvrđen model sa zajedničkim podešavanjem,
**pokvaren katalog** — daje `false`.

Gdje se to primjenjuje:

| Mjesto | Ponašanje kad je `false` |
|---|---|
| `decideProposal` | **ne spušta** polaznu; razlog `MODEL_UNVERIFIED`; podizanje zbog hladnoće ostaje dozvoljeno |
| `ProposalShadowService` | prosljeđuje `flowAdviceAllowed` iz `HomeProfile.boilerCatalogId` |
| `GET /api/home-profiles/boiler-catalog` | svaki zapis nosi `flowAdviceAllowed`, da klijent može objasniti zašto |

Podizanje ostaje dozvoljeno i kad model nije potvrđen: ono ne može ugroziti PTV, a
hladna kuća je stvarna šteta. Pravilo je „ne spuštaj bez dokaza", ne „ne diraj ništa".

Parametar je u `ControllerInput` **obavezan**, a ne opcioni sa defaultom `true`. Zadana
vrijednost „dozvoljeno" je upravo ona koju ne treba imati: novi pozivalac mora svjesno
odlučiti, a ne naslijediti dozvolu.

## 4. Gornja granica ide iz tri mjesta

```
efektivni_max = min(55, home.maxHeatingFlowC ?? 55, model.heatingFlowMaxC ?? 55)
```

- `55` — raspon proizvoda (odluka vlasnika), neprelaziv;
- `home.maxHeatingFlowC` — šta sistem dozvoljava (podno grijanje, estrih);
- `model.heatingFlowMaxC` — šta proizvođač dozvoljava (ecoTEC plus 80, Condens 7000 WP 85).

Praktično model skoro nikad ne veže (80 > 55), ali pravilo mora postojati: kad bi se
jednom pojavio model sa granicom 45, aplikacija ga ne smije pregaziti.

## 5. Šta se dešava sa starim podacima i starim klijentima

`boilerModel` (slobodan tekst) **nije obrisan**: stari profili ga imaju, i brisanje bi
uništilo podatak koji korisnik možda želi vidjeti. Ali:

- nijedna odluka se na njega ne oslanja (ni sigurnosna, ni granica);
- u DTO-u je označen `@deprecated` i prima se samo da stari klijenti ne puknu
  (`forbidNonWhitelisted: true` bi inače vratio 400);
- novi klijent šalje `boilerCatalogId`.

U UI-u je slobodan tekst **zamijenjen izborom iz kataloga** (`Select` grupisan po
marki). Opcija nosi raspon samo kad je potvrđen; za `TO_VERIFY` piše „raspon nije
potvrđen" — broj napisan tamo izgledao bi kao podatak proizvođača. Ispod izbora stoji
**posljedica**, u tri stanja:

| Stanje | Šta piše |
|---|---|
| nije odabran | „Bez odabranog modela aplikacija ne savjetuje snižavanje polazne — samo je podiže ako je hladno." |
| odabran, nepotvrđen | „…nije potvrđeno da su grijanje i topla voda odvojena podešavanja, pa aplikacija ne savjetuje snižavanje." |
| odabran, potvrđen | „Model potvrđen … snižavanje polazne je bezbjedno." |

Dvije posljedice koje su namjerno ostavljene vidljivima:

- **prazan izbor se šalje kao `null`**, ne kao `''` — `''` bi backend odbio kao nepoznat
  zapis, a `null` znači „obriši odabir";
- ako je u profilu zapis kojeg **više nema u katalogu**, ne briše se sam: prikazuje se
  kao opcija sa sirovim id-em, da korisnik vidi šta je sačuvano i svjesno odabere novo.

Katalog se dohvata paralelno sa profilom; ako padne, forma radi bez izbora modela — što je
sigurno stanje (nema savjeta o snižavanju), a ne bijela stranica.

## 5.1 Porodica + snaga: odabir mora biti stvarna kombinacija (2026-11-18)

`boilerCatalogId` imenuje **porodicu**, a porodica pokriva više snaga: `ecoTEC pro VUW`
postoji kao 24, 28 i 30 kW, `ecoTEC plus VUW` kao 20,4 / 25,5 / 30,6 kW. Dok je postojao
samo `boilerCatalogId`, zapis je govorio „ecoTEC pro", a ne koji uređaj stoji u kući.

Zato je dodat `HomeProfile.boilerOutputKw` (`Float?`, migracija
`20261118100000_boiler_output_kw`) i pravilo da se odabir provjerava **kao cjelina**:

| Situacija | Ishod |
|---|---|
| snaga je u `outputsKw` odabrane porodice | prihvata se |
| snaga nije u spisku | `400`, uz spisak dozvoljenih (npr. „24, 28, 30") |
| porodica navodi snage, a snaga nije poslata | `400` — „nije odabrano" ne smije izgledati kao „nije poznato" |
| porodica ne navodi snage (nepotvrđen model) | snaga mora ostati prazna |
| snaga bez porodice | `400` — broj bez uređaja nije podatak |
| promjena porodice bez nove snage | `400`; stara snaga se **ne** prenosi na novi model |

Pravilo je u `HomeProfileService.validateBoilerSelection`, ne u DTO-u: međupoljno je i
traži katalog, a DTO bi time dobio drugi izvor istog podatka. Kod `PATCH`-a se provjerava
**stanje poslije zahtjeva**, pa se kroz dva poziva ne može doći u kombinaciju koju nijedan
pojedinačni zahtjev ne dozvoljava.

Posljedica za klijente: forma mora poslati snagu kad porodica ima `outputsKw`. To je i
razlog zašto je u web formi odabir trostepen (marka → porodica/varijanta → snaga), a ne
jedan padajući spisak: jedan spisak bi nudio 13 porodica i ćutao o tome koja snaga.

## 5.2 Model koji je korisnik tražio, a nije ga bilo u katalogu

Korisnik ima **Vaillant ecoTEC pro VUW 246/5-3**, a katalog ga nije nudio. Zapis
`vaillant-ecotec-pro` (VUW) je do 2026-11-18 bio `TO_VERIFY` — dakle bez brojeva i bez
savjeta o snižavanju. Sada je potvrđen iz priručnika (`0020244995_05`, ecoTEC pro VUW
..6/5-3) i vodi se kao `vaillant-ecotec-pro-vuw`:

| Polje | Vrijednost | Izvor u priručniku |
|---|---|---|
| polazna, raspon podešavanja | 30…80 °C | „Max. flow temperature adjustment range (default setting: 75 °C)" |
| polazna, tvornički | 75 °C | isto |
| parametar ograničenja | D.071, 40…80 °C | „Max. heating target flow temp." |
| PTV | 35…65 °C | „Hot water output temperature range" (D.006) |
| krugovi odvojeni | `true` | D.071 dira **samo** grijanje; PTV se podešava zasebno |
| snage | 24 / 28 / 30 kW | VUW 246/5-3, 286/5-3, 306/5-3 |
| min. modulacija | 5 kW | „Heating adjustment range 5 … 19 kW" |

Dvije stvari koje se ne smiju izgubiti iz zapisa: oznaka 24/28/30 je **razred PTV-a**, a
grijanje je ograničeno na 5…19 kW; i `heatingFlowMaxC = 80` ne znači da aplikacija smije
predložiti 80 — gornja granica ostaje 55, katalog samo provjerava da model ne veže niže.

Duplikat `vaillant-ecotec-pro` (TO_VERIFY) je uklonjen, jer bi u UI-u stajala **dva**
„ecoTEC pro" zapisa, jedan sa rasponom i jedan bez — a korisnik ne može znati koji je
tačan.

## 6. Provjere

Backend — `npx jest src/modules/BoilerCatalog src/modules/HomeProfile src/modules/DailyRecord`
→ **226 testova, 226 prošlo**:

- katalog: integritet, jedinstveni id-evi, potvrđeni imaju izvor i brojeve, nepotvrđeni
  **nemaju** brojeve, pokvaren katalog se prepoznaje;
- pravilo: potvrđen + odvojeni krugovi ⇒ dozvoljeno; nepotvrđen, nepoznat, prazan,
  zajednički krugovi ⇒ **nije** dozvoljeno;
- granica: profil i model sužavaju, nijedan ulaz ne prelazi 55;
- kontroler: `MODEL_UNVERIFIED` blokira spuštanje, ali ne i podizanje;
- endpoint: katalog izlaže `flowAdviceAllowed`, ne izlaže interne parametre.

Frontend — `npx vitest run` → **146 testova, 146 prošlo** (od toga 12 novih za
`familyLabel`/`catalogGroups`/`selectionHint`/`isKnownFamilyId`: nepotvrđen zapis nema
izmišljen raspon, nosi natuknicu, prazan katalog ne ruši formu). `tsc --noEmit` i `eslint`
čisti.

`python3 scripts/audit/boiler_catalog_check.py` → `Katalog ispravan.`
(13 zapisa: 5 potvrđenih, 8 za potvrdu.)

Nakon dopune 2026-11-18: `npx jest src/modules/HomeProfile src/modules/BoilerCatalog`
→ **99 testova, 99 prošlo**, od toga 10 novih u
`src/modules/HomeProfile/tests/home-profile-boiler-selection.spec.ts` (porodica × snaga).

## 7. Šta ostaje

| Šta | Zašto |
|---|---|
| uklanjanje `boilerModel` iz DTO-a | tek kad klijent prestane da ga šalje (sada ga ne šalje, ali stari tabovi još mogu) |
| prijevod natuknica na engleski | natuknice su za sada samo na bosanskom — to su rečenice, ne labele, pa traže pravi prijevod, ne mašinski |
| dopuna 9 zapisa iz priručnika | `19` §7.1; do tada vrijedi „nepotvrđeno → ne savjetuj" |
| granica po emiteru iz modela (`underfloorMaxFlowC`) | polje u katalogu je danas `null` za sve zapise — nema izvora, pa se ne koristi |
