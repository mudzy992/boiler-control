import { decideDailyProposal, heatTimeFloorFor } from '../proposal-decision';
import { decideProposal } from '../proposal-controller';
import { equilibriumFlow } from '../equilibrium-flow';
import { explorationFor } from '../exploration';
import {
  findBoilerFamily,
  isFlowAdviceAllowed,
} from '../../BoilerCatalog/boiler-catalog';

/**
 * F4.2 — zajednička odluka mora dati **isti** broj kao dosadašnji put.
 *
 * Izdvajanje je premještanje, ne prepisivanje. Ako bi se pri tom promijenio
 * broj, shadow bi odjednom pisao drugu vrijednost — a F3.7 mjeri razliku
 * između shadow-a i predloga, pa bi ta razlika bila artefakt refaktora, a ne
 * nalaz o formuli.
 *
 * Test zato ne provjerava „da li funkcija radi", nego **poklapanje sa putem
 * koji je postojao prije izdvajanja**. Isti ulazi se provode kroz oba načina i
 * porede broj po broj.
 */
describe('F4.2 proposal-decision', () => {
  // `OutcomeSignals` traži brojeve za podbačaj/prebačaj (`0` = nema signala,
  // što je i tačno: nije izmjereno ništa preko tolerancije).
  const outcome: Parameters<typeof decideProposal>[0]['outcome'] = {
    undershootC: 0,
    overshootC: 0,
    nightUndershootC: null,
    medianCycleMin: null,
  };

  const baseInput: Omit<Parameters<typeof decideDailyProposal>[0], 'model'> = {
    homeProfileId: 1,
    localDate: '2026-11-12',
    now: new Date('2026-11-12T06:00:00Z'),
    targetRoomC: 22,
    nightMinC: -3,
    dayMaxC: 4,
    maxFlowC: 55,
    boilerCatalogId: null,
    nightFloor: { floorC: null, basis: 'NO_FORECAST' as const },
    shortCycleFloorC: null,
    daysSinceChange: 3,
    previousFlowC: 46,
    outcome,
    heatTimeFloorC: null,
    recentOvershootC: [],
    exploredYesterday: false,
    dayGainInProposal: false,
  };

  const model: NonNullable<Parameters<typeof decideDailyProposal>[0]['model']> =
    {
      state: 'TRACKING',
      slopeS: 0.9,
      slopeCiHigh: 1.1,
      days: 40,
      internalGainC: 1,
      uDayC: 0.5,
      shortCycleFloorC: null,
      shortCycleFloorAt: null,
    };

  /**
   * Put koji je postojao prije F4.2 — napisan ovdje **doslovno** onako kako je
   * stajao u `ProposalShadowService.evaluate()`. Ako se izdvojena funkcija
   * raziđe s ovim, test pada i to je jedini način da se refaktor ne podmetne
   * kao promjena formule.
   */
  function legacyPath(
    input: typeof baseInput & { model: typeof model | null },
  ) {
    const equilibrium = equilibriumFlow({
      targetRoomC: input.targetRoomC,
      nightMinC: input.nightMinC,
      dayMaxC: input.dayMaxC,
      slopeS: input.model?.slopeS ?? null,
      slopeCiHigh: input.model?.slopeCiHigh ?? null,
      modelDays: input.model?.days ?? null,
      internalGainC: input.model?.internalGainC ?? null,
      uDayC: input.dayGainInProposal ? (input.model?.uDayC ?? null) : null,
    });
    const family = findBoilerFamily(input.boilerCatalogId);
    const exploration = explorationFor({
      recentOvershootC: input.recentOvershootC,
      nightMinC: input.nightMinC,
      exploredYesterday: input.exploredYesterday,
      hasPreviousFlow: input.previousFlowC != null,
    });
    const decision = decideProposal({
      modelFlowC: equilibrium.flowC,
      previousFlowC: input.previousFlowC,
      daysSinceChange: input.daysSinceChange,
      outcome: input.outcome,
      night: { floorC: input.nightFloor.floorC, basis: input.nightFloor.basis },
      shortCycleFloorC: input.shortCycleFloorC,
      maxFlowC: 55,
      flowAdviceAllowed: isFlowAdviceAllowed(family),
      modelState: input.model?.state ?? 'COLD_START',
      exploration: exploration.direction,
      heatTimeFloorC: input.heatTimeFloorC,
    });
    return { equilibrium, decision };
  }

  it('isti ulaz daje isti broj kao put prije izdvajanja', () => {
    const input = { ...baseInput, model };
    const legacy = legacyPath(input);
    const current = decideDailyProposal(input);

    expect(current.decision.flowC).toBe(legacy.decision.flowC);
    expect(current.decision.action).toBe(legacy.decision.action);
    expect(current.equilibrium.flowC).toBe(legacy.equilibrium.flowC);
  });

  it('poklapa se i bez modela (COLD_START)', () => {
    const input = { ...baseInput, model: null };
    const legacy = legacyPath(input);
    const current = decideDailyProposal(input);

    expect(current.decision.flowC).toBe(legacy.decision.flowC);
    expect(current.decision.action).toBe(legacy.decision.action);
  });

  it('poklapa se kad nema noćne prognoze', () => {
    const input = {
      ...baseInput,
      model,
      nightMinC: null,
      nightFloor: { floorC: null, basis: 'NO_FORECAST' as const },
    };
    const legacy = legacyPath(input);
    const current = decideDailyProposal(input);

    expect(current.decision.flowC).toBe(legacy.decision.flowC);
    expect(current.decision.reasons).toEqual(legacy.decision.reasons);
  });

  it('prekidač u_day ostaje odluka vlasnika, ne skrivena konstanta', () => {
    // Servis predaje `DAY_GAIN_IN_PROPOSAL`; izdvojena funkcija ga ne smije
    // preuzeti. Isključen ⇒ `u_day` ne ulazi, i to se vidi u članovima.
    const off = decideDailyProposal({
      ...baseInput,
      model,
      dayGainInProposal: false,
    });
    const on = decideDailyProposal({
      ...baseInput,
      model,
      dayGainInProposal: true,
    });

    // `c` ulazi uvijek (to nije prekidač); razlikuje se samo dnevni dobitak.
    expect(off.equilibrium.internalGainAppliedC).toBeGreaterThan(0);
    // Kad je član isključen, dobitak dana je 0; kad je uključen, nije.
    expect(off.equilibrium.dayGainAppliedC).toBe(0);
    expect(on.equilibrium.dayGainAppliedC).toBeGreaterThan(0);
    // Isključen član ⇒ polazna nije niža nego sa uključenim. `flowC` može biti
    // `null` (nema noćne prognoze), pa se prvo tvrdi da broj postoji — inače
    // poređenje `null <= null` prolazi a ništa ne dokazuje.
    expect(off.equilibrium.flowC).not.toBeNull();
    expect(on.equilibrium.flowC).not.toBeNull();
    expect(on.equilibrium.flowC).toBeLessThanOrEqual(off.equilibrium.flowC);
  });

  it('granica sistema se primjenjuje prije odluke, ne poslije', () => {
    // `maxFlowC` je granica kuće; `ceilingC` smije biti niži zbog kataloga.
    // Da se granica primijeni tek na kraju, kontroler bi dobio broj izvan nje.
    const result = decideDailyProposal({ ...baseInput, model, maxFlowC: 40 });
    expect(result.ceilingC).toBeLessThanOrEqual(40);
    if (result.decision.flowC != null) {
      expect(result.decision.flowC).toBeLessThanOrEqual(40);
    }
  });

  describe('heatTimeFloorFor — pod T_max', () => {
    it('bez izmjerenog dogrijavanja nema poda, ne izmišlja se nula', () => {
      expect(
        heatTimeFloorFor({
          roomC: 20,
          targetRoomC: 22,
          heatRateCPerHour: null,
          measuredFlowC: 45,
          measuredRoomC: 19,
        }),
      ).toBeNull();
    });

    it('sa mjerenjem vraća broj', () => {
      const floor = heatTimeFloorFor({
        roomC: 20,
        targetRoomC: 22,
        heatRateCPerHour: 0.5,
        measuredFlowC: 45,
        measuredRoomC: 19,
      });
      expect(typeof floor).toBe('number');
    });
  });
});
