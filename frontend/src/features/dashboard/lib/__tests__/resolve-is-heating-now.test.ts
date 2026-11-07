import { describe, expect, it } from 'vitest';
import { resolveIsHeatingNow } from '../resolve-is-heating-now';

describe('resolveIsHeatingNow', () => {
  it('returns true when any array element is heating', () => {
    expect(
      resolveIsHeatingNow([
        { deviceId: 1, isHeatingNow: false },
        { deviceId: 2, isHeatingNow: true },
      ]),
    ).toBe(true);
  });

  it('returns false for empty array or all idle', () => {
    expect(resolveIsHeatingNow([])).toBe(false);
    expect(
      resolveIsHeatingNow([{ deviceId: 1, isHeatingNow: false }]),
    ).toBe(false);
  });

  it('tolerates a single object shape', () => {
    expect(resolveIsHeatingNow({ isHeatingNow: true })).toBe(true);
    expect(resolveIsHeatingNow({ isHeatingNow: false })).toBe(false);
  });
});
