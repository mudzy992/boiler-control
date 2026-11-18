import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors, fonts, spacing } from '../theme';
import {
  TvCard, TvCardTitle, TvChip, TvDataRow, TvIcon, TvMetricCard, TvPageHeading,
  TvScrollView, TvSectionTitle, TvStatusPill, TvText, type TvIconName,
} from '../components/TvUI';

export type Page = 'home' | 'heating' | 'gas' | 'settings';
export type HomeView = 'overview' | 'analytics' | 'health';
export type GasView = 'readings' | 'analysis';
export type SettingsView = 'profile' | 'notifications' | 'schedule';
export type AnyRecord = Record<string, any>;

export interface TvDashboardData {
  dashboard: AnyRecord | null;
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
  release?: { version: string } | null;
}

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const fmt = (value: unknown, digits = 1) => isNumber(value) ? value.toFixed(digits) : '—';
const pick = (obj: AnyRecord | null | undefined, ...keys: string[]) => {
  for (const key of keys) if (obj?.[key] !== undefined && obj[key] !== null) return obj[key];
  return undefined;
};
const dateText = (value: unknown) => {
  if (!value) return '—';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('bs-BA', { day: '2-digit', month: 'short', year: 'numeric' });
};
const first = <T,>(...values: (T | null | undefined)[]): T | null => values.find((value) => value !== null && value !== undefined) ?? null;

export function TvMainNavigation({ page, onChange }: { page: Page; onChange: (page: Page) => void }) {
  const items: { id: Page; label: string; icon: TvIconName }[] = [
    { id: 'home', label: 'Početna', icon: 'home' },
    { id: 'heating', label: 'Grijanje', icon: 'flame' },
    { id: 'gas', label: 'Plin', icon: 'gas' },
    { id: 'settings', label: 'Postavke', icon: 'settings' },
  ];
  return (
    <View style={styles.nav}>
      <View style={styles.brand}><View style={styles.brandIcon}><TvIcon name="flame" color={colors.accent} size={22} /></View><View><TvText style={styles.brandName}>Boiler Control</TvText><TvText size="micro" tone="dim" style={styles.brandCaption}>TV · PREGLED DOMA</TvText></View></View>
      <View style={styles.navItems}>
        {items.map((item) => <Pressable key={item.id} focusable accessibilityRole="tab" accessibilityState={{ selected: page === item.id }} onPress={() => onChange(item.id)} style={({ focused }) => [styles.navItem, page === item.id && styles.navItemActive, focused && styles.navFocused]}><TvIcon name={item.icon} size={21} color={page === item.id ? colors.accent : colors.textDim} /><TvText size="small" style={{ fontFamily: page === item.id ? fonts.sansSemiBold : fonts.sansMedium, color: page === item.id ? colors.accent : colors.textMuted }}>{item.label}</TvText></Pressable>)}
      </View>
      <View style={styles.navStatus}><View style={styles.onlineDot} /><TvText size="micro" tone="ok" style={styles.onlineLabel}>READ ONLY</TvText></View>
    </View>
  );
}

export function TvTopBar({ data }: { data: TvDashboardData }) {
  const weather = data.dashboard?.system?.weather;
  const temp = pick(weather, 'temp', 'temperature');
  const updated = data.updatedAt ? new Date(data.updatedAt).toLocaleTimeString('bs-BA', { hour: '2-digit', minute: '2-digit' }) : null;
  return <View style={styles.topbar}>
    <View style={styles.topBrand}><TvText size="small" tone="muted">DOMAĆINSTVO</TvText><TvText size="small" style={styles.topHome}>{String(pick(data.homeProfile, 'name', 'title', 'location') ?? pick(data.dashboard?.homes?.[0], 'name', 'location') ?? 'Pregled doma')}</TvText></View>
    <View style={styles.topMeta}>
      <View style={styles.topMetaItem}><TvIcon name="weather" size={18} color={colors.warning} /><TvText size="small" tone="muted">Vani</TvText><TvText size="small" style={styles.topValue}>{fmt(temp)}°</TvText></View>
      {data.release ? <TvStatusPill label={`NOVA VERZIJA ${data.release.version}`} tone="signal" icon="alert" /> : null}
      <TvStatusPill label={data.error ? 'PODACI ZASTARJELI' : data.updatedAt ? 'SISTEM ONLINE' : 'POVEZIVANJE'} tone={data.error ? 'warn' : data.updatedAt ? 'ok' : 'neutral'} />
      <View style={styles.clockWrap}><TvText size="section" style={styles.clock}>{new Date().toLocaleTimeString('bs-BA', { hour: '2-digit', minute: '2-digit' })}</TvText><TvText size="micro" tone="dim">{updated ? `AŽURIRANO ${updated}` : 'ČEKA PODATKE'}</TvText></View>
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
  return <TvScrollView>
    <TvPageHeading eyebrow="KONTROLNI CENTAR" title={greeting} subtitle="Pregled doma · samo podaci učitani iz sistema" right={<View style={styles.chipRow}>{viewTabs.map((tab) => <TvChip key={tab.id} label={tab.label} active={view === tab.id} onPress={() => onView(tab.id)} />)}</View>} />
    {data.error ? <TvStatusPill label="Neki podaci nisu osvježeni" tone="warn" icon="alert" /> : null}
    {data.loading && !dash && !data.analysis ? <Loading /> : null}
    {view === 'overview' ? <>
      <View style={styles.metricGrid}>
        <TvMetricCard label="Vanjska temperatura" value={fmt(pick(weather, 'temp', 'temperature'))} unit="°C" meta={pick(weather, 'condition') ? String(weather.condition) : 'Stvarno očitanje'} icon="weather" tone="warn" />
        <TvMetricCard label={String(pick(thermostat, 'alias', 'name') ? `Termostat · ${pick(thermostat, 'alias', 'name')}` : 'Temperatura sobe')} value={fmt(pick(thermostat, 'roomCurrentTemp', 'currentTemperature'))} unit="°C" meta={isNumber(pick(thermostat, 'roomTargetTemp', 'targetTemperature')) ? `Cilj ${fmt(pick(thermostat, 'roomTargetTemp', 'targetTemperature'))} °C` : 'Trenutno očitanje'} icon="thermometer" tone="signal" />
        <TvMetricCard label="Polazna voda" value={fmt(pick(boiler, 'actualFlowTemp', 'flowTemp', 'currentFlowTemp'))} unit="°C" meta="Temperatura sistema grijanja" icon="water" />
        <TvMetricCard label="Trošak plina" value={fmt(cost, 2)} unit="KM" meta="Iznos vraćen analizom plina" icon="cost" tone="ok" />
      </View>
      <View style={styles.twoColumns}>
        <TvCard containerStyle={{ flex: 1 }}><TvCardTitle title="Temperatura doma" subtitle="Senzorski podaci · vremenski graf nije dostupan kroz ovaj pregled" icon="chart" /><TemperatureChart events={data.heatingEvents} /></TvCard>
        <HeatingSummary data={data} /></View>
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
      <TvMetricCard label="Temperatura sobe" value={fmt(pick(thermostat, 'roomCurrentTemp', 'currentTemperature'))} unit="°C" meta={isNumber(pick(thermostat, 'roomTargetTemp', 'targetTemperature')) ? `Cilj ${fmt(pick(thermostat, 'roomTargetTemp', 'targetTemperature'))} °C` : 'Očitanje termostata'} icon="thermometer" tone="signal" />
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
        {data.programs.length ? data.programs.slice(0, 8).map((program, index) => <TvDataRow key={program.id ?? index} label={String(pick(program, 'dayType') ?? `Program ${index + 1}`)} detail={minuteTime(pick(program, 'startMinute'))} value={isNumber(pick(program, 'targetTemp')) ? `${fmt(program.targetTemp)} °C` : '—'} />) : <EmptyState text="Nema rasporeda dostupnog iz API-ja." />}
      </TvCard>
    </View>
    <TvCard><TvCardTitle title="Nedavni ciklusi" subtitle="Događaji iz evidencije grijanja" icon="clock" />
      {Array.isArray(data.dashboard?.recentHeatingEvents) && data.dashboard.recentHeatingEvents.length ? data.dashboard.recentHeatingEvents.slice(0, 5).map((event: AnyRecord, i: number) => <TvDataRow key={event.id ?? i} label={dateText(pick(event, 'startedAt'))} detail={pick(event, 'durationMinutes') != null ? `${event.durationMinutes} min` : undefined} value={`${fmt(pick(event, 'roomCurrentTemp'))} °C`} />) : <EmptyState text="Nema nedavnih ciklusa u odgovoru pregleda doma." />}
    </TvCard><DataFootnote data={data} />
  </TvScrollView>;
}

export function GasScreen({ data, view, onView }: { data: TvDashboardData; view: GasView; onView: (view: GasView) => void }) {
  const analysis = data.analysis ?? {};
  const consumption = pick(analysis, 'consumptionFromReferenceM3', 'totalGas', 'currentMonthConsumption');
  const cost = pick(analysis, 'costIncVat', 'currentMonthCost', 'totalCost');
  const readings = [...data.readings].sort((a, b) => readingDate(b).localeCompare(readingDate(a)));
  return <TvScrollView>
    <TvPageHeading eyebrow="POTROŠNJA I OČITANJA" title="Plin" subtitle="Prikaz evidentiranih podataka · na TV-u nema dodavanja ni uređivanja" right={<View style={styles.chipRow}><TvChip label="Očitanja" active={view === 'readings'} onPress={() => onView('readings')} /><TvChip label="Analiza" active={view === 'analysis'} onPress={() => onView('analysis')} /></View>} />
    <View style={styles.metricGrid}>
      <TvMetricCard label="Potrošnja" value={fmt(consumption, 2)} unit={String(pick(analysis, 'unit') ?? 'm³')} meta="Vrijednost vraćena analizom" icon="gas" tone="signal" />
      <TvMetricCard label="Trošak ukupno" value={fmt(cost, 2)} unit={String(pick(analysis, 'currency') ?? 'KM')} meta="Samo ako je dostupno u API-ju" icon="cost" tone="ok" />
      <TvMetricCard label="Prosjek po danu" value={fmt(pick(analysis, 'averageDailyConsumption'))} unit="m³" meta="Analiza potrošnje" icon="chart" />
      <TvMetricCard label="Očitanja evidentirana" value={String(readings.length)} meta="Broj trenutno učitanih zapisa" icon="calendar" />
    </View>
    <View style={styles.twoColumns}>
      <TvCard containerStyle={{ flex: 1 }}><TvCardTitle title={view === 'readings' ? 'Historija očitanja' : 'Analiza potrošnje'} subtitle={view === 'readings' ? 'Podaci direktno iz evidencije' : 'Metrike dostupne kroz gas analysis API'} icon="chart" />
        {view === 'readings' ? readings.length ? readings.slice(0, 8).map((reading, index) => <TvDataRow key={reading.id ?? index} label={dateText(readingDate(reading))} detail={pick(reading, 'counterValue', 'meterReading', 'value', 'reading') != null ? `Stanje brojila ${fmt(pick(reading, 'counterValue', 'meterReading', 'value', 'reading'), 2)} ${String(pick(reading, 'unit') ?? 'm³')}` : undefined} value={pick(reading, 'consumption') != null ? `${fmt(reading.consumption, 2)} m³` : '—'} />) : <EmptyState text="Nema očitanja vraćenih iz API-ja." /> : <>
          <TvDataRow label="Potrošnja ukupno" value={`${fmt(consumption, 2)} ${String(pick(analysis, 'unit') ?? 'm³')}`} />
          <TvDataRow label="Prosječna mjesečna potrošnja" value={`${fmt(pick(analysis, 'averageMonthlyConsumption'))} m³`} />
          <TvDataRow label="Procjena mjesečne potrošnje" value={`${fmt(pick(analysis, 'projectedMonthlyConsumption'))} m³`} />
          <TvDataRow label="Trošak s PDV-om" value={`${fmt(cost, 2)} ${String(pick(analysis, 'currency') ?? 'KM')}`} />
          <TvDataRow label="Poređenje s prethodnim periodom" value={fmt(pick(analysis, 'consumptionChange')) === '—' ? '—' : `${fmt(pick(analysis, 'consumptionChange'))}%`} />
        </>}</TvCard>
      <TvCard containerStyle={{ flex: 1 }}><TvCardTitle title="Stanje podataka" subtitle="Ažurirano isključivo iz postojećih GET API-ja" icon="shield" />
        <TvDataRow label="Učitana očitanja" value={String(readings.length)} />
        <TvDataRow label="Raspon analize" value={analysis.fromDate || analysis.toDate ? `${dateText(analysis.fromDate)} – ${dateText(analysis.toDate)}` : 'Nije naveden'} />
        <TvDataRow label="Evidencija" value={readings.length ? 'Dostupna' : 'Nema podataka'} tone={readings.length ? 'ok' : 'dim'} />
        <ReadingChart readings={readings} />
      </TvCard>
    </View><DataFootnote data={data} />
  </TvScrollView>;
}

export function SettingsScreen({ data, view, onView }: { data: TvDashboardData; view: SettingsView; onView: (view: SettingsView) => void }) {
  const menu: { id: SettingsView; label: string; icon: TvIconName }[] = [
    { id: 'profile', label: 'Profil', icon: 'profile' }, { id: 'notifications', label: 'Obavijesti', icon: 'bell' }, { id: 'schedule', label: 'Raspored grijanja', icon: 'calendar' },
  ];
  return <TvScrollView>
    <TvPageHeading eyebrow="POSTAVKE · SAMO PREGLED" title="Profil i postavke" subtitle="Izmjene profila i uređaja ostaju dostupne u mobilnoj aplikaciji" />
    <View style={styles.settingsLayout}>
      <View style={styles.settingsMenu}>{menu.map((item) => <Pressable key={item.id} focusable onPress={() => onView(item.id)} style={({ focused }) => [styles.settingsButton, view === item.id && styles.settingsButtonActive, focused && styles.navFocused]}><TvIcon name={item.icon} size={21} color={view === item.id ? colors.accent : colors.textMuted} /><TvText size="small" style={view === item.id ? styles.settingsTextActive : undefined}>{item.label}</TvText><TvIcon name="chevron" size={17} color={colors.textDim} /></Pressable>)}</View>
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
    {data.notifications.length ? data.notifications.slice(0, 10).map((notification, index) => <TvDataRow key={notification.id ?? index} label={String(pick(notification, 'title', 'type') ?? 'Obavijest')} detail={String(pick(notification, 'message', 'body') ?? dateText(pick(notification, 'createdAt')))} value={dateText(pick(notification, 'createdAt'))} tone={pick(notification, 'readAt', 'isRead') ? 'dim' : 'primary'} />) : <EmptyState text="Nema obavijesti vraćenih iz API-ja." />}</TvCard>;
}

function ScheduleSettings({ data }: { data: TvDashboardData }) {
  return <TvCard><TvCardTitle title="Raspored grijanja" subtitle="Program sinhronizovan s termostatom · nije moguće uređivati na TV-u" icon="calendar" right={<TvStatusPill label="SAMO PREGLED" tone="signal" />} />
    {data.programs.length ? data.programs.slice(0, 12).map((program, index) => <TvDataRow key={program.id ?? index} label={String(pick(program, 'dayType') ?? `Period ${index + 1}`)} detail={minuteTime(pick(program, 'startMinute'))} value={isNumber(pick(program, 'targetTemp')) ? `${fmt(program.targetTemp)} °C` : '—'} />) : <EmptyState text="Nema rasporeda vraćenog iz API-ja." />}</TvCard>;
}

function AnalyticsView({ data }: { data: TvDashboardData }) {
  const analysis = data.analysis ?? {};
  return <><View style={styles.metricGrid}>
    <TvMetricCard label="Potrošnja plina" value={fmt(pick(analysis, 'consumptionFromReferenceM3', 'totalGas', 'currentMonthConsumption'), 2)} unit="m³" meta="Analizirani period" icon="gas" tone="signal" />
    <TvMetricCard label="Trošak s PDV-om" value={fmt(pick(analysis, 'costIncVat', 'currentMonthCost', 'totalCost'), 2)} unit="KM" meta="Stvarna vrijednost API-ja" icon="cost" tone="ok" />
    <TvMetricCard label="Prosjek po danu" value={fmt(pick(analysis, 'averageDailyConsumption'))} unit="m³" meta="Ako je uključen u odgovor" icon="chart" />
    <TvMetricCard label="Rad grijanja" value={fmt(pick(analysis, 'totalHeatingHours'))} unit="h" meta="Ako je uključen u odgovor" icon="clock" />
  </View><TvCard><TvCardTitle title="Trendovi i raspon" subtitle="Ne prikazujemo izmišljene istorijske tačke" icon="chart" />
    <TvDataRow label="Početak perioda" value={dateText(analysis.period?.from ?? analysis.fromDate)} /><TvDataRow label="Kraj perioda" value={dateText(analysis.period?.to ?? analysis.toDate)} />
    <TemperatureChart events={data.heatingEvents} /><ReadingChart readings={data.readings} />
  </TvCard></>;
}

function HealthView({ data }: { data: TvDashboardData }) {
  const health = data.health ?? {};
  const checks = Array.isArray(health.components) ? health.components : Array.isArray(health.checks) ? health.checks : Array.isArray(health.items) ? health.items : [];
  const score = pick(health, 'score', 'healthScore', 'overallScore');
  const alerts = pick(health, 'warnings', 'alerts');
  return <><View style={styles.metricGrid}>
    <TvMetricCard label="Zdravlje sistema" value={fmt(score, 0)} unit={score != null ? '/ 100' : undefined} meta="Samo API-jem vraćena ocjena" icon="shield" tone="ok" />
    <TvMetricCard label="Provjere" value={String(checks.length || '—')} meta="Status provjera u odgovoru" icon="check" tone="signal" />
    <TvMetricCard label="Upozorenja" value={Array.isArray(alerts) ? String(alerts.length) : fmt(alerts, 0)} meta="Aktivna upozorenja" icon="alert" tone={Array.isArray(alerts) && alerts.length ? 'warn' : 'ok'} />
    <TvMetricCard label="Uređaji" value={String(data.devices.length || '—')} meta="Termostati dostupni za nalog" icon="thermometer" />
  </View><View style={styles.twoColumns}><TvCard><TvCardTitle title="Zdravlje sistema" subtitle="Automatske provjere iz dashboard health API-ja" icon="shield" />
    {checks.length ? checks.slice(0, 8).map((check: AnyRecord, index: number) => <TvDataRow key={check.id ?? index} label={String(pick(check, 'label', 'name', 'title', 'key') ?? `Provjera ${index + 1}`)} detail={String(pick(check, 'message', 'description', 'weight') ?? '')} value={isNumber(pick(check, 'score')) ? `${fmt(check.score, 0)} / 100` : String(pick(check, 'status', 'state') ?? '—')} tone={isNumber(pick(check, 'score')) ? 'ok' : /ok|good|healthy|pass/i.test(String(pick(check, 'status', 'state'))) ? 'ok' : 'muted'} />) : <EmptyState text="Nema pojedinačnih provjera u odgovoru health API-ja." />}
    </TvCard><TvCard><TvCardTitle title="Upozorenja" subtitle="Samo trenutno vraćeni status" icon="alert" />{Array.isArray(alerts) && alerts.length ? alerts.slice(0, 8).map((alert: AnyRecord, index: number) => <TvDataRow key={alert.id ?? index} label={String(pick(alert, 'title', 'type') ?? `Upozorenje ${index + 1}`)} detail={String(pick(alert, 'message', 'description') ?? '')} value={String(pick(alert, 'severity', 'status') ?? 'Aktivno')} tone="warn" />) : <EmptyState text="Nema aktivnih upozorenja prijavljenih u API odgovoru." />}</TvCard></View></>;
}

function HeatingSummary({ data }: { data: TvDashboardData }) {
  const thermostat = data.dashboard?.homes?.[0]?.thermostats?.[0] ?? {};
  const boiler = data.dashboard?.system?.boiler ?? {};
  const active = data.heatingStatus.some((item) => item?.isHeatingNow === true);
  return <TvCard><TvCardTitle title="Status grijanja" subtitle={String(pick(thermostat, 'alias', 'name') ?? 'Termostat')} right={<TvStatusPill label={active ? 'AKTIVNO' : 'STATUS NEPOZNAT'} tone={active ? 'ok' : 'neutral'} />} icon="flame" />
    <TvDataRow label="Termostat" value={`${fmt(pick(thermostat, 'roomCurrentTemp'))} / ${fmt(pick(thermostat, 'roomTargetTemp'))} °C`} />
    <TvDataRow label="Polazna voda" value={`${fmt(pick(boiler, 'actualFlowTemp'))} °C`} />
    <TvDataRow label="Ciklusi u periodu" value={fmt(pick(data.heatingSummary, 'totalCycles'), 0)} />
  </TvCard>;
}
function HealthSummary({ data }: { data: TvDashboardData }) {
  const score = pick(data.health, 'score', 'healthScore', 'overallScore');
  return <TvCard><TvCardTitle title="Zdravlje sistema" subtitle="Status iz dashboard health API-ja" icon="shield" right={<TvStatusPill label={score != null ? 'PODACI UČITANI' : 'NEMA STATUSA'} tone={score != null ? 'ok' : 'neutral'} />} />
    <TvDataRow label="Ocjena sistema" value={score != null ? `${fmt(score, 0)} / 100` : '—'} />
    <TvDataRow label="Uređaji u nalogu" value={String(data.devices.length || '—')} />
    <TvDataRow label="Obavijesti" value={String(data.notifications.length)} />
    <TvText size="micro" tone="dim">Bez API podatka kartica ostaje prazna; TV ne koristi demo vrijednosti.</TvText>
  </TvCard>;
}
function Recommendation({ data }: { data: TvDashboardData }) {
  const recommendation = data.dashboard?.system?.recommendation ?? {};
  return <TvCard><TvCardTitle title="Preporuka sistema" subtitle="Vrijednosti koje vraća dashboard API" icon="trend" />
    <TvDataRow label="Preporučena polazna temperatura" value={isNumber(pick(recommendation, 'recommendedFlowTemp')) ? `${fmt(recommendation.recommendedFlowTemp)} °C` : '—'} />
    <TvDataRow label="Izvor preporuke" value={String(pick(recommendation, 'source') ?? '—')} />
    <TvText size="micro" tone="dim">Preporuka je informativna i TV ne mijenja postavke kotla.</TvText>
  </TvCard>;
}
function DataFootnote({ data }: { data: TvDashboardData }) {
  return <View style={styles.footnote}><TvIcon name="shield" size={14} color={colors.textDim} /><TvText size="micro" tone="dim">Samo pregled · vrijednosti se prikazuju isključivo kada ih postojeći API vrati{data.updatedAt ? ` · osvježeno ${new Date(data.updatedAt).toLocaleTimeString('bs-BA', { hour: '2-digit', minute: '2-digit' })}` : ''}</TvText></View>;
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
  return <View style={styles.chartPlaceholder}><Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}><Path d={`M0 12H${width}M0 41H${width}M0 70H${width}`} stroke={colors.border} strokeWidth="1" strokeDasharray="4 6" /><Path d={`M${points.join(' L')}`} fill="none" stroke={colors.accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></Svg><TvText size="micro" tone="dim" style={styles.chartCaption}>Stvarna sobna temperatura · {values.length} očitanja</TvText></View>;
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
  return <View style={styles.chartPlaceholder}><Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}><Path d={`M0 12H${width}M0 41H${width}M0 70H${width}`} stroke={colors.border} strokeWidth="1" strokeDasharray="4 6" /><Path d={`M${points.join(' L')}`} fill="none" stroke={colors.accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></Svg><TvText size="micro" tone="dim" style={styles.chartCaption}>Stanje brojila · {values.length} evidentirana očitanja</TvText></View>;
}
function EmptyChart({ caption }: { caption: string }) { return <View style={styles.chartPlaceholder}><Svg width="100%" height={82} viewBox="0 0 500 82"><Path d="M0 18H500M0 41H500M0 64H500" stroke={colors.border} strokeWidth="1" strokeDasharray="4 6" /><Circle cx="20" cy="41" r="4" fill={colors.textDim} /></Svg><TvText size="micro" tone="dim" style={styles.chartCaption}>{caption}</TvText></View>; }
function Loading() { return <View style={styles.loading}><ActivityIndicator color={colors.accent} /><TvText size="small" tone="muted">Učitavanje stvarnih podataka…</TvText></View>; }
function readingDate(reading: AnyRecord) { return String(pick(reading, 'readingDate', 'date', 'createdAt') ?? ''); }
function minuteTime(value: unknown) { if (!isNumber(value)) return undefined; const minutes = Math.max(0, Math.floor(value)); return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`; }

const styles = StyleSheet.create({
  nav: { height: 78, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 28, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 28 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 11, minWidth: 210 }, brandIcon: { width: 39, height: 39, borderRadius: 12, backgroundColor: `${colors.accent}1c`, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${colors.accent}44` },
  brandName: { fontFamily: fonts.sansSemiBold }, brandCaption: { fontFamily: fonts.mono, letterSpacing: 1, marginTop: 2 }, navItems: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  navItem: { minWidth: 116, height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderWidth: 1, borderColor: 'transparent', borderRadius: 11 }, navItemActive: { backgroundColor: `${colors.accent}12`, borderColor: `${colors.accent}30` }, navFocused: { borderColor: colors.accent, backgroundColor: `${colors.accent}16` }, navLabel: { color: colors.textMuted, fontFamily: fonts.sansMedium }, navLabelActive: { color: colors.accent, fontFamily: fonts.sansSemiBold },
  navStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 125, justifyContent: 'flex-end' }, onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success }, onlineLabel: { fontFamily: fonts.mono, letterSpacing: 1 },
  topbar: { minHeight: 58, paddingHorizontal: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: `${colors.border}99` }, topBrand: { flexDirection: 'row', alignItems: 'center', gap: 10 }, topHome: { fontFamily: fonts.sansSemiBold }, topMeta: { flexDirection: 'row', alignItems: 'center', gap: 22 }, topMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 8 }, topValue: { fontFamily: fonts.monoSemiBold }, clockWrap: { alignItems: 'flex-end', gap: 2 }, clock: { fontFamily: fonts.monoSemiBold },
  chipRow: { flexDirection: 'row', gap: 8, alignItems: 'center' }, metricGrid: { flexDirection: 'row', gap: 14, marginVertical: 2 }, twoColumns: { flexDirection: 'row', gap: 14 }, settingsLayout: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' }, settingsMenu: { width: 250, gap: 8 }, settingsButton: { minHeight: 58, borderRadius: 12, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, settingsButtonActive: { borderColor: `${colors.accent}55`, backgroundColor: `${colors.accent}10` }, settingsTextActive: { color: colors.accent, fontFamily: fonts.sansSemiBold, flex: 1 }, settingsContent: { flex: 1 },
  empty: { paddingVertical: 19, paddingHorizontal: 6 }, chartPlaceholder: { marginTop: 8, borderRadius: 10, backgroundColor: colors.background, borderWidth: 1, borderColor: `${colors.border}99`, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10 }, chartCaption: { lineHeight: 16 }, loading: { minHeight: 78, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }, footnote: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 3 },
});
