import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RecommendationBreakdown } from '../../features/heating/components/RecommendationBreakdown';
import type { RecommendationBreakdownData } from '../../features/heating/components/RecommendationBreakdown';

const breakdown: RecommendationBreakdownData = {
  version: 1,
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

    expect(screen.getByText('Razlog preporuke')).toBeInTheDocument();
    expect(screen.getByText('51.2°C')).toBeInTheDocument();
    expect(screen.getByText('-2.5°C')).toBeInTheDocument();
    expect(screen.getByText('+0.25°C')).toBeInTheDocument();
    expect(screen.getByText('-0.50°C')).toBeInTheDocument();
    expect(screen.getByText('+0.13°C')).toBeInTheDocument();
    expect(screen.getByText('51.1°C')).toBeInTheDocument();
    expect(screen.getByText('72%')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('28 min')).toBeInTheDocument();
    expect(screen.getByText(/savjetodavna/i)).toBeInTheDocument();
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
    expect(screen.queryByText('Razlog preporuke')).not.toBeInTheDocument();
  });

  it('null optional polja ne prikazuju redove za uzorke/vrijeme', () => {
    render(
      <RecommendationBreakdown
        breakdown={{ ...breakdown, samples: null, expectedHeatTimeMin: null }}
      />,
    );

    expect(screen.queryByText('Broj uzoraka')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Očekivano vrijeme zagrijavanja'),
    ).not.toBeInTheDocument();
  });
});
