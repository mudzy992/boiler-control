import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '../../hooks/useTranslation';
import { resolveColor } from '../../theme/palette';
import { weatherApi, weatherV2Keys } from '../../services/api/weather.api';
import type { WeatherLocationCandidate, WeatherV2Success } from '../../types/WeatherV2';
import { FormInput } from '../FormInput';
import {
  Box,
  HStack,
  Modal,
  Pressable,
  ScrollView,
  Spinner,
  Text,
  VStack,
  useColorModeValue,
} from '../ui/nativewind';
import {
  formatNullableNumber,
  formatWeatherDateTime,
  formatWeatherDay,
  formatWeatherHour,
  weatherConditionIcon,
} from './weatherV2.utils';

interface WeatherV2CardProps {
  homeProfileId: number;
}

interface ConfirmVariables {
  query: string;
  candidateId: string;
}

export function WeatherV2Card({ homeProfileId }: WeatherV2CardProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [locationModalOpen, setLocationModalOpen] = React.useState(false);
  const [locationQuery, setLocationQuery] = React.useState('');
  const [queryValidationError, setQueryValidationError] = React.useState(false);
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const mutedColor = useColorModeValue('gray.600', 'gray.400');
  const subtleBg = useColorModeValue('gray.100', 'gray.700');
  const accentColor = useColorModeValue('brand.500', 'brand.400');

  const weatherQuery = useQuery({
    queryKey: weatherV2Keys.current(homeProfileId),
    queryFn: () => weatherApi.getCurrent(homeProfileId),
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

  const searchMutation = useMutation({
    mutationFn: (query: string) => weatherApi.getLocationCandidates(homeProfileId, query),
  });

  const confirmMutation = useMutation({
    mutationFn: ({ query, candidateId }: ConfirmVariables) =>
      weatherApi.confirmLocation(homeProfileId, query, candidateId),
    onSuccess: () => {
      setLocationModalOpen(false);
      setLocationQuery('');
      searchMutation.reset();
      void queryClient.invalidateQueries({
        queryKey: weatherV2Keys.current(homeProfileId),
      });
    },
  });

  const openLocationSearch = () => {
    setLocationQuery('');
    setQueryValidationError(false);
    searchMutation.reset();
    confirmMutation.reset();
    setLocationModalOpen(true);
  };

  const searchLocations = () => {
    const query = locationQuery.trim();
    if (query.length < 2 || query.length > 100) {
      setQueryValidationError(true);
      return;
    }
    setQueryValidationError(false);
    searchMutation.mutate(query);
  };

  const candidates = searchMutation.data?.candidates ?? [];
  const confirmedSearchQuery = searchMutation.data?.query ?? locationQuery.trim();
  const data = weatherQuery.data;
  const forecast = data?.status === 'ok' ? data : null;

  const confirmCandidate = (candidate: WeatherLocationCandidate) => {
    confirmMutation.mutate({
      query: confirmedSearchQuery,
      candidateId: candidate.providerId,
    });
  };

  return (
    <>
      <Box bg={bgColor} borderWidth={1} borderColor={borderColor} rounded="xl" p={5}>
        <VStack space={4}>
          <HStack justifyContent="space-between" alignItems="flex-start" space={3}>
            <VStack flex={1} space={1}>
              <Text fontSize="lg" fontWeight="700" color={textColor}>
                {t('weather.title')}
              </Text>
              {forecast && (
                <Text fontSize="xs" color={mutedColor}>
                  {forecast.location.label}
                </Text>
              )}
            </VStack>
            {forecast && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('weather.changeLocation')}
                onPress={openLocationSearch}
                px={2}
                py={1}
              >
                <Text fontSize="xs" fontWeight="600" color={accentColor}>
                  {t('weather.changeLocation')}
                </Text>
              </Pressable>
            )}
          </HStack>

          {weatherQuery.isLoading && (
            <HStack space={3} alignItems="center">
              <Spinner color={accentColor} />
              <Text color={mutedColor}>{t('weather.loading')}</Text>
            </HStack>
          )}

          {weatherQuery.isError && !data && (
            <VStack space={3}>
              <Text color="red.500">{t('weather.unavailable')}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('common.retry')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => void weatherQuery.refetch()}
                bg="brand.500"
                rounded="md"
                px={4}
                py={2}
                alignSelf="flex-start"
              >
                <Text color="white" fontWeight="600">
                  {t('common.retry')}
                </Text>
              </Pressable>
            </VStack>
          )}

          {data?.status === 'location_confirmation_required' && (
            <VStack space={3}>
              <Text fontSize="sm" color={mutedColor}>
                {t('weather.locationRequired')}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('weather.chooseLocation')}
                onPress={openLocationSearch}
                bg="brand.500"
                rounded="md"
                px={4}
                py={3}
                alignSelf="flex-start"
              >
                <Text color="white" fontWeight="600">
                  {t('weather.chooseLocation')}
                </Text>
              </Pressable>
            </VStack>
          )}

          {forecast && (
            <ForecastContent
              forecast={forecast}
              locale={i18n.language}
              textColor={textColor}
              mutedColor={mutedColor}
              subtleBg={subtleBg}
              accentColor={accentColor}
            />
          )}
        </VStack>
      </Box>

      {/* Zatvoreni dijalog ne opterećuje inicijalni forecast render. */}
      {locationModalOpen && (
        <Modal isOpen={locationModalOpen} onClose={() => setLocationModalOpen(false)}>
          <Modal.Content>
            <Modal.CloseButton />
            <Modal.Header>{t('weather.chooseLocation')}</Modal.Header>
            <Modal.Body px={0} py={0}>
              <ScrollView style={{ maxHeight: 520 }}>
                <VStack px={5} py={4} space={4}>
                  <Text fontSize="sm" color={mutedColor}>
                    {t('weather.locationExplanation')}
                  </Text>
                  <FormInput
                    accessibilityLabel={t('weather.locationQuery')}
                    placeholder={t('weather.locationPlaceholder')}
                    value={locationQuery}
                    autoCapitalize="words"
                    isDisabled={searchMutation.isPending || confirmMutation.isPending}
                    onChangeText={(value) => {
                      setLocationQuery(value);
                      setQueryValidationError(false);
                      searchMutation.reset();
                    }}
                    onSubmitEditing={searchLocations}
                  />
                  {queryValidationError && (
                    <Text fontSize="sm" color="red.500">
                      {t('weather.locationQueryError')}
                    </Text>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('weather.searchLocation')}
                    onPress={searchLocations}
                    isDisabled={searchMutation.isPending || confirmMutation.isPending}
                    opacity={searchMutation.isPending ? 0.6 : 1}
                    bg="brand.500"
                    rounded="md"
                    px={4}
                    py={3}
                    alignItems="center"
                  >
                    <Text color="white" fontWeight="600">
                      {searchMutation.isPending
                        ? t('weather.searchingLocation')
                        : t('weather.searchLocation')}
                    </Text>
                  </Pressable>

                  {searchMutation.isError && (
                    <Text fontSize="sm" color="red.500">
                      {t('weather.locationSearchError')}
                    </Text>
                  )}
                  {searchMutation.isSuccess && candidates.length === 0 && (
                    <Text fontSize="sm" color={mutedColor}>
                      {t('weather.noLocations')}
                    </Text>
                  )}

                  <VStack space={2}>
                    {candidates.map((candidate) => (
                      <Pressable
                        key={candidate.providerId}
                        accessibilityRole="button"
                        accessibilityLabel={t('weather.confirmCandidate', {
                          location: candidate.label,
                        })}
                        onPress={() => confirmCandidate(candidate)}
                        isDisabled={confirmMutation.isPending}
                        borderWidth={1}
                        borderColor={borderColor}
                        bg={subtleBg}
                        rounded="md"
                        p={3}
                      >
                        <VStack space={1}>
                          <Text fontSize="sm" fontWeight="600" color={textColor}>
                            {candidate.label}
                          </Text>
                          <Text fontSize="xs" color={mutedColor}>
                            {candidate.timezone}
                          </Text>
                        </VStack>
                      </Pressable>
                    ))}
                  </VStack>
                  {confirmMutation.isPending && (
                    <HStack space={2} alignItems="center">
                      <Spinner color={accentColor} />
                      <Text fontSize="sm" color={mutedColor}>
                        {t('weather.confirmingLocation')}
                      </Text>
                    </HStack>
                  )}
                  {confirmMutation.isError && (
                    <Text fontSize="sm" color="red.500">
                      {t('weather.locationConfirmError')}
                    </Text>
                  )}
                </VStack>
              </ScrollView>
            </Modal.Body>
          </Modal.Content>
        </Modal>
      )}
    </>
  );
}

interface ForecastContentProps {
  forecast: WeatherV2Success;
  locale: string;
  textColor: string;
  mutedColor: string;
  subtleBg: string;
  accentColor: string;
}

const ForecastContent = React.memo(function ForecastContent({
  forecast,
  locale,
  textColor,
  mutedColor,
  subtleBg,
  accentColor,
}: ForecastContentProps) {
  const { t } = useTranslation();
  const current = forecast.currentHidden ? null : forecast.current;
  const timeZone = forecast.location.timezone;

  return (
    <VStack space={4}>
      {forecast.freshness === 'stale' && (
        <Text fontSize="sm" color="yellow.600">
          {t('weather.staleData')}
        </Text>
      )}

      {!current && (
        <Text fontSize="sm" color={mutedColor}>
          {forecast.currentHidden ? t('weather.currentHidden') : t('weather.currentUnavailable')}
        </Text>
      )}

      {current && (
        <VStack space={3}>
          <HStack justifyContent="space-between" alignItems="center">
            <VStack flex={1} space={1}>
              <Text fontSize="xs" fontWeight="700" color={mutedColor}>
                {t('weather.current')}
              </Text>
              <HStack alignItems="baseline" space={1}>
                <Text fontSize="4xl" fontWeight="800" color={textColor}>
                  {formatNullableNumber(current.temperatureC)}
                </Text>
                <Text fontSize="xl" color={mutedColor}>
                  °C
                </Text>
              </HStack>
              <Text fontSize="sm" color={mutedColor}>
                {t('weather.feelsLike', {
                  value: formatNullableNumber(current.apparentTemperatureC),
                })}
              </Text>
              <Text fontSize="sm" fontWeight="600" color={accentColor}>
                {t(current.conditionI18nKey)}
              </Text>
            </VStack>
            <Ionicons
              name={weatherConditionIcon(current.conditionKey)}
              size={52}
              color={resolveColor(accentColor)}
            />
          </HStack>

          <HStack space={2}>
            <WeatherMetric
              label={t('weather.humidity')}
              value={`${formatNullableNumber(current.humidityPercent)}%`}
              bg={subtleBg}
              textColor={textColor}
              mutedColor={mutedColor}
            />
            <WeatherMetric
              label={t('weather.windKph')}
              value={formatNullableNumber(current.windKph, 1)}
              bg={subtleBg}
              textColor={textColor}
              mutedColor={mutedColor}
            />
            <WeatherMetric
              label={t('weather.pressureUnit')}
              value={formatNullableNumber(current.pressureHpa)}
              bg={subtleBg}
              textColor={textColor}
              mutedColor={mutedColor}
            />
          </HStack>
        </VStack>
      )}

      <VStack space={2}>
        <Text fontSize="sm" fontWeight="700" color={textColor}>
          {t('weather.hourly72')}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <HStack space={2} pr={2}>
            {forecast.hourly.map((hour, index) => (
              <Box
                key={hour.at}
                testID={`weather-v2-hour-${index}`}
                bg={subtleBg}
                rounded="md"
                p={3}
                w="96px"
              >
                <VStack space={1} alignItems="center">
                  <Text fontSize="xs" color={mutedColor} textAlign="center">
                    {formatWeatherHour(hour.at, locale, timeZone)}
                  </Text>
                  <Ionicons
                    name={weatherConditionIcon(hour.conditionKey)}
                    size={22}
                    color={resolveColor(accentColor)}
                  />
                  <Text fontSize="lg" fontWeight="700" color={textColor}>
                    {formatNullableNumber(hour.temperatureC)}°
                  </Text>
                  <Text fontSize="xs" color={mutedColor}>
                    {t('weather.precipitation', {
                      value: formatNullableNumber(hour.precipitationProbabilityPercent),
                    })}
                  </Text>
                </VStack>
              </Box>
            ))}
          </HStack>
        </ScrollView>
      </VStack>

      <VStack space={2}>
        <Text fontSize="sm" fontWeight="700" color={textColor}>
          {t('weather.daily7')}
        </Text>
        {forecast.daily.map((day, index) => (
          <Box
            key={day.date ?? `unknown-day-${index}`}
            testID={`weather-v2-day-${index}`}
            bg={subtleBg}
            rounded="md"
            p={3}
          >
            <VStack space={1}>
              <HStack justifyContent="space-between" space={2}>
                <Text flex={1} fontSize="sm" fontWeight="600" color={textColor}>
                  {formatWeatherDay(day.date, locale)}
                </Text>
                <Text fontSize="sm" fontWeight="700" color={textColor}>
                  {formatNullableNumber(day.temperatureMaxC)}° /{' '}
                  {formatNullableNumber(day.temperatureMinC)}°
                </Text>
              </HStack>
              <HStack justifyContent="space-between" space={2}>
                <Text flex={1} fontSize="xs" color={mutedColor}>
                  {t(day.conditionI18nKey)}
                </Text>
                <Text fontSize="xs" color={mutedColor}>
                  {t('weather.precipitation', {
                    value: formatNullableNumber(day.precipitationProbabilityPercent),
                  })}
                </Text>
              </HStack>
            </VStack>
          </Box>
        ))}
      </VStack>

      <VStack space={1}>
        <Text testID="weather-v2-fetched-at" fontSize="xs" color={mutedColor}>
          {t('weather.fetchedAt', {
            value: formatWeatherDateTime(forecast.fetchedAt, locale, timeZone),
          })}
        </Text>
        <Text fontSize="xs" color={mutedColor}>
          {t('weather.source')}
        </Text>
      </VStack>
    </VStack>
  );
});

function WeatherMetric({
  label,
  value,
  bg,
  textColor,
  mutedColor,
}: {
  label: string;
  value: string;
  bg: string;
  textColor: string;
  mutedColor: string;
}) {
  return (
    <Box flex={1} bg={bg} rounded="md" p={2} alignItems="center">
      <Text fontSize="sm" fontWeight="700" color={textColor}>
        {value}
      </Text>
      <Text fontSize="xs" color={mutedColor} textAlign="center">
        {label}
      </Text>
    </Box>
  );
}
