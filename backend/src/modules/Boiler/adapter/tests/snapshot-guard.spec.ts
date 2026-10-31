/**
 * REL-7 (B-026): normalizacija Tuya snapshot-a.
 *
 * Ovi testovi pokrivaju čiste funkcije iz `snapshot-guard.ts`. Ponasanje
 * cijelog toka (stvarni adapter + stvarni `pollDevice`) pokriva
 * `scripts/audit/tuya_missing_fields_repro.cjs`.
 *
 * Ključna invarijanta: **nepoznato nije nula**. Prije ove ispravke odsutno
 * polje je postajalo stvarna vrijednost (`null / 2 === 0`, `=== true` -> false),
 * pa je poller na izmisljenim podacima birao pocetak/kraj ciklusa grijanja.
 */
import {
  SNAPSHOT_GUARD_FLAG,
  snapshotGuardEnabled,
  toNullableNumber,
  toNullableBoolean,
  missingSnapshotFields,
  isSnapshotComplete,
} from '../snapshot-guard';

describe('snapshot-guard (REL-7 / B-026)', () => {
  describe('toNullableNumber', () => {
    it('vraca null za odsutno polje, a ne 0', () => {
      expect(toNullableNumber(undefined)).toBeNull();
      expect(toNullableNumber(null)).toBeNull();
    });

    it('vraca null za prazan string i boolean', () => {
      // `Number('') === 0` i `Number(true) === 1` — oba bi bila tiha greska.
      expect(toNullableNumber('')).toBeNull();
      expect(toNullableNumber(true)).toBeNull();
      expect(toNullableNumber(false)).toBeNull();
    });

    it('vraca null za nesto sto nije broj', () => {
      expect(toNullableNumber('abc')).toBeNull();
      expect(toNullableNumber(NaN)).toBeNull();
      expect(toNullableNumber(Infinity)).toBeNull();
    });

    it('STVARNA nula ostaje 0, ne postaje null', () => {
      expect(toNullableNumber(0)).toBe(0);
      expect(toNullableNumber('0')).toBe(0);
    });

    it('prihvata numericke stringove (Tuya zna poslati string)', () => {
      expect(toNullableNumber('42')).toBe(42);
      expect(toNullableNumber('20.5')).toBe(20.5);
    });

    it('prihvata negativne vrijednosti (zimske temperature)', () => {
      expect(toNullableNumber(-10)).toBe(-10);
      expect(toNullableNumber('-10')).toBe(-10);
    });
  });

  describe('toNullableBoolean', () => {
    it('vraca undefined za odsutno polje, a ne false', () => {
      expect(toNullableBoolean(undefined)).toBeUndefined();
      expect(toNullableBoolean(null)).toBeUndefined();
    });

    it('STVARNO false ostaje false', () => {
      expect(toNullableBoolean(false)).toBe(false);
      expect(toNullableBoolean(true)).toBe(true);
    });

    it('namjerno NE prihvata stringove ni brojeve', () => {
      // Prosirivanje bi stvarni kvar pretvorilo u tiho drugacije ponasanje.
      expect(toNullableBoolean('true')).toBeUndefined();
      expect(toNullableBoolean('false')).toBeUndefined();
      expect(toNullableBoolean(1)).toBeUndefined();
      expect(toNullableBoolean(0)).toBeUndefined();
    });
  });

  describe('missingSnapshotFields', () => {
    it('prazan niz kad je snapshot kompletan', () => {
      expect(
        missingSnapshotFields({
          currentTemp: 20,
          targetTemp: 21,
          powerOn: true,
        }),
      ).toEqual([]);
    });

    it('imenuje tacno polje koje nedostaje', () => {
      expect(
        missingSnapshotFields({
          currentTemp: null,
          targetTemp: 21,
          powerOn: true,
        }),
      ).toEqual(['TempCurrent']);
      expect(
        missingSnapshotFields({
          currentTemp: 20,
          targetTemp: null,
          powerOn: true,
        }),
      ).toEqual(['TempSet']);
      expect(
        missingSnapshotFields({ currentTemp: 20, targetTemp: 21 }),
      ).toEqual(['Power']);
    });

    it('navodi sva tri kad nista nije poslano', () => {
      expect(
        missingSnapshotFields({ currentTemp: null, targetTemp: null }),
      ).toEqual(['TempCurrent', 'TempSet', 'Power']);
    });

    it('stvarne nule i false se NE broje kao nedostajuce', () => {
      expect(
        missingSnapshotFields({
          currentTemp: 0,
          targetTemp: 0,
          powerOn: false,
        }),
      ).toEqual([]);
    });
  });

  describe('isSnapshotComplete', () => {
    it('kompletan samo kad sva tri polja imaju vrijednost', () => {
      expect(
        isSnapshotComplete({ currentTemp: 0, targetTemp: 0, powerOn: false }),
      ).toBe(true);
      expect(
        isSnapshotComplete({
          currentTemp: null,
          targetTemp: 21,
          powerOn: true,
        }),
      ).toBe(false);
      expect(isSnapshotComplete({ currentTemp: 20, targetTemp: 21 })).toBe(
        false,
      );
    });
  });

  describe('snapshotGuardEnabled', () => {
    it('zadano je UKLJUCENO (varijabla ne postoji)', () => {
      expect(snapshotGuardEnabled({})).toBe(true);
    });

    it('prazan string znaci ukljuceno', () => {
      expect(snapshotGuardEnabled({ [SNAPSHOT_GUARD_FLAG]: '' })).toBe(true);
    });

    it('iskljucuje se samo eksplicitnim off vrijednostima', () => {
      for (const off of [
        'off',
        'OFF',
        'Off',
        'false',
        'FALSE',
        '0',
        'no',
        ' off ',
      ]) {
        expect(snapshotGuardEnabled({ [SNAPSHOT_GUARD_FLAG]: off })).toBe(
          false,
        );
      }
    });

    it('sve ostalo znaci ukljuceno', () => {
      for (const on of ['on', 'true', '1', 'yes', 'bilo-sta']) {
        expect(snapshotGuardEnabled({ [SNAPSHOT_GUARD_FLAG]: on })).toBe(true);
      }
    });
  });
});
