/// <reference types="nativewind/types" />

/**
 * CSS fajlovi postoje samo za NativeWind na webu (`App.tsx` uvozi
 * `./global.css`), a TypeScript za njih nema tip bez Expo-ovog generisanog
 * `expo-env.d.ts`.
 *
 * Taj fajl nastaje prvim `expo start` i **ne ide u repo** (`.expo/` je u
 * `.gitignore`), pa je lokalno `tsc` prolazio a na svježem CI checkoutu padao
 * na `Cannot find module or type declarations for side-effect import of
 * './global.css'`. Deklaracija je zato ovdje: fajl je commitovan i ne zavisi
 * od toga je li Expo pokrenut.
 */
declare module '*.css';

// NOTE: Ovaj fajl je nekad bio generisan (NativeWind); sada je ručno održavan.
