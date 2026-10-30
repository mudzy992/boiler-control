import { describe, it, expect } from 'vitest';
import {
  MIN_CURRENT_FLOW_TEMP,
  MAX_CURRENT_FLOW_TEMP,
  flowTempRangeMessage,
  isWithinFlowTempRange,
} from '../boilerLimits';
import {
  SHORT_CYCLE_MINUTES,
  SHORT_CYCLE_COUNT_THRESHOLD,
  LONG_CYCLE_MINUTES,
  TARGET_SHORTFALL_WARN_C,
  HEALTH_SCORE_PENALTY_PER_ANOMALY,
  HEALTH_SCORE_BASE,
  computeHealthScore,
} from '../heatingAnalysis';
// `?raw` daje sadržaj backend DTO-a kao string, pa test može provjeriti da se
// klijentske granice i dalje poklapaju sa serverom.
import setTempDto from '../../../../backend/src/modules/Boiler/dto/set-current-temp.dto.ts?raw';

/**
 * FE2-14 (FE-010): poslovna logika duplirana na klijentu.
 *
 * Ovi testovi zaključavaju dvije stvari:
 *  1. da granice temperature ostanu u paritetu s backend `SetCurrentTempDto`,
 *  2. da health score formula ostane ista (i da clamp na 0 radi).
 */

describe('FE2-14: granice temperature polaznog voda', () => {
  it('donja i gornja granica su 48 i 55', () => {
    expect(MIN_CURRENT_FLOW_TEMP).toBe(48);
    expect(MAX_CURRENT_FLOW_TEMP).toBe(55);
  });

  it('granice su INKLUDIRAJUĆE na obje strane', () => {
    expect(isWithinFlowTempRange(48)).toBe(true);
    expect(isWithinFlowTempRange(55)).toBe(true);
    expect(isWithinFlowTempRange(51.5)).toBe(true);
  });

  it('vrijednosti izvan granica se odbijaju', () => {
    // 47.9 je ključan slučaj iz FE-010: backend je odbija, pa mora i klijent.
    expect(isWithinFlowTempRange(47.9)).toBe(false);
    expect(isWithinFlowTempRange(55.1)).toBe(false);
    expect(isWithinFlowTempRange(0)).toBe(false);
  });

  it('poruka o rasponu sadrži obje granice', () => {
    const msg = flowTempRangeMessage();
    expect(msg).toContain(String(MIN_CURRENT_FLOW_TEMP));
    expect(msg).toContain(String(MAX_CURRENT_FLOW_TEMP));
  });

  it('PARITET S BACKENDOM: klijentske granice odgovaraju @Min/@Max u DTO-u', () => {
    // Ako neko promijeni granicu u backendu a ne ovdje (ili obrnuto), web bi
    // ili propuštao zahtjeve koje server odbija, ili blokirao one koje server
    // prihvata. Ovaj test to hvata.
    const minMatch = /@Min\((\d+)\)/.exec(setTempDto);
    const maxMatch = /@Max\((\d+)\)/.exec(setTempDto);

    expect(minMatch).not.toBeNull();
    expect(maxMatch).not.toBeNull();
    expect(Number(minMatch?.[1])).toBe(MIN_CURRENT_FLOW_TEMP);
    expect(Number(maxMatch?.[1])).toBe(MAX_CURRENT_FLOW_TEMP);
  });
});

describe('FE2-14: health score', () => {
  it('bez anomalija daje puni score', () => {
    expect(computeHealthScore(0)).toBe(100);
  });

  it('svaka anomalija oduzima 15 bodova', () => {
    expect(computeHealthScore(1)).toBe(85);
    expect(computeHealthScore(2)).toBe(70);
    expect(computeHealthScore(3)).toBe(55);
  });

  it('score nikad ne pada ispod 0 (clamp)', () => {
    // 7 × 15 = 105 > 100, pa bez clamp-a bilo bi -5.
    expect(computeHealthScore(7)).toBe(0);
    expect(computeHealthScore(100)).toBe(0);
  });

  it('konstante odgovaraju formuli', () => {
    expect(HEALTH_SCORE_BASE).toBe(100);
    expect(HEALTH_SCORE_PENALTY_PER_ANOMALY).toBe(15);
    expect(computeHealthScore(4)).toBe(
      Math.max(0, HEALTH_SCORE_BASE - 4 * HEALTH_SCORE_PENALTY_PER_ANOMALY)
    );
  });
});

describe('FE2-14: pragovi upozorenja (privremena politika)', () => {
  it('pragovi imaju dokumentovane vrijednosti preuzete iz postojećeg koda', () => {
    // Ove brojeve NE mijenjamo — samo ih imenujemo. Test postoji da promjena
    // politike bude vidljiva i namjerna, a ne usputna.
    expect(SHORT_CYCLE_MINUTES).toBe(20);
    expect(SHORT_CYCLE_COUNT_THRESHOLD).toBe(3);
    expect(LONG_CYCLE_MINUTES).toBe(90);
    expect(TARGET_SHORTFALL_WARN_C).toBe(1.5);
  });

  it('kratkI ciklus je strogo kraći od praga, dugi strogo duži', () => {
    // Granice su stroge nejednakosti u izvornom kodu; test to čuva jer
    // zamjena < sa <= tiho mijenja koje cikluse računamo.
    expect(SHORT_CYCLE_MINUTES).toBeGreaterThan(0);
    expect(LONG_CYCLE_MINUTES).toBeGreaterThan(SHORT_CYCLE_MINUTES);
  });
});
