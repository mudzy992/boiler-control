/**
 * Sesija TV-a u trajnoj memoriji.
 *
 * **Zašto TV pamti sesiju.** Uparivanje traži telefon; ako bi TV zaboravio
 * sesiju pri svakom gašenju, korisnik bi svaki put morao po telefon. TV je
 * uređaj koji se gasi daljinskim, ne „odjavom".
 *
 * **Zašto `refreshToken` i `token` zajedno.** Access token ističe (15 min);
 * bez refresh tokena TV bi tražio ponovno uparivanje svakih 15 minuta.
 */

export interface StoredSession {
  token: string;
  refreshToken: string;
  userId: number;
}

/**
 * Interfejs, ne konkretna implementacija: u testovima je mapa, u aplikaciji
 * `expo-secure-store`-u sličan sloj. Zaključavanje na biblioteku ovdje bi
 * značilo da se logika sesije ne može testirati bez native modula.
 */
export interface SessionStorage {
  read: () => Promise<string | null>;
  write: (value: string) => Promise<void>;
  clear: () => Promise<void>;
}

const KEY = 'tv.session.v1';

export function createSessionStore(storage: SessionStorage) {
  return {
    async load(): Promise<StoredSession | null> {
      const raw = await storage.read();
      return parseSession(raw);
    },

    async save(session: StoredSession): Promise<void> {
      await storage.write(JSON.stringify({ ...session, key: KEY }));
    },

    async clear(): Promise<void> {
      await storage.clear();
    },
  };
}

/**
 * Parsiraj sačuvanu sesiju; **neispravan sadržaj se odbacuje**, ne baca.
 *
 * Ako se format promijeni ili upis bude polovičan (TV isključen strujom
 * usred upisa), aplikacija se mora pokrenuti i tražiti novo uparivanje — a ne
 * pasti na startu sa ekranom koji se ne može proći.
 */
export function parseSession(raw: string | null): StoredSession | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (
      typeof parsed.token === 'string' &&
      parsed.token.length > 0 &&
      typeof parsed.refreshToken === 'string' &&
      parsed.refreshToken.length > 0 &&
      typeof parsed.userId === 'number'
    ) {
      return {
        token: parsed.token,
        refreshToken: parsed.refreshToken,
        userId: parsed.userId,
      };
    }
    return null;
  } catch {
    return null;
  }
}
