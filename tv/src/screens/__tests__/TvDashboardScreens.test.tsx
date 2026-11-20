import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import {
  GasScreen,
  HomeScreen,
  TvMainNavigation,
  type TvDashboardData,
} from '../TvDashboardScreens';
import { colors } from '../../theme';

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

  it('zamjenjuje ravan graf temperature jasnom, punom trakom statusa grijanja', async () => {
    const inactive = await render(<HomeScreen
      data={{ ...baseData, heatingStatus: [{ isHeatingNow: false }] }}
      view="overview"
      onView={jest.fn()}
    />);

    expect(inactive.getByText('NEAKTIVNO')).toBeTruthy();
    expect(inactive.getByText('Trenutno nema zagrijavanja')).toBeTruthy();
    expect(inactive.queryByText('Temperatura doma')).toBeNull();
    expect(inactive.queryByText('Ciklusi u periodu')).toBeNull();
    await inactive.unmount();

    const active = await render(<HomeScreen
      data={{ ...baseData, heatingStatus: [{ isHeatingNow: true }] }}
      view="overview"
      onView={jest.fn()}
    />);
    expect(active.getByText('ZAGRIJAVANJE')).toBeTruthy();
    expect(active.getByText('Grijanje je aktivno')).toBeTruthy();
  });

  it('označava aktivnu stavku glavnog menija samo bojom i donjom linijom', async () => {
    const view = await render(<TvMainNavigation page="home" onChange={jest.fn()} />);
    const tab = view.getByRole('tab', { name: 'Početna' });
    const style = StyleSheet.flatten(tab.props.style);

    expect(tab.props.accessibilityState.selected).toBe(true);
    expect(style.backgroundColor).toBe('transparent');
    expect(style.borderBottomColor).toBe(colors.accent);
    expect(style.borderRadius).toBe(0);
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
