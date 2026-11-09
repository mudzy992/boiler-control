import {
  EXPLORATION_AMPLITUDE_K,
  EXPLORATION_OVERSHOOT_K,
  EXPLORATION_REQUIRED_DAYS,
  EXPLORATION_WINDOW_DAYS,
  explorationFor,
  type ExplorationInput,
} from '../exploration';

/**
 * Istraživanje (`17` §8.5). Testira se **kad nije dozvoljeno**, jer je to ono
 * što štiti komfor: svaki blok ima svoj razlog, a red provjera je dio odluke
 * (hladna noć poništava rezervu na dnevnom prebačaju).
 */

function input(overrides: Partial<ExplorationInput> = {}): ExplorationInput {
  return {
    recentOvershootC: [1.6, 1.8, 0.2, 1.5, 0.1],
    nightMinC: 3,
    exploredYesterday: false,
    hasPreviousFlow: true,
    ...overrides,
  };
}

describe('explorationFor — kada je dozvoljeno', () => {
  it('3 prebačaja > 1 K u 5 dana daje istraživanje prema dolje', () => {
    expect(explorationFor(input())).toEqual({
      direction: 'LOWER',
      block: null,
    });
  });

  it('prebačaj tačno 1 K nije rezerva — granica je oštra', () => {
    expect(
      explorationFor(input({ recentOvershootC: [1, 1, 1, 1, 1] })).block,
    ).toBe('NO_RESERVE');
  });

  it('gleda samo zadnjih 5 dana', () => {
    // Tri stara prebačaja i dva nova bez rezerve: ukupno 3, ali ne u prozoru.
    const recentOvershootC = [2, 2, 2, 0, 0];
    expect(explorationFor(input({ recentOvershootC })).direction).toBe('LOWER');
    expect(
      explorationFor(input({ recentOvershootC: [2, 2, 2, 2, 0, 0, 0] })).block,
    ).toBe('NO_RESERVE');
  });

  it('dani bez mjerenja se preskaču, ne broje kao rezerva', () => {
    expect(
      explorationFor(input({ recentOvershootC: [null, 1.5, null, 1.5, null] }))
        .block,
    ).toBe('NO_RESERVE');
    expect(
      explorationFor(input({ recentOvershootC: [null, 1.5, 1.5, null, 1.5, 1.5] }))
        .direction,
    ).toBe('LOWER');
  });
});

describe('explorationFor — kada nije dozvoljeno', () => {
  it('bez prethodne polazne nema oko čega varirati', () => {
    expect(explorationFor(input({ hasPreviousFlow: false }))).toEqual({
      direction: null,
      block: 'NO_PREVIOUS',
    });
  });

  it('bez prognoze noći ne istražujemo', () => {
    expect(explorationFor(input({ nightMinC: null })).block).toBe('NO_FORECAST');
  });

  it('hladna noć poništava rezervu sa dana', () => {
    expect(explorationFor(input({ nightMinC: -0.1 })).block).toBe('COLD_NIGHT');
    expect(explorationFor(input({ nightMinC: 0 })).direction).toBe('LOWER');
  });

  it('nikad dva dana zaredom', () => {
    expect(explorationFor(input({ exploredYesterday: true }))).toEqual({
      direction: null,
      block: 'YESTERDAY',
    });
  });

  it('bez rezerve nema istraživanja', () => {
    expect(
      explorationFor(input({ recentOvershootC: [0.2, 0.1, 0.4, 0.3, 0.9] })).block,
    ).toBe('NO_RESERVE');
    expect(explorationFor(input({ recentOvershootC: [] })).block).toBe(
      'NO_RESERVE',
    );
  });

  it('red provjera: sigurnost prije svrhe, svrha prije dokaza', () => {
    // Sve troje ne valja — mora pobijediti sigurnost.
    expect(
      explorationFor(
        input({
          nightMinC: -5,
          exploredYesterday: true,
          recentOvershootC: [],
        }),
      ).block,
    ).toBe('COLD_NIGHT');
  });
});

describe('konstante iz `17` §8.5', () => {
  it('prag, broj dana, prozor i amplituda su ono što dokument kaže', () => {
    expect(EXPLORATION_OVERSHOOT_K).toBe(1);
    expect(EXPLORATION_REQUIRED_DAYS).toBe(3);
    expect(EXPLORATION_WINDOW_DAYS).toBe(5);
    expect(EXPLORATION_AMPLITUDE_K).toBe(1);
  });
});
