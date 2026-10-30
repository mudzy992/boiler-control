/**
 * FE2-14 (FE-010): granice temperature polaznog voda.
 *
 * IZVOR ISTINE JE BACKEND: `backend/src/modules/Boiler/dto/set-current-temp.dto.ts`
 * nosi `@Min(48)` i `@Max(55)` na polju `currentFlowTemp`. Ove konstante su
 * namjerno identične tome — služe da web prikaže istu granicu koju backend
 * stvarno provjerava, umjesto da svaka stranica ima svoju kopiju.
 *
 * Prije ove datoteke vrijednosti su bile duplirane u `BoilerPage.tsx:16-17` i
 * `DashboardPage.tsx:183-184` (a treća kopija postoji u
 * `mobile/src/screens/dashboard/DashboardScreen.tsx:32-33`), pa je promjena
 * granice značila tri usklađivanja i rizik da web tiho odbija ono što backend
 * prihvata.
 *
 * VAŽNO — česta zabuna: broj 46 koji se pojavljuje u
 * `backend/src/modules/Heating/strategies/base.strategy.ts:25`
 * (`Math.max(46, Math.min(55, finalTemp))`) NIJE ova granica. To je clamp
 * *izlaza preporuke*, dok je 48-55 ograničenje *korisničkog unosa*. Nalaz FE-010
 * je te dvije veličine poistovjetio i zaključio da je dio raspona nedostižan iz
 * weba; provjerom DTO-a utvrđeno je da se web i backend tačno poklapaju.
 */
export const MIN_CURRENT_FLOW_TEMP = 48;
export const MAX_CURRENT_FLOW_TEMP = 55;

/**
 * Poruka validacije, na jednom mjestu umjesto tri interpolirane kopije.
 */
export function flowTempRangeMessage(): string {
  return `Temperature must be between ${MIN_CURRENT_FLOW_TEMP}°C and ${MAX_CURRENT_FLOW_TEMP}°C`;
}

/**
 * Jedinstvena provjera granice. Vraća `true` kada je vrijednost prihvatljiva.
 *
 * Namjerno je izdvojena kao funkcija: backend `class-validator` odbacuje
 * vrijednosti izvan [48, 55], pa klijent mora koristiti ISTU usporedbu da ne bi
 * propustio zahtjev koji server odbija (ili obrnuto).
 */
export function isWithinFlowTempRange(value: number): boolean {
  return value >= MIN_CURRENT_FLOW_TEMP && value <= MAX_CURRENT_FLOW_TEMP;
}
