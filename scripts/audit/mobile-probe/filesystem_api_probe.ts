/**
 * Audit probe (Faza 3, MO-001).
 *
 * Cilj: dokazati, pomocu stvarno instaliranih tipova paketa `expo-file-system`
 * (verzija iz `mobile/package-lock.json`), koje API-je `AnalyticsScreen.tsx` koristi
 * preko top-level importa, a koji od njih postoje u novom (SDK 54) API-ju.
 *
 * Pokretanje (read-only, bez izvrsavanja aplikacije):
 *   cd mobile && npx tsc --noEmit -p ../scripts/audit/mobile-probe/tsconfig.json
 *
 * Ocekivan rezultat: greske samo na REDOVIMA OZNACENIM "BREAKS".
 * Svaki drugi rezultat znaci da se API promijenio i nalaz treba ponovo provjeriti.
 */
import * as FileSystem from 'expo-file-system';
import * as FileSystemLegacy from 'expo-file-system/legacy';

// `as any` namjerno: reproduciramo runtime pristup iz AnalyticsScreen.tsx:129
// (`const fileSystem = FileSystem as any;`) da bismo dokazali da su polja undefined.
const fs = FileSystem as any;

export const report = {
  // --- vrijednosti koje AnalyticsScreen.tsx cita kao direktorije (167-171) ---
  documentDirectory: fs.documentDirectory, // BREAKS: undefined u SDK 54 top-level API-ju
  cacheDirectory: fs.cacheDirectory, //       BREAKS: undefined
  temporaryDirectory: fs.temporaryDirectory, // BREAKS: undefined

  // --- funkcije koje AnalyticsScreen.tsx poziva (135, 137, 185) ---
  getInfoAsync: fs.getInfoAsync, //         postoji, ali je stub koji baca gresku u runtimeu
  makeDirectoryAsync: fs.makeDirectoryAsync, // postoji, ali je stub koji baca gresku u runtimeu
  writeAsStringAsync: fs.writeAsStringAsync, // postoji, ali je stub koji baca gresku u runtimeu
  deleteAsync: fs.deleteAsync, //           postoji, ali je stub koji baca gresku u runtimeu

  // --- ispravan SDK 54 API (dokaz da paket nije prazan, samo drugaciji) ---
  hasPathsClass: typeof FileSystem.Paths === 'function',
  hasFileClass: typeof FileSystem.File === 'function',
  hasDirectoryClass: typeof FileSystem.Directory === 'function',

  // --- legacy podputanja koju vec koristi GasReadingsScreen.tsx:6 (ispravno) ---
  legacyWriteAsStringAsync: typeof FileSystemLegacy.writeAsStringAsync === 'function',
  legacyGetInfoAsync: typeof FileSystemLegacy.getInfoAsync === 'function',
  legacyDocumentDirectory: typeof FileSystemLegacy.documentDirectory === 'string',
  legacyDownloadAsync: typeof FileSystemLegacy.downloadAsync === 'function',
};

// Namjerni tipki dokaz: sljedece cetiri linije MORAJU prijaviti gresku.
// @ts-expect-error SDK 54 top-level API ne izvozi documentDirectory
export const proofDocumentDirectory: string = FileSystem.documentDirectory;
// `makeDirectoryAsync` POSTOJI u tipovima, ali je stub koji baca gresku u runtimeu
// (node_modules/expo-file-system/build/legacyWarnings.d.ts:37) - zato ovdje nema @ts-expect-error.
export const proofMakeDirectory: unknown = FileSystem.makeDirectoryAsync;
// @ts-expect-error SDK 54 top-level API ne izvozi cacheDirectory
export const proofCacheDirectory: string = FileSystem.cacheDirectory;
// @ts-expect-error SDK 54 top-level API ne izvozi temporaryDirectory
export const proofTemporaryDirectory: string = FileSystem.temporaryDirectory;
