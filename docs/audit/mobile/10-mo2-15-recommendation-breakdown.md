# MO2-15 — mobilni „razlog preporuke“ iz backend snapshota

**Status:** RIJEŠENO U KODU 2026-11-01 (`d21a8a4`), CI-verificirano.
**CI run:** `41353900211` na `d21a8a4`.

## Cilj

Prikazati mobilnom korisniku zašto je preporuka takva kakva jest, isključivo iz
backend breakdown snapshota koji je dodat u FE2-10. Mobilni klijent ne
rekonstruiše formulu, ne računa baznu krivulju i ne mijenja preporučenu
temperaturu.

## Promjene

- `mobile/src/types/Dashboard.ts` dodaje `RecommendationBreakdown` i opciono
  `breakdown` polje na `Recommendation`.
- Nova komponenta `mobile/src/components/RecommendationBreakdown.tsx` renderuje
  baznu krivulju, ponderisanu vanjsku temperaturu, korekcije, konačnu
  preporuku, pouzdanost, uzorke i očekivano vrijeme zagrijavanja.
- Komponenta ima savjetodavni disclaimer i renderuje se samo kada backend
  pošalje breakdown; bez breakdowna vraća `null`.
- `DashboardScreen` prikazuje karticu iz `system.recommendation.breakdown`.
- Granice za unos trenutne temperature prebačene su u
  `mobile/src/constants/boilerLimits.ts` i usklađene s backendom (48–55 °C).
- Dodani su `recommendation.*` prijevodi na engleski i bosanski.

## Migracija, rollback i flag

- Nema DB migracije.
- Nema backend/API promjene; koristi se postojeći dashboard odgovor.
- Nema novog env flaga, isto kao kod FE2-10.
- Rollback je revert commita `d21a8a4`.

## Testovi

Lokalno:

- `npm run type-check` — čisto;
- `npm run lint` — **0 grešaka / 78 pre-existing warninga**;
- `npm test -- --ci` — **8 suite / 60 testova**.

Novi testovi:

- `RecommendationBreakdown.test.tsx` — puni backend breakdown, null optional
  polja, izostanak breakdowna i promjena backend odgovora;
- `boilerLimits.test.ts` — granice 47.9/48/55/55.1 i NaN.

## CI dokaz

Run `41353900211` na `d21a8a4`:

- mobile **success** (type-check, lint, unit tests);
- backend `test` **success**;
- frontend failure samo na pre-existing `Deploy config consistent (FE2-7)`.

## Kompatibilnost i otvoreno

- Instalirani mobile klijenti nisu pogođeni dok se ne ažuriraju; novo polje je
  opciono i ne uvodi novi API poziv.
- `apiClient.getRecommendations()` i dalje postoji kao zasebna metoda; dashboard
  već nosi breakdown, tako da za ovu karticu nije potreban dodatni poziv.
- FORM-1 stručna validacija formule ostaje otvorena; MO2-15 ne mijenja formulu.
- Granice unosa nisu iz backend odgovora jer ih API trenutno ne izlaže; zato su
  centralizirane kao konstante usklađene s `SetCurrentTempDto`.
