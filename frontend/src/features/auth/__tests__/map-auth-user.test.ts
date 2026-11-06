import { describe, expect, it } from 'vitest';
import { mapAuthUser } from '../map-auth-user';

describe('AU-03: mapAuthUser keeps role from login/me', () => {
  it('maps numeric id and role', () => {
    const actual = mapAuthUser({
      id: 7,
      email: 'a@b.c',
      name: 'Ana',
      role: 'ADMIN',
      plan: 'FREE',
      prefersDarkMode: true,
    });
    expect(actual).toEqual({
      id: 7,
      email: 'a@b.c',
      username: null,
      name: 'Ana',
      role: 'ADMIN',
      plan: 'FREE',
      prefersDarkMode: true,
    });
  });

  it('coerces string id and defaults unknown role', () => {
    const actual = mapAuthUser({
      id: '12',
      email: 'x@y.z',
      role: 'NOPE',
    });
    expect(actual.id).toBe(12);
    expect(actual.role).toBe('USER');
  });
});
