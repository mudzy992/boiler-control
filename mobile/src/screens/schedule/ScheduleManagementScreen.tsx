import { useMemo, useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  useColorModeValue,
  ScrollView,
  Icon,
  Badge,
  Select,
  Center,
} from '../../components/ui/nativewind';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { thermostatApi } from '../../services/api/thermostat.api';
import { useTranslation } from '../../hooks/useTranslation';
import { useNavigation } from '@react-navigation/native';
import { Screen, ScreenHeader, SkeletonPanel, SkeletonRows } from '../../ui';

/**
 * SCHEDULE MANAGEMENT SCREEN (VIEW-ONLY)
 *
 * ⚠️ READ-ONLY DISPLAY ONLY
 *
 * This screen displays the current thermostat heating programs as received from the Tuya Cloud.
 * No write operations are supported - scheduling modifications require backend API implementation.
 *
 * Backend Integration:
 * ✅ Fetches devices from GET /api/thermostat-device
 * ✅ Fetches programs from GET /api/thermostat-device/:id/programs
 * ✅ Stores programs in local database via ProgramSyncService
 * ✅ Displays current active interval and next scheduled change
 * ❌ Does NOT support creating, editing, or deleting programs
 * ❌ Does NOT support sending commands to Tuya devices
 *
 * Future Enhancement:
 * When backend implements Tuya command API, this screen can be enhanced to include
 * program editing, creation, and scheduling features. Currently limited to visualization.
 */

// Day type constants from backend (Prisma DayType enum)
type DayType = 'WORKDAY' | 'SATURDAY' | 'SUNDAY';

interface ThermostatProgram {
  id: number;
  dayType: DayType;
  startMinute: number; // Minutes since midnight (e.g., 6:30 = 390)
  targetTemp: number;
  orderIndex: number; // 0-5 (max 6 intervals per day)
}

interface GroupedPrograms {
  workday: ThermostatProgram[];
  saturday: ThermostatProgram[];
  sunday: ThermostatProgram[];
}

// Helper: Convert minutes since midnight to HH:MM format
const minutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

// Helper: Get current active interval
const getCurrentActiveInterval = (programs: ThermostatProgram[]): ThermostatProgram | null => {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Determine day type
  const dayOfWeek = now.getDay();
  const dayType: DayType =
    dayOfWeek === 0 || dayOfWeek === 6 ? (dayOfWeek === 0 ? 'SUNDAY' : 'SATURDAY') : 'WORKDAY';

  // Find programs for today
  const todayPrograms = programs
    .filter((p) => p.dayType === dayType)
    .sort((a, b) => a.startMinute - b.startMinute);

  // Find current active
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

// Helper: Get next scheduled change
/**
 * F1: `dayLabel` iz helpera je ključ (`today` / `tomorrow`), ne prikazni tekst.
 * Prijevod se radi na mjestu renderovanja, pa helper ne zavisi od i18n-a.
 */
const dayLabelKey = (day: string) =>
  `schedule.day${day.charAt(0).toUpperCase()}${day.slice(1)}`;

const getNextScheduledChange = (
  programs: ThermostatProgram[]
): { program: ThermostatProgram; time: string; dayLabel: string } | null => {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const dayOfWeek = now.getDay();

  // Try to find next today
  const dayType: DayType =
    dayOfWeek === 0 || dayOfWeek === 6 ? (dayOfWeek === 0 ? 'SUNDAY' : 'SATURDAY') : 'WORKDAY';

  const todayPrograms = programs
    .filter((p) => p.dayType === dayType)
    .sort((a, b) => a.startMinute - b.startMinute);
  const nextToday = todayPrograms.find((p) => p.startMinute > currentMinutes);

  if (nextToday) {
    return { program: nextToday, time: minutesToTime(nextToday.startMinute), dayLabel: 'today' };
  }

  // Find first program tomorrow
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

// Program interval card component - MOVED OUTSIDE to avoid hooks ordering issues
const ProgramIntervalCard = ({ program }: { program: ThermostatProgram }) => {
  const { t } = useTranslation();
  const cardBg = useColorModeValue('white', 'dark.800');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const subtextColor = useColorModeValue('gray.600', 'gray.400');

  return (
    <Box bg={cardBg} rounded="lg" p={3} borderLeftWidth={3} borderLeftColor="brand.500">
      <HStack justifyContent="space-between" alignItems="center">
        <VStack flex={1} space={1}>
          <HStack alignItems="center" space={2}>
            <Icon as={Ionicons} name="time-outline" size={4} color={subtextColor} />
            <Text fontSize="sm" fontWeight="bold" color={textColor}>
              {minutesToTime(program.startMinute)}
            </Text>
          </HStack>
          <HStack alignItems="center" space={2}>
            <Icon as={Ionicons} name="thermometer-outline" size={4} color={subtextColor} />
            <Text fontSize="sm" color={subtextColor}>
              {t('schedule.targetTemp', { value: program.targetTemp })}
            </Text>
          </HStack>
        </VStack>
        <Badge colorScheme="coolGray" variant="subtle">
          #{program.orderIndex + 1}
        </Badge>
      </HStack>
    </Box>
  );
};

// Day group section - MOVED OUTSIDE to avoid hooks ordering issues
const DayGroupSection = ({
  programs,
  dayLabel,
}: {
  programs: ThermostatProgram[];
  dayLabel: string;
}) => {
  const { t } = useTranslation();
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const subtextColor = useColorModeValue('gray.600', 'gray.400');

  return (
    <Box>
      <Heading size="sm" color={textColor} mb={2}>
        {dayLabel}
      </Heading>
      {programs.length === 0 ? (
        <Text fontSize="sm" color={subtextColor} italic>
          {t('schedule.noProgramsForDay', { day: dayLabel.toLowerCase() })}
        </Text>
      ) : (
        <VStack space={2}>
          {programs.map((program) => (
            <ProgramIntervalCard
              key={`${program.dayType}-${program.orderIndex}`}
              program={program}
            />
          ))}
        </VStack>
      )}
    </Box>
  );
};

const ScheduleManagementScreenContent = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);

  // ALL HOOKS CALLED AT TOP LEVEL UNCONDITIONALLY
  const bgColor = useColorModeValue('gray.50', 'dark.900');
  const cardBg = useColorModeValue('white', 'dark.800');
  const borderColor = useColorModeValue('gray.200', 'dark.700');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const subtextColor = useColorModeValue('gray.600', 'gray.400');
  const infoColor = useColorModeValue('blue.50', 'dark.700');
  const infoBorder = useColorModeValue('blue.200', 'blue.700');
  const greenBg = useColorModeValue('green.50', 'dark.700');
  const greenText = useColorModeValue('green.700', 'green.400');
  const greenBorder = 'green.200';

  // Fetch all thermostat devices
  const {
    data: devices,
    isLoading: devicesLoading,
    isError: devicesError,
  } = useQuery({
    queryKey: ['thermostat-devices'],
    queryFn: thermostatApi.getAllDevices,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Auto-select first device
  useEffect(() => {
    if (devices && devices.length > 0 && !selectedDeviceId) {
      setSelectedDeviceId(devices[0].id);
    }
  }, [devices, selectedDeviceId]);

  // Fetch programs for selected device
  const {
    data: programs = [],
    isLoading: programsLoading,
    isError: programsError,
    error: programsErrorObj,
  } = useQuery({
    queryKey: ['thermostat-programs', selectedDeviceId],
    queryFn: () => thermostatApi.getDevicePrograms(selectedDeviceId!),
    enabled: !!selectedDeviceId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  const isLoading = devicesLoading || programsLoading;
  const error = devicesError || programsError;

  // Group programs by day type
  const groupedPrograms = useMemo<GroupedPrograms>(() => {
    return {
      workday: programs
        .filter((p) => p.dayType === 'WORKDAY')
        .sort((a, b) => a.startMinute - b.startMinute),
      saturday: programs
        .filter((p) => p.dayType === 'SATURDAY')
        .sort((a, b) => a.startMinute - b.startMinute),
      sunday: programs
        .filter((p) => p.dayType === 'SUNDAY')
        .sort((a, b) => a.startMinute - b.startMinute),
    };
  }, [programs]);

  const currentActive = useMemo(() => getCurrentActiveInterval(programs), [programs]);
  const nextChange = useMemo(() => getNextScheduledChange(programs), [programs]);

  if (isLoading) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader
          title={t('schedule.title')}
          onBack={() => (navigation as any).goBack()}
          backLabel={t('common.back')}
          testID="schedule-header"
        />
        {/* F4 (UX-07): skeleton redova programa, u footprintu liste. */}
        <Box px={4} pt={3} style={{ gap: 12 }}>
          <SkeletonPanel lines={1} height={84} />
          <SkeletonRows count={4} />
        </Box>
      </Screen>
    );
  }

  if (error) {
    return (
      <Box flex={1} bg={bgColor} safeArea>
        <Center flex={1} px={4}>
          <Icon as={Ionicons} name="alert-circle-outline" size={16} color="red.500" mb={4} />
          <Text color={textColor} fontSize="lg" fontWeight="bold" mb={2}>
            {t('schedule.loadErrorTitle')}
          </Text>
          <Text color={subtextColor} textAlign="center">
            {programsErrorObj instanceof Error
              ? programsErrorObj.message
              : t('schedule.loadErrorBody')}
          </Text>
        </Center>
      </Box>
    );
  }

  if (!devices || devices.length === 0) {
    return (
      <Box flex={1} bg={bgColor} safeArea>
        <Center flex={1} px={4}>
          <Icon as={Ionicons} name="thermometer-outline" size={16} color="gray.400" mb={4} />
          <Text color={textColor} fontSize="lg" fontWeight="bold" mb={2}>
            {t('schedule.noDevicesTitle')}
          </Text>
          <Text color={subtextColor} textAlign="center">
            {t('schedule.noDevicesBody')}
          </Text>
        </Center>
      </Box>
    );
  }

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId);

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title={t('schedule.title')}
        subtitle={t('schedule.subtitle')}
        onBack={() => (navigation as any).goBack()}
        backLabel={t('common.back')}
        testID="schedule-header"
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        <VStack px={4} py={4} space={4}>

          {/* Device Selector (if multiple devices) */}
          {devices && devices.length > 1 && (
            <Box>
              <Text fontSize="sm" fontWeight="600" color={textColor} mb={2}>
                {t('schedule.selectThermostat')}
              </Text>
              <Select
                selectedValue={selectedDeviceId?.toString()}
                minWidth="200"
                accessibilityLabel={t('schedule.selectThermostat')}
                placeholder={t('schedule.selectThermostat')}
                bg={cardBg}
                onValueChange={(itemValue: string) => setSelectedDeviceId(parseInt(itemValue))}
              >
                {devices.map((device) => (
                  <Select.Item
                    key={device.id}
                    label={`${device.alias} (${device.vendor})`}
                    value={device.id.toString()}
                  />
                ))}
              </Select>
            </Box>
          )}

          {/* Current Device Info */}
          {selectedDevice && (
            <Box bg={cardBg} rounded="lg" p={3} borderLeftWidth={3} borderLeftColor="brand.500">
              <HStack alignItems="center" space={2}>
                <Icon as={Ionicons} name="thermometer" size={5} color="brand.500" />
                <VStack flex={1}>
                  <Text fontSize="md" fontWeight="bold" color={textColor}>
                    {selectedDevice.alias}
                  </Text>
                  <Text fontSize="xs" color={subtextColor}>
                    {selectedDevice.vendor} ·{' '}
                    {t('schedule.deviceMode', {
                      mode: t(`schedule.mode.${selectedDevice.mode}`, {
                        defaultValue: selectedDevice.mode,
                      }),
                    })}
                  </Text>
                </VStack>
                <Badge colorScheme={selectedDevice.mode === 'PROGRAM' ? 'success' : 'warning'}>
                  {t(`schedule.mode.${selectedDevice.mode}`, {
                    defaultValue: selectedDevice.mode,
                  })}
                </Badge>
              </HStack>
            </Box>
          )}

          {/* Status Badge - Read Only Notice */}
          <Box bg={infoColor} borderWidth={1} borderColor={infoBorder} rounded="lg" p={3}>
            <HStack alignItems="flex-start" space={2}>
              <Icon as={Ionicons} name="information-circle" size={5} color="blue.500" mt={0.5} />
              <VStack flex={1} space={1}>
                <Text fontSize="xs" fontWeight="bold" color="blue.700">
                  {t('schedule.readOnlyTitle')}
                </Text>
                <Text fontSize="xs" color="blue.600">
                  {t('schedule.readOnlyBody')}
                </Text>
              </VStack>
            </HStack>
          </Box>

          {programs.length === 0 ? (
            <Center py={10}>
              <Icon as={Ionicons} name="calendar-outline" size={16} color="gray.400" mb={3} />
              <Text color={subtextColor} fontSize="sm">
                {t('schedule.noPrograms')}
              </Text>
            </Center>
          ) : (
            <>
              {/* Current Active */}
              {currentActive && (
                <Box bg={greenBg} rounded="lg" p={4} borderWidth={1} borderColor={greenBorder}>
                  <HStack space={3} alignItems="flex-start">
                    <Icon as={Ionicons} name="checkmark-circle" size={6} color="green.500" />
                    <VStack flex={1} space={1}>
                      <Text fontSize="xs" fontWeight="bold" color={greenText}>
                        {t('schedule.currentlyActive')}
                      </Text>
                      <Text fontSize="sm" color={textColor} fontWeight="bold">
                        {minutesToTime(currentActive.startMinute)} • {currentActive.targetTemp}°C
                      </Text>
                      <Text fontSize="xs" color={subtextColor}>
                        {t('schedule.activeIntervalToday')}
                      </Text>
                    </VStack>
                  </HStack>
                </Box>
              )}

              {/* Next Scheduled Change */}
              {nextChange && (
                <Box
                  bg={cardBg}
                  rounded="lg"
                  p={4}
                  borderLeftWidth={2}
                  borderLeftColor="orange.400"
                >
                  <HStack space={3} alignItems="flex-start">
                    <Icon as={Ionicons} name="arrow-forward-circle" size={6} color="orange.500" />
                    <VStack flex={1} space={1}>
                      <Text fontSize="xs" fontWeight="bold" color={subtextColor}>
                        {t('schedule.nextChange')}
                      </Text>
                      <Text fontSize="sm" color={textColor} fontWeight="bold">
                        {t('schedule.nextChangeAt', {
                          day: t(dayLabelKey(nextChange.dayLabel)),
                          time: nextChange.time,
                        })}
                      </Text>
                      <Text fontSize="xs" color={subtextColor}>
                        {t('schedule.targetTemp', { value: nextChange.program.targetTemp })}
                      </Text>
                    </VStack>
                  </HStack>
                </Box>
              )}

              {/* Programs by Day */}
              <VStack space={6}>
                <DayGroupSection
                  programs={groupedPrograms.workday}
                  dayLabel={t('schedule.dayWorkdays')}
                />
                <DayGroupSection
                  programs={groupedPrograms.saturday}
                  dayLabel={t('schedule.daySaturday')}
                />
                <DayGroupSection
                  programs={groupedPrograms.sunday}
                  dayLabel={t('schedule.daySunday')}
                />
              </VStack>

              {/* Bottom Info */}
              <Box bg={cardBg} rounded="lg" p={4} mt={2} borderWidth={1} borderColor={borderColor}>
                <VStack space={2}>
                  <Text fontSize="xs" fontWeight="bold" color={textColor}>
                    {t('schedule.howItWorks')}
                  </Text>
                  <Text fontSize="xs" color={subtextColor} lineHeight="sm">
                    {t('schedule.howItWorksBody')}
                  </Text>
                  <Text fontSize="xs" color={subtextColor} lineHeight="sm" mt={2}>
                    {t('schedule.howToEditBody')}
                  </Text>
                </VStack>
              </Box>
            </>
          )}
        </VStack>
      </ScrollView>
    </Screen>
  );
};

export const ScheduleManagementScreen = ScheduleManagementScreenContent;
