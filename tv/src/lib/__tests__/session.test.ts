import { createSessionStore, parseSession } from '../session';

/**
 * Sesija preživljava gašenje TV-a, ali **neispravna sesija se odbacuje**.
 *
 * TV se isključuje daljinskim (i strujom). Polovičan upis ne smije ostaviti
 * aplikaciju na ekranu koji se ne može proći.
 */

const session = { token: 'access-7', refreshToken: 'refresh-7', userId: 7 };

describe('čuvanje sesije', () => {
  it('sačuvana sesija se vraća ista', async () => {
    let raw: string | null = null;
    const store = createSessionStore({
      read: async () => raw,
      write: async (v) => {
        raw = v;
      },
      clear: async () => {
        raw = null;
      },
    });

    await store.save(session);
    expect(await store.load()).toEqual(session);

    await store.clear();
    expect(await store.load()).toBeNull();
  });
});

describe('čitanje neispravne sesije', () => {
  it('prazno ili polovično → null, ne izuzetak', () => {
    expect(parseSession(null)).toBeNull();
    expect(parseSession('')).toBeNull();
    expect(parseSession('{')).toBeNull();
    // Token bez refresh tokena: TV bi se prijavio i ostao bez načina da
    // obnovi sesiju — bolje odmah tražiti novo uparivanje.
    expect(parseSession(JSON.stringify({ token: 'a', userId: 7 }))).toBeNull();
    expect(
      parseSession(JSON.stringify({ token: '', refreshToken: 'r', userId: 7 })),
    ).toBeNull();
  });

  it('ispravna sesija prolazi, sa ili bez dodatnih polja', () => {
    expect(parseSession(JSON.stringify(session))).toEqual(session);
    expect(
      parseSession(JSON.stringify({ ...session, key: 'tv.session.v1' })),
    ).toEqual(session);
  });
});
