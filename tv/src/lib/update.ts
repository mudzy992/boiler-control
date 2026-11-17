/**
 * Provjera nove verzije na TV-u — **samo obavijest**, bez instalacije.
 *
 * ## Zašto bez automatske instalacije
 *
 * Android traži `REQUEST_INSTALL_PACKAGES` i potvrdu korisnika za svaku
 * instalaciju van prodavnice. Na TV-u se ta potvrda pojavljuje preko cijelog
 * ekrana i traži daljinski — korisnik koji gleda analitiku ne smije završiti u
 * sistemskom dijalogu. Zato TV **kaže** da postoji nova verzija i pokaže
 * adresu; instalaciju pokreće onaj ko zna šta radi.
 *
 * ## Zašto gate ne blokira
 *
 * Mobilna aplikacija ima `versionGate` koji može zaključati staru verziju.
 * Na TV-u to ne radimo: TV visi na zidu i često se ne ažurira mjesecima. Ako bi
 * ga blokirali, korisnik bi ostao bez analitike zbog nadogradnje koju ne može
 * izvršiti bez telefona. TV zato samo **obavještava**.
 */

/** Odgovor `GET /api/app-releases/latest?platform=TV`. */
export interface TvLatestRelease {
  version: string;
  buildNumber: number;
  sizeBytes: number;
  notes: string | null;
  publishedAt: string;
  downloadUrl: string;
}

export interface ReleaseResponse {
  release: TvLatestRelease | null;
}

/**
 * Strogi semver bez sufiksa.
 *
 * **Zašto odbijamo suffiks, a ne „popravljamo" ga.** `2.0.0-beta.1` se ne može
 * pouzdano uporediti sa `2.0.0` bez pravila o prerelease-u; TV koji bi pogrešno
 * zaključio da je beta novija nudio bi polomljenu verziju. Radije ne nudimo
 * ništa.
 */
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

function parse(version: string): [number, number, number] | null {
  const match = SEMVER.exec(version.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** `1` kad je `a` novija, `-1` kad je starija, `0` kad su iste. */
export function compareVersions(a: string, b: string): number | null {
  const left = parse(a);
  const right = parse(b);
  // Nepoznat oblik: vraćamo `null`, a pozivalac tada ne nudi ništa.
  if (!left || !right) return null;

  for (let i = 0; i < 3; i += 1) {
    if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  }
  return 0;
}

/**
 * Ima li TV noviju verziju od instalirane.
 *
 * **`null` znači „ne znam", ne „nema".** Kad se verzija ne može pročitati
 * (prazan odgovor, neispravan semver), TV ne smije ništa tvrditi — ni da je
 * ažuran ni da treba update.
 */
export function newVersionAvailable(
  currentVersion: string,
  response: ReleaseResponse | null | undefined,
): TvLatestRelease | null {
  const release = response?.release;
  if (!release) return null;

  const comparison = compareVersions(release.version, currentVersion);
  if (comparison === null) return null;

  // Samo strogo novija: ista verzija je „već imam", starija je objavljena
  // greškom (npr. vraćanje na prethodnu) i ne smije se nuditi kao nova.
  return comparison > 0 ? release : null;
}
