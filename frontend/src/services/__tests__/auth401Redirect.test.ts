import { describe, expect, it } from 'vitest';
import { shouldForceLoginRedirectOn401 } from '../auth401';

describe('AU-01: 401 redirect policy', () => {
  it('does not force redirect for /auth/login', () => {
    expect(shouldForceLoginRedirectOn401('/auth/login')).toBe(false);
    expect(shouldForceLoginRedirectOn401('/api/auth/login')).toBe(false);
  });

  it('forces redirect for other protected URLs', () => {
    expect(shouldForceLoginRedirectOn401('/user')).toBe(true);
    expect(shouldForceLoginRedirectOn401('/dashboard')).toBe(true);
    expect(shouldForceLoginRedirectOn401('/auth/refresh')).toBe(true);
  });
});
