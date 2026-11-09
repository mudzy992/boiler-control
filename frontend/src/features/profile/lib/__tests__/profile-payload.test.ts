import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildProfileUpdate,
  EDITABLE_PROFILE_FIELDS,
} from '../profile-payload';

/**
 * Regresija: „Ažuriranje profila nije uspjelo. (property role should not exist,
 * property plan should not exist, property createdAt should not exist, property
 * updatedAt should not exist)".
 *
 * Uzrok: stranica je u `form` unosila **cijeli** odgovor `GET /api/user` i
 * vraćala ga na `PUT /api/user`, a backend odbija nepoznata polja
 * (`forbidNonWhitelisted`). Prva popravka je skinula samo `id`, pa je pad
 * nastavio na sljedećem polju.
 *
 * Ovi testovi ne provjeravaju jedno polje — provjeravaju da **ništa** iz
 * odgovora ne može ući u zahtjev osim dozvoljenog.
 */

/** Odgovor kakav backend stvarno vraća na `GET /api/user`. */
const SERVER_RESPONSE = {
  id: 1,
  email: 'vlasnik@example.com',
  username: 'vlasnik',
  name: 'Vlasnik',
  homeLocation: 'Visoko',
  role: 'USER',
  plan: 'FREE',
  avatarUrl: null,
  timezone: 'Europe/Sarajevo',
  locale: 'bs-BS',
  prefersDarkMode: false,
  gasPriceExVat: 1.25,
  gasPriceIncVat: 1.46,
  gasPriceSource: 'MANUAL',
  gasPriceVatRate: 0.17,
  gasPriceLastUpdatedAt: '2026-11-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-11-08T00:00:00.000Z',
};

const DTO_FIELDS = new Set<string>([...EDITABLE_PROFILE_FIELDS, 'locale']);

/**
 * Bijela lista mora odgovarati **ugovoru**, ne sjećanju. Ako neko doda polje
 * ovdje a zaboravi ga u `UpdateUserDto` (ili obrnuto), ovo pada prije nego
 * korisnik vidi „property … should not exist".
 */
describe('EDITABLE_PROFILE_FIELDS prema contracts/openapi.json', () => {
  const contract = JSON.parse(
    readFileSync(join(process.cwd(), '..', 'contracts', 'openapi.json'), 'utf8'),
  ) as {
    components: { schemas: Record<string, { properties?: Record<string, unknown> }> };
  };
  const dto = contract.components.schemas.UpdateUserDto?.properties ?? {};

  it('svako polje iz bijele liste postoji u UpdateUserDto', () => {
    for (const field of EDITABLE_PROFILE_FIELDS) {
      expect(Object.keys(dto), `nema u ugovoru: ${field}`).toContain(field);
    }
  });

  it('ugovor ne nudi polja koja ova stranica ne zna popuniti', () => {
    // `password`/`currentPassword` pripadaju drugom toku (promjena lozinke),
    // `gasPriceEffectiveFrom` se šalje uz cijenu — oba su svjesno izvan liste.
    const intentionallyOmitted = new Set([
      'password',
      'currentPassword',
      'gasPriceEffectiveFrom',
      'locale',
    ]);
    const uncovered = Object.keys(dto).filter(
      (key) => !intentionallyOmitted.has(key) && !EDITABLE_PROFILE_FIELDS.includes(key as never),
    );
    expect(uncovered).toEqual([]);
  });
});

describe('buildProfileUpdate', () => {
  it('ne propušta role, plan, createdAt, updatedAt, id ni email', () => {
    const payload = buildProfileUpdate(SERVER_RESPONSE, 'bs-BS');

    expect(payload).not.toHaveProperty('role');
    expect(payload).not.toHaveProperty('plan');
    expect(payload).not.toHaveProperty('createdAt');
    expect(payload).not.toHaveProperty('updatedAt');
    expect(payload).not.toHaveProperty('id');
    expect(payload).not.toHaveProperty('email');
  });

  it('ne propušta izvedena polja cijene plina (server ih računa)', () => {
    const payload = buildProfileUpdate(SERVER_RESPONSE, 'bs-BS');

    expect(payload).not.toHaveProperty('gasPriceIncVat');
    expect(payload).not.toHaveProperty('gasPriceSource');
    expect(payload).not.toHaveProperty('gasPriceVatRate');
    expect(payload).not.toHaveProperty('gasPriceLastUpdatedAt');
  });

  it('svaki ključ u tijelu postoji u DTO-u (inače je 400)', () => {
    const payload = buildProfileUpdate(SERVER_RESPONSE, 'en-US');

    for (const key of Object.keys(payload)) {
      expect(DTO_FIELDS.has(key), `neočekivan ključ u PUT tijelu: ${key}`).toBe(true);
    }
  });

  it('zadržava polja koja se stvarno mogu mijenjati', () => {
    const payload = buildProfileUpdate(SERVER_RESPONSE, 'bs-BS');

    expect(payload).toEqual({
      locale: 'bs-BS',
      username: 'vlasnik',
      name: 'Vlasnik',
      homeLocation: 'Visoko',
      timezone: 'Europe/Sarajevo',
      prefersDarkMode: false,
      gasPriceExVat: 1.25,
    });
  });

  it('locale se šalje uvijek, i kad ga izvor nema', () => {
    expect(buildProfileUpdate({}, 'en-US')).toEqual({ locale: 'en-US' });
  });

  it('ne šalje prazan string (username ima min. 3 znaka → rušio bi cijeli zahtjev)', () => {
    const payload = buildProfileUpdate(
      { username: '   ', name: '', homeLocation: '' },
      'bs-BS',
    );
    expect(payload).toEqual({ locale: 'bs-BS' });
  });

  it('ne šalje undefined, null ni NaN', () => {
    const payload = buildProfileUpdate(
      { name: undefined, gasPriceExVat: Number.NaN, timezone: null },
      'bs-BS',
    );
    expect(payload).toEqual({ locale: 'bs-BS' });
  });

  it('zadržava false i nulu (nisu „prazno")', () => {
    const payload = buildProfileUpdate(
      { prefersDarkMode: false, gasPriceExVat: 0 },
      'bs-BS',
    );
    expect(payload).toEqual({ locale: 'bs-BS', prefersDarkMode: false, gasPriceExVat: 0 });
  });
});
