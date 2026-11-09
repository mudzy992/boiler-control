import { render } from '@testing-library/react-native';
import { RecommendationBreakdown } from '../RecommendationBreakdown';
import type { RecommendationBreakdown as BreakdownData } from '../../types/Dashboard';

jest.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const fullBreakdown: BreakdownData = {
  version: 1,
  mode: 'FULL',
  intervalKey: 'weekday_morning',
  baseCurveTemp: 51.123456,
  weightedExternalTemp: -2.5,
  appliedOffsets: { home: 0.25, interval: -0.5, events: 0.125 },
  finalTemp: 50.998456,
  confidence: 0.72,
  samples: 8,
  expectedHeatTimeMin: 27.5,
};

/** MO2-15: the card must follow the backend snapshot, not a local formula. */
describe('MO2-15 RecommendationBreakdown', () => {
  it('renders the backend breakdown values and disclaimer', async () => {
    const { getByText, getByTestId } = await render(
      <RecommendationBreakdown breakdown={fullBreakdown} />
    );

    expect(getByTestId('recommendation-breakdown')).toBeTruthy();
    expect(getByText('recommendation.disclaimer')).toBeTruthy();
    expect(getByText('51.1°C')).toBeTruthy();
    expect(getByText('-2.5°C')).toBeTruthy();
    expect(getByText('+0.25°C')).toBeTruthy();
    expect(getByText('-0.50°C')).toBeTruthy();
    expect(getByText('+0.13°C')).toBeTruthy();
    expect(getByText('51.0°C')).toBeTruthy();
    expect(getByText('72%')).toBeTruthy();
    expect(getByText('8')).toBeTruthy();
    expect(getByText('28 min')).toBeTruthy();
  });

  it('omits optional rows when samples and expected heat time are null', async () => {
    const { queryByText } = await render(
      <RecommendationBreakdown
        breakdown={{ ...fullBreakdown, samples: null, expectedHeatTimeMin: null }}
      />
    );

    expect(queryByText('recommendation.samples')).toBeNull();
    expect(queryByText('recommendation.expectedHeatTime')).toBeNull();
  });

  /**
   * `36`: red „Režim … · Interval …" je uklonjen sa dna kartice. Isti podatak
   * stoji uz traku termostata na Početnoj, gdje je kontekst odluke; na dnu
   * ekrana je bio duplikat koji je korisnik zaokružio kao suvišan.
   */
  it('ne ispisuje režim i interval — taj kontekst nosi kartica termostata', async () => {
    const { queryByText } = await render(
      <RecommendationBreakdown breakdown={fullBreakdown} />
    );

    expect(queryByText(/recommendation\.mode: FULL/)).toBeNull();
    expect(queryByText(/recommendation\.interval: weekday_morning/)).toBeNull();
  });

  /**
   * `36`: stariji zapisi nemaju `appliedOffsets`. Kartica je na takvom redu
   * rušila cijelu Početnu (`Cannot read properties of undefined (reading 'home')`),
   * pa se offseti sada izostavljaju — ostalo (rezultat, pouzdanost) ostaje.
   */
  it('preživi zapis bez `appliedOffsets` i izostavi redove offseta', async () => {
    const withoutOffsets = {
      ...fullBreakdown,
      appliedOffsets: undefined,
    } as unknown as BreakdownData;

    const { queryByText, getByText } = await render(
      <RecommendationBreakdown breakdown={withoutOffsets} />
    );

    expect(queryByText('recommendation.homeOffset')).toBeNull();
    expect(queryByText('recommendation.intervalOffset')).toBeNull();
    expect(queryByText('recommendation.eventsOffset')).toBeNull();
    expect(getByText('51.0°C')).toBeTruthy();
  });

  it('renders nothing without a backend breakdown', async () => {
    const { toJSON } = await render(<RecommendationBreakdown breakdown={null} />);
    expect(toJSON()).toBeNull();
  });

  it('updates the display when the backend response changes', async () => {
    const { getByText, rerender } = await render(
      <RecommendationBreakdown breakdown={fullBreakdown} />
    );
    expect(getByText('51.0°C')).toBeTruthy();

    await rerender(
      <RecommendationBreakdown
        breakdown={{ ...fullBreakdown, finalTemp: 49.24, confidence: 0.5 }}
      />
    );
    expect(getByText('49.2°C')).toBeTruthy();
    expect(getByText('50%')).toBeTruthy();
  });
});
