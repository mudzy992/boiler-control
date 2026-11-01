import {
  HeatingType,
  InsulationType,
  SeasonMode,
  WindowType,
} from '../../../constants/homeProfileEnums';
import { homeProfileToForm } from '../homeProfileForm';

/** MO2-20: null location becomes empty field; 0/false are not defaulted. */
describe('MO2-20 homeProfileToForm', () => {
  it('maps null location to an empty field, not a placeholder', () => {
    const form = homeProfileToForm({ location: null });
    expect(form.location).toBe('');
  });

  it('preserves numberOfResidents=0 and hasFloorHeating=false', () => {
    const form = homeProfileToForm({
      numberOfResidents: 0,
      hasFloorHeating: false,
    });
    expect(form.numberOfResidents).toBe(0);
    expect(form.hasFloorHeating).toBe(false);
  });

  it('preserves empty strings and zero numeric values', () => {
    const form = homeProfileToForm({
      homeName: '',
      boilerModel: '',
      floorArea: 0,
      ceilingHeight: 0,
      insulationThickness: 0,
      targetMorningTemp: 0,
      targetDayTemp: 0,
      targetNightTemp: 0,
    });
    expect(form.homeName).toBe('');
    expect(form.boilerModel).toBe('');
    expect(form.floorArea).toBe(0);
    expect(form.ceilingHeight).toBe(0);
    expect(form.insulationThickness).toBe(0);
    expect(form.targetMorningTemp).toBe(0);
    expect(form.targetDayTemp).toBe(0);
    expect(form.targetNightTemp).toBe(0);
  });

  it('uses defaults only for null/undefined fields', () => {
    const form = homeProfileToForm({
      homeName: null,
      location: undefined,
      floorArea: null,
      insulationType: null,
      windowType: undefined,
      heatingType: null,
      seasonMode: undefined,
    });
    expect(form.homeName).toBe('');
    expect(form.location).toBe('');
    expect(form.floorArea).toBe(100);
    expect(form.insulationType).toBe(InsulationType.STANDARD);
    expect(form.windowType).toBe(WindowType.DOUBLE_GLAZED);
    expect(form.heatingType).toBe(HeatingType.RADIATOR);
    expect(form.seasonMode).toBe(SeasonMode.WINTER);
  });

  it('falls back from homeName to legacy name when homeName is null', () => {
    const form = homeProfileToForm({ homeName: null, name: 'Legacy Home' });
    expect(form.homeName).toBe('Legacy Home');
  });
});
