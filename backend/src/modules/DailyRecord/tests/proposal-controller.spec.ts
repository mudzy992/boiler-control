import {
  DWELL_DAYS,
  SHORT_CYCLE_MARGIN_K,
  SHORT_CYCLE_MIN,
  STEP_DOWN_K,
  STEP_UP_K,
  decideProposal,
  shortCycleFloorFrom,
  type ControllerInput,
  type OutcomeSignals,
} from '../proposal-controller';

/**
 * Kontroler je jedino mjesto koje smije spustiti polaznu. Zato testovi ne
 * provjeravaju „da li vraća broj" nego **kada se to ne smije dogoditi**:
 * bez modela, bez ishoda, `DEGRADED`, bez poredljive noći.
 */

const comfortable = (overrides: Partial<OutcomeSignals> = {}): OutcomeSignals => ({
  undershootC: 0.2,
  overshootC: 0.1,
  nightUndershootC: 0.1,
  medianCycleMin: 45,
  ...overrides,
});

const baseInput = (overrides: Partial<ControllerInput> = {}): ControllerInput => ({
  modelFlowC: 42,
  previousFlowC: 45,
  daysSinceChange: 10,
  outcome: comfortable(),
  night: { floorC: 40, basis: 'NO_FAILURE' },
  modelState: 'TRACKING',
  ...overrides,
});

describe('decideProposal — kad se polazna ne smije spustiti', () => {
  it('DEGRADED model: drži prošlu vrijednost, bez obzira na ishod', () => {
    const decision = decideProposal(
      baseInput({ modelState: 'DEGRADED', modelFlowC: null }),
    );
    expect(decision).toMatchObject({
      flowC: 45,
      action: 'HOLD',
      reasons: ['DEGRADED'],
    });
  });

  it('nema ishoda dana: drži prošlu vrijednost', () => {
    const decision = decideProposal(baseInput({ outcome: null }));
    expect(decision).toMatchObject({
      flowC: 45,
      action: 'HOLD',
      reasons: ['NO_OUTCOME'],
    });
  });

  it('nema modela: drži prošlu vrijednost', () => {
    const decision = decideProposal(baseInput({ modelFlowC: null }));
    expect(decision).toMatchObject({
      flowC: 45,
      action: 'HOLD',
      reasons: ['NO_MODEL'],
    });
  });

  it('bez poredljivih noći ne spušta, iako je dan bio udoban', () => {
    for (const basis of ['NO_FORECAST', 'NO_EVIDENCE'] as const) {
      const decision = decideProposal(
        baseInput({ night: { floorC: null, basis } }),
      );
      expect(decision).toMatchObject({
        flowC: 45,
        action: 'HOLD',
        reasons: ['NO_NIGHT_EVIDENCE'],
      });
    }
  });

  it('noći koje nijesu podbacile ne blokiraju spuštanje', () => {
    const decision = decideProposal(
      baseInput({ night: { floorC: null, basis: 'NO_FAILURE' } }),
    );
    expect(decision.action).toBe('LOWER');
    expect(decision.flowC).toBe(45 - STEP_DOWN_K);
  });

  it('bez prošle vrijednosti kontroler ne izmišlja: prva odluka je bazna', () => {
    const decision = decideProposal(baseInput({ previousFlowC: null }));
    expect(decision).toMatchObject({ flowC: 42, action: 'HOLD', reasons: ['STEADY'] });
  });

  it('prva odluka bez modela vraća null, ne broj', () => {
    const decision = decideProposal(
      baseInput({ previousFlowC: null, modelFlowC: null }),
    );
    expect(decision.flowC).toBeNull();
  });
});

describe('decideProposal — podbačaj podiže, i to iznad prošle', () => {
  it('dnevni podbačaj: +1,5 K, i to i kad je model pao', () => {
    const decision = decideProposal(
      baseInput({
        modelFlowC: 36,
        outcome: comfortable({ undershootC: 1.6 }),
        daysSinceChange: 0,
      }),
    );
    expect(decision.reasons).toEqual(['UNDERSHOOT']);
    expect(decision.action).toBe('RAISE');
    // Iako je model na 36, polazna ne smije pasti: 45 + 1,5 = 46,5.
    expect(decision.flowC).toBe(46.5);
  });

  it('noćni podbačaj je dovoljan i kad je dan bio udoban', () => {
    const decision = decideProposal(
      baseInput({ outcome: comfortable({ nightUndershootC: 1.4 }) }),
    );
    expect(decision.reasons).toEqual(['NIGHT_UNDERSHOOT']);
    expect(decision.flowC).toBe(46.5);
  });

  it('podbačaj ne čeka dwell — komfor je sigurnosna stvar', () => {
    const decision = decideProposal(
      baseInput({ daysSinceChange: 0, outcome: comfortable({ undershootC: 2 }) }),
    );
    expect(decision.reasons).toEqual(['UNDERSHOOT']);
    expect(decision.flowC).toBe(46.5);
  });

  it('podbačaj tačno na toleranciji ne diže polaznu', () => {
    const decision = decideProposal(
      baseInput({ night: { floorC: null, basis: 'NO_FAILURE' }, outcome: comfortable({ undershootC: 1.0 }) }),
    );
    expect(decision.reasons).toEqual(['COMFORT_HOLD']);
    expect(decision.action).toBe('LOWER');
  });
});

describe('decideProposal — prebačaj, kratki ciklusi, udobnost', () => {
  it('prebačaj veći od 1,5 K spušta jedan korak', () => {
    const decision = decideProposal(
      baseInput({
        night: { floorC: null, basis: 'NO_FAILURE' },
        outcome: comfortable({ overshootC: 1.8 }),
      }),
    );
    expect(decision.reasons).toEqual(['OVERSHOOT']);
    expect(decision.flowC).toBe(44);
  });

  it('kratki ciklusi dižu jedan korak — vlasnikov primjer 49 → 50', () => {
    // Izmjereno: na 49 su ciklusi kratki. Granica je 49 + 1 = 50, pa predlog
    // više ne pada na 49 dok se ne izmjeri da je niža vrijednost dugo ciklirala.
    const floor = shortCycleFloorFrom({ flowC: 49, medianCycleMin: 5 });
    expect(floor).toBe(49 + SHORT_CYCLE_MARGIN_K);

    const decision = decideProposal(
      baseInput({
        previousFlowC: 49,
        modelFlowC: 49.74,
        shortCycleFloorC: floor,
        outcome: comfortable({ medianCycleMin: 5 }),
      }),
    );
    expect(decision.reasons).toEqual(['SHORT_CYCLES']);
    expect(decision.action).toBe('RAISE');
    expect(decision.flowC).toBe(50);
  });

  it('granica iz kratkih ciklusa se ne izmišlja kad ciklusi nijesu kratki', () => {
    expect(shortCycleFloorFrom({ flowC: 49, medianCycleMin: SHORT_CYCLE_MIN })).toBeNull();
    expect(shortCycleFloorFrom({ flowC: 49, medianCycleMin: null })).toBeNull();
    expect(shortCycleFloorFrom({ flowC: null, medianCycleMin: 3 })).toBeNull();
  });

  it('kratki ciklusi bez zapamćene granice ne mijenjaju polaznu', () => {
    const decision = decideProposal(
      baseInput({
        previousFlowC: 45,
        night: { floorC: null, basis: 'NO_FAILURE' },
        outcome: comfortable({ medianCycleMin: 4 }),
      }),
    );
    expect(decision.flowC).toBe(45);
    expect(decision.action).toBe('HOLD');
  });

  it('medijana ciklusa tačno na granici nije kratka', () => {
    const decision = decideProposal(
      baseInput({
        night: { floorC: null, basis: 'NO_FAILURE' },
        outcome: comfortable({ medianCycleMin: SHORT_CYCLE_MIN }),
      }),
    );
    expect(decision.action).toBe('LOWER');
  });

  it('kad medijane ciklusa nema, kontroler ne pretpostavlja kratke cikluse', () => {
    const decision = decideProposal(
      baseInput({
        night: { floorC: null, basis: 'NO_FAILURE' },
        outcome: comfortable({ medianCycleMin: null }),
      }),
    );
    expect(decision.reasons).toEqual(['COMFORT_HOLD']);
    expect(decision.action).toBe('LOWER');
  });
});

describe('decideProposal — dwell i deadband', () => {
  it('spuštanje se zaustavlja na ravnotežnoj polaznoj iz modela', () => {
    // Baza 42 je polazna pri kojoj kuća u najhladnijem satu drži cilj. Ispod nje
    // nema dokaza da je toplo — ima samo dokaz da je formula bila previsoka.
    const atBase = decideProposal(
      baseInput({
        previousFlowC: 42,
        modelFlowC: 42,
        night: { floorC: null, basis: 'NO_FAILURE' },
      }),
    );
    expect(atBase.flowC).toBe(42);
    expect(atBase.action).toBe('HOLD');

    const aboveBase = decideProposal(
      baseInput({
        previousFlowC: 45,
        modelFlowC: 42,
        night: { floorC: null, basis: 'NO_FAILURE' },
      }),
    );
    expect(aboveBase.flowC).toBe(44);
  });

  it('promjena unutar dwell-a se ne izvršava', () => {
    const decision = decideProposal(
      baseInput({
        daysSinceChange: DWELL_DAYS - 1,
        night: { floorC: null, basis: 'NO_FAILURE' },
      }),
    );
    expect(decision.reasons).toEqual(['DWELL']);
    expect(decision.flowC).toBe(45);
  });

  it('koraci su fiksni, pa deadband iz `17` §8.2 ne može ni da se aktivira', () => {
    // Svaka promjena koju kontroler predlaže je 1,0 K (dolje) ili 1,5 K (gore),
    // dakle uvijek iznad 0,5 K. Ovo nije test pravila nego tvrdnja o koracima.
    expect(STEP_DOWN_K).toBeGreaterThan(0.5);
    expect(STEP_UP_K).toBeGreaterThan(0.5);
  });
});

describe('decideProposal — tvrde granice imaju zadnju riječ', () => {
  it('noćni minimum podiže odluku iznad odluke kontrolera', () => {
    const decision = decideProposal(
      baseInput({
        night: { floorC: 47, basis: 'RAISED_FROM_FAILURE' },
        outcome: comfortable({ overshootC: 0, undershootC: 0 }),
      }),
    );
    // Kontroler bi spustio na 44, ali noćni minimum je 47.
    expect(decision.flowC).toBe(47);
    expect(decision.action).toBe('RAISE');
    expect(decision.bounds).toContain('NIGHT_FLOOR');
  });

  it('nikad iznad 55 ni ispod 30', () => {
    const high = decideProposal(
      baseInput({
        previousFlowC: 54,
        modelFlowC: 60,
        night: { floorC: 60, basis: 'AT_LIMIT' },
        outcome: comfortable({ undershootC: 3 }),
      }),
    );
    expect(high.flowC).toBe(55);

    const low = decideProposal(
      baseInput({
        previousFlowC: 31,
        modelFlowC: 20,
        night: { floorC: null, basis: 'NO_FAILURE' },
        daysSinceChange: 10,
      }),
    );
    expect(low.flowC).toBe(30);
  });

  it('maksimum sistema (npr. podno grijanje) ograničava odluku', () => {
    const decision = decideProposal(
      baseInput({
        previousFlowC: 40,
        modelFlowC: 50,
        maxFlowC: 45,
        night: { floorC: null, basis: 'NO_FAILURE' },
        daysSinceChange: 10,
      }),
    );
    expect(decision.flowC).toBeLessThanOrEqual(45);
  });

  it('noćni minimum pobjeduje dnevnu granicu i kad to znači više od 2 K', () => {
    const decision = decideProposal(
      baseInput({
        previousFlowC: 40,
        modelFlowC: 52,
        night: { floorC: 50, basis: 'RAISED_FROM_FAILURE' },
        outcome: comfortable({ undershootC: 2.5 }),
      }),
    );
    // 40 + 1,5 = 41,5; minimum 50 se ne može postići bez kršenja dnevne
    // granice, a minimum pobjeduje — odluka je 50 samo ako granica dopusti.
    expect(decision.flowC).toBeGreaterThanOrEqual(50);
  });
});
