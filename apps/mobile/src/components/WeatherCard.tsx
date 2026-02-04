import React from 'react';
import { Box, VStack, HStack, Text, useColorModeValue } from 'native-base';
import { Ionicons } from '@expo/vector-icons';
import type { TodayWeather } from '../types/Weather';

interface WeatherCardProps {
  weather: TodayWeather;
}

export const WeatherCard: React.FC<WeatherCardProps> = ({ weather }) => {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const mutedColor = useColorModeValue('gray.600', 'gray.400');
  const accentColor = useColorModeValue('brand.500', 'brand.400');

  // Map weather condition to icon
  const getWeatherIcon = (condition?: string) => {
    if (!condition) return 'partly-sunny';
    const lower = condition.toLowerCase();
    if (lower.includes('rain')) return 'rainy';
    if (lower.includes('cloud')) return 'cloudy';
    if (lower.includes('sunny') || lower.includes('clear')) return 'sunny';
    if (lower.includes('snow')) return 'snow';
    if (lower.includes('wind')) return 'flash';
    return 'partly-sunny';
  };

  return (
    <Box bg={bgColor} borderWidth={1} borderColor={borderColor} rounded="lg" p={4} mb={3}>
      <VStack space={3}>
        {/* Main weather info */}
        <HStack justifyContent="space-between" alignItems="center">
          <VStack space={1}>
            <Text fontSize="xs" fontWeight="600" color={mutedColor}>
              Weather
            </Text>
            <HStack alignItems="baseline" space={1}>
              <Text fontSize="3xl" fontWeight="bold" color={textColor}>
                {weather?.temp ? weather.temp.toFixed(0) : '—'}
              </Text>
              <Text fontSize="lg" color={mutedColor}>
                °C
              </Text>
            </HStack>
            <Text fontSize="sm" color={mutedColor}>
              Feels like {weather?.feelsLike ? weather.feelsLike.toFixed(0) : '—'}°C
            </Text>
            <Text fontSize="sm" fontWeight="500" color={accentColor}>
              {weather.condition}
            </Text>
          </VStack>

          <Box>
            <Ionicons name={getWeatherIcon(weather.condition)} size={60} color={accentColor} />
          </Box>
        </HStack>

        {/* Weather details grid */}
        <HStack space={2} justifyContent="space-between">
          {/* Humidity */}
          <Box
            flex={1}
            bg={useColorModeValue('gray.50', 'gray.900')}
            rounded="md"
            p={2}
            alignItems="center"
          >
            <Ionicons name="water" size={16} color={accentColor} />
            <Text fontSize="xs" color={mutedColor} mt={1}>
              {weather?.humidity ?? '—'}%
            </Text>
            <Text fontSize="xs" color={mutedColor}>
              Humidity
            </Text>
          </Box>

          {/* Wind */}
          <Box
            flex={1}
            bg={useColorModeValue('gray.50', 'gray.900')}
            rounded="md"
            p={2}
            alignItems="center"
          >
            <Ionicons name="cloudy-outline" size={16} color={accentColor} />
            <Text fontSize="xs" color={mutedColor} mt={1}>
              {weather?.windSpeed ? weather.windSpeed.toFixed(1) : '—'}
            </Text>
            <Text fontSize="xs" color={mutedColor}>
              m/s
            </Text>
          </Box>

          {/* Pressure */}
          <Box
            flex={1}
            bg={useColorModeValue('gray.50', 'gray.900')}
            rounded="md"
            p={2}
            alignItems="center"
          >
            <Ionicons name="git-branch" size={16} color={accentColor} />
            <Text fontSize="xs" color={mutedColor} mt={1}>
              {weather?.pressure ?? '—'}
            </Text>
            <Text fontSize="xs" color={mutedColor}>
              hPa
            </Text>
          </Box>
        </HStack>
      </VStack>
    </Box>
  );
};
