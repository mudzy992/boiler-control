import { useMemo, useState, useEffect } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';

import { thermostatApi } from '../../services/api/thermostat.api';
import { useTranslation } from '../../hooks/useTranslation';
import { radius, space } from '../../theme/tokens';
import {
  DeviceName,
  EmptyState,
  ErrorState,
  InlineBanner,
  MonoLabel,
  MonoMeta,
  Panel,
  PanelRow,
  Pressable,
  Screen,
  ScreenBody,
  ScreenHeader,
  Sheet,
  SkeletonPanel,
  SkeletonRows,
  Text,
  useTokens,
} from '../../ui';

/**
 * RASPORED GRIJANJA (samo čitanje).
 *
 * ⚠️ Ekran ne mijenja programe: backend još nema Tuya komandu za upis, pa
 * prikazuje ono što stigne iz `GET /api/thermostat-device/:id/programs`.
 *
 * F10 (SCHED-THEME): ekran je bio posljednji veliki ostatak starog NativeWind
 * sloja — `gray.50`/`dark.900` podloga, `blue.50` info kutija, `green.50`
 * „aktivno" kutija, `orange.400` ivica i `brand.500` akcenti. Nijedna od tih
 * boja ne postoji u `src/theme/tokens.ts`, pa je na tamnoj temi ekran bio
 * svjetliji od ostatka aplikacije, a „aktivna zona" je izgledala kao alert.
 *
 * Sada: `Panel`/`PanelRow` (površina + hairline), `InlineBanner` za info i
 * za trenutno aktivnu zonu, `Readout` za temperaturu, `MonoMeta` za minute, i
 * `Sheet` sa radio listom za izbor termostata (prije: `Select` koji na 360 px
 * nije imao mjesta za „Boiler Living Room (Tuya)".
 *
 * Korisnikov zahtjev: **naziv uređaja velikim slovima** — vidi `DeviceTitle`.
 */

type DayType = 'WORKDAY' | 'SATURDAY' | 'SUNDAY';

interface ThermostatProgram {
  id: number;
  dayType: DayType;
  startMinute: number;
  targetTemp: number;
  orderIndex: number;
}

interface ThermostatDevice {
  id: number;
  alias: string;
  vendor: string;
  mode: string;
}

interface GroupedPrograms {
  workday: ThermostatProgram[];
  saturday: ThermostatProgram[];
  sunday: ThermostatProgram[];
}

/** Minutes since midnight → HH:MM. */
const minutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const getCurrentActiveInterval = (programs: ThermostatProgram[]): ThermostatProgram | null => {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const dayOfWeek = now.getDay();
  const dayType: DayType =
    dayOfWeek === 0 || dayOfWeek === 6 ? (dayOfWeek === 0 ? 'SUNDAY' : 'SATURDAY') : 'WORKDAY';

  const todayPrograms = programs
    .filter((p) => p.dayType === dayType)
    .sort((a, b) => a.startMinute - b.startMinute);

  return (
    todayPrograms.find((p, i) => {
      const nextProgram = todayPrograms[i + 1];
      if (nextProgram) {
        return currentMinutes >= p.startMinute && currentMinutes < nextProgram.startMinute;
      }
      return currentMinutes >= p.startMinute;
    }) || null
  );
};

/**
 * F1: `dayLabel` iz helpera je ključ (`today` / `tomorrow`), ne prikazni tekst.
 * Prijevod se radi na mjestu renderovanja, pa helper ne zavisi od i18n-a.
 */
const dayLabelKey = (day: string) =>
  `schedule.day${day.charAt(0).toUpperCase()}${day.slice(1)}`;

const getNextScheduledChange = (
  programs: ThermostatProgram[],
): { program: ThermostatProgram; time: string; dayLabel: string } | null => {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const dayOfWeek = now.getDay();

  const dayType: DayType =
    dayOfWeek === 0 || dayOfWeek === 6 ? (dayOfWeek === 0 ? 'SUNDAY' : 'SATURDAY') : 'WORKDAY';

  const todayPrograms = programs
    .filter((p) => p.dayType === dayType)
    .sort((a, b) => a.startMinute - b.startMinute);
  const nextToday = todayPrograms.find((p) => p.startMinute > currentMinutes);

  if (nextToday) {
    return { program: nextToday, time: minutesToTime(nextToday.startMinute), dayLabel: 'today' };
  }

  const tomorrowDayOfWeek = (dayOfWeek + 1) % 7;
  const tomorrowDayType: DayType =
    tomorrowDayOfWeek === 0 || tomorrowDayOfWeek === 6
      ? tomorrowDayOfWeek === 0
        ? 'SUNDAY'
        : 'SATURDAY'
      : 'WORKDAY';

  const tomorrowPrograms = programs
    .filter((p) => p.dayType === tomorrowDayType)
    .sort((a, b) => a.startMinute - b.startMinute);
  if (tomorrowPrograms.length > 0) {
    return {
      program: tomorrowPrograms[0],
      time: minutesToTime(tomorrowPrograms[0].startMinute),
      dayLabel: 'tomorrow',
    };
  }

  return null;
};

/** Jedan programski interval: vrijeme + ciljna temperatura + redni broj. */
function ProgramIntervalRow({ program, divider }: { program: ThermostatProgram; divider: boolean }) {
  const { tr } = useScheduleI18n();
  return (
    <PanelRow divider={divider} testID={`schedule-interval-${program.id}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, flex: 1 }}>
        <Text weight="monoSemiBold" size="bodyLg">
          {minutesToTime(program.startMinute)}
        </Text>
        <MonoMeta>{`${tr('schedule.targetTemp', { value: program.targetTemp })}`}</MonoMeta>
        <View style={{ flex: 1 }} />
        <MonoMeta tone="dim">{`#${program.orderIndex + 1}`}</MonoMeta>
      </View>
    </PanelRow>
  );
}

/** Mali most da komponente van glavnog tijela dobiju isti `t`. */
function useScheduleI18n() {
  const { t: tr } = useTranslation();
  return { tr };
}

function DayGroupSection({
  programs,
  dayLabel,
  testID,
}: {
  programs: ThermostatProgram[];
  dayLabel: string;
  testID: string;
}) {
  const { t: tr } = useTranslation();
  return (
    <View style={{ gap: space.sm }} testID={testID}>
      <MonoLabel>{dayLabel}</MonoLabel>
      {programs.length === 0 ? (
        <Panel padded={false}>
          <PanelRow divider={false}>
            <Text size="body" tone="dim">
              {tr('schedule.noProgramsForDay', { day: dayLabel.toLowerCase() })}
            </Text>
          </PanelRow>
        </Panel>
      ) : (
        <Panel variant="flush" padded={false}>
          {programs.map((program, index) => (
            <ProgramIntervalRow
              key={`${program.dayType}-${program.orderIndex}`}
              program={program}
              divider={index < programs.length - 1}
            />
          ))}
        </Panel>
      )}
    </View>
  );
}

const ScheduleManagementScreenContent = () => {
  const { t } = useTokens();
  const { t: tr } = useTranslation();
  const navigation = useNavigation();
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);
  const [devicePickerOpen, setDevicePickerOpen] = useState(false);

  const {
    data: devices,
    isLoading: devicesLoading,
    isError: devicesError,
  } = useQuery({
    queryKey: ['thermostat-devices'],
    queryFn: thermostatApi.getAllDevices,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (devices && devices.length > 0 && !selectedDeviceId) {
      setSelectedDeviceId(devices[0].id);
    }
  }, [devices, selectedDeviceId]);

  const {
    data: programs = [],
    isLoading: programsLoading,
    isError: programsError,
    error: programsErrorObj,
    refetch: refetchPrograms,
  } = useQuery({
    queryKey: ['thermostat-programs', selectedDeviceId],
    queryFn: () => thermostatApi.getDevicePrograms(selectedDeviceId!),
    enabled: !!selectedDeviceId,
    staleTime: 1000 * 60 * 2,
  });

  const isLoading = devicesLoading || programsLoading;
  const error = devicesError || programsError;

  const groupedPrograms = useMemo<GroupedPrograms>(
    () => ({
      workday: programs
        .filter((p: ThermostatProgram) => p.dayType === 'WORKDAY')
        .sort((a, b) => a.startMinute - b.startMinute),
      saturday: programs
        .filter((p: ThermostatProgram) => p.dayType === 'SATURDAY')
        .sort((a, b) => a.startMinute - b.startMinute),
      sunday: programs
        .filter((p: ThermostatProgram) => p.dayType === 'SUNDAY')
        .sort((a, b) => a.startMinute - b.startMinute),
    }),
    [programs],
  );

  const currentActive = useMemo(() => getCurrentActiveInterval(programs), [programs]);
  const nextChange = useMemo(() => getNextScheduledChange(programs), [programs]);

  const header = (
    <ScreenHeader
      title={tr('schedule.title')}
      subtitle={tr('schedule.subtitle')}
      onBack={() => (navigation as any).goBack()}
      backLabel={tr('common.back')}
      testID="schedule-header"
    />
  );

  if (isLoading) {
    return (
      <Screen edges={['top']}>
        {header}
        <ScreenBody>
          <SkeletonPanel lines={1} height={84} />
          <SkeletonRows count={4} />
        </ScreenBody>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen edges={['top']}>
        {header}
        <ScreenBody>
          <ErrorState
            title={tr('schedule.loadErrorTitle')}
            message={
              programsErrorObj instanceof Error
                ? programsErrorObj.message
                : tr('schedule.loadErrorBody')
            }
            retryLabel={tr('common.retry')}
            onRetry={() => void refetchPrograms()}
          />
        </ScreenBody>
      </Screen>
    );
  }

  if (!devices || devices.length === 0) {
    return (
      <Screen edges={['top']}>
        {header}
        <ScreenBody>
          <EmptyState
            icon="thermometer-outline"
            title={tr('schedule.noDevicesTitle')}
            message={tr('schedule.noDevicesBody')}
          />
        </ScreenBody>
      </Screen>
    );
  }

  const selectedDevice: ThermostatDevice | undefined = devices.find(
    (device: ThermostatDevice) => device.id === selectedDeviceId,
  );
  const modeLabel = selectedDevice
    ? tr(`schedule.mode.${selectedDevice.mode}`, { defaultValue: selectedDevice.mode })
    : '';

  return (
    <Screen edges={['top']} testID="schedule-screen">
      {header}
      <ScreenBody testID="schedule-body">
        {/* Izbor termostata: red koji otvara sheet (isti obrazac kao filter perioda). */}
        {selectedDevice ? (
          <Pressable
            onPress={() => setDevicePickerOpen(true)}
            disabled={devices.length < 2}
            accessibilityRole={devices.length > 1 ? 'combobox' : 'text'}
            accessibilityLabel={`${tr('schedule.selectThermostat')}: ${selectedDevice.alias}`}
            testID="schedule-device-select"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.md,
              minHeight: 56,
              paddingHorizontal: space.md,
              backgroundColor: t.panel,
              borderColor: t.line,
              borderWidth: 1,
              borderRadius: radius.control,
            }}
          >
            <Ionicons name="thermometer" size={16} color={t.signal} />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <DeviceName name={selectedDevice.alias} size="section" weight="semibold" />
              <MonoMeta>{`${selectedDevice.vendor} · ${modeLabel}`}</MonoMeta>
            </View>
            {devices.length > 1 ? (
              <Ionicons name="chevron-down" size={16} color={t.inkDim} />
            ) : null}
          </Pressable>
        ) : null}

        <Sheet
          isOpen={devicePickerOpen}
          onClose={() => setDevicePickerOpen(false)}
          title={tr('schedule.selectThermostat')}
          closeLabel={tr('common.close')}
          snapPoints={['45%', '70%']}
          scrollable
          testID="schedule-device-sheet"
        >
          <View>
            {devices.map((device: ThermostatDevice, index: number) => {
              const active = device.id === selectedDeviceId;
              return (
                <Pressable
                  key={device.id}
                  onPress={() => {
                    setSelectedDeviceId(device.id);
                    setDevicePickerOpen(false);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${device.alias} (${device.vendor})`}
                  testID={`schedule-device-option-${device.id}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.md,
                    minHeight: 56,
                    paddingHorizontal: space.sm,
                    borderBottomWidth: index < devices.length - 1 ? 1 : 0,
                    borderBottomColor: t.line,
                  }}
                >
                  <Ionicons
                    name={active ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={active ? t.signal : t.inkDim}
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <DeviceName name={device.alias} size="section" weight="semibold" />
                    <MonoMeta>{device.vendor}</MonoMeta>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Sheet>

        {/*
          Info traka: prije je bila `blue.50` kutija sa `blue.700` tekstom —
          boja koje u temi nema. `InlineBanner` nosi isti sadržaj i poštuje ton.
        */}
        <InlineBanner
          tone="info"
          title={tr('schedule.readOnlyTitle')}
          message={tr('schedule.readOnlyBody')}
          testID="schedule-readonly-banner"
        />

        {programs.length === 0 ? (
          <EmptyState icon="calendar-outline" title={tr('schedule.noPrograms')} />
        ) : (
          <>
            {currentActive ? (
              <InlineBanner
                tone="ok"
                title={tr('schedule.currentlyActive')}
                message={`${minutesToTime(currentActive.startMinute)} · ${currentActive.targetTemp} °C`}
                meta={tr('schedule.activeIntervalToday')}
                testID="schedule-active-banner"
              />
            ) : null}

            {nextChange ? (
              <Panel variant="hero" padded={false} testID="schedule-next-change">
                <PanelRow divider={false}>
                  <View style={{ gap: 2, flex: 1, minWidth: 0 }}>
                    <MonoLabel>{tr('schedule.nextChange')}</MonoLabel>
                    <Text size="bodyLg" weight="medium">
                      {tr('schedule.nextChangeAt', {
                        day: tr(dayLabelKey(nextChange.dayLabel)),
                        time: nextChange.time,
                      })}
                    </Text>
                    <MonoMeta>
                      {tr('schedule.targetTemp', { value: nextChange.program.targetTemp })}
                    </MonoMeta>
                  </View>
                  <Ionicons name="arrow-forward" size={18} color={t.signal} />
                </PanelRow>
              </Panel>
            ) : null}

            <DayGroupSection
              programs={groupedPrograms.workday}
              dayLabel={tr('schedule.dayWorkdays')}
              testID="schedule-day-workday"
            />
            <DayGroupSection
              programs={groupedPrograms.saturday}
              dayLabel={tr('schedule.daySaturday')}
              testID="schedule-day-saturday"
            />
            <DayGroupSection
              programs={groupedPrograms.sunday}
              dayLabel={tr('schedule.daySunday')}
              testID="schedule-day-sunday"
            />

            <Panel variant="flush" padded={false} testID="schedule-how-it-works">
              <PanelRow divider>
                <MonoLabel>{tr('schedule.howItWorks')}</MonoLabel>
              </PanelRow>
              <PanelRow divider>
                <Text size="body" tone="muted">
                  {tr('schedule.howItWorksBody')}
                </Text>
              </PanelRow>
              <PanelRow divider={false}>
                <Text size="body" tone="muted">
                  {tr('schedule.howToEditBody')}
                </Text>
              </PanelRow>
            </Panel>
          </>
        )}
      </ScreenBody>
    </Screen>
  );
};

export const ScheduleManagementScreen = ScheduleManagementScreenContent;
