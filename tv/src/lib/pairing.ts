/**
 * TV strana uparivanja — čista logika, bez UI-ja i bez mreže.
 *
 * Cijeli tok je **četiri stanja**, i to je ono što se može pogriješiti:
 *
 * ```
 *   idle ──create──> waiting ──READY──> paired
 *                       │                 │
 *                       └──EXPIRED──> expired (novi kod)
 * ```
 *
 * **Zašto stanje mora biti eksplicitno, a ne „dok nema tokena čekaj".** TV
 * koji zauvijek čeka izgleda identično kao TV kome je kod istekao — korisnik
 * ne zna treba li čekati ili uzeti novi kod. Zato `expired` nosi poruku, a
 * `paired` nosi token.
 *
 * **Zašto kod prestaje vrijediti čim se preuzme.** `claim` na serveru mijenja
 * stanje u `CLAIMED`; drugi poziv sa istim kodom ne vraća tokene. TV ne smije
 * ponavljati preuzimanje jer bi izgubio sesiju.
 */

/** Koliko često TV pita (server vraća istu vrijednost, ovo je rezerva). */
export const PAIRING_POLL_INTERVAL_MS = 2000;

/** Koliko dugo TV čeka prije nego što sam zaključi da je kod istekao. */
export const PAIRING_LOCAL_TIMEOUT_MS = 5 * 60 * 1000;

export type PairingState =
  | { phase: 'idle' }
  | { phase: 'waiting'; code: string; expiresAt: number }
  | { phase: 'paired'; token: string; refreshToken: string; userId: number }
  | { phase: 'expired'; code: string }
  | { phase: 'error'; message: string };

/** Oblik odgovora `GET /api/tv-pairing/sessions/:code`. */
export type ClaimResponse =
  | { status: 'PENDING' | 'APPROVED' | 'CLAIMED' | 'EXPIRED' | 'REJECTED' }
  | {
      status: 'READY';
      token: string;
      refreshToken: string;
      userId: number;
    };

/** Validate untrusted JSON before it enters the pairing state machine. */
export function parseClaimResponse(value: unknown): ClaimResponse | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const response = value as Record<string, unknown>;
  const status = response.status;
  if (status === 'READY') {
    if (
      typeof response.token === 'string' && response.token.trim().length > 0 &&
      typeof response.refreshToken === 'string' && response.refreshToken.trim().length > 0 &&
      typeof response.userId === 'number' && Number.isSafeInteger(response.userId) && response.userId > 0
    ) {
      return {
        status,
        token: response.token,
        refreshToken: response.refreshToken,
        userId: response.userId,
      };
    }
    return null;
  }

  return status === 'PENDING' || status === 'APPROVED' || status === 'CLAIMED' || status === 'EXPIRED' || status === 'REJECTED'
    ? { status }
    : null;
}

/**
 * Prevedi odgovor servera u novo stanje TV-a.
 *
 * **`CLAIMED` je poseban slučaj i nije greška.** Znači da je **ovaj** TV već
 * preuzeo tokene (npr. aplikacija je ubijena poslije preuzimanja, prije upisa).
 * Tada nema šta da se radi osim pokazati „uparivanje je završeno" — ali ako su
 * tokeni izgubljeni, korisnik mora dobiti **novi kod**, ne poruku „već
 * upareno" bez izlaza. Zato `CLAIMED` ide u `expired`: novi kod je jedini izlaz.
 */
export function reduceClaim(
  current: PairingState,
  response: ClaimResponse,
): PairingState {
  switch (response.status) {
    case 'READY':
      return {
        phase: 'paired',
        token: response.token,
        refreshToken: response.refreshToken,
        userId: response.userId,
      };

    case 'PENDING':
    case 'APPROVED':
      // `APPROVED` znači da je telefon odobrio, a TV još nije preuzeo — server
      // daje tokene u istom odgovoru, pa se ovdje ne bi trebalo doći. Ako se
      // dođe, čekanje je i dalje tačan odgovor.
      return current;

    case 'EXPIRED':
    case 'REJECTED':
    case 'CLAIMED':
      return { phase: 'expired', code: current.phase === 'waiting' ? current.code : '' };

    default:
      return current;
  }
}

/** Da li je kod lokalno istekao (TV ne treba da čeka mrežu). */
export function isLocallyExpired(expiresAt: number, now = Date.now()): boolean {
  return now >= expiresAt;
}

/**
 * Kod za prikaz: `ABCD2345` → `ABCD 2345`.
 *
 * Razmak, ne crtica: na TV-u se kod čita iz daljine, a crtica izgleda kao
 * minus i lako se zamijeni sa `1`/`l`.
 */
export function formatCodeForTv(code: string): string {
  const clean = code.replace(/[\s-]/g, '').toUpperCase();
  return `${clean.slice(0, 4)} ${clean.slice(4)}`;
}

/**
 * Sadržaj QR koda.
 *
 * **Namjerno NIJE URL.** Ako bi QR bio `https://…/pair?code=X`, skeniranje
 * običnom kamerom telefona otvorilo bi browser — a odobrenje traži **prijavu u
 * aplikaciji**. Zato QR nosi prefiks koji samo naša aplikacija razumije:
 *
 * ```
 *   boilercontrol://tv-pair?code=ABCD2345
 * ```
 *
 * Kamera bez aplikacije tada ne radi ništa korisno, ali i ne vodi korisnika na
 * stranicu koja ne može dovršiti posao.
 */
export const PAIRING_DEEP_LINK_PREFIX = 'boilercontrol://tv-pair?code=';

export function pairingDeepLink(code: string): string {
  return `${PAIRING_DEEP_LINK_PREFIX}${code.replace(/[\s-]/g, '').toUpperCase()}`;
}

/**
 * Izvuci kod iz skeniranog teksta.
 *
 * Prihvata i goli kod i deep link — jer telefon može skenirati ili QR sa TV-a
 * ili kod koji je korisnik prepisao. Vraća `null` kad ništa ne odgovara, da
 * pozivalac ne pošalje besmislicu serveru.
 */
export function extractPairingCode(scanned: string): string | null {
  const trimmed = scanned.trim();

  if (trimmed.startsWith(PAIRING_DEEP_LINK_PREFIX)) {
    const code = trimmed.slice(PAIRING_DEEP_LINK_PREFIX.length);
    return normalizeIfShaped(code);
  }

  return normalizeIfShaped(trimmed);
}

function normalizeIfShaped(raw: string): string | null {
  const code = raw.replace(/[\s-]/g, '').toUpperCase();
  if (code.length !== 8) return null;
  // Ista abeceda kao backend (`pairing-code.ts`): bez `0`, `O`, `1`, `I`, `L`.
  return [...code].every((ch) => '23456789ABCDEFGHJKMNPQRSTUVWXYZ'.includes(ch))
    ? code
    : null;
}
