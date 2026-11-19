import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { baseTvLayout, baseTypeScale, colors, fonts, scaleContent, spacing, typeScale, tvLayout } from '../theme';
import { tvLocaleTag } from '../config';
import {
  TvCard, TvCardTitle, TvChip, TvDataRow, TvIcon, TvMetricCard, TvPageHeading,
  TvScrollView, TvSectionTitle, TvStatusPill, TvText, type TvIconName,
} from '../components/TvUI';

export type Page = 'home' | 'heating' | 'gas' | 'settings';
export type HomeView = 'overview' | 'analytics' | 'health';
export type GasView = 'readings' | 'analysis';
export type SettingsView = 'profile' | 'notifications' | 'schedule';
export type AnyRecord = Record<string, unknown>;
export type ThermostatRecord = AnyRecord & {
  roomCurrentTemp?: unknown;
  currentTemperature?: unknown;
  roomTargetTemp?: unknown;
  targetTemperature?: unknown;
  alias?: unknown;
  name?: unknown;
};
export type HomeRecord = AnyRecord & { thermostats?: ThermostatRecord[] | null };
export type SystemRecord = AnyRecord & {
  weather?: AnyRecord | null;
  boiler?: AnyRecord | null;
  recommendation?: AnyRecord | null;
};
export type DashboardRecord = AnyRecord & {
  system?: SystemRecord | null;
  homes?: HomeRecord[] | null;
};

export interface TvDashboardData {
  dashboard: DashboardRecord | null;
  analysis: AnyRecord | null;
  readings: AnyRecord[];
  health: AnyRecord | null;
  heatingStatus: AnyRecord[];
  heatingSummary: AnyRecord | null;
  heatingEvents: AnyRecord[];
  devices: AnyRecord[];
  programs: AnyRecord[];
  profile: AnyRecord | null;
  homeProfile: AnyRecord | null;
  notifications: AnyRecord[];
  updatedAt: number | null;
  loading: boolean;
  error: string | null;
}

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isRecord = (value: unknown): value is AnyRecord => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const asRecords = (value: unknown): AnyRecord[] => Array.isArray(value) ? value.filter(isRecord) : [];
const itemKey = (value: unknown, fallback: number): string | number => typeof value === 'string' || typeof value === 'number' ? value : fallback;
const fmt = (value: unknown, digits = 1) => isNumber(value) ? value.toFixed(digits) : '—';
const pick = (obj: AnyRecord | null | undefined, ...keys: string[]) => {
  for (const key of keys) if (obj?.[key] !== undefined && obj[key] !== null) return obj[key];
  return undefined;
};
const dateText = (value: unknown) => {
  if (!value) return '—';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString(tvLocaleTag(), { day: '2-digit', month: 'short', year: 'numeric' });
};

export function TvMainNavigation({ page, onChange }: { page: Page; onChange: (page: Page) => void }) {
  const [focusedPage, setFocusedPage] = React.useState<Page | null>(null);
  const items: { id: Page; label: string; icon: TvIconName }[] = [
    { id: 'home', label: 'Početna', icon: 'home' },
    { id: 'heating', label: 'Grijanje', icon: 'flame' },
    { id: 'gas', label: 'Plin', icon: 'gas' },
    { id: 'settings', label: 'Postavke', icon: 'settings' },
  ];
  return (
    <View style={styles.nav} accessibilityRole="tablist">
      <View style={styles.navItems}>
        {items.map((item) => {
          const focused = focusedPage === item.id;
          return <Pressable key={item.id} focusable accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{ selected: page === item.id }} onFocus={() => setFocusedPage(item.id)} onBlur={() => setFocusedPage(null)} onPress={() => onChange(item.id)} style={[styles.navItem, page === item.id && styles.navItemActive, focused && styles.navFocused]}><TvIcon name={item.icon} size={21} color={page === item.id ? colors.accent : colors.textDim} /><TvText size="small" style={{ fontFamily: page === item.id ? fonts.sansSemiBold : fonts.sansMedium, color: page === item.id ? colors.accentText : colors.textMuted, letterSpacing: 0.7, textTransform: 'uppercase' }}>{item.label}</TvText></Pressable>;
        })}
      </View>
    </View>
  );
}

export function TvTopBar({ data }: { data: TvDashboardData }) {
  const weather = data.dashboard?.system?.weather;
  const temp = pick(weather, 'temp', 'temperature');
  const updated = data.updatedAt ? new Date(data.updatedAt).toLocaleTimeString(tvLocaleTag(), { hour: '2-digit', minute: '2-digit' }) : null;
  const location = String(pick(data.homeProfile, 'location', 'city') ?? 'DOM');
  const homeName = String(pick(data.homeProfile, 'name', 'title') ?? '');
  return <View style={styles.topbar}>
    <View style={styles.topBrand}>
      <View style={styles.topBrandIcon}><TvIcon name="flame" color={colors.accent} size={23} sizeScale="full" /></View>
      <View><TvText sizeScale="full" style={styles.brandName}>Boiler Control</TvText><TvText size="micro" tone="dim" sizeScale="full" style={styles.brandCaption}>TV · {location.toUpperCase()}{homeName ? ` · ${homeName.toUpperCase()}` : ''}</TvText></View>
    </View>
    <View style={styles.topMeta}>
      <View style={styles.topMetaItem}><TvIcon name="weather" size={19} sizeScale="full" color={colors.warning} /><TvText size="small" tone="muted" sizeScale="full">Vanjska temperatura</TvText><TvText size="small" sizeScale="full" style={styles.topValue}>{fmt(temp)}°</TvText></View>
      <TvStatusPill label={data.error ? 'PODACI ZASTARJELI' : data.updatedAt ? 'SISTEM ONLINE' : 'POVEZIVANJE'} tone={data.error ? 'warn' : data.updatedAt ? 'ok' : 'neutral'} sizeScale="full" />
      <View style={styles.clockWrap}><TvText size="section" sizeScale="full" style={styles.clock}>{new Date().toLocaleTimeString(tvLocaleTag(), { hour: '2-digit', minute: '2-digit' })}</TvText><TvText size="micro" tone="dim" sizeScale="full">{updated ? `AŽURIRANO ${updated}` : 'ČEKA PODATKE'}</TvText></View>
    </View>
  </View>;
}

export function HomeScreen({ data, view, onView }: { data: TvDashboardData; view: HomeView; onView: (view: HomeView) => void }) {
  const dash = data.dashboard;
  const system = dash?.system ?? {};
  const thermostat = dash?.homes?.[0]?.thermostats?.find((t: AnyRecord) => isNumber(t?.roomCurrentTemp)) ?? dash?.homes?.[0]?.thermostats?.[0];
  const weather = system.weather ?? {};
  const boiler = system.boiler ?? {};
  const cost = pick(data.analysis, 'costIncVat', 'currentMonthCost', 'totalCost');
  const title = String(pick(data.profile, 'name', 'displayName', 'username') ?? 'Vaš dom');
  const greeting = `Dobro došli, ${title.split(' ')[0]}`;
  const viewTabs: { id: HomeView; label: string }[] = [{ id: 'overview', label: 'Pregled' }, { id: 'analytics', label: 'Analitika' }, { id: 'health', label: 'Zdravlje' }];
  const heading = view === 'overview' ? greeting : view === 'analytics' ? 'Analitika' : 'Zdravlje sistema';
  const eyebrow = view === 'overview' ? 'KONTROLNI CENTAR' : view === 'analytics' ? 'PREGLED PODATAKA / ZDRAVLJE DOMA' : 'ANALITIKA / STATUS UREĐAJA';
  const subtitle = view === 'overview' ? 'Pregled doma · samo podaci učitani iz sistema' : view === 'analytics' ? 'Stvarni trendovi grijanja i potrošnje · samo dostupna očitanja' : 'Stanje veze, termostata i svježine podataka';
  return <TvScrollView key={view}>
    <TvPageHeading eyebrow={eyebrow} title={heading} subtitle={subtitle} right={<View style={styles.chipRow}>{viewTabs.map((tab) => <TvChip key={tab.id} label={tab.label} active={view === tab.id} preferredFocus={view !== 'overview' && view === tab.id} onPress={() => onView(tab.id)} />)}</View>} />
    {data.error ? <TvStatusPill label="Neki podaci nisu osvježeni" tone="warn" icon="alert" /> : null}
    {data.loading && !dash && !data.analysis ? <Loading /> : null}
    {view === 'overview' ? <>
      <View style={styles.metricGrid}>
        <TvMetricCard label="Vanjska temperatura" value={fmt(pick(weather, 'temp', 'temperature'))} unit="°C" meta={pick(weather, 'condition') ? String(weather.condition) : 'Stvarno očitanje'} icon="weather" tone="warn" preferredFocus />
        <TvMetricCard label={String(pick(thermostat, 'alias', 'name') ? `Termostat · ${pick(thermostat, 'alias', 'name')}` : 'Temperatura sobe')} value={fmt(pick(thermostat, 'roomCurrentTemp', 'currentTemperature'))} unit="°C" meta={isNumber(pick(thermostat, 'roomTargetTemp', 'targetTemperature')) ? `Cilj ${fmt(pick(thermostat, 'roomTargetTemp', 'targetTemperature'))} °C` : 'Trenutno očitanje'} icon="thermometer" tone="signal" />
        <TvMetricCard label="Polazna voda" value={fmt(pick(boiler, 'actualFlowTemp', 'flowTemp', 'currentFlowTemp'))} unit="°C" meta="Temperatura sistema grijanja" icon="water" />
        <TvMetricCard label="Trošak plina" value={fmt(cost, 2)} unit="KM" meta="Iznos vraćen analizom plina" icon="cost" tone="ok" />
      </View>
      <View style={styles.twoColumns}>
        <TvCard containerStyle={{ flex: 1.55 }}><TvCardTitle title="Temperatura doma" subtitle="Očitanje termostata · posljednja dostupna mjerenja" icon="chart" /><TemperatureChart events={data.heatingEvents} /></TvCard>
        <HeatingSummary data={data} />
      </View>
      <View style={styles.twoColumns}><HealthSummary data={data} /><Recommendation data={data} /></View>
    </> : view === 'analytics' ? <AnalyticsView data={data} /> : <HealthView data={data} />}
    <DataFootnote data={data} />
  </TvScrollView>;
}

export function HeatingScreen({ data }: { data: TvDashboardData }) {
  const thermostat = data.dashboard?.homes?.[0]?.thermostats?.[0] ?? {};
  const boiler = data.dashboard?.system?.boiler ?? {};
  const active = data.heatingStatus.some((item) => item?.isHeatingNow === true);
  const summary = data.heatingSummary ?? {};
  const device = data.devices[0] ?? {};
  return <TvScrollView>
    <TvPageHeading eyebrow="SISTEM GRIJANJA" title="Grijanje" subtitle="Status i očitanja uređaja · upravljanje ostaje u mobilnoj aplikaciji" right={<TvStatusPill label={active ? 'GRIJANJE AKTIVNO' : 'STATUS SISTEMA'} tone={active ? 'ok' : 'neutral'} icon="flame" />} />
    <View style={styles.metricGrid}>
      <TvMetricCard label="Temperatura sobe" value={fmt(pick(thermostat, 'roomCurrentTemp', 'currentTemperature'))} unit="°C" meta={isNumber(pick(thermostat, 'roomTargetTemp', 'targetTemperature')) ? `Cilj ${fmt(pick(thermostat, 'roomTargetTemp', 'targetTemperature'))} °C` : 'Očitanje termostata'} icon="thermometer" tone="signal" preferredFocus />
      <TvMetricCard label="Polazna voda" value={fmt(pick(boiler, 'actualFlowTemp', 'flowTemp', 'currentFlowTemp'))} unit="°C" meta="Stvarna temperatura" icon="water" />
      <TvMetricCard label="Ciklusi grijanja" value={fmt(pick(summary, 'totalCycles'), 0)} meta="U periodu sažetka" icon="clock" tone="ok" />
      <TvMetricCard label="Ukupno trajanje" value={fmt(pick(summary, 'totalDurationMin'), 0)} unit="min" meta="Iz evidencije ciklusa" icon="chart" />
    </View>
    <View style={styles.twoColumns}>
      <TvCard containerStyle={{ flex: 1 }}><TvCardTitle title="Termostat" subtitle={String(pick(thermostat, 'alias', 'name') ?? pick(device, 'alias') ?? 'Povezani uređaj')} icon="thermometer" right={<TvStatusPill label={String(pick(device, 'mode') ?? 'SAMO PREGLED')} tone="signal" />} />
        <TvDataRow label="Trenutna temperatura" value={`${fmt(pick(thermostat, 'roomCurrentTemp', 'currentTemperature'))} °C`} />
        <TvDataRow label="Ciljna temperatura" value={`${fmt(pick(thermostat, 'roomTargetTemp', 'targetTemperature'))} °C`} />
        <TvDataRow label="Način rada" value={String(pick(device, 'mode') ?? '—')} />
        <TvDataRow label="Zadnji kontakt" value={dateText(pick(device, 'lastSeen'))} /></TvCard>
      <TvCard containerStyle={{ flex: 1 }}><TvCardTitle title="Raspored grijanja" subtitle="Trenutno sinhronizovani programi · read-only" icon="calendar" />
        {data.programs.length ? data.programs.slice(0, 8).map((program, index) => <TvDataRow key={itemKey(program.id, index)} label={String(pick(program, 'dayType') ?? `Program ${index + 1}`)} detail={minuteTime(pick(program, 'startMinute'))} value={isNumber(pick(program, 'targetTemp')) ? `${fmt(program.targetTemp)} °C` : '—'} />) : <EmptyState text="Nema rasporeda dostupnog iz API-ja." />}
      </TvCard>
    </View>
    <TvCard><TvCardTitle title="Nedavni ciklusi" subtitle="Događaji iz evidencije grijanja" icon="clock" />
      {data.heatingEvents.length ? data.heatingEvents.slice(0, 5).map((event, i) => <TvDataRow key={itemKey(event.id, i)} label={dateText(pick(event, 'startedAt'))} detail={pick(event, 'durationMinutes') != null ? `${event.durationMinutes} min` : undefined} value={`${fmt(pick(event, 'roomCurrentTemp'))} °C`} />) : <EmptyState text="Nema nedavnih ciklusa u odgovoru pregleda doma." />}
    </TvCard><DataFootnote data={data} />
  </TvScrollView>;
}

export function GasScreen({ data, view, onView }: { data: TvDashboardData; view: GasView; onView: (view: GasView) => void }) {
  const analysis = data.analysis ?? {};
  const consumption = pick(analysis, 'consumptionFromReferenceM3', 'totalGas', 'currentMonthConsumption');
  const cost = pick(analysis, 'costIncVat', 'currentMonthCost', 'totalCost');
  const readings = [...data.readings].sort((a, b) => readingDate(b).localeCompare(readingDate(a)));
  const period = isRecord(analysis.period) ? analysis.period : {};
  return <TvScrollView key={view}>
    <TvPageHeading eyebrow="POTROŠNJA I OČITANJA" title="Plin" subtitle="Prikaz evidentiranih podataka · na TV-u nema dodavanja ni uređivanja" right={<View style={styles.chipRow}><TvChip label="Očitanja" active={view === 'readings'} onPress={() => onView('readings')} /><TvChip label="Analiza" active={view === 'analysis'} onPress={() => onView('analysis')} /></View>} />
    <View style={styles.metricGrid}>
      <TvMetricCard label="Potrošnja" value={fmt(consumption, 2)} unit={String(pick(analysis, 'unit') ?? 'm³')} meta="Vrijednost vraćena analizom" icon="gas" tone="signal" preferredFocus />
      <TvMetricCard label="Trošak ukupno" value={fmt(cost, 2)} unit={String(pick(analysis, 'currency') ?? 'KM')} meta="Samo ako je dostupno u API-ju" icon="cost" tone="ok" />
      <TvMetricCard label="Prosjek po danu" value={fmt(pick(analysis, 'averageDailyConsumption'))} unit="m³" meta="Analiza potrošnje" icon="chart" />
      <TvMetricCard label="Očitanja evidentirana" value={String(readings.length)} meta="Broj trenutno učitanih zapisa" icon="calendar" />
    </View>
    <View style={styles.twoColumns}>
      <TvCard containerStyle={{ flex: 1 }}><TvCardTitle title={view === 'readings' ? 'Historija očitanja' : 'Analiza potrošnje'} subtitle={view === 'readings' ? 'Podaci direktno iz evidencije' : 'Metrike dostupne kroz gas analysis API'} icon="chart" />
        {view === 'readings' ? readings.length ? readings.slice(0, 8).map((reading, index) => <TvDataRow key={itemKey(reading.id, index)} label={dateText(readingDate(reading))} detail={pick(reading, 'counterValue', 'meterReading', 'value', 'reading') != null ? `Stanje brojila ${fmt(pick(reading, 'counterValue', 'meterReading', 'value', 'reading'), 2)} ${String(pick(reading, 'unit') ?? 'm³')}` : undefined} value={pick(reading, 'consumption') != null ? `${fmt(reading.consumption, 2)} m³` : '—'} />) : <EmptyState text="Nema očitanja vraćenih iz API-ja." /> : <>
          <TvDataRow label="Potrošnja ukupno" value={`${fmt(consumption, 2)} ${String(pick(analysis, 'unit') ?? 'm³')}`} />
          <TvDataRow label="Prosječna mjesečna potrošnja" value={`${fmt(pick(analysis, 'averageMonthlyConsumption'))} m³`} />
          <TvDataRow label="Procjena mjesečne potrošnje" value={`${fmt(pick(analysis, 'projectedMonthlyConsumption'))} m³`} />
          <TvDataRow label="Trošak s PDV-om" value={`${fmt(cost, 2)} ${String(pick(analysis, 'currency') ?? 'KM')}`} />
          <TvDataRow label="Poređenje s prethodnim periodom" value={fmt(pick(analysis, 'consumptionChange')) === '—' ? '—' : `${fmt(pick(analysis, 'consumptionChange'))}%`} />
        </>}</TvCard>
      <TvCard containerStyle={{ flex: 1 }}><TvCardTitle title="Stanje podataka" subtitle="Ažurirano isključivo iz postojećih GET API-ja" icon="shield" />
        <TvDataRow label="Učitana očitanja" value={String(readings.length)} />
        <TvDataRow label="Raspon analize" value={period.from || period.to ? `${dateText(period.from)} – ${dateText(period.to)}` : 'Nije naveden'} />
        <TvDataRow label="Evidencija" value={readings.length ? 'Dostupna' : 'Nema podataka'} tone={readings.length ? 'ok' : 'dim'} />
        <ReadingChart readings={readings} />
      </TvCard>
    </View><DataFootnote data={data} />
  </TvScrollView>;
}

export function SettingsScreen({ data, view, onView }: { data: TvDashboardData; view: SettingsView; onView: (view: SettingsView) => void }) {
  const [focusedSetting, setFocusedSetting] = React.useState<SettingsView | null>(null);
  const menu: { id: SettingsView; label: string; icon: TvIconName }[] = [
    { id: 'profile', label: 'Profil', icon: 'profile' }, { id: 'notifications', label: 'Obavijesti', icon: 'bell' }, { id: 'schedule', label: 'Raspored grijanja', icon: 'calendar' },
  ];
  return <TvScrollView key={view}>
    <TvPageHeading eyebrow="POSTAVKE · SAMO PREGLED" title="Profil i postavke" subtitle="Izmjene profila i uređaja ostaju dostupne u mobilnoj aplikaciji" />
    <View style={styles.settingsLayout}>
      <View style={styles.settingsMenu}>{menu.map((item) => {
        const focused = focusedSetting === item.id;
        return <Pressable key={item.id} focusable hasTVPreferredFocus={view === item.id} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{ selected: view === item.id }} onFocus={() => setFocusedSetting(item.id)} onBlur={() => setFocusedSetting(null)} onPress={() => onView(item.id)} style={[styles.settingsButton, view === item.id && styles.settingsButtonActive, focused && styles.navFocused]}><TvIcon name={item.icon} size={21} color={view === item.id ? colors.accentText : colors.textMuted} /><TvText size="small" style={view === item.id ? styles.settingsTextActive : undefined}>{item.label}</TvText><TvIcon name="chevron" size={17} color={colors.textDim} /></Pressable>;
      })}</View>
      <View style={styles.settingsContent}>{view === 'profile' ? <ProfileSettings data={data} /> : view === 'notifications' ? <NotificationSettings data={data} /> : <ScheduleSettings data={data} />}</View>
    </View><DataFootnote data={data} />
  </TvScrollView>;
}

function ProfileSettings({ data }: { data: TvDashboardData }) {
  const profile = data.profile ?? {};
  const home = data.homeProfile ?? data.dashboard?.homes?.[0] ?? {};
  return <TvCard><TvCardTitle title="Osnovni podaci" subtitle="Korisnički profil i aktivni dom" icon="profile" right={<TvStatusPill label="SAMO PREGLED" tone="signal" />} />
    <TvDataRow label="Ime" detail="Prikazno ime profila" value={String(pick(profile, 'name', 'displayName', 'username') ?? '—')} />
    <TvDataRow label="E-mail" detail="Prijavljeni račun" value={String(pick(profile, 'email') ?? '—')} />
    <TvDataRow label="Dom" detail="Aktivni profil domaćinstva" value={String(pick(home, 'name', 'title', 'location') ?? '—')} />
    <TvDataRow label="Lokacija" value={String(pick(home, 'location', 'city', 'address') ?? pick(profile, 'homeLocation') ?? '—')} />
    <TvDataRow label="Status TV uređaja" value="Povezan" tone="ok" /></TvCard>;
}

function NotificationSettings({ data }: { data: TvDashboardData }) {
  return <TvCard><TvCardTitle title="Obavijesti" subtitle="Obavještenja primljena iz naloga · bez označavanja kao pročitano" icon="bell" right={<TvStatusPill label="SAMO PREGLED" tone="signal" />} />
    {data.notifications.length ? data.notifications.slice(0, 10).map((notification, index) => <TvDataRow key={itemKey(notification.id, index)} label={String(pick(notification, 'title', 'type') ?? 'Obavijest')} detail={String(pick(notification, 'message', 'body') ?? dateText(pick(notification, 'createdAt')))} value={dateText(pick(notification, 'createdAt'))} tone={pick(notification, 'readAt', 'isRead') ? 'dim' : 'primary'} />) : <EmptyState text="Nema obavijesti vraćenih iz API-ja." />}</TvCard>;
}

function ScheduleSettings({ data }: { data: TvDashboardData }) {
  return <TvCard><TvCardTitle title="Raspored grijanja" subtitle="Program sinhronizovan s termostatom · nije moguće uređivati na TV-u" icon="calendar" right={<TvStatusPill label="SAMO PREGLED" tone="signal" />} />
    {data.programs.length ? data.programs.slice(0, 12).map((program, index) => <TvDataRow key={itemKey(program.id, index)} label={String(pick(program, 'dayType') ?? `Period ${index + 1}`)} detail={minuteTime(pick(program, 'startMinute'))} value={isNumber(pick(program, 'targetTemp', 'roomTargetTemp')) ? `${fmt(pick(program, 'targetTemp', 'roomTargetTemp'))} °C` : '—'} />) : <EmptyState text="Nema rasporeda vraćenog iz API-ja." />}</TvCard>;
}

function AnalyticsView({ data }: { data: TvDashboardData }) {
  const analysis = data.analysis ?? {};
  const summary = data.heatingSummary ?? {};
  const score = pick(data.health, 'score');
  const averageTemp = pick(summary, 'avgIndoorTemp');
  const consumption = pick(analysis, 'consumptionFromReferenceM3', 'totalGas');
  const warnings = asRecords(data.health?.warnings);
  return <>
    <View style={styles.metricGrid}>
      <TvMetricCard label="Zdravlje sistema" value={fmt(score, 0)} unit={score != null ? '/ 100' : undefined} meta="Ocjena iz health API-ja" icon="shield" tone="ok" />
      <TvMetricCard label="Prosječna sobna temperatura" value={fmt(averageTemp)} unit="°C" meta="Prosjek iz događaja grijanja" icon="thermometer" tone="signal" />
      <TvMetricCard label="Potrošnja u periodu" value={fmt(consumption, 2)} unit="m³" meta="Gas analysis API" icon="gas" />
    </View>
    <View style={styles.twoColumns}>
      <TvCard containerStyle={{ flex: 1.6 }}><TvCardTitle title="Grijanje i temperatura" subtitle="Stvarna očitanja iz zadnjih 30 dana" icon="chart" /><TemperatureChart events={data.heatingEvents} /></TvCard>
      <TvCard containerStyle={{ flex: 0.85 }}><TvCardTitle title="Stanje zdravlja" subtitle="Automatske provjere iz API-ja" icon="shield" right={<TvStatusPill label={warnings.length ? 'UPOZORENJA' : 'STATUS UČITAN'} tone={warnings.length ? 'warn' : 'ok'} />} />
        <TvDataRow label="Ocjena sistema" value={score != null ? `${fmt(score, 0)} / 100` : '—'} />
        <TvDataRow label="Komponente" value={Array.isArray(data.health?.components) ? String(asRecords(data.health.components).length) : '—'} />
        <TvDataRow label="Upozorenja" value={String(warnings.length)} tone={warnings.length ? 'warn' : 'ok'} />
        <TvDataRow label="Izračunato" value={dateText(data.health?.computedAt)} />
      </TvCard>
    </View>
    <View style={styles.twoColumns}>
      <TvCard containerStyle={{ flex: 1.1 }}><TvCardTitle title="Potrošnja plina" subtitle="Zabilježena stanja plinomjera" icon="gas" /><ReadingChart readings={data.readings} /></TvCard>
      <TvCard containerStyle={{ flex: 0.9 }}><TvCardTitle title="Učinkovitost grijanja" subtitle="Metrike za aktivni period · bez izmišljenih poređenja" icon="clock" />
        <TvDataRow label="Prosječno trajanje ciklusa" value={isNumber(pick(summary, 'avgDurationMin')) ? `${fmt(summary.avgDurationMin, 0)} min` : '—'} />
        <TvDataRow label="Broj ciklusa" value={fmt(pick(summary, 'totalCycles'), 0)} />
        <TvDataRow label="Ukupno grijanje" value={isNumber(pick(summary, 'totalDurationMin')) ? `${fmt(summary.totalDurationMin, 0)} min` : '—'} />
        <TvDataRow label="Trošak s PDV-om" value={isNumber(pick(analysis, 'costIncVat')) ? `${fmt(analysis.costIncVat, 2)} KM` : '—'} />
      </TvCard>
    </View>
  </>;
}

function HealthView({ data }: { data: TvDashboardData }) {
  const health = data.health ?? {};
  const score = pick(health, 'score');
  const components = asRecords(health.components);
  const warnings = asRecords(health.warnings);
  const thermostat = data.dashboard?.homes?.[0]?.thermostats?.[0] ?? {};
  const active = data.heatingStatus.some((item) => item?.isHeatingNow === true);
  const scoreColor = isNumber(score) && score < 60 ? colors.warning : colors.success;
  return <>
    <View style={styles.healthPageGrid}>
      <TvCard containerStyle={{ flex: 0.75 }}><TvCardTitle title="Zdravlje sistema" subtitle="Indeks iz dashboard health API-ja" icon="shield" right={<TvStatusPill label={warnings.length ? `${warnings.length} UPOZORENJA` : 'STATUS UČITAN'} tone={warnings.length ? 'warn' : 'ok'} />} />
        <View style={styles.healthMain}>
          <View style={styles.scoreRing} accessible accessibilityRole="progressbar" accessibilityLabel="Ocjena zdravlja sistema" accessibilityValue={{ min: 0, max: 100, now: isNumber(score) ? Math.max(0, Math.min(100, score)) : undefined }}><Svg width="100%" height="100%" viewBox="0 0 100 100"><Circle cx="50" cy="50" r="42" fill="none" stroke={colors.border} strokeWidth="7" /><Circle cx="50" cy="50" r="42" fill="none" stroke={scoreColor} strokeWidth="7" strokeLinecap="round" strokeDasharray="264" strokeDashoffset={isNumber(score) ? 264 - (Math.max(0, Math.min(100, score)) / 100) * 264 : 264} /></Svg><View style={styles.scoreCenter}><TvText size="title" style={styles.scoreValue}>{fmt(score, 0)}</TvText><TvText size="micro" tone="dim">INDEKS</TvText></View></View>
          <View style={styles.healthCopy}><TvText size="section" style={styles.healthTitle}>{warnings.length ? 'Potrebna je pažnja' : 'Status sistema'}</TvText><TvText size="small" tone="muted">{warnings.length ? String(warnings[0]?.message ?? 'API je prijavio upozorenja.') : 'Stanje i upozorenja prikazani prema posljednjoj provjeri sistema.'}</TvText><TvStatusPill label={warnings.length ? 'PROVJERITE UPOZORENJA' : 'BEZ UPOZORENJA'} tone={warnings.length ? 'warn' : 'ok'} /></View>
        </View>
        <View style={styles.healthItems}>
          {components.length ? components.slice(0, 4).map((component: AnyRecord, index: number) => <TvDataRow key={itemKey(component.key, index)} label={String(component.key ?? `Komponenta ${index + 1}`)} detail={isNumber(component.weight) ? `Ponder ${component.weight}` : undefined} value={`${fmt(component.score, 0)} / 100`} tone={isNumber(component.score) && component.score < 60 ? 'warn' : 'ok'} />) : <EmptyState text="Nema komponenti uključenih u ocjenu zdravlja." />}
        </View>
      </TvCard>
      <TvCard containerStyle={{ flex: 1.4 }}><TvCardTitle title={String(pick(thermostat, 'alias') ? `Termostat · ${thermostat.alias}` : 'Termostat')} subtitle="Trenutna i ciljna temperatura sobe" icon="thermometer" right={<TvStatusPill label={active ? 'GRIJANJE AKTIVNO' : 'STATUS SISTEMA'} tone={active ? 'ok' : 'neutral'} />} />
        <View style={styles.heatingSummary}>
          <View style={styles.bigReading}><TvText size="small" tone="muted">TRENUTNO</TvText><TvText size="title" style={styles.bigNumber}>{fmt(pick(thermostat, 'roomCurrentTemp'))} °C</TvText></View>
          <View style={styles.bigReading}><TvText size="small" tone="muted">CILJ</TvText><TvText size="title" style={styles.bigNumber}>{fmt(pick(thermostat, 'roomTargetTemp'))} °C</TvText></View>
        </View>
        <TvSectionTitle title="Temperatura · dostupna historija" meta="Samo stvarni događaji grijanja" />
        <TemperatureChart events={data.heatingEvents} />
        {warnings.length ? <View style={styles.warningList}>{warnings.slice(0, 2).map((warning: AnyRecord, index: number) => <TvDataRow key={itemKey(warning.type, index)} label={String(warning.type ?? 'Upozorenje')} detail={String(warning.message ?? '')} value={String(warning.level ?? 'info')} tone="warn" />)}</View> : null}
      </TvCard>
    </View>
  </>;
}

function HeatingSummary({ data }: { data: TvDashboardData }) {
  const thermostat = data.dashboard?.homes?.[0]?.thermostats?.[0] ?? {};
  const boiler = data.dashboard?.system?.boiler ?? {};
  const active = data.heatingStatus.some((item) => item?.isHeatingNow === true);
  return <TvCard containerStyle={{ flex: 0.85 }}><TvCardTitle title="Status grijanja" subtitle={String(pick(thermostat, 'alias', 'name') ?? 'Termostat')} right={<TvStatusPill label={active ? 'AKTIVNO' : 'STATUS NEPOZNAT'} tone={active ? 'ok' : 'neutral'} />} icon="flame" />
    <TvDataRow label="Termostat" value={`${fmt(pick(thermostat, 'roomCurrentTemp'))} / ${fmt(pick(thermostat, 'roomTargetTemp'))} °C`} />
    <TvDataRow label="Polazna voda" value={`${fmt(pick(boiler, 'actualFlowTemp'))} °C`} />
    <TvDataRow label="Ciklusi u periodu" value={fmt(pick(data.heatingSummary, 'totalCycles'), 0)} />
  </TvCard>;
}
function HealthSummary({ data }: { data: TvDashboardData }) {
  const score = pick(data.health, 'score', 'healthScore', 'overallScore');
  return <TvCard containerStyle={{ flex: 1.1 }}><TvCardTitle title="Zdravlje sistema" subtitle="Status iz dashboard health API-ja" icon="shield" right={<TvStatusPill label={score != null ? 'PODACI UČITANI' : 'NEMA STATUSA'} tone={score != null ? 'ok' : 'neutral'} />} />
    <TvDataRow label="Ocjena sistema" value={score != null ? `${fmt(score, 0)} / 100` : '—'} />
    <TvDataRow label="Uređaji u nalogu" value={String(data.devices.length || '—')} />
    <TvDataRow label="Obavijesti" value={String(data.notifications.length)} />
    <TvText size="small" tone="dim">Bez API podatka kartica ostaje prazna; TV ne koristi demo vrijednosti.</TvText>
  </TvCard>;
}
function Recommendation({ data }: { data: TvDashboardData }) {
  const recommendation = data.dashboard?.system?.recommendation ?? {};
  return <TvCard containerStyle={{ flex: 0.9 }}><TvCardTitle title="Preporuka sistema" subtitle="Vrijednosti koje vraća dashboard API" icon="trend" />
    <TvDataRow label="Preporučena polazna temperatura" value={isNumber(pick(recommendation, 'recommendedFlowTemp')) ? `${fmt(recommendation.recommendedFlowTemp)} °C` : '—'} />
    <TvDataRow label="Izvor preporuke" value={String(pick(recommendation, 'source') ?? '—')} />
    <TvText size="small" tone="dim">Preporuka je informativna i TV ne mijenja postavke kotla.</TvText>
  </TvCard>;
}
function DataFootnote({ data }: { data: TvDashboardData }) {
  return <View style={styles.footnote}><TvIcon name="shield" size={14} color={colors.textDim} /><TvText size="small" tone="dim">Samo pregled · vrijednosti se prikazuju isključivo kada ih postojeći API vrati{data.updatedAt ? ` · osvježeno ${new Date(data.updatedAt).toLocaleTimeString(tvLocaleTag(), { hour: '2-digit', minute: '2-digit' })}` : ''}</TvText></View>;
}
function EmptyState({ text }: { text: string }) { return <View style={styles.empty}><TvText size="small" tone="dim">{text}</TvText></View>; }
function TemperatureChart({ events }: { events: AnyRecord[] }) {
  const ordered = [...events].sort((a, b) => String(a.startedAt ?? '').localeCompare(String(b.startedAt ?? ''))).slice(-18);
  const values = ordered.map((event) => pick(event, 'roomCurrentTempThermostat', 'roomCurrentTemp')).filter(isNumber);
  if (values.length < 2) return <EmptyChart caption="Nema dovoljno stvarnih temperaturnih očitanja za grafikon." />;
  const min = Math.min(...values) - 0.5;
  const max = Math.max(...values) + 0.5;
  const width = 500;
  const height = 82;
  const points = values.map((value, index) => `${(index / (values.length - 1)) * width},${height - ((value - min) / Math.max(max - min, 0.1)) * (height - 10) - 5}`);
  return <View style={styles.chartPlaceholder} accessible accessibilityRole="image" accessibilityLabel={`Grafikon sobne temperature. ${values.length} očitanja, od ${fmt(Math.min(...values))} do ${fmt(Math.max(...values))} stepeni.`}><Svg width="100%" height={scaleContent(height)} viewBox={`0 0 ${width} ${height}`}><Path d={`M${points.join(' L')}`} fill="none" stroke={colors.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></Svg><TvText size="small" tone="dim" style={styles.chartCaption}>Stvarna sobna temperatura · {values.length} očitanja</TvText></View>;
}
function ReadingChart({ readings }: { readings: AnyRecord[] }) {
  const ordered = [...readings].sort((a, b) => readingDate(a).localeCompare(readingDate(b))).slice(-12);
  const values = ordered.map((reading) => pick(reading, 'counterValue', 'meterReading', 'value')).filter(isNumber);
  if (values.length < 2) return <EmptyChart caption="Nema dovoljno evidentiranih očitanja za grafikon." />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = 500;
  const height = 82;
  const points = values.map((value, index) => `${(index / (values.length - 1)) * width},${height - ((value - min) / Math.max(max - min, 0.1)) * (height - 10) - 5}`);
  return <View style={styles.chartPlaceholder} accessible accessibilityRole="image" accessibilityLabel={`Grafikon stanja brojila. ${values.length} očitanja, od ${fmt(min, 2)} do ${fmt(max, 2)}.`}><Svg width="100%" height={scaleContent(height)} viewBox={`0 0 ${width} ${height}`}><Path d={`M${points.join(' L')}`} fill="none" stroke={colors.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></Svg><TvText size="small" tone="dim" style={styles.chartCaption}>Stanje brojila · {values.length} evidentirana očitanja</TvText></View>;
}
function EmptyChart({ caption }: { caption: string }) { return <View style={styles.chartPlaceholder} accessible accessibilityRole="image" accessibilityLabel={caption}><TvText size="small" tone="dim" style={styles.chartCaption}>{caption}</TvText></View>; }
function Loading() { return <View style={styles.loading}><ActivityIndicator color={colors.accent} accessibilityLabel="Učitavanje podataka" /><TvText size="small" tone="muted">Učitavanje stvarnih podataka…</TvText></View>; }
function readingDate(reading: AnyRecord) { return String(pick(reading, 'readingDate', 'date', 'createdAt') ?? ''); }
function minuteTime(value: unknown) { if (!isNumber(value)) return undefined; const minutes = Math.max(0, Math.floor(value)); return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`; }

const styles = StyleSheet.create({
  nav: { height: tvLayout.bottomNavHeight, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: tvLayout.safeX, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)' },
  navItems: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: scaleContent(8) },
  navItem: { minWidth: scaleContent(152), height: tvLayout.minFocusTarget, paddingHorizontal: scaleContent(15), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: scaleContent(10), borderWidth: tvLayout.focusBorder, borderColor: 'transparent', borderRadius: scaleContent(13) },
  navItemActive: { backgroundColor: `${colors.accent}16`, borderColor: `${colors.accent}66` },
  navFocused: { borderColor: colors.accent, backgroundColor: `${colors.accent}20` },
  brandName: { fontFamily: fonts.sansBold, fontSize: baseTypeScale.section, letterSpacing: -0.4 },
  brandCaption: { fontFamily: fonts.mono, letterSpacing: 1, marginTop: 3 },
  topbar: { height: baseTvLayout.topBarHeight, paddingHorizontal: baseTvLayout.safeX, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.12)' },
  topBrand: { flexDirection: 'row', alignItems: 'center', gap: 14, flexShrink: 1 },
  topBrandIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: `${colors.accent}18`, borderColor: `${colors.accent}66`, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  topMeta: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  topMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  topValue: { fontFamily: fonts.monoSemiBold, fontSize: baseTypeScale.small },
  clockWrap: { alignItems: 'flex-end', gap: 2, minWidth: 96 },
  clock: { fontFamily: fonts.monoSemiBold, fontSize: baseTypeScale.section },
  chipRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  metricGrid: { flexDirection: 'row', gap: scaleContent(14), marginVertical: scaleContent(2) },
  twoColumns: { flexDirection: 'row', gap: scaleContent(14) },
  settingsLayout: { flexDirection: 'row', gap: scaleContent(14), alignItems: 'flex-start' },
  settingsMenu: { width: scaleContent(250), gap: spacing.sm },
  settingsButton: { minHeight: tvLayout.minFocusTarget, borderRadius: scaleContent(12), paddingHorizontal: scaleContent(11), flexDirection: 'row', alignItems: 'center', gap: scaleContent(9), borderWidth: tvLayout.focusBorder, borderColor: colors.border, backgroundColor: colors.surface },
  settingsButtonActive: { borderColor: `${colors.accent}88`, backgroundColor: `${colors.accent}10` },
  settingsTextActive: { color: colors.accentText, fontFamily: fonts.sansSemiBold, flex: 1 },
  settingsContent: { flex: 1 },
  empty: { paddingVertical: scaleContent(19), paddingHorizontal: scaleContent(6) },
  chartPlaceholder: { marginTop: scaleContent(8), borderRadius: scaleContent(10), backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, paddingHorizontal: scaleContent(9), paddingTop: scaleContent(6), paddingBottom: scaleContent(8) },
  chartCaption: { lineHeight: scaleContent(19) },
  loading: { minHeight: scaleContent(78), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: scaleContent(9) },
  footnote: { flexDirection: 'row', alignItems: 'center', gap: scaleContent(6), paddingTop: scaleContent(2) },
  healthPageGrid: { flexDirection: 'row', gap: scaleContent(14), alignItems: 'stretch' },
  healthMain: { flexDirection: 'row', alignItems: 'center', gap: scaleContent(15), paddingVertical: scaleContent(6) },
  scoreRing: { width: scaleContent(148), height: scaleContent(148), flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  scoreCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  scoreValue: { fontFamily: fonts.monoSemiBold, lineHeight: scaleContent(36) },
  healthCopy: { flex: 1, gap: scaleContent(7) },
  healthTitle: { fontFamily: fonts.sansSemiBold },
  healthItems: { marginTop: scaleContent(7) },
  heatingSummary: { flexDirection: 'row', gap: scaleContent(9), marginBottom: scaleContent(10) },
  bigReading: { flex: 1, minHeight: scaleContent(88), paddingHorizontal: scaleContent(12), paddingVertical: scaleContent(10), borderWidth: 1, borderColor: colors.border, borderRadius: scaleContent(9), backgroundColor: colors.background, gap: scaleContent(5) },
  bigNumber: { fontFamily: fonts.monoSemiBold, letterSpacing: scaleContent(-0.8) },
  warningList: { marginTop: scaleContent(9) },
});
