# Pravila implementacije i sigurnost promjena

Faza 4. Datum: 2026-11-06. Obavezno za Fazu 5 (I0–I7).

## 1. Design sistem

1. Vizuelne vrijednosti samo preko tokena (`index.css` / Tailwind theme). Hex i `w-[Npx]` / `text-[#…]` zabranjeni u feature komponentama bez bilješke u commit bodyju.
2. Jedini UI primitiv: `frontend/src/shared/components/ui` (shadcn). Ne dodavati paralelni Button/Card.
3. Lokalni `frontend/src/components/{Button,Card,Input,InputNumber,StatCard}` se ne proširuju; brišu se u I7 kad nema importa.
4. Light i dark: klasa `html.dark`; ključ `boiler.theme`; FOUC skripta ostaje.
5. `prefersDarkMode` sa API-ja ne prepisuje temu u v1.

## 2. Stanja i UX

1. Svaki data block: loading (skeleton), error (+ retry), empty (+ akcija gdje ima).
2. Nema full-page spinnera kao jedinog loading obrasca.
3. Mobilni <1024px: navigacija Sheet/drawer, ne modal za nav.
4. Dijalozi: Escape, focus trap, restore focus. Uzor: `GasForm`.
5. Jedan `main#main-content`; SkipLink mora pogoditi taj id.

## 3. Podaci i ugovori

1. Ne mijenjati Prisma, DTO, rute API-ja bez eksplicitnog odobrenja.
2. React Query ključevi iz `lib/queryKeys.ts` ostaju dijeljeni (notifications, gas, homeProfile, dashboard, boiler).
3. Heating page ≠ dashboard heating-events ugovor (polja i limiti).
4. Temp unos 48–55; preporuka clamp 46 nije unos.
5. Health samo sa `GET /api/dashboard/health`.
6. Potrošnja plina: novije − starije; download preko `downloadProtectedFile`.
7. Breakdown se ne računa na klijentu; generate se ne vraća.
8. Home profile granice = forma `validate`, ne širi Zod.
9. PUT `/api/user`: samo polja `UpdateUserDto`; email van tijela.
10. Redis nije dashboard keš.

## 4. i18n i a11y

1. Novi korisnički string: BS + EN u `locales/config.ts` (ili postojeći i18n fajlovi).
2. WCAG 2.2 AA: label `htmlFor`, vidljiv fokus, tipkovnica, ARIA samo kad treba.
3. Graf: tekstualna alternativa (caption / sr-only sažetak).

## 5. Kod higijena

1. Fajlovi ~100–150 linija; soft cap 200 (config/schema do 400).
2. Bez `any` i nepotrebnih castova; bez TODO/placeholder/commented-out.
3. Nove zavisnosti samo uz obrazloženje u commit body (planira: Radix paketi, lucide-react).
4. Named exports; kebab-case fajlovi.

## 6. Change-safety

### Prije osjetljive izmjene

Karakterizacijski testovi (ako već ne postoje) za:

- Gas potrošnja i GasForm validacija (postoje)
- RecommendationBreakdown brojevi (postoje; jezik en-US u testu)
- Temp 48–55 submit guard
- Profile PUT payload whitelist (bez `id` / gas meta)
- Home profile: create omogućen kad nema profila

### Tok po podfazi

1. Implementiraj samo jednu I-podfazu.
2. Lokalno: `npm run type-check`, `lint`, `test`, `build` (uz `VITE_API_URL`).
3. Commit (mali, conventional).
4. Push `main` (ili dogovorena grana) → `gh run watch` Frontend CI.
5. Ažuriraj `STATE.md`.
6. Stani i javi prije sljedeće podfaze.

### Stop / rollback

Zaustavi i revert podfazu ako:

- Frontend CI crven poslije pusha
- Poslovni broj (potrošnja, breakdown %, temp) se promijeni bez odobrenja
- Otkriješ da plan ne odgovara stvarnosti — dokumentuj, predloži izmjenu `08`, čekaj odobrenje

Ne koristiti `--no-verify`. Ne force-push na `main`.

### Feature flag

Nije dio opcije A. Ne uvoditi `v2` layout flag bez nove odluke.
