import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { RecommendationBreakdown } from '../../features/heating/components/RecommendationBreakdown';
import type { RecommendationBreakdownData } from '../../features/heating/components/RecommendationBreakdown';
import '../../locales/config';

beforeAll(async () => {
  await i18n.changeLanguage('en-US');
});

const breakdown: RecommendationBreakdownData = {
  version: 2,
  engine: 'curve',
  model: null,
  mode: 'FULL',
  intervalKey: 'weekday_morning',
  baseCurveTemp: 51.2,
  weightedExternalTemp: -2.5,
  appliedOffsets: {
    home: 0.25,
    interval: -0.5,
    events: 0.125,
  },
  finalTemp: 51.1,
  confidence: 0.72,
  samples: 8,
  expectedHeatTimeMin: 27.5,
};

describe('FE2-10 RecommendationBreakdown', () => {
  it('prikazuje backend breakdown bez klijentske rekonstrukcije', () => {
    render(<RecommendationBreakdown breakdown={breakdown} />);

    expect(screen.getByText('Recommendation breakdown')).toBeInTheDocument();
    expect(screen.getByText('51.2°C')).toBeInTheDocument();
    expect(screen.getByText('-2.5°C')).toBeInTheDocument();
    expect(screen.getByText('+0.25°C')).toBeInTheDocument();
    expect(screen.getByText('-0.50°C')).toBeInTheDocument();
    expect(screen.getByText('+0.13°C')).toBeInTheDocument();
    expect(screen.getByText('51.1°C')).toBeInTheDocument();
    expect(screen.getByText('72%')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('28 min')).toBeInTheDocument();
    expect(screen.getByText(/advisory/i)).toBeInTheDocument();
  });

  it('promjena backend odgovora mijenja prikazane vrijednosti', () => {
    const { rerender } = render(
      <RecommendationBreakdown breakdown={breakdown} />,
    );
    expect(screen.getByText('51.1°C')).toBeInTheDocument();

    rerender(
      <RecommendationBreakdown
        breakdown={{ ...breakdown, finalTemp: 49.9, confidence: 0.4 }}
      />,
    );

    expect(screen.getByText('49.9°C')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(screen.queryByText('51.1°C')).not.toBeInTheDocument();
  });

  it('bez breakdowna ne prikazuje karticu niti pogađa formulu', () => {
    const { container } = render(<RecommendationBreakdown breakdown={null} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('Recommendation breakdown')).not.toBeInTheDocument();
  });

  it('null optional polja ne prikazuju redove za uzorke/vrijeme', () => {
    render(
      <RecommendationBreakdown
        breakdown={{ ...breakdown, samples: null, expectedHeatTimeMin: null }}
      />,
    );

    expect(screen.queryByText('Number of samples')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Expected heat-up time'),
    ).not.toBeInTheDocument();
  });

  /**
   * F4.4 — najvažniji test u ovoj izmjeni.
   *
   * Modelski put nema krivu. Ako ekran prikaže „0.0°C", korisnik to čita kao
   * kvar grijanja, a ne kao „ovaj put preporuku daje model". Zato se traži
   * odsustvo nule, a ne prisustvo crtice: formatiranje se može promijeniti,
   * ali izmišljena nula ne smije nikad.
   */
  it('modelski put ne prikazuje krivu i nikad izmišljenu nulu', () => {
    render(
      <RecommendationBreakdown
        breakdown={{
          ...breakdown,
          engine: 'model',
          baseCurveTemp: null,
          weightedExternalTemp: null,
          appliedOffsets: null,
          model: {
            slopeS: 0.94,
            slopeSource: 'CI_HIGH',
            internalGainC: 1.02,
            dayGainC: 0,
            outdoorRefC: -3.4,
            outdoorRefSource: 'NIGHT_DAY_BLEND',
            equilibriumFlowC: 44.04,
            reasons: [],
          },
        }}
      />,
    );

    // Redovi krive nestaju — nema ih sa crticom, nema ih uopšte.
    expect(screen.queryByText('Base curve')).toBeNull();
    expect(screen.queryByText('Weighted external temperature')).toBeNull();
    expect(screen.queryByText('Home profile correction')).toBeNull();

    // Nema nijedne izmišljene nule.
    expect(screen.queryByText('0.0°C')).toBeNull();
    expect(screen.queryByText('+0.00°C')).toBeNull();

    // A ono što je broj zaista dalo — jeste tu.
    expect(screen.getByText('44.0°C')).toBeTruthy();
    expect(screen.getByText(/0.94/)).toBeTruthy();
  });

  it('stari red bez engine (null) prikazuje krivu kao i prije', () => {
    // Redovi zapisani prije F4.3 nemaju `engine`. Ne smiju nestati sa ekrana:
    // `null` znači „ne zna se koji motor", ne „model".
    render(<RecommendationBreakdown breakdown={{ ...breakdown, engine: null }} />);
    expect(screen.getByText('Base curve')).toBeTruthy();
    expect(screen.getByText('51.2°C')).toBeTruthy();
  });
});
