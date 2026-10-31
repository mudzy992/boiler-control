/**
 * MO2-8 (MO-012): jest setup koji se izvršava PRIJE učitavanja test modula.
 *
 * Zašto `setupFiles`, a ne `setupFilesAfterEnv` ili `beforeAll` u testu:
 * `src/config/api.config.ts` izračunava `API_CONFIG.BASE_URL` na **top level**
 * (linija 52), dakle pri samom `import`. Ako varijabla tada nije postavljena,
 * modul baca `API_URL not configured` i cijeli test suite padne prije nego što
 * ijedna asertcija počne. `setupFiles` je jedina faza koja sigurno prethodi
 * učitavanju modula.
 *
 * Vrijednost je namjerno očigledno lažna (`test.invalid`): MO2-1 je uklonio
 * hardkodovani fallback host upravo zato što je dev saobraćaj završavao na
 * stvarnom serveru. Test ne smije dobiti host koji izgleda produkcijski.
 */

process.env.EXPO_PUBLIC_API_URL = 'https://test.invalid/api';
