import { act, render } from '@testing-library/react-native';
import { AnimatedSplash } from '../AnimatedSplash';

jest.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

/**
 * `36`: splash je bio samo slika na bijelom, pa je izgledao kao zamrznut ekran.
 * Sada poslije 400 ms pokaže indikator i tekst — dovoljno da korisnik vidi da se
 * nešto dešava, a ne odmah (indikator u prvom kadru izgleda kao da je zapelo).
 */
describe('AnimatedSplash — feedback dok se aplikacija priprema (`36`)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('ne pokazuje indikator u prvom kadru', async () => {
    const { queryByTestId } = await render(
      <AnimatedSplash visible onFinished={() => undefined} />
    );

    expect(queryByTestId('splash-progress')).toBeNull();
  });

  it('pokaže indikator i tekst poslije 400 ms', async () => {
    const { queryByTestId, getByText } = await render(
      <AnimatedSplash visible onFinished={() => undefined} />
    );

    await act(async () => {
      jest.advanceTimersByTime(450);
    });

    expect(queryByTestId('splash-progress')).toBeTruthy();
    expect(getByText('common.splashPreparing')).toBeTruthy();
  });

  it('sakrije indikator kad splash više nije vidljiv', async () => {
    const { queryByTestId, rerender } = await render(
      <AnimatedSplash visible onFinished={() => undefined} />
    );

    await act(async () => {
      jest.advanceTimersByTime(450);
    });
    expect(queryByTestId('splash-progress')).toBeTruthy();

    await rerender(<AnimatedSplash visible={false} onFinished={() => undefined} />);
    expect(queryByTestId('splash-progress')).toBeNull();
  });
});
