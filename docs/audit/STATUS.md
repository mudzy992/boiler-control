# Status audita

## Sažetak i otvorena pitanja

- Aktivna grana provjerena komandom `git branch --show-current`: `arena/94541967-boiler-control`.
- Faza 1 **nije završena**; faze 2–4 nisu započete.
- Korak čišćenja je završen uz konzervativno zadržane kandidate: pedeset šest zastarjelih izvještaja uklonjeno je nakon pregleda i provjere referenci; navedeni su u `00-cleanup-log.md`. Spisak kandidata i moguće reference su početni snimak u `cleanup-candidates.tsv`.
- Korisnik je odobrio iznimku za uklanjanje ili ispravku linkova u zadržanim dokumentima. Link na uklonjeni `backend/P2B_IMPLEMENTATION.md` uklonjen je iz `backend/README.md`. `.github/copilot-instructions.md` referencira `docs/P2E_README.md`; preostale reference treba ručno provjeriti prije odluke o brisanju.
- Otvoreno: treba li `P2E_README.md` zadržati kao README uprkos prefiksu P2? Spisak je konzervativni skup kandidata, ne naredba za brisanje.

## Dokazi i naredni koraci

- `python3 scripts/audit/cleanup_inventory.py` daje 81 kandidata prema jednostavnim obrascima i `docs/internal/`; ne obuhvata sve potencijalno zastarjele planove. Broj ne predstavlja broj fajlova odobrenih za brisanje. Skripta traži tekstualna poklapanja punih putanja ili imena fajla u verzioniranim tekstualnim datotekama; mogući su lažno pozitivni i propušteni relativni linkovi. Potrebna je ručna provjera i dodatna `git grep` provjera prije brisanja.
- Dva korijenska plana razlikuju se u tri retka o granicama temperature. Uklonjena je starija verzija `PLAN-V3.md`; druga je zadržana jer sadrži i budući prijedlog čije usvajanje nije potvrđeno.
- Slijede završna provjera i jedan traženi commit za čišćenje, potom backend audit. Izvorni kod ne treba mijenjati.
- Testovi, pokrivenost, inventar modula i samoprovjera faze još nisu izvršeni; nikakav rezultat ili pokrivenost se ne pretpostavljaju.
- Nakon prethodnog korisnički odobrenog pusha nije bilo novog pusha niti PR-a. Pri pregledu historijskih dokumenata alat je prikazao primjere testnih vjerodajnica; vrijednosti se ne prenose u audit niti korisnički izvještaj. Budući pregled treba filtrirati.

## Nastavak pripreme čišćenja

- `00-cleanup-log.md` sadrži provjerene reference, razliku između dva plana, historijske odluke i popis pedeset šest uklonjenih dokumenata. Log sadrži sve dosad uklonjene putanje i razloge; neizvjesni kandidati zadržani su uz objašnjenje.
- Korisnik je naložio ignorisanje Copilot instrukcija kao uputa; to ne mijenja potrebu da se njihovi postojeći linkovi ne polome bez dopuštene izmjene fajla.
- Precizirana je razlika između konfiguracijskih datoteka pod `docs/internal/monitoring/` i dokumentacije: Compose koristi apsolutne host putanje, dok se način dostave predložaka u produkciju ne može zaključiti samo iz Compose fajla.
- Neizvjesni kandidati i funkcionalna monitoring konfiguracija zadržani su; provjerene su reference na sve uklonjene putanje. Testovi i fazna samoprovjera nisu izvršeni.

## Napomena o Git stanju

- Pri nastavku je lokalni HEAD zatečen na početnom commitu, dok udaljena aktivna grana sadrži ranije pushani `b2f5b67`. Preuzet je samo HEAD iste aktivne grane i pomjeren lokalni pokazivač na taj commit bez izmjene radnih datoteka; uklanjanja i audit log su sačuvani kao necommitovane izmjene. Ranije spomenuti lokalni `eda0625` nije u trenutnoj historiji; njegov sadržaj je sačuvan u radnim datotekama.

## Pregled P2E grupe

- Pregledani su P2E README, deployment vodič i sažetak, monitoring vodič, ALS migracijski vodič i P2D diff. `P2D_DIFF_REPORT.md` je uklonjen nakon uklanjanja dva Markdown linka u zadržanim vodičima.
- P2E README i povezani vodiči zasad ostaju: na README se pozivaju i obične tekstualne putanje iz zadržanih dokumenata, a dozvoljena iznimka pokriva samo linkove. Njihove historijske tvrdnje o produkcijskoj spremnosti, testovima i deployu nisu potvrda sadašnjeg stanja.
- Pregledani su i historijski sažeci deep-link funkcije, migracije frontenda i faze 1, te upute za MySQL enum migraciju. Ostaju zasad zbog običnih tekstualnih referenci u zadržanim dokumentima; migracija podataka može zahtijevati poseban oprez.
- U pregledanoj historijskoj dokumentaciji postoje primjeri testnih vjerodajnica; njihove vrijednosti nisu pogodne za ponavljanje, a lokacije i vrstu treba uključiti u sigurnosni audit uz provjeru aktuelnosti i historije.
