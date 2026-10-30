import { describe, it, expect } from 'vitest';
import {
  MIN_CURRENT_FLOW_TEMP,
  MAX_CURRENT_FLOW_TEMP,
  flowTempRangeMessage,
  isWithinFlowTempRange,
} from '../boilerLimits';
// `?raw` daje sadržaj backend DTO-a kao string, pa test može provjeriti da se
// klijentske granice i dalje poklapaju sa serverom.
import setTempDto from '../../../../backend/src/modules/Boiler/dto/set-current-temp.dto.ts?raw';

/**
 * FE2-14 (FE-010): granice temperature polaznog voda.
 *
 * Ovi testovi zaključavaju da klijentske granice ostanu u paritetu s backend
 * `SetCurrentTempDto`. Ako neko promijeni granicu na serveru a ne ovdje (ili
 * obrnuto), web bi ili propuštao zahtjeve koje server odbija, ili blokirao one
 * koje server prihvata.
 *
 * NAPOMENA — health score i pragovi upozorenja (20/3/1.5/90/15) su FE2-14
 * preseljeni u backend (`backend/src/common/heating-health.ts`) i tamo
 * testirani (`heating-health.spec.ts`, 23 testa). Frontend ih više NE računa,
 * pa ovdje namjerno nema njihovih testova — imati ih na oba mjesta bi značilo
 * vratiti duplikaciju koju FE2-14 uklanja.
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
    const minMatch = /@Min\((\d+)\)/.exec(setTempDto);
    const maxMatch = /@Max\((\d+)\)/.exec(setTempDto);

    expect(minMatch).not.toBeNull();
    expect(maxMatch).not.toBeNull();
    expect(Number(minMatch?.[1])).toBe(MIN_CURRENT_FLOW_TEMP);
    expect(Number(maxMatch?.[1])).toBe(MAX_CURRENT_FLOW_TEMP);
  });
});
