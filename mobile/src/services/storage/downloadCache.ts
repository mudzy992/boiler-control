import * as FileSystemLegacy from 'expo-file-system/legacy';

/**
 * MO2-16 (MO-020): jedan izvor istine za direktorij preuzetih dokumenata.
 *
 * Zašto postoji
 * -------------
 * Prije ove izmjene `GasReadingsScreen.tsx` je sam sastavljao putanju
 * (`${cacheDirectory}downloads/`) i u nju spremao fakture i slike brojila, ali
 * ih **nikad nije brisao** — `openLocalFile` na liniji 368 bio je zadnja
 * operacija, `deleteAsync` se nije pojavljivao nigdje u fajlu (provjereno
 * grep-om 2026-10-30). Dokumenti su ostajali trajno u **nešifriranom** cacheu.
 *
 * „Clear cache" u postavkama je bio `console.log`, pa korisnik nije mogao ni
 * ručno očistiti. Da bi oba mjesta čistila ISTI direktorij, putanja mora biti
 * definisana jednom — inače bi postavke brisale nešto drugo nego što ekran
 * puni, a test bi to propustio.
 */

/** Pod-direktorij unutar cache-a u koji se preuzimaju dokumenti. */
export const DOWNLOADS_SUBDIRECTORY = 'downloads/';

/**
 * Vraća apsolutni URI direktorija za preuzimanja, ili `null` ako uređaj ne
 * nudi nijedan upotrebljiv direktorij.
 */
export async function getDownloadsDirectory(): Promise<string | null> {
  const baseDirectory =
    FileSystemLegacy.cacheDirectory || FileSystemLegacy.documentDirectory;
  if (!baseDirectory) {
    return null;
  }
  return `${baseDirectory}${DOWNLOADS_SUBDIRECTORY}`;
}

/**
 * Briše sav sadržaj direktorija za preuzimanja.
 *
 * Namjerno briše CIJELI sadržaj, a ne samo fajlove starije od nekog praga:
 * svaki fajl ovdje je privremena kopija dokumenta koji je već otvoren u
 * vanjskom pregledniku, pa nijedan nema razloga preživjeti sesiju.
 *
 * Vraća broj obrisanih fajlova da bi UI mogao pokazati smislen rezultat, a ne
 * samo „uspješno".
 */
export async function purgeDownloadsDirectory(): Promise<{ deletedFiles: number }> {
  const directory = await getDownloadsDirectory();
  if (!directory) {
    return { deletedFiles: 0 };
  }

  const info = await FileSystemLegacy.getInfoAsync(directory);
  if (!info.exists) {
    return { deletedFiles: 0 };
  }

  const entries = await FileSystemLegacy.readDirectoryAsync(directory);
  let deletedFiles = 0;

  for (const entry of entries) {
    const uri = `${directory}${entry}`;
    try {
      // `idempotent: true` da već nepostojeći fajl ne sruši cijelo čišćenje —
      // bolje je obrisati ostatak nego stati na prvoj grešci.
      await FileSystemLegacy.deleteAsync(uri, { idempotent: true });
      deletedFiles += 1;
    } catch {
      // Pojedinačni neuspjeh se namjerno ne propagira: cilj je osloboditi što
      // je više moguće, a jedan zaključan fajl ne smije blokirati ostale.
    }
  }

  return { deletedFiles };
}
