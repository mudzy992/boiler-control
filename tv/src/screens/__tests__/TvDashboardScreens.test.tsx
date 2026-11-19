import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import {
  GasScreen,
  HomeScreen,
  type TvDashboardData,
} from '../TvDashboardScreens';

const baseData: TvDashboardData = {
  dashboard: null,
  analysis: null,
  readings: [],
  health: null,
  heatingStatus: [],
  heatingSummary: null,
  heatingEvents: [],
  devices: [],
  programs: [],
  profile: null,
  homeProfile: null,
  notifications: [],
  updatedAt: null,
  loading: false,
  error: null,
};

describe('TV read-only dashboard screens', () => {
  it('ne izmišlja vrijednosti kada API nije vratio podatke', async () => {
    const view = await render(<HomeScreen data={baseData} view="overview" onView={jest.fn()} />);

    expect(view.getAllByText('—').length).toBeGreaterThanOrEqual(4);
    expect(view.queryByText('8.6')).toBeNull();
    expect(view.queryByText('21.4')).toBeNull();
    expect(view.queryByText('128')).toBeNull();
  });

  it('zadržava podnavigaciju Početna/Analitika/Zdravlje dostupnom iz svakog prikaza', async () => {
    const onView = jest.fn();
    const view = await render(<HomeScreen data={baseData} view="analytics" onView={onView} />);

    expect(view.getByRole('button', { name: 'Pregled' })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Zdravlje' })).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Zdravlje' }));
    expect(onView).toHaveBeenCalledWith('health');
  });

  it('prikazuje očitanja iz API-ja i prebacuje prikaz plina bez upisa', async () => {
    const onView = jest.fn();
    const data = {
      ...baseData,
      readings: [{ id: 7, readingDate: '2026-11-01T00:00:00.000Z', counterValue: 1842.6, consumption: 42.3 }],
    };
    const view = await render(<GasScreen data={data} view="readings" onView={onView} />);

    expect(view.getByText('Stanje brojila 1842.60 m³')).toBeTruthy();
    expect(view.getByText('42.30 m³')).toBeTruthy();
    fireEvent.press(view.getByText('Analiza'));
    expect(onView).toHaveBeenCalledWith('analysis');
  });
});
