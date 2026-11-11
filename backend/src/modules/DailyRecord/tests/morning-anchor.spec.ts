import { anchorDailyFlow, type DaytimeChangeReason } from '../morning-anchor';

/**
 * `F14`: jedna polazna za cijeli dan.
 *
 * Test čuva tri stvari koje se ne vide iz UI-a:
 * 1. jutarnji predlog se **ne** mijenja samo zato što formula sada računa drugačije;
 * 2. izmjena usred dana moguća je samo sa izmjerenim manjkom, i samo **gore**;
 * 3. kad jutra nema, to se kaže (`FORMULA`) umjesto da se pretvara da je jutro potvrdilo broj.
 */
describe('anchorDailyFlow — jedna polazna za cijeli dan', () => {
  const base = {
    morningFlowC: 46,
    currentFlowC: 52,
    today: null,
    minC: 30,
    maxC: 55,
  };

  it('formula odstupa, ali bez dokaza broj ostaje jutarnji', () => {
    const result = anchorDailyFlow(base);

    expect(result).toMatchObject({
      flowC: 46,
      basis: 'MORNING',
      changed: false,
      change: null,
    });
    // Odstupanje se prijavljuje, ne skriva — ali ne mijenja odluku.
    expect(result.formulaDriftC).toBeCloseTo(6, 6);
  });

  it('manjak preko tolerancije podiže polaznu i nosi razlog', () => {
    const result = anchorDailyFlow({
      ...base,
      today: { undershootC: 1.6, nightUndershootC: null },
    });

    expect(result).toMatchObject({
      flowC: 52,
      basis: 'CHANGED',
      changed: true,
    });
    expect(result.change).toEqual({
      flowC: 52,
      reason: 'DAY_UNDERSHOOT' satisfies DaytimeChangeReason,
      measuredUndershootC: 1.6,
    });
  });

  it('manjak ispod tolerancije ne mijenja ništa', () => {
    for (const value of [0.6, 1.0, null]) {
      const result = anchorDailyFlow({
        ...base,
        today: { undershootC: value, nightUndershootC: value },
      });
      expect(result.flowC).toBe(46);
      expect(result.changed).toBe(false);
    }
  });

  it('noćni manjak ima prednost u tekstu razloga', () => {
    const result = anchorDailyFlow({
      ...base,
      today: { undershootC: 2.4, nightUndershootC: 1.2 },
    });

    expect(result.change?.reason).toBe('NIGHT_UNDERSHOOT');
    expect(result.change?.measuredUndershootC).toBe(1.2);
    expect(result.flowC).toBe(52);
  });

  it('formula ispod jutra uz dokaz ne spušta broj', () => {
    const result = anchorDailyFlow({
      morningFlowC: 50,
      currentFlowC: 44,
      today: { undershootC: 2, nightUndershootC: null },
      minC: 30,
      maxC: 55,
    });

    // Kuća je bila prehladna — spuštanje bi pogoršalo. Ostaje jutarnji broj.
    expect(result.flowC).toBe(50);
    expect(result.basis).toBe('MORNING');
    expect(result.changed).toBe(false);
  });

  it('izmjena nikad ne prelazi granicu doma', () => {
    const result = anchorDailyFlow({
      morningFlowC: 46,
      currentFlowC: 55,
      today: { undershootC: 3, nightUndershootC: null },
      ceilingC: 49,
      minC: 46,
      maxC: 55,
    });

    expect(result.flowC).toBe(49);
    expect(result.change?.flowC).toBe(49);
  });

  it('bez jutarnjeg predloga broj je formula, i tako se i prijavljuje', () => {
    const result = anchorDailyFlow({ ...base, morningFlowC: null });

    expect(result).toMatchObject({
      flowC: 52,
      basis: 'FORMULA',
      changed: false,
    });
  });

  it('bez jutra i bez formule nema broja (ne izmišlja se ništa)', () => {
    const result = anchorDailyFlow({
      ...base,
      morningFlowC: null,
      currentFlowC: null,
    });

    expect(result).toMatchObject({ flowC: null, basis: 'NONE' });
  });

  it('jutarnji predlog se reže na granice doma prije poređenja', () => {
    const result = anchorDailyFlow({
      morningFlowC: 60,
      currentFlowC: 40,
      today: null,
      minC: 46,
      maxC: 55,
    });

    expect(result.flowC).toBe(55);
  });
});
