# Status audita

## Sažetak i otvorena pitanja

- Aktivna grana provjerena komandom `git branch --show-current`: `arena/94541967-boiler-control`.
- Faza 1 **nije završena**; faze 2–4 nisu započete.
- Čišćenje je u pripremi: nijedan fajl još nije obrisan. Spisak kandidata i moguće reference su u `cleanup-candidates.tsv`.
- Otvoreno: kako postupiti s referencama iz zadržanih fajlova koje pravilo dozvoljenih izmjena ne dopušta uređivati? Na primjer, `backend/README.md` referencira `backend/P2B_IMPLEMENTATION.md`, a `.github/copilot-instructions.md` referencira `docs/P2E_README.md`. Reference treba ručno provjeriti u kontekstu prije odluke o brisanju.
- Otvoreno: treba li `P2E_README.md` zadržati kao README uprkos prefiksu P2? Spisak je konzervativni skup kandidata, ne naredba za brisanje.

## Dokazi i naredni koraci

- `python3 scripts/audit/cleanup_inventory.py` daje 81 kandidata prema jednostavnim obrascima i `docs/internal/`; ne obuhvata sve potencijalno zastarjele planove. Broj ne predstavlja broj fajlova odobrenih za brisanje. Skripta traži tekstualna poklapanja punih putanja ili imena fajla u verzioniranim tekstualnim datotekama; mogući su lažno pozitivni i propušteni relativni linkovi. Potrebna je ručna provjera i dodatna `git grep` provjera prije brisanja.
- Dva korijenska plana imaju različite SHA-256 sažetke (`sha256sum PLAN-V3.md PLAN-current-boiler-temp-source-of-truth.md`); jednaka veličina nije dokaz da su identični. Treba uporediti sadržaj i provjeriti reference prije odluke.
- Slijedi čitanje kandidata i provjera izvornog koda, očuvanje relevantnih historijskih odluka u `00-cleanup-log.md`, provjera referenci, pa tek onda eventualno `git rm` i jedan traženi commit za čišćenje. Postojeće dokumente i izvorni kod ne treba mijenjati mimo dopuštenog opsega.
- Testovi, pokrivenost, inventar modula i samoprovjera faze još nisu izvršeni; nikakav rezultat ili pokrivenost se ne pretpostavljaju.
- Nije rađen push niti PR. Nisu ispisivane vrijednosti tajni.
