import { describe, expect, it } from 'vitest';
import i18n from '../config';

/** Resursi kako ih i18n drži; hvatamo ih preko `getResourceBundle`, a ne importom. */
const en = i18n.getResourceBundle('en-US', 'translation');
const bs = i18n.getResourceBundle('bs-BS', 'translation');

/**
 * Etikete temperatura moraju reći **šta** mjere (`32`).
 *
 * U aplikaciji postoje dvije temperature koje se obje zovu „trenutna": vazduh u
 * sobi i polazna voda u kotlu. Obje su brojevi u °C, pa zamjena ne pada ni na
 * tipovima ni u testovima logike — vidi se kao pogrešan broj na ekranu. Ovaj
 * test čuva ono što se vidi: da uz broj polazne vode uvijek piše da je polazna.
 *
 * Nije lingvistička pedanterija: „Stvarna protok. temp." je značilo *flow rate*,
 * a ne *flow temperature*, i korisnik je imao pravo pročitati ga pogrešno.
 */

const flowWords = ['polaz', 'flow'];
const roomWords = ['sob', 'room'];

const mentions = (text: string, words: string[]): boolean =>
  words.some((word) => text.toLowerCase().includes(word));

describe('etikete polazne vode', () => {
  const flowKeys: Array<[string, string, string]> = [
    ['boiler.colSuggested', en.boiler.colSuggested, bs.boiler.colSuggested],
    ['boiler.colActual', en.boiler.colActual, bs.boiler.colActual],
    ['dashboard.suggestedFlow', en.dashboard.suggestedFlow, bs.dashboard.suggestedFlow],
    ['dashboard.actualFlow', en.dashboard.actualFlow, bs.dashboard.actualFlow],
    ['dashboard.boilerStatus', en.dashboard.boilerStatus, bs.dashboard.boilerStatus],
    ['tempDialog.label', en.tempDialog.label, bs.tempDialog.label],
  ];

  it.each(flowKeys)('%s kaže da je polazna voda (en i bs)', (_key, enText, bsText) => {
    expect(mentions(enText, flowWords)).toBe(true);
    expect(mentions(bsText, flowWords)).toBe(true);
  });

  it('nijedna etiketa polazne nije gola „trenutna temperatura"', () => {
    for (const [key, enText, bsText] of flowKeys) {
      expect({ key, text: enText }).not.toEqual({ key, text: 'Current temp' });
      expect({ key, text: bsText }).not.toEqual({ key, text: 'Trenutna temp.' });
    }
  });

  it('akcija upisa polazne ne glasi kao „postavi trenutnu temp."', () => {
    // Dugme mijenja zapis **polazne vode**, ne temperaturu sobe; sobu mijenja
    // termostat, a ne ova aplikacija.
    expect(mentions(en.boiler.setCurrentTemp, flowWords)).toBe(true);
    expect(mentions(bs.boiler.setCurrentTemp, flowWords)).toBe(true);
    expect(mentions(en.dashboard.setCurrentTemp, flowWords)).toBe(true);
    expect(mentions(bs.dashboard.setCurrentTemp, flowWords)).toBe(true);
  });
});

describe('etikete temperature sobe', () => {
  it('soba se zove soba, a ne „current temp"', () => {
    expect(mentions(en.dashboard.currentTemp, roomWords)).toBe(true);
    expect(mentions(bs.dashboard.currentTemp, roomWords)).toBe(true);
    expect(mentions(en.dashboard.targetSubtitle, roomWords)).toBe(true);
    expect(mentions(bs.dashboard.targetSubtitle, roomWords)).toBe(true);
  });
});
